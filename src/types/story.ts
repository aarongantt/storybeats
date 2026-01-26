// Core TypeScript interfaces for StoryBeats v0.1

export type StoryFormat = 'Film' | 'TV' | 'Book' | 'Comic' | 'Play' | 'Short' | 'Vertical';

export type BeatNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type BeatStatus = 'empty' | 'incomplete' | 'complete';

export type BeatSource = 'user' | 'ai' | 'ai-with-context';

export enum BeatTitle {
  WhereWeBegin = "Where We Begin",
  WhatTheyWant = "What They Want",
  TheWorldAroundThem = "The World Around Them",
  SomethingGoesWrong = "Something Goes Wrong",
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

// Lightweight Story Bible (Level 1)
export interface StoryBible {
  protagonist: {
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
