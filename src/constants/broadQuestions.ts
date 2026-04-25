import type { PillarKey } from '../types/story';

// Phase 1 — Foundation: broad-stroke story pillars.
export const PILLAR_ORDER: PillarKey[] = [
  'protagonist',
  'want',
  'obstacle',
  'stakes',
  'settingTime',
  'tone',
  'endingFeeling',
];

// Phase 2 — Key Dramatic Moments: turning-point questions that map directly to
// specific beats and feed beat-generation prompts as dramatic anchors.
export const TURNING_POINT_ORDER: PillarKey[] = [
  'incitingMoment',
  'pointOfCommitment',
  'midpointTwist',
  'lowestPoint',
  'transformation',
];

interface PillarDefinition {
  text: string;
  targeting: string;
  placeholder: string;
  shortLabel: string;
}

export const BROAD_QUESTIONS: Record<PillarKey, PillarDefinition> = {
  // Phase 1
  protagonist: {
    text: 'Who is your main character, at a glance?',
    targeting: 'pillar.protagonist',
    placeholder: 'e.g. Elena, a 27-year-old museum curator with a sharp eye and a complicated family.',
    shortLabel: 'Protagonist',
  },
  want: {
    text: 'What do they want more than anything?',
    targeting: 'pillar.want',
    placeholder: 'What goal drives them through the story?',
    shortLabel: 'Want',
  },
  obstacle: {
    text: "What's the biggest force standing in their way?",
    targeting: 'pillar.obstacle',
    placeholder: 'A person, institution, condition, inner flaw — anything.',
    shortLabel: 'Obstacle',
  },
  stakes: {
    text: 'What happens if they fail?',
    targeting: 'pillar.stakes',
    placeholder: 'What is lost, broken, or ended if things go wrong?',
    shortLabel: 'Stakes',
  },
  settingTime: {
    text: 'Where and when does this take place?',
    targeting: 'pillar.settingTime',
    placeholder: 'Setting, era, world, mood of the place.',
    shortLabel: 'Setting',
  },
  tone: {
    text: "What's the tone or emotional flavor?",
    targeting: 'pillar.tone',
    placeholder: 'Gritty, hopeful, surreal, darkly comic, etc.',
    shortLabel: 'Tone',
  },
  endingFeeling: {
    text: 'How do you want readers to feel at the end?',
    targeting: 'pillar.endingFeeling',
    placeholder: 'The final emotional note you want to leave them on.',
    shortLabel: 'Ending Feeling',
  },

  // Phase 2 — Key Dramatic Moments
  incitingMoment: {
    text: 'What specifically pulls them into the story they can\'t avoid?',
    targeting: 'pillar.incitingMoment',
    placeholder: 'The event that breaks their normal life — concrete, specific.',
    shortLabel: 'Inciting Moment',
  },
  pointOfCommitment: {
    text: 'What do they do that locks them in — the choice they can\'t take back?',
    targeting: 'pillar.pointOfCommitment',
    placeholder: 'The deliberate action that closes off their old life.',
    shortLabel: 'Point of Commitment',
  },
  midpointTwist: {
    text: 'What major shift or revelation hits in the middle that changes everything they thought they knew?',
    targeting: 'pillar.midpointTwist',
    placeholder: 'A truth, betrayal, or reframe that flips the story.',
    shortLabel: 'Midpoint Twist',
  },
  lowestPoint: {
    text: 'What\'s their rock bottom — the moment when all hope feels lost?',
    targeting: 'pillar.lowestPoint',
    placeholder: 'The deepest defeat before any rebound.',
    shortLabel: 'Lowest Point',
  },
  transformation: {
    text: 'How are they fundamentally different by the end?',
    targeting: 'pillar.transformation',
    placeholder: 'What they\'ve learned, lost, or become — the arc in one breath.',
    shortLabel: 'Transformation',
  },
};

// Map each pillar to the Story Bible field(s) the accepted answer should populate.
// First path is the canonical fallback when analyzeResponse misses it.
export const PILLAR_TO_BIBLE_PATH: Record<PillarKey, string[]> = {
  // Phase 1
  protagonist: ['protagonist.description', 'protagonist.name'],
  want: ['protagonist.goal', 'protagonist.want'],
  obstacle: ['conflict.mainConflict', 'conflict.antagonist'],
  stakes: ['conflict.stakes'],
  settingTime: ['world.setting', 'world.description'],
  tone: ['theme'],
  endingFeeling: ['endingVibe'],
  // Phase 2
  incitingMoment: ['inciting'],
  pointOfCommitment: ['turningPoint'],
  midpointTwist: ['midpointShift'],
  lowestPoint: ['lowestPoint'],
  transformation: ['transformation'],
};
