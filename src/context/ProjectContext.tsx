import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type {
  Project,
  Beat,
  StoryBible,
  Question,
  QuestionHistory,
  CharacterRole,
  InterviewState,
  SuggestedAnswer,
  PillarKey,
  BeatCursor,
  InterviewPhase,
} from '../types/story';
import { storageService, type InterviewBlob } from '../services/storage/localStorageService';
import { BeatTitle } from '../types/story';

export type Screen =
  | 'welcome'
  | 'initial-input'
  | 'quick-interview'
  | 'format-confirmation'
  | 'timeline-builder'
  | 'what-next'
  | 'pitch';

const VALID_SCREENS: ReadonlySet<string> = new Set<Screen>([
  'welcome',
  'initial-input',
  'quick-interview',
  'format-confirmation',
  'timeline-builder',
  'what-next',
  'pitch',
]);

function isValidScreen(value: string): value is Screen {
  return VALID_SCREENS.has(value);
}

interface AppState {
  currentProject: Project | null;
  currentScreen: Screen;
  questionHistory: QuestionHistory[];
  currentQuestion: Question | null;
  questionCount: number;
  interviewState: InterviewState;
  loading: boolean;
  error: string | null;
}

export const FRESH_INTERVIEW_STATE: InterviewState = {
  phase: 'phase1-pillars',
  phase1Index: 0,
  phase2Index: 0,
  beatCursor: { beatNumber: 1, questionsAskedForBeat: 0 },
  suggestedAnswers: {},
  lastError: null,
};

// Deep merge helper for Story Bible to accumulate data instead of overwriting
export function deepMergeStoryBible(
  current: StoryBible,
  updates: Partial<StoryBible>
): StoryBible {
  const merged: StoryBible = { ...current };

  // Merge characters array intelligently (must run BEFORE the migration so
  // updates targeting characters land before we sync from protagonist).
  if (updates.characters) {
    const existingChars = merged.characters || [];
    const updatedChars = updates.characters;

    const mergedChars = [...existingChars];

    for (const newChar of updatedChars) {
      const existingIndex = mergedChars.findIndex(c =>
        c.id === newChar.id ||
        (c.role === newChar.role && c.role !== 'supporting') // Match main/antagonist by role
      );

      if (existingIndex >= 0) {
        // Deep merge existing character
        mergedChars[existingIndex] = {
          ...mergedChars[existingIndex],
          ...newChar,
          // Preserve non-empty fields from existing
          name: newChar.name || mergedChars[existingIndex].name,
          wants: newChar.wants || mergedChars[existingIndex].wants,
          weaknesses: newChar.weaknesses || mergedChars[existingIndex].weaknesses,
        };
      } else {
        // Add new character
        mergedChars.push(newChar);
      }
    }

    merged.characters = mergedChars;
  }

  // Merge old-shape protagonist updates.
  if (updates.protagonist) {
    merged.protagonist = {
      ...current.protagonist,
      ...updates.protagonist,
    };
  }

  // Bootstrap a main character from the protagonist record when we have
  // meaningful data and no character row yet. Empty `{}` (initial state)
  // does NOT trigger this — only real protagonist data does.
  const hasProtagonistData = !!(
    merged.protagonist &&
    (merged.protagonist.name ||
      (merged.protagonist.description && merged.protagonist.description.length > 0) ||
      merged.protagonist.occupation)
  );
  if (!merged.characters && hasProtagonistData && merged.protagonist) {
    merged.characters = [
      {
        id: 'main-char-1',
        role: 'main' as CharacterRole,
        name: merged.protagonist.name,
        description: merged.protagonist.description,
        wants: merged.protagonist.want || merged.protagonist.goal,
        needs: merged.protagonist.need,
        occupation: merged.protagonist.occupation,
        background: merged.protagonist.background,
        fears: merged.protagonist.fears,
        motivations: merged.protagonist.motivations,
        personality: merged.protagonist.personality,
        // weaknesses left undefined — extracted later by character hierarchy
      },
    ];
  }

  // Sync protagonist edits down to characters[0] so the two views can never
  // drift. Specifically: when the name follow-up writes protagonist.name,
  // the main character must reflect that name immediately.
  if (updates.protagonist && merged.characters && merged.characters.length > 0) {
    const mainIndex = merged.characters.findIndex((c) => c.role === 'main');
    if (mainIndex >= 0) {
      const main = merged.characters[mainIndex];
      const synced = {
        ...main,
        name: updates.protagonist.name || main.name,
        description: updates.protagonist.description || main.description,
        occupation: updates.protagonist.occupation || main.occupation,
        background: updates.protagonist.background || main.background,
        fears: updates.protagonist.fears || main.fears,
        motivations: updates.protagonist.motivations || main.motivations,
        personality: updates.protagonist.personality || main.personality,
        wants: updates.protagonist.goal || updates.protagonist.want || main.wants,
        needs: updates.protagonist.need || main.needs,
      };
      merged.characters = [
        ...merged.characters.slice(0, mainIndex),
        synced,
        ...merged.characters.slice(mainIndex + 1),
      ];
    }
  }

  // Merge world object deeply, accumulating rules array
  if (updates.world) {
    merged.world = {
      ...current.world,
      ...updates.world,
    };

    // Accumulate rules array (avoid duplicates)
    if (updates.world.rules && Array.isArray(updates.world.rules)) {
      const existingRules = current.world?.rules || [];
      const newRules = updates.world.rules;
      merged.world.rules = [
        ...existingRules,
        ...newRules.filter(rule => !existingRules.includes(rule)),
      ];
    }
  }

  // Merge conflict object deeply
  if (updates.conflict) {
    merged.conflict = {
      ...current.conflict,
      ...updates.conflict,
    };
  }

  // Accumulate secondaryCharacters array (avoid duplicate names)
  if (updates.secondaryCharacters && Array.isArray(updates.secondaryCharacters)) {
    const existingChars = current.secondaryCharacters || [];
    const newChars = updates.secondaryCharacters;
    const existingNames = new Set(
      existingChars
        .filter(c => c.name)
        .map(c => c.name.toLowerCase())
    );

    merged.secondaryCharacters = [
      ...existingChars,
      ...newChars.filter(char => char.name && !existingNames.has(char.name.toLowerCase())),
    ];
  }

  // Merge theme — tokenize, dedupe (case-insensitive), recombine. Avoids
  // "dark, dark, hopeful, dark" snowball when the user re-answers the tone
  // pillar multiple times.
  if (updates.theme) {
    const toTokens = (s: string) =>
      s
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of [...toTokens(current.theme || ''), ...toTokens(updates.theme)]) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(t);
      }
    }
    merged.theme = out.length ? out.join(', ') : undefined;
  }

  // Simple property updates
  if (updates.turningPoint) merged.turningPoint = updates.turningPoint;
  if (updates.endingVibe) merged.endingVibe = updates.endingVibe;
  if (updates.inciting) merged.inciting = updates.inciting;
  if (updates.midpointShift) merged.midpointShift = updates.midpointShift;
  if (updates.lowestPoint) merged.lowestPoint = updates.lowestPoint;
  if (updates.transformation) merged.transformation = updates.transformation;
  // (No catch-all anymore — StoryBible no longer has an `[key]: any` index
  // signature. Add new known fields explicitly above.)

  return merged;
}

