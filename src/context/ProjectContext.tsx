import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Project, Beat, StoryBible, Question, QuestionHistory, CharacterRole } from '../types/story';
import { storageService } from '../services/storage/localStorageService';
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

interface AppState {
  currentProject: Project | null;
  currentScreen: Screen;
  questionHistory: QuestionHistory[];
  currentQuestion: Question | null;
  questionCount: number;
  loading: boolean;
  error: string | null;
}

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
  | { type: 'INCREMENT_QUESTION_COUNT' };

const initialState: AppState = {
  currentProject: null,
  currentScreen: 'welcome',
  questionHistory: [],
  currentQuestion: null,
  questionCount: 0,
  loading: false,
  error: null,
};

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
      return { ...state, currentProject: newProject };
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
      return { ...state, currentScreen: action.payload };

    case 'SET_QUESTION':
      return { ...state, currentQuestion: action.payload };

    case 'ADD_QUESTION_HISTORY':
      return {
        ...state,
        questionHistory: [...state.questionHistory, action.payload],
      };

    case 'INCREMENT_QUESTION_COUNT':
      return { ...state, questionCount: state.questionCount + 1 };

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

  // Load project from localStorage on mount (but don't change screen - let the flow handle that)
  useEffect(() => {
    const savedProject = storageService.getCurrentProject();
    if (savedProject) {
      dispatch({ type: 'LOAD_PROJECT', payload: savedProject });
      // Don't auto-redirect - let the user flow control screen navigation
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
