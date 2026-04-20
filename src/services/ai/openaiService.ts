import OpenAI from 'openai';
import type {
  StoryBible,
  Question,
  Beat,
  BeatNumber,
  BeatTitle,
  PitchPackage,
  QuestionHistory,
  EmotionalTone,
  Character,
  PillarKey,
  BeatCursor,
  InterviewPhase,
} from '../../types/story';
import { BEAT_CONTRACTS, getMissingFieldsForBeat } from '../../constants/beatContracts';
import { BROAD_QUESTIONS, PILLAR_ORDER } from '../../constants/broadQuestions';
import { withResilience } from './retry';
import {
  validateStoryBibleExtraction,
  validateAnalyzeResponse,
  validateAnswerOptions,
  validateBeatAlternatives,
  validatePitch,
  validateAutoComplete,
  validateEmotionalIntensity,
  validateCharacterHierarchy,
  validateQuestionResponse,
} from './schemas';

interface TokenUsageCallback {
  (operation: string, promptTokens: number, completionTokens: number): void;
}

interface CallJSONOptions {
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

class OpenAIService {
  private client: OpenAI | null = null;
  private tokenCallback: TokenUsageCallback | null = null;

  initialize(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  setTokenCallback(callback: TokenUsageCallback) {
    this.tokenCallback = callback;
  }

  private trackTokens(operation: string, usage: { prompt_tokens: number; completion_tokens: number } | undefined) {
    if (this.tokenCallback && usage) {
      this.tokenCallback(operation, usage.prompt_tokens, usage.completion_tokens);
    }
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please provide an API key.');
    }
    return this.client;
  }

  /**
   * Centralized JSON call with retry / timeout / validation via withResilience.
   */
  private async callJSON<T>(
    prompt: string,
    schema: (raw: unknown) => T,
    operation: string,
    opts: CallJSONOptions = {},
  ): Promise<T> {
    const client = this.ensureClient();

    return withResilience<T>(
      async (signal) => {
        const response = await client.chat.completions.create(
          {
            model: opts.model ?? 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: opts.temperature ?? 0.7,
          },
          { signal },
        );

        this.trackTokens(operation, response.usage);

        const content = response.choices[0]?.message?.content ?? '{}';
        return JSON.parse(content);
      },
      {
        operation,
        schema,
        maxAttempts: opts.maxAttempts ?? 3,
        timeoutMs: opts.timeoutMs ?? 30_000,
      },
    );
  }