type AppAction =
  | { type: 'CREATE_PROJECT'; payload: Partial<Project> }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> }
  | { type: 'UPDATE_STORY_BIBLE'; payload: Partial<StoryBible> }
  | { type: 'UPDATE_BEAT'; payload: { beatNumber: number; beat: Partial<Beat> } }
  | { type: 'SET_SCREEN'; payload: Screen }
  | { type: 'SET_QUESTION'; payload: Question | null }
  | { type: 'ADD_QUESTION_HISTORY'; payload: QuestionHistory }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_PROJECT'; payload: Project }
  | { type: 'INCREMENT_QUESTION_COUNT' }
  | { type: 'SET_INTERVIEW_STATE'; payload: Partial<InterviewState> }
  | { type: 'SET_SUGGESTED_ANSWERS'; payload: Partial<Record<PillarKey, SuggestedAnswer>> }
  | { type: 'ADVANCE_PHASE1' }
  | { type: 'ADVANCE_PHASE2' }
  | { type: 'ADVANCE_BEAT_CURSOR'; payload?: BeatCursor }
  | { type: 'INCREMENT_BEAT_QUESTIONS' }
  | { type: 'SET_PHASE'; payload: InterviewPhase }
  | { type: 'RESET_INTERVIEW' }
  | { type: 'RESTORE_INTERVIEW'; payload: InterviewBlob };

const initialState: AppState = {
  currentProject: null,
  currentScreen: 'welcome',
  questionHistory: [],
  currentQuestion: null,
  questionCount: 0,
  interviewState: FRESH_INTERVIEW_STATE,
  loading: false,
  error: null,
};

