// Core TypeScript interfaces for StoryBeats v0.1

export type StoryFormat = 'Film' | 'TV' | 'Book' | 'Comic' | 'Play' | 'Short' | 'Vertical';

export type BeatNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type BeatStatus = 'empty' | 'incomplete' | 'complete';

export type BeatSource = 'user' | 'ai' | 'ai-with-context';

export enum BeatTitle {
  MeetTheMainCharacter = "Meet the Main Character",
  TheCharactersWorld = "The Character's World",
  TheCatalyst = "The Catalyst",
  TheDrivingConflict = "The Driving Conflict",
  AHardChoice = "A Hard Choice",
  CrossingTheLine = "Crossing the Line",
  ThingsGetMessy = "Things Get Messy",
  ATruthIsRevealed = "A Truth Is Revealed",
  EverythingStartsToFallApart = "Everything Starts to Fall Apart",
  TheLowestPoint = "The Lowest Point",
  BecomingSomeoneNew = "Becoming Someone New",
  HowItAllEnds = "How It All Ends",
}

export type OpeningFrameType = 'none' | 'prologue' | 'cold-open' | 'flash-forward' | 'in-media-res' | 'myth-legend';
export type ClosingFrameType = 'none' | 'epilogue' | 'journey-back' | 'one-year-later' | 'final-image' | 'twist-ending';

// Character hierarchy types
export type CharacterRole = 'main' | 'supporting' | 'antagonist';

export interface Character {
  id: string;
  role: CharacterRole;
  name?: string;
  description?: string;
  wants?: string;          // What they consciously desire
  weaknesses?: string;     // Their flaws/vulnerabilities
  needs?: string;          // What they actually need (may differ from wants)
  occupation?: string;
  background?: string;
  fears?: string;
  motivations?: string;
  personality?: string;
  relationshipToMain?: string; // For supporting/antagonist only
}

// Emotional intensity tracking
export type EmotionalTone = 'neutral' | 'negative' | 'positive' | 'wild-card';

export interface EmotionalDataPoint {
  beatNumber: BeatNumber;
  intensity: number;       // -10 to +10 scale (negative to positive)
  tension: number;         // 0 to 10 scale (how much conflict/stakes)
  tone: EmotionalTone;     // Which option user selected
  timestamp: string;
}

// Story health metrics
export interface StoryHealth {
  overallTension: number;           // 0-10 average tension
  emotionalVariety: number;         // 0-10 how much variety in tones
  arcConsistency: number;           // 0-10 how smooth the emotional flow
  hasProperBeginning: boolean;      // Does it start with "meet main character"
  hasClimacticMoment: boolean;      // Peak tension exists
  recommendations: string[];        // AI-generated suggestions
}

// Lightweight Story Bible (Level 1)
export interface StoryBible {
  // NEW: Character hierarchy (main/supporting/antagonist)
  characters?: Character[];

  // DEPRECATED: Keep for backward compatibility - will be migrated to characters array
  protagonist?: {
    name?: string;
    description?: string;
    goal?: string;
    want?: string;
    need?: string;
    occupation?: string;
    background?: string;
    fears?: string;
    motivations?: string;
    personality?: string;
  };
  world: {
    setting?: string;
    rules?: string[];
    description?: string;
  };
  conflict: {
    mainConflict?: string;
    antagonist?: string;
    stakes?: string;
  };
  theme?: string;
  secondaryCharacters?: Array<{
    name: string;
    role: string;
    relationship?: string;
  }>;
  turningPoint?: string;
  endingVibe?: string;
  // Additional fields from "Expand Your Story"
  [key: string]: any;
}

export interface Beat {
  id: string;
  number: BeatNumber;
  title: BeatTitle; // Backend only, NOT shown to user
  summary: string; // 2-3 sentences, shown to user
  userWritten: boolean;
  locked: boolean;
  status: BeatStatus;
  alternativeVersions: string[]; // AI suggestions history
  // NEW: Emotional tracking
  emotionalData?: EmotionalDataPoint;
  selectedTone?: EmotionalTone;
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: BeatSource;
  };
}

export interface Frame {
  type: 'opening' | 'closing';
  frameType: OpeningFrameType | ClosingFrameType;
  content: string; // narrative content
  locked: boolean;
}

export interface Timeline {
  openingFrame?: Frame;
  beats: Beat[]; // always 12
  closingFrame?: Frame;
  completeness: number; // 0-100
  storyHealth?: StoryHealth;  // NEW: Story health metrics
}

export interface PitchPackage {
  logline: string;
  shortSynopsis: string;
  onePageSynopsis: string;
  numberedOutline: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  format: StoryFormat;
  genres: string[]; // multi-select
  tones: string[]; // multi-select
  storyBible: StoryBible;
  timeline: Timeline;
  pitch?: PitchPackage;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
  };
}

export type QuestionPresentationMode = 'chips' | 'free-form';

export interface ChipOption {
  label: string;
  value: string;
}

export interface Question {
  id: string;
  text: string;
  presentationMode: QuestionPresentationMode;
  chipOptions?: ChipOption[];
  allowSurpriseMe: boolean;
  allowSkip: boolean;
  targeting: string; // Story Bible field path (e.g., "protagonist.goal")
}

export interface QuestionHistory {
  question: string;
  answer: string;
  extractedData: Partial<StoryBible>;
  timestamp: string;
}