  /**
   * Validate the API key. Fast-fail path — no retry.
   */
  async testApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = this.ensureClient();
      await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      return { valid: true };
    } catch (error: any) {
      console.error('API key test failed:', error);
      if (error?.status === 401) {
        return { valid: false, error: 'Invalid API key. Please check your key and try again.' };
      } else if (error?.status === 429) {
        return { valid: false, error: 'Rate limit exceeded or insufficient credits. Please check your OpenAI account billing.' };
      } else if (error?.status === 403) {
        return { valid: false, error: 'This API key does not have access to GPT-4o. Please check your OpenAI account permissions.' };
      } else if (error?.message?.includes('billing')) {
        return { valid: false, error: 'Billing issue detected. Please add payment method at platform.openai.com/account/billing' };
      }
      return { valid: false, error: `API error: ${error?.message || 'Unknown error.'}` };
    }
  }

  // ==========================================================================
  // EXTRACTION & ANALYSIS
  // ==========================================================================

  async extractStoryBible(initialInput: string): Promise<Partial<StoryBible>> {
    const prompt = `You are analyzing a user's initial story idea to extract ALL relevant structured information.

USER INPUT:
"${initialInput}"

Extract EVERY detail mentioned and return a complete JSON object:
{
  "protagonist": {
    "name": "extract if mentioned, else null",
    "description": "extract physical/personality details if mentioned",
    "goal": "extract what they want to achieve",
    "want": "extract surface desire if mentioned",
    "need": "extract deeper need if implied",
    "occupation": "extract their job/profession if mentioned",
    "background": "extract backstory/history if mentioned",
    "fears": "extract what they're afraid of if mentioned",
    "motivations": "extract what drives them if mentioned",
    "personality": "extract personality traits if mentioned"
  },
  "world": {
    "setting": "extract time/place (e.g., 'museum at night', '1920s Chicago')",
    "description": "extract unique world features",
    "rules": ["extract any world rules mentioned"]
  },
  "conflict": {
    "mainConflict": "extract the central problem/challenge",
    "antagonist": "extract who/what opposes protagonist",
    "stakes": "extract what's at risk or what happens if they fail"
  },
  "theme": "infer theme if obvious",
  "endingVibe": "infer desired ending feeling if hinted",
  "secondaryCharacters": [{"name":"...","role":"...","relationship":"..."}]
}

Omit fields that are not present in the input. Do not invent. Only capture what is actually stated or strongly implied.`;

    return this.callJSON(prompt, validateStoryBibleExtraction, 'Extract Story Bible');
  }

  async analyzeResponse(
    question: Question,
    answer: string,
    currentBible: Partial<StoryBible>,
  ): Promise<Partial<StoryBible>> {
    const prompt = `Extract ALL relevant story information from this Q&A and return fields to merge into the Story Bible.

QUESTION: ${question.text}
ANSWER: ${answer}

CURRENT STORY BIBLE (for reference only — do not repeat existing values):
${JSON.stringify(currentBible, null, 2)}

EXTRACTION RULES:
1. Extract protagonist details mentioned in the answer: name, description, goals, wants, needs, occupation, background, fears, motivations, personality
2. Extract world setting, rules, unique features
3. Extract main conflict, antagonist details, stakes
4. Extract secondary characters with their relationships
5. If the answer describes tone/mood, populate "theme"
6. If the answer describes the desired ending feeling, populate "endingVibe"
7. Return ONLY fields that should be updated or added. Omit fields not mentioned in the answer.

Return JSON with this shape (all fields optional):
{
  "protagonist": {"name":"...","description":"...","goal":"...","want":"...","need":"...","occupation":"...","background":"...","fears":"...","motivations":"...","personality":"..."},
  "world": {"setting":"...","description":"...","rules":["..."]},
  "conflict": {"mainConflict":"...","antagonist":"...","stakes":"..."},
  "theme": "...",
  "endingVibe": "...",
  "secondaryCharacters": [{"name":"...","role":"...","relationship":"..."}]
}`;

    return this.callJSON(prompt, validateAnalyzeResponse, 'Analyze Response');
  }

  // ==========================================================================
  // ANSWER / BEAT OPTION GENERATION
  // ==========================================================================

  async generateAIAnswerOptions(
    question: Question,
    storyBible: Partial<StoryBible>,
  ): Promise<string[]> {
    const prompt = `You are helping a user develop their story. Generate 4 creative answer options for this question with different tones.

QUESTION: ${question.text}

CURRENT STORY CONTEXT:
${JSON.stringify(storyBible, null, 2)}

Generate EXACTLY 4 answer options with different tones:
1. NEUTRAL: Balanced, straightforward, middle-ground
2. NEGATIVE: Darker, more conflicted, adds complications
3. POSITIVE: Lighter, more hopeful, optimistic
4. WILD-CARD: Genre-bending plot twist — surprising but coherent

All options should fit the context and be concise (1-2 sentences).

Return JSON: {"neutral":"...","negative":"...","positive":"...","wildCard":"..."}`;

    const data = await this.callJSON(prompt, validateAnswerOptions, 'Generate AI Answer Options');
    return [data.neutral, data.negative, data.positive, data.wildCard].filter((s) => s.length > 0);
  }

  async generateBeatWithContext(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[],
  ): Promise<string[]> {
    const mainCharacter = storyBible.characters?.[0] || storyBible.protagonist;
    const antagonist = storyBible.characters?.find((c) => c.role === 'antagonist');

    const prompt = `You are creating Beat #${beatNumber}: "${beatTitle}" for a story outline.

CRITICAL: You MUST use the information from the Story Bible below. Do NOT create generic scenarios.

COMPLETE STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

PREVIOUS BEATS:
${previousBeats.map((b) => `Beat ${b.number}: ${b.summary}`).join('\n\n')}

MANDATORY REQUIREMENTS:
1. Use the EXACT protagonist (name: ${mainCharacter?.name || 'the protagonist'})
2. Use the EXACT setting: ${storyBible.world?.setting || 'the world'}
3. Incorporate the main conflict: ${storyBible.conflict?.mainConflict || 'the conflict'}
4. Reference the antagonist if present: ${antagonist?.name || storyBible.conflict?.antagonist || 'the antagonist'}
5. If theme is specified (${storyBible.theme}), reflect it
6. Flow naturally from previous beats
7. Each alternative must be EXACTLY ONE SENTENCE

Generate 4 options:
1. NEUTRAL: Balanced, straightforward progression
2. NEGATIVE: Setbacks, complications, darker turn
3. POSITIVE: Progress, hope, lighter turn
4. WILD-CARD: Unexpected twist, game-changer

Return JSON: {"neutral":"...","negative":"...","positive":"...","wildCard":"..."}`;

    const data = await this.callJSON(prompt, validateBeatAlternatives, 'Generate Beat');
    return [data.neutral, data.negative, data.positive, data.wildCard].filter((s) => s.length > 0);
  }

  async regenerateBeat(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[],
  ): Promise<string[]> {
    return this.generateBeatWithContext(beatNumber, beatTitle, storyBible, previousBeats);
  }

  async generatePitch(
    storyBible: StoryBible,
    beats: Beat[],
    format: string,
  ): Promise<PitchPackage> {
    const beatsText = beats
      .filter((b) => b.status === 'complete')
      .map((b) => `Beat ${b.number}: ${b.summary}`)
      .join('\n\n');

    const prompt = `Generate a pitch package for this story.

STORY BEATS:
${beatsText}

STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

FORMAT: ${format}

Return JSON: {"logline":"...","shortSynopsis":"...","onePageSynopsis":"...","numberedOutline":"..."}`;

    const data = await this.callJSON(prompt, validatePitch, 'Generate Pitch');
    return { ...data, createdAt: new Date().toISOString() };
  }

  async autoCompleteBeats(
    beats: Beat[],
    storyBible: StoryBible,
  ): Promise<Record<number, string>> {
    const emptyBeats = beats.filter((b) => !b.summary || b.status === 'empty');
    if (emptyBeats.length === 0) return {};

    const completedBeats = beats.filter((b) => b.summary && b.status === 'complete');

    const prompt = `You are auto-completing a story outline. Generate ONE SENTENCE for each empty beat using NEUTRAL tone.

COMPLETE STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

ALREADY COMPLETED BEATS:
${completedBeats.map((b) => `Beat ${b.number}: ${b.summary}`).join('\n')}

BEATS TO COMPLETE:
${emptyBeats.map((b) => `Beat ${b.number}: ${b.title}`).join('\n')}

MANDATORY:
1. Use the EXACT protagonist name: ${storyBible.characters?.[0]?.name || storyBible.protagonist?.name || 'the protagonist'}
2. Use the EXACT setting: ${storyBible.world?.setting || 'the world'}
3. Incorporate the conflict: ${storyBible.conflict?.mainConflict || 'the conflict'}
4. Each beat = EXACTLY ONE SENTENCE
5. Neutral tone, flow from completed beats

Return JSON with beat numbers as keys: {"1":"...","5":"...","12":"..."}`;

    return this.callJSON(prompt, validateAutoComplete, 'Auto-Complete Beats');
  }

  async calculateEmotionalIntensity(
    beatSummary: string,
    selectedTone: EmotionalTone,
    beatNumber: BeatNumber,
    beatTitle: BeatTitle,
  ): Promise<{ intensity: number; tension: number }> {
    const prompt = `Analyze this story beat and determine its emotional intensity and dramatic tension.

BEAT #${beatNumber}: "${beatTitle}"
SUMMARY: ${beatSummary}
SELECTED TONE: ${selectedTone}

Return JSON: {"intensity": <-10..10>, "tension": <0..10>}

GUIDELINES:
- intensity: -10 (tragic) to +10 (triumphant), 0 neutral
- tension: 0 (calm) to 10 (life-or-death stakes)
- A scene can be positive but high tension (winning after struggle)
- A scene can be negative but low tension (quiet sadness)`;

    return this.callJSON(prompt, validateEmotionalIntensity, 'Calculate Emotional Intensity', {
      temperature: 0.3,
    });
  }

  async extractCharacterHierarchy(
    storyBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[],
  ): Promise<Character[]> {
    const prompt = `Analyze the story information and identify character hierarchy.

STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

QUESTION HISTORY:
${questionHistory.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}

Identify:
1. MAIN CHARACTER (protagonist)
2. SUPPORTING CHARACTERS (allies, mentors, friends, family)
3. ANTAGONIST (villain, opposing force)

Return JSON:
{
  "characters": [
    {"id":"main-1","role":"main","name":"...","wants":"...","weaknesses":"...","description":"...","occupation":"...","fears":"...","motivations":"...","personality":"..."}
  ]
}

Include ALL characters mentioned. For each: role is one of "main", "supporting", "antagonist".`;

    return this.callJSON(prompt, validateCharacterHierarchy, 'Extract Character Hierarchy', {
      temperature: 0.5,
    });
  }

  // ==========================================================================
  // INTERVIEW FLOW — Phase 1 (fixed pillars) + Phase 2 (beat-driven adaptive)
  // ==========================================================================

  /**
   * Master router. Called by QuickInterviewScreen. Returns the next question
   * plus the cursor advance that the caller should commit. Caller is
   * responsible for dispatching the returned `nextPhase` / cursor values to
   * state; this method is stateless.
   */
  async generateInterviewQuestion(
    phase: InterviewPhase,
    phase1Index: number,
    bible: Partial<StoryBible>,
    history: QuestionHistory[],
    beats: Beat[],
    beatCursor: BeatCursor,
  ): Promise<{
    question: Question | null;
    nextPhase: InterviewPhase;
    nextPhase1Index: number;
    nextBeatCursor: BeatCursor;
  }> {
    // Walk the phase state machine. Phase 1 never calls the AI.
    let currentPhase: InterviewPhase = phase;
    let currentIndex = phase1Index;
    let currentCursor: BeatCursor = { ...beatCursor };

    if (currentPhase === 'phase1-pillars') {
      if (currentIndex >= PILLAR_ORDER.length) {
        currentPhase = 'phase2-beats';
      } else {
        const pillar = PILLAR_ORDER[currentIndex];
        const suggestion = derivePillarSuggestion(bible, pillar);
        return {
          question: buildPillarQuestion(pillar, suggestion),
          nextPhase: 'phase1-pillars',
          nextPhase1Index: currentIndex,
          nextBeatCursor: currentCursor,
        };
      }
    }

    if (currentPhase === 'phase2-beats') {
      const phase2QuestionCount = history.filter((h) => h.phase === 'phase2-beats').length;
      if (phase2QuestionCount >= 20) {
        return {
          question: null,
          nextPhase: 'complete',
          nextPhase1Index: currentIndex,
          nextBeatCursor: currentCursor,
        };
      }

      const result = await this.generateBeatPhaseQuestion(bible, history, beats, currentCursor);
      if (!result.question) {
        return {
          question: null,
          nextPhase: 'complete',
          nextPhase1Index: currentIndex,
          nextBeatCursor: result.nextCursor,
        };
      }
      return {
        question: result.question,
        nextPhase: 'phase2-beats',
        nextPhase1Index: currentIndex,
        nextBeatCursor: result.nextCursor,
      };
    }

    return {
      question: null,
      nextPhase: 'complete',
      nextPhase1Index: currentIndex,
      nextBeatCursor: currentCursor,
    };
  }

  /**
   * Phase 2: walks beats 1..12, asking up to 3 questions per beat. Auto-skips
   * beats whose required Story Bible fields are already satisfied.
   */
  private async generateBeatPhaseQuestion(
    bible: Partial<StoryBible>,
    history: QuestionHistory[],
    beats: Beat[],
    cursor: BeatCursor,
  ): Promise<{ question: Question | null; nextCursor: BeatCursor }> {
    let c: BeatCursor = { ...cursor };

    // Walk forward through beats, skipping any with nothing left to ask.
    while (c.beatNumber <= 12) {
      const beatNumber = c.beatNumber as BeatNumber;
      const missing = getMissingFieldsForBeat(beatNumber, bible);

      if (missing.length === 0 || c.questionsAskedForBeat >= 3) {
        c = { beatNumber: c.beatNumber + 1, questionsAskedForBeat: 0 };
        continue;
      }

      const question = await this.buildBeatQuestion(
        beatNumber,
        missing[0],
        bible,
        history,
      );
      return { question, nextCursor: c };
    }

    return { question: null, nextCursor: c };
  }

  private async buildBeatQuestion(
    beatNumber: BeatNumber,
    missingField: string,
    bible: Partial<StoryBible>,
    history: QuestionHistory[],
  ): Promise<Question> {
    const contract = BEAT_CONTRACTS[beatNumber];
    const main = bible.characters?.find((c) => c.role === 'main') ?? bible.characters?.[0];
    const protagonistName = main?.name || bible.protagonist?.name || 'the protagonist';

    const recent = history
      .slice(-5)
      .map((h) => `- "${h.question}"`)
      .join('\n');

    const prompt = `You are helping flesh out Beat ${beatNumber} ("${contract.title}") of a 12-beat story outline.

This beat's purpose: ${contract.purpose}

Still missing for this beat: ${missingField}

Known so far:
- Protagonist: ${protagonistName}${main?.description ? ` (${main.description})` : ''}
- Setting: ${bible.world?.setting || 'not yet specified'}
- Main conflict: ${bible.conflict?.mainConflict || 'not yet specified'}
- Antagonist: ${bible.conflict?.antagonist || 'not yet specified'}
- Stakes: ${bible.conflict?.stakes || 'not yet specified'}

Recently asked (do not repeat or paraphrase):
${recent || '(none)'}

Ask ONE short, conversational question aimed specifically at capturing "${missingField}". Reference the protagonist by name if known. Keep it under 20 words.

Return JSON: {"question":"...","targeting":"beat-${beatNumber}:${missingField}"}`;

    const data = await this.callJSON(prompt, validateQuestionResponse, `Generate Beat ${beatNumber} Question`, {
      temperature: 0.5,
    });

    return {
      id: generateUUID(),
      text: data.question,
      presentationMode: 'free-form',
      chipOptions: undefined,
      allowSurpriseMe: true,
      allowSkip: true,
      targeting: data.targeting || `beat-${beatNumber}:${missingField}`,
      level: 2,
    };
  }
}

