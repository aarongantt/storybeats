import type { PillarKey } from '../types/story';

export const PILLAR_ORDER: PillarKey[] = [
  'protagonist',
  'want',
  'obstacle',
  'stakes',
  'settingTime',
  'tone',
  'endingFeeling',
];

interface PillarDefinition {
  text: string;
  targeting: string;
  placeholder: string;
  shortLabel: string;
}

export const BROAD_QUESTIONS: Record<PillarKey, PillarDefinition> = {
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
};

// Map each pillar to the Story Bible field(s) the accepted answer should populate.
// First path in the array is the canonical fallback path when analyzeResponse
// fails to extract the value on its own.
export const PILLAR_TO_BIBLE_PATH: Record<PillarKey, string[]> = {
  protagonist: ['protagonist.description', 'protagonist.name'],
  want: ['protagonist.goal', 'protagonist.want'],
  obstacle: ['conflict.mainConflict', 'conflict.antagonist'],
  stakes: ['conflict.stakes'],
  settingTime: ['world.setting', 'world.description'],
  tone: ['theme'],
  endingFeeling: ['endingVibe'],
};
