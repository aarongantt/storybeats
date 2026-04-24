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
  | 'expand-story'
  | 'what-next'
  | 'pitch';

const VALID_SCREENS: ReadonlySet<string> = new Set<Screen>([
  'welcome',
  'initial-input',
  'quick-interview',
  'format-confirmation',
  'timeline-builder',
  'expand-story',
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

  // MIGRATION: Convert old protagonist to characters array if needed
  if (!merged.characters && merged.protagonist) {
    merged.characters = [{
      id: 'main-char-1',
      role: 'main' as CharacterRole,
      name: merged.protagonist.name,
      description: merged.protagonist.description,
      wants: merged.protagonist.want,
      weaknesses: merged.protagonist.fears,
      needs: merged.protagonist.need,
      occupation: merged.protagonist.occupation,
      background: merged.protagonist.background,
      fears: merged.protagonist.fears,
      motivations: merged.protagonist.motivations,
      personality: merged.protagonist.personality,
    }];
  }

  // Merge characters array intelligently
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

  // Keep old protagonist merging for backward compatibility
  if (updates.protagonist) {
    merged.protagonist = {
      ...current.protagonist,
      ...updates.protagonist,
    };
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

  // Merge theme - prefer non-empty values, combine if both exist
  if (updates.theme) {
    if (current.theme && current.theme !== updates.theme) {
      // If both exist and differ, combine them
      merged.theme = `${current.theme}, ${updates.theme}`;
    } else {
      merged.theme = updates.theme;
    }
  }

  // Simple property updates
  if (updates.turningPoint) merged.turningPoint = updates.turningPoint;
  if (updates.endingVibe) merged.endingVibe = updates.endingVibe;

  // Handle any additional dynamic properties
  Object.keys(updates).forEach(key => {
    if (
      !['protagonist', 'world', 'conflict', 'secondaryCharacters', 'theme', 'turningPoint', 'endingVibe'].includes(key)
    ) {
      (merged as any)[key] = (updates as any)[key];
    }
  });

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
            alternativeVersions: [],
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
        interviewState: action.payload.interviewState,
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
