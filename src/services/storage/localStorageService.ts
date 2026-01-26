import type { Project } from '../../types/story';

const STORAGE_KEYS = {
  CURRENT_PROJECT: 'storybeats_current_project',
  PROJECT_LIST: 'storybeats_projects',
  USER_PREFERENCES: 'storybeats_preferences',
  OPENAI_KEY: 'storybeats_openai_key',
};

export interface UserPreferences {
  theme: 'dark' | 'light';
  apiKey?: string;
}

class LocalStorageService {
  // Project Management
  saveProject(project: Project): void {
    try {
      const projects = this.getAllProjects();
      projects[project.id] = project;
      localStorage.setItem(STORAGE_KEYS.PROJECT_LIST, JSON.stringify(projects));
      localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, project.id);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }

  getProject(id: string): Project | null {
    try {
      const projects = this.getAllProjects();
      return projects[id] || null;
    } catch (error) {
      console.error('Failed to get project:', error);
      return null;
    }
  }

  getCurrentProject(): Project | null {
    try {
      const currentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
      if (!currentProjectId) return null;
      return this.getProject(currentProjectId);
    } catch (error) {
      console.error('Failed to get current project:', error);
      return null;
    }
  }

  getAllProjects(): Record<string, Project> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECT_LIST);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get all projects:', error);
      return {};
    }
  }

  deleteProject(id: string): void {
    try {
      const projects = this.getAllProjects();
      delete projects[id];
      localStorage.setItem(STORAGE_KEYS.PROJECT_LIST, JSON.stringify(projects));

      // Clear current project if it's the one being deleted
      const currentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
      if (currentProjectId === id) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  // API Key Management
  saveApiKey(key: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OPENAI_KEY, key);
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  }

  getApiKey(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.OPENAI_KEY);
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  }

  clearApiKey(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.OPENAI_KEY);
    } catch (error) {
      console.error('Failed to clear API key:', error);
    }
  }

  // Preferences
  savePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  getPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return data ? JSON.parse(data) : { theme: 'dark' };
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return { theme: 'dark' };
    }
  }

  // Clear all data
  clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  }
}

export const storageService = new LocalStorageService();
