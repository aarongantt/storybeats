// Hand-rolled response validators for OpenAI calls.
// Each validator takes `unknown` and returns a narrowed type, or throws OpenAIValidationError.

import type { StoryBible, Character, PitchPackage } from '../../types/story';
import { OpenAIValidationError } from './retry';

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function asString(x: unknown): string | undefined {
  return typeof x === 'string' && x.trim() ? x.trim() : undefined;
}

function asStringArray(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const arr = x.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return arr.length ? arr : undefined;
}

function asNumber(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface QuestionResponse {
  question: string;
  targeting?: string;
}

export function validateQuestionResponse(raw: unknown): QuestionResponse {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for question response.');
  const question = asString(raw.question);
  if (!question) throw new OpenAIValidationError('Question response missing "question" field.');
  return { question, targeting: asString(raw.targeting) };
}

export function validateStoryBibleExtraction(raw: unknown): Partial<StoryBible> {
  if (!isObject(raw)) return {};

  const result: Partial<StoryBible> = { world: {}, conflict: {} };

  if (isObject(raw.protagonist)) {
    const p = raw.protagonist;
    result.protagonist = {
      name: asString(p.name),
      description: asString(p.description),
      goal: asString(p.goal),
      want: asString(p.want),
      need: asString(p.need),
      occupation: asString(p.occupation),
      background: asString(p.background),
      fears: asString(p.fears),
      motivations: asString(p.motivations),
      personality: asString(p.personality),
    };
  }

  if (isObject(raw.world)) {
    result.world = {
      setting: asString(raw.world.setting),
      description: asString(raw.world.description),
      rules: asStringArray(raw.world.rules),
    };
  }

  if (isObject(raw.conflict)) {
    result.conflict = {
      mainConflict: asString(raw.conflict.mainConflict),
      antagonist: asString(raw.conflict.antagonist),
      stakes: asString(raw.conflict.stakes),
    };
  }

  const theme = asString(raw.theme);
  if (theme) result.theme = theme;

  const turningPoint = asString(raw.turningPoint);
  if (turningPoint) result.turningPoint = turningPoint;

  const endingVibe = asString(raw.endingVibe);
  if (endingVibe) result.endingVibe = endingVibe;

  if (Array.isArray(raw.secondaryCharacters)) {
    const chars = raw.secondaryCharacters
      .filter(isObject)
      .map((c) => ({
        name: asString(c.name) ?? '',
        role: asString(c.role) ?? '',
        relationship: asString(c.relationship),
      }))
      .filter((c) => c.name);
    if (chars.length) result.secondaryCharacters = chars;
  }

  if (Array.isArray(raw.characters)) {
    const chars = raw.characters
      .filter(isObject)
      .map((c, idx): Character | null => {
        const role = asString(c.role);
        const name = asString(c.name);
        if (!role || !['main', 'supporting', 'antagonist'].includes(role)) return null;
        return {
          id: asString(c.id) ?? `char-${Date.now()}-${idx}`,
          role: role as Character['role'],
          name,
          description: asString(c.description),
          wants: asString(c.wants),
          weaknesses: asString(c.weaknesses),
          needs: asString(c.needs),
          occupation: asString(c.occupation),
          background: asString(c.background),
          fears: asString(c.fears),
          motivations: asString(c.motivations),
          personality: asString(c.personality),
          relationshipToMain: asString(c.relationshipToMain),
        };
      })
      .filter((c): c is Character => c !== null);
    if (chars.length) result.characters = chars;
  }

  return result;
}

export function validateAnalyzeResponse(raw: unknown): Partial<StoryBible> {
  // Same shape as extraction; reuse.
  return validateStoryBibleExtraction(raw);
}

export interface AnswerOptions {
  neutral: string;
  negative: string;
  positive: string;
  wildCard: string;
}

export function validateAnswerOptions(raw: unknown): AnswerOptions {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for answer options.');
  const result = {
    neutral: asString(raw.neutral) ?? '',
    negative: asString(raw.negative) ?? '',
    positive: asString(raw.positive) ?? '',
    wildCard: asString(raw.wildCard) ?? '',
  };
  // At least one option must be non-empty.
  if (!result.neutral && !result.negative && !result.positive && !result.wildCard) {
    throw new OpenAIValidationError('Answer options were all empty.');
  }
  return result;
}

export function validateBeatAlternatives(raw: unknown): AnswerOptions {
  return validateAnswerOptions(raw);
}

export function validatePitch(raw: unknown): Omit<PitchPackage, 'createdAt'> {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for pitch response.');
  return {
    logline: asString(raw.logline) ?? '',
    shortSynopsis: asString(raw.shortSynopsis) ?? '',
    onePageSynopsis: asString(raw.onePageSynopsis) ?? '',
    numberedOutline: asString(raw.numberedOutline) ?? '',
  };
}

export function validateAutoComplete(raw: unknown): Record<number, string> {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for auto-complete.');
  const result: Record<number, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const beatNumber = parseInt(key, 10);
    const text = asString(value);
    if (Number.isFinite(beatNumber) && beatNumber >= 1 && beatNumber <= 12 && text) {
      result[beatNumber] = text;
    }
  }
  return result;
}

export interface EmotionalIntensity {
  intensity: number; // -10..10
  tension: number; //   0..10
}

export function validateEmotionalIntensity(raw: unknown): EmotionalIntensity {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for emotional intensity.');
  const intensity = asNumber(raw.intensity);
  const tension = asNumber(raw.tension);
  return {
    intensity: intensity === undefined ? 0 : clamp(intensity, -10, 10),
    tension: tension === undefined ? 5 : clamp(tension, 0, 10),
  };
}

export function validateCharacterHierarchy(raw: unknown): Character[] {
  const bible = validateStoryBibleExtraction(raw);
  return bible.characters ?? [];
}
