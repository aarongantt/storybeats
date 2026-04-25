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

  // Phase 2 dramatic anchors — usually unset on initial extraction but allowed
  // through if the rough idea named them.
  const inciting = asString(raw.inciting);
  if (inciting) result.inciting = inciting;

  const midpointShift = asString(raw.midpointShift);
  if (midpointShift) result.midpointShift = midpointShift;

  const lowestPoint = asString(raw.lowestPoint);
  if (lowestPoint) result.lowestPoint = lowestPoint;

  const transformation = asString(raw.transformation);
  if (transformation) result.transformation = transformation;

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

export interface AutoCompleteBeat {
  summary: string;
  intensity?: number; // -10 to 10
  tension?: number; //   0 to 10
}

export function validateAutoComplete(raw: unknown): Record<number, AutoCompleteBeat> {
  if (!isObject(raw)) throw new OpenAIValidationError('Expected object for auto-complete.');
  // Tolerate both {"1": "..."} (legacy) and {"beats": {"1": {summary, intensity, tension}}} shapes.
  const source: Record<string, unknown> = isObject(raw.beats) ? raw.beats : raw;
  const result: Record<number, AutoCompleteBeat> = {};

  for (const [key, value] of Object.entries(source)) {
    const beatNumber = parseInt(key, 10);
    if (!Number.isFinite(beatNumber) || beatNumber < 1 || beatNumber > 12) continue;

    if (typeof value === 'string') {
      const text = asString(value);
      if (text) result[beatNumber] = { summary: text };
      continue;
    }

    if (isObject(value)) {
      const summary = asString(value.summary);
      if (!summary) continue;
      const intensity = asNumber(value.intensity);
      const tension = asNumber(value.tension);
      result[beatNumber] = {
        summary,
        intensity: intensity === undefined ? undefined : clamp(intensity, -10, 10),
        tension: tension === undefined ? undefined : clamp(tension, 0, 10),
      };
    }
  }

  if (Object.keys(result).length === 0) {
    throw new OpenAIValidationError('Auto-complete response contained no valid beats.');
  }
  return result;
}

export function validateStorySpine(raw: unknown): string {
  if (isObject(raw)) {
    const spine = asString(raw.spine) || asString(raw.storySpine) || asString(raw.synopsis);
    if (spine) return spine;
  }
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  throw new OpenAIValidationError('Story spine response was empty.');
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
