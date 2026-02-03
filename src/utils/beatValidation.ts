import type { StoryBible, Beat, BeatNumber, EmotionalTone } from '../types/story';
import { BEAT_CONTRACTS } from '../constants/beatContracts';
import type { BeatContract } from '../constants/beatContracts';

/**
 * Beat completion status for a single beat
 */
export interface BeatCompletionStatus {
  beatNumber: BeatNumber;
  isComplete: boolean;
  missingRequirements: string[];
  canBeGenerated: boolean;
  dependenciesSatisfied: boolean;
}

/**
 * Validation score for a beat against its contract
 */
export interface ValidationScore {
  structuralObligation: number;  // 0-1
  requiredChange: number;         // 0-1
  directionModifier: number;      // 0-1
  overallScore: number;           // Average of above
  violations: string[];
  feedback: string;
}

/**
 * Calculate completion status for all 12 beats
 * Returns array indicating which beats are complete and which can be generated
 */
export function calculateBeatCompletionStatus(
  storyBible: Partial<StoryBible>,
  beats: Beat[]
): BeatCompletionStatus[] {
  const statuses: BeatCompletionStatus[] = [];

  for (let i = 1; i <= 12; i++) {
    const beatNumber = i as BeatNumber;
    const contract = BEAT_CONTRACTS[beatNumber];
    const beat = beats.find(b => b.number === beatNumber);

    // Check Story Bible requirements
    const missingRequirements = contract.requiredStoryBibleFields.filter(
      field => !getNestedValue(storyBible, field)
    );

    // Check if beat has content
    const hasContent = beat && beat.summary && beat.summary.length > 50;

    // Check dependencies (previous beats complete)
    const dependenciesSatisfied = contract.requiredPreviousBeats.every(
      prevBeatNum => {
        const prevBeat = beats.find(b => b.number === prevBeatNum);
        return prevBeat && prevBeat.status === 'complete';
      }
    );

    statuses.push({
      beatNumber,
      isComplete: !!(hasContent && missingRequirements.length === 0),
      missingRequirements,
      canBeGenerated: missingRequirements.length === 0 && dependenciesSatisfied,
      dependenciesSatisfied
    });
  }

  return statuses;
}

/**
 * Validate a beat against its contract using AI
 * Returns validation score with detailed feedback
 *
 * NOTE: This function makes an API call to OpenAI
 * It should be called from openaiService to maintain API key encapsulation
 */
export function buildBeatValidationPrompt(
  beat: Beat,
  storyBible: Partial<StoryBible>,
  direction: EmotionalTone
): string {
  const contract = BEAT_CONTRACTS[beat.number];

  return `
You are validating a story beat against structural requirements.

**Beat Number:** ${beat.number}
**Beat Title:** ${contract.title}
**Beat Content:**
${beat.summary}

**Structural Obligation:**
${contract.structuralObligation}

**Required Change:**
Before: ${contract.requiredChange.before}
After: ${contract.requiredChange.after}

**Direction Modifier (${direction}):**
${contract.directionModifiers[direction]}

**Must Not Include:** ${contract.mustNotInclude.join(', ') || 'None'}
**Must Not Resolve:** ${contract.mustNotResolve.join(', ') || 'None'}

Score each dimension 0-1:
1. **Structural Obligation**: Does the beat fulfill its purpose?
2. **Required Change**: Does the before/after state exist?
3. **Direction Modifier**: Does the tone match the selected direction?

Return JSON:
{
  "structuralObligation": <0-1 score>,
  "requiredChange": <0-1 score>,
  "directionModifier": <0-1 score>,
  "violations": [<list of issues>],
  "feedback": "<brief explanation>"
}
`;
}

/**
 * Parse validation response from AI
 */
export function parseValidationResponse(response: string): ValidationScore {
  try {
    const result = JSON.parse(response);

    return {
      structuralObligation: result.structuralObligation || 0,
      requiredChange: result.requiredChange || 0,
      directionModifier: result.directionModifier || 0,
      overallScore: (
        (result.structuralObligation || 0) +
        (result.requiredChange || 0) +
        (result.directionModifier || 0)
      ) / 3,
      violations: result.violations || [],
      feedback: result.feedback || ''
    };
  } catch (error) {
    console.error('Beat validation parsing failed:', error);
    return {
      structuralObligation: 0,
      requiredChange: 0,
      directionModifier: 0,
      overallScore: 0,
      violations: ['Validation parsing failed'],
      feedback: 'Could not parse validation response'
    };
  }
}

/**
 * Check if logline is complete (all 4 components present)
 * Used to determine if Level 1 is complete
 */
export function isLoglineComplete(storyBible: Partial<StoryBible>): boolean {
  const hasProtagonist = !!(
    storyBible.protagonist?.name &&
    storyBible.protagonist?.description
  );
  const hasGoal = !!(
    storyBible.protagonist?.goal ||
    storyBible.protagonist?.want ||
    storyBible.protagonist?.need
  );
  const hasObstacle = !!(
    storyBible.conflict?.mainConflict ||
    storyBible.conflict?.antagonist
  );
  const hasStakes = !!storyBible.conflict?.stakes;

  return hasProtagonist && hasGoal && hasObstacle && hasStakes;
}

/**
 * Get logline component status (for Level 1 progress indicator)
 */
export interface LoglineComponentStatus {
  protagonist: boolean;
  goal: boolean;
  obstacle: boolean;
  stakes: boolean;
}

export function getLoglineComponentStatus(
  storyBible: Partial<StoryBible>
): LoglineComponentStatus {
  return {
    protagonist: !!(
      storyBible.protagonist?.name &&
      storyBible.protagonist?.description
    ),
    goal: !!(
      storyBible.protagonist?.goal ||
      storyBible.protagonist?.want ||
      storyBible.protagonist?.need
    ),
    obstacle: !!(
      storyBible.conflict?.mainConflict ||
      storyBible.conflict?.antagonist
    ),
    stakes: !!storyBible.conflict?.stakes
  };
}

/**
 * Helper: Get nested value from object by path
 * Supports paths like "protagonist.name", "conflict.mainConflict", etc.
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj);
}

/**
 * Helper: Set nested value in object by path
 * Used for updating Story Bible from question answers
 */
export function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return obj;

  let current = obj;
  for (const key of keys) {
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
  return obj;
}