// ============================================================================
// PURE HELPERS (exported so screens/context can reuse them)
// ============================================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build the fixed Phase 1 question for a specific pillar. Pure — no AI call.
 */
export function buildPillarQuestion(pillar: PillarKey, suggestion: string | null): Question {
  const def = BROAD_QUESTIONS[pillar];
  return {
    id: generateUUID(),
    text: def.text,
    presentationMode: 'free-form',
    chipOptions: undefined,
    allowSurpriseMe: true,
    allowSkip: true,
    targeting: def.targeting,
    level: 1,
    pillarKey: pillar,
    suggestedAnswer: suggestion ?? undefined,
  };
}

/**
 * Derive a human-readable suggestion for a pillar from the extracted Story Bible.
 * Returns null if nothing extractable exists.
 */
export function derivePillarSuggestion(
  bible: Partial<StoryBible>,
  pillar: PillarKey,
): string | null {
  const main = bible.characters?.find((c) => c.role === 'main') ?? bible.characters?.[0];
  const protagonistName = main?.name || bible.protagonist?.name;
  const protagonistDescription = main?.description || bible.protagonist?.description;
  const protagonistOccupation = main?.occupation || bible.protagonist?.occupation;

  switch (pillar) {
    case 'protagonist': {
      const parts = [protagonistName, protagonistDescription, protagonistOccupation].filter(Boolean);
      return parts.length ? parts.join(', ') : null;
    }
    case 'want': {
      return (
        main?.wants ||
        bible.protagonist?.goal ||
        bible.protagonist?.want ||
        bible.protagonist?.need ||
        null
      );
    }
    case 'obstacle': {
      return bible.conflict?.mainConflict || bible.conflict?.antagonist || null;
    }
    case 'stakes': {
      return bible.conflict?.stakes || null;
    }
    case 'settingTime': {
      const setting = bible.world?.setting;
      const desc = bible.world?.description;
      if (setting && desc && desc.length < 120) return `${setting} — ${desc}`;
      return setting || desc || null;
    }
    case 'tone': {
      return bible.theme || null;
    }
    case 'endingFeeling': {
      return bible.endingVibe || null;
    }
    default:
      return null;
  }
}

export const openaiService = new OpenAIService();