function persistInterview(projectId: string | undefined, state: AppState): void {
  if (!projectId) return;
  storageService.saveInterview(projectId, {
    interviewState: state.interviewState,
    questionHistory: state.questionHistory,
    currentQuestion: state.currentQuestion,
    questionCount: state.questionCount,
    savedAt: new Date().toISOString(),
  });
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CREATE_PROJECT': {
      const newProject: Project = {
        id: `project-${Date.now()}`,
        title: 'Untitled Story',
        format: 'Film',
        genres: [],
        tones: [],
        storyBible: {
          protagonist: {},
          world: {},
          conflict: {},
        },
        timeline: {
          beats: Array.from({ length: 12 }, (_, i) => ({
            id: `beat-${i + 1}`,
            number: (i + 1) as any,
            title: Object.values(BeatTitle)[i],
            summary: '',
            userWritten: false,
            locked: false,
            status: 'empty' as const,
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'user' as const,
            },
          })),
          completeness: 0,
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '0.1.0',
        },
        ...action.payload,
      };
      storageService.saveProject(newProject);
      // Reset interview state for the new project.
      const nextState: AppState = {
        ...state,
        currentProject: newProject,
        questionHistory: [],
        currentQuestion: null,
        questionCount: 0,
        interviewState: FRESH_INTERVIEW_STATE,
        error: null,
      };
      persistInterview(newProject.id, nextState);
      return nextState;
    }

    case 'UPDATE_PROJECT': {
      if (!state.currentProject) return state;
      const updated = { ...state.currentProject, ...action.payload };
      storageService.saveProject(updated);
      return { ...state, currentProject: updated };
    }

    case 'UPDATE_STORY_BIBLE': {
      if (!state.currentProject) return state;
      const updated = {
        ...state.currentProject,
        storyBible: deepMergeStoryBible(
          state.currentProject.storyBible,
          action.payload
        ),
      };
      storageService.saveProject(updated);
      return { ...state, currentProject: updated };
    }

    case 'UPDATE_BEAT': {
      if (!state.currentProject) return state;
      const beats = [...state.currentProject.timeline.beats];
      const index = beats.findIndex(b => b.number === action.payload.beatNumber);
      if (index === -1) return state;

      beats[index] = { ...beats[index], ...action.payload.beat };
      const updated = {
        ...state.currentProject,
        timeline: { ...state.currentProject.timeline, beats },
      };
      storageService.saveProject(updated);
      return { ...state, currentProject: updated };
    }

    case 'SET_SCREEN':
      storageService.saveCurrentScreen(action.payload);
      return { ...state, currentScreen: action.payload };

    case 'SET_QUESTION': {
      const next = { ...state, currentQuestion: action.payload };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'ADD_QUESTION_HISTORY': {
      const next = {
        ...state,
        questionHistory: [...state.questionHistory, action.payload],
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'INCREMENT_QUESTION_COUNT': {
      const next = { ...state, questionCount: state.questionCount + 1 };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'SET_INTERVIEW_STATE': {
      const next = {
        ...state,
        interviewState: { ...state.interviewState, ...action.payload },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'SET_SUGGESTED_ANSWERS': {
      const next = {
        ...state,
        interviewState: {
          ...state.interviewState,
          suggestedAnswers: { ...state.interviewState.suggestedAnswers, ...action.payload },
        },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'ADVANCE_PHASE1': {
      const next = {
        ...state,
        interviewState: {
          ...state.interviewState,
          phase1Index: state.interviewState.phase1Index + 1,
        },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'ADVANCE_PHASE2': {
      const next = {
        ...state,
        interviewState: {
          ...state.interviewState,
          phase2Index: state.interviewState.phase2Index + 1,
        },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'ADVANCE_BEAT_CURSOR': {
      const newCursor =
        action.payload ?? {
          beatNumber: state.interviewState.beatCursor.beatNumber + 1,
          questionsAskedForBeat: 0,
        };
      const next = {
        ...state,
        interviewState: { ...state.interviewState, beatCursor: newCursor },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'INCREMENT_BEAT_QUESTIONS': {
      const next = {
        ...state,
        interviewState: {
          ...state.interviewState,
          beatCursor: {
            ...state.interviewState.beatCursor,
            questionsAskedForBeat: state.interviewState.beatCursor.questionsAskedForBeat + 1,
          },
        },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'SET_PHASE': {
      const next = {
        ...state,
        interviewState: { ...state.interviewState, phase: action.payload },
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'RESET_INTERVIEW': {
      const next = {
        ...state,
        questionHistory: [],
        currentQuestion: null,
        questionCount: 0,
        interviewState: FRESH_INTERVIEW_STATE,
      };
      persistInterview(state.currentProject?.id, next);
      return next;
    }

    case 'RESTORE_INTERVIEW':
      return {
        ...state,
        interviewState: {
          // Defensive defaults for fields that may be missing on legacy blobs.
          phase: action.payload.interviewState.phase ?? 'phase1-pillars',
          phase1Index: action.payload.interviewState.phase1Index ?? 0,
          phase2Index: action.payload.interviewState.phase2Index ?? 0,
          beatCursor:
            action.payload.interviewState.beatCursor ?? FRESH_INTERVIEW_STATE.beatCursor,
          suggestedAnswers: action.payload.interviewState.suggestedAnswers ?? {},
          lastError: action.payload.interviewState.lastError ?? null,
        },
        questionHistory: action.payload.questionHistory,
        currentQuestion: action.payload.currentQuestion,
        questionCount: action.payload.questionCount,
      };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LOAD_PROJECT':
      return { ...state, currentProject: action.payload };

    default:
      return state;
  }
}

const ProjectContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load project + interview state + last screen from localStorage on mount.
  useEffect(() => {
    const savedProject = storageService.getCurrentProject();
    if (savedProject) {
      dispatch({ type: 'LOAD_PROJECT', payload: savedProject });
      const savedInterview = storageService.getInterview(savedProject.id);
      if (savedInterview) {
        dispatch({ type: 'RESTORE_INTERVIEW', payload: savedInterview });
      }
    }
    const savedScreen = storageService.getCurrentScreen();
    if (savedScreen && isValidScreen(savedScreen)) {
      dispatch({ type: 'SET_SCREEN', payload: savedScreen });
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ state, dispatch }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
}
