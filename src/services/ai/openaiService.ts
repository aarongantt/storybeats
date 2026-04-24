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
import { PILLAR_ORDER } from '../../constants/broadQuestions';
import { BROAD_QUESTIONS } from '../../constants/broadQuestions';
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
  validateStorySpine,
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
    const prompt = `Extract structured story data from this user's rough idea. Return JSON matching the schema below.

USER INPUT:
"""
${initialInput}
"""

CRITICAL FIELD DISTINCTIONS — read carefully, these are where extractors usually fail:

protagonist.goal — a SHORT, SPECIFIC clause describing what the protagonist wants at their core.
  GOOD: "survive the night", "protect the artifact", "clear his name", "find his daughter"
  BAD:  "combat a group of thieves and later work with them to fight a spirit" (that is PLOT, not a want)
  BAD:  multi-clause summaries, anything with "and later", "then", "before", "so that"
  If the story has multiple central actors with competing wants, pick the ONE most primal want for the main character only — the character whose decisions drive the story.

protagonist.want — surface desire. Skip this field if it's identical to goal.
protagonist.need — deeper, often-unconscious need. Leave blank unless the input clearly implies one.

conflict.mainConflict — the central external OPPOSITION, described in one sentence. Include the antagonist's goal if that's what creates the opposition.
  GOOD: "a team of sophisticated thieves are trying to steal the artifact the guard is sworn to protect"
  GOOD: "an ancient spirit has been awakened and is hunting everyone in the museum"
  If there are multiple opposing forces (rival thieves AND a supernatural threat), you MAY combine them in a single sentence.

conflict.antagonist — the PRIMARY opposing force (name or label). Pick one — the most persistent antagonistic presence.

conflict.stakes — what is LOST if the protagonist fails. Short clause.
  GOOD: "his life", "the artifact is stolen and the spirit is unleashed on the city"
  BAD:  hopes, feelings, plot events

world.setting — where and when, one phrase. "A museum at night", "1920s Chicago", "a generation ship adrift".
world.description — notable unique features, one sentence. Optional.
world.rules — any explicit rules of the world. Array. Optional.

theme — emotional flavor / tonal signature. "tense, claustrophobic, darkly comic". Leave blank if not clearly implied.
endingVibe — how the reader should FEEL at the end. Leave blank unless explicitly stated.

PROTAGONIST SELECTION — if the input describes multiple main actors (e.g. a guard AND a team of thieves), choose the one whose POV drives the story. That is usually the character the narrator follows, or the first-named character in the setup.

Return JSON. Omit fields you cannot extract. Do NOT invent. Here is the shape:
{
  "protagonist": {
    "name": "...", "description": "...", "goal": "<short want clause>",
    "occupation": "...", "background": "...", "fears": "...", "motivations": "...", "personality": "..."
  },
  "world": { "setting": "...", "description": "...", "rules": ["..."] },
  "conflict": { "mainConflict": "...", "antagonist": "...", "stakes": "..." },
  "theme": "...",
  "endingVibe": "...",
  "secondaryCharacters": [{"name":"...","role":"...","relationship":"..."}]
}`;

    return this.callJSON(prompt, validateStoryBibleExtraction, 'Extract Story Bible', { temperature: 0.4 });
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
    followingBeats: Beat[] = [],
    storySpine?: string,
  ): Promise<string[]> {
    const mainCharacter = storyBible.characters?.[0] || storyBible.protagonist;
    const antagonist = storyBible.characters?.find((c) => c.role === 'antagonist');
    const prevLast = previousBeats.length > 0 ? previousBeats[previousBeats.length - 1] : null;

    const prompt = `You are writing Beat #${beatNumber} ("${beatTitle}") of a 12-beat story outline. Your job is to keep the narrative flowing — this beat must read as a causal continuation of what came before and a causal setup for what comes after.

${storySpine ? `STORY SPINE (the causal backbone — respect it):\n${storySpine}\n\n` : ''}STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

PREVIOUS BEATS (in order):
${previousBeats.length ? previousBeats.map((b) => `Beat ${b.number}: ${b.summary}`).join('\n\n') : '(none yet)'}
${prevLast ? `\nImmediately prior ending: "${prevLast.summary.split(/(?<=[.!?])\s+/).slice(-1)[0]}"` : ''}

UPCOMING BEATS (your beat must set these up, do not invalidate them):
${followingBeats.length ? followingBeats.map((b) => `Beat ${b.number}: ${b.summary || '(not yet written)'}`).join('\n\n') : '(none yet)'}

CONTINUITY RULES (CRITICAL):
- Begin by referencing a specific element (character decision, object, emotion, or location) from the previous beat.
- End with a consequence, decision, or question that the NEXT beat can pick up.
- Do NOT re-introduce the protagonist — assume the reader has met them.
- Use the protagonist's EXACT name (${mainCharacter?.name || 'the protagonist'}) and specifics (setting: ${storyBible.world?.setting || 'established'}, antagonist: ${antagonist?.name || storyBible.conflict?.antagonist || 'established'}).
- Each option should be 2–3 sentences. Write with narrative momentum, not as a summary bullet.

Generate 4 options with different tonal choices:
1. NEUTRAL: Balanced progression, the default path
2. NEGATIVE: Setbacks, complications, darker turn
3. POSITIVE: Progress, hope, lighter turn
4. WILD-CARD: Unexpected twist, still grounded in the spine

Return JSON: {"neutral":"...","negative":"...","positive":"...","wildCard":"..."}`;

    const data = await this.callJSON(prompt, validateBeatAlternatives, `Generate Beat ${beatNumber}`);
    return [data.neutral, data.negative, data.positive, data.wildCard].filter((s) => s.length > 0);
  }

  async regenerateBeat(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[],
    followingBeats: Beat[] = [],
    storySpine?: string,
  ): Promise<string[]> {
    return this.generateBeatWithContext(
      beatNumber,
      beatTitle,
      storyBible,
      previousBeats,
      followingBeats,
      storySpine,
    );
  }

  /**
   * Generate a 5–7 sentence "story spine" — the causal backbone of the story.
   * This is the Dramatron / Sudowrite Story Engine pattern: derive a synopsis
   * before the beats so each beat has a shared narrative target.
   */
  async generateStorySpine(storyBible: StoryBible, format?: string): Promise<string> {
    const main = storyBible.characters?.find((c) => c.role === 'main') ?? storyBible.characters?.[0];
    const mainName = main?.name || storyBible.protagonist?.name || 'the protagonist';

    const prompt = `Write a story spine: the causal backbone of this story in 5-7 sentences. Each sentence must flow from the previous. Use the Pixar "Once upon a time / Every day / Until one day / Because of that / Because of that / Until finally / Ever since" scaffold as a guide (you can drop or rearrange beats), but output prose, not labeled lines.

STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

${format ? `FORMAT: ${format}\n` : ''}REQUIREMENTS:
- Use ${mainName} by name.
- Establish the setting in the first sentence.
- The middle sentences must escalate: each sentence describes a cause or consequence of the previous one.
- The final sentence must land on the emotional ending the user intends (${storyBible.endingVibe || 'resolution'}).
- No bullet points. No labels. Just flowing prose.
- 5 to 7 sentences. Concise, specific, evocative.

Return JSON: {"spine":"<the prose spine>"}`;

    return this.callJSON(prompt, validateStorySpine, 'Generate Story Spine', { temperature: 0.8 });
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

  /**
   * Generate every empty, non-locked beat in ONE call, using the story spine
   * and any existing/locked beats as fixed waypoints. Each beat references the
   * previous one explicitly so the final outline reads as a continuous arc.
   */
  async autoCompleteBeats(
    beats: Beat[],
    storyBible: StoryBible,
    storySpine?: string,
  ): Promise<Record<number, string>> {
    // Locked beats and beats the user explicitly completed are treated as canon.
    const fixed = beats.filter((b) => b.locked || (b.summary && b.status === 'complete'));
    const toGenerate = beats.filter((b) => !b.locked && (!b.summary || b.status === 'empty' || b.status === 'incomplete'));
    if (toGenerate.length === 0) return {};

    const main = storyBible.characters?.find((c) => c.role === 'main') ?? storyBible.characters?.[0];
    const mainName = main?.name || storyBible.protagonist?.name || 'the protagonist';
    const antagonist = storyBible.characters?.find((c) => c.role === 'antagonist');
    const antagonistName = antagonist?.name || storyBible.conflict?.antagonist;

    const beatSkeleton = beats
      .map((b) => {
        const isFixed = fixed.some((f) => f.number === b.number);
        if (isFixed) return `Beat ${b.number} — "${b.title}" [CANON, DO NOT CHANGE]: ${b.summary}`;
        return `Beat ${b.number} — "${b.title}" [GENERATE]`;
      })
      .join('\n');

    const prompt = `You are drafting a 12-beat story outline that reads as one continuous narrative, not 12 disconnected bullets. A reader should be able to read beats 1-12 in order and feel a single escalating arc.

${storySpine ? `STORY SPINE (the causal backbone — every beat must honor it):\n${storySpine}\n\n` : ''}STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

BEAT MAP (CANON beats are fixed — write around them; GENERATE beats are yours):
${beatSkeleton}

HARD RULES — each generated beat MUST:
1. Reference a specific element (decision, object, relationship, emotion, or location) from the IMMEDIATELY PREVIOUS beat. Do not start "fresh" in any beat after beat 1.
2. End with a consequence or question that the NEXT beat can pick up.
3. Use ${mainName} by name; do not re-introduce them.
${antagonistName ? `4. Reference ${antagonistName} or the main conflict ("${storyBible.conflict?.mainConflict ?? 'the conflict'}") where structurally appropriate.` : ''}
5. Be 2-3 sentences. Specific. Concrete. Written with narrative momentum, not as a label.
6. Respect the beat's narrative job (e.g. Beat 3 is the catalyst, Beat 10 is the lowest point, Beat 12 is resolution).
7. Never invalidate or restart a CANON beat.

TONE: Neutral — balanced, grounded. The user will regenerate individual beats later if they want a different direction.

Return JSON:
{
  "beats": {
    ${toGenerate.map((b) => `"${b.number}": "<beat ${b.number} prose, 2-3 sentences>"`).join(',\n    ')}
  }
}`;

    return this.callJSON(prompt, validateAutoComplete, 'Auto-Complete Beats', {
      temperature: 0.75,
      timeoutMs: 60_000, // single call covers up to 12 beats — allow longer.
    });
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
      // Walk pillars in order. Skip any we already have a confident
      // extraction for; only ask the gaps. If the user previously skipped a
      // pillar (no extracted answer either), we respect that via the stored
      // phase1Index, which has already advanced past it.
      let i = currentIndex;
      while (i < PILLAR_ORDER.length) {
        const pillar = PILLAR_ORDER[i];
        if (hasConfidentAnswer(bible, pillar)) {
          i++;
          continue;
        }
        const suggestion = derivePillarSuggestion(bible, pillar);
        return {
          question: buildPillarQuestion(pillar, suggestion, bible),
          nextPhase: 'phase1-pillars',
          nextPhase1Index: i,
          nextBeatCursor: currentCursor,
        };
      }
      // All pillars either extracted or skipped — we have enough to draft.
      currentPhase = 'complete';
      currentIndex = i;
    }

    // Suppress unused var warnings when Phase 2 is disabled.
    void history;
    void beats;

    return {
      question: null,
      nextPhase: 'complete',
      nextPhase1Index: currentIndex,
      nextBeatCursor: currentCursor,
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

// Plot-event markers — if the extracted "want" contains these, it's almost
// certainly a plot summary masquerading as a want, so we treat the pillar as
// still open and ask the user.
const PLOT_MARKERS = [
  ' and later ',
  ' and then ',
  ' then ',
  ' before ',
  ' after ',
  ' in order to ',
  ' so that ',
  ' eventually ',
  ' finally ',
  ' when they ',
];

function looksLikePlot(s: string): boolean {
  const lower = s.toLowerCase();
  return PLOT_MARKERS.some((m) => lower.includes(m));
}

/**
 * Return true if we already have a usable extraction for this pillar and can
 * skip asking the user. "Usable" = non-empty and not a plot paragraph.
 *
 * Note: for the protagonist pillar, "confident" = we have BOTH a name AND a
 * description/occupation. If we have the role but no name, the interview
 * should ask a targeted name follow-up (see protagonistNameIsMissing).
 */
export function hasConfidentAnswer(bible: Partial<StoryBible>, pillar: PillarKey): boolean {
  const main = bible.characters?.find((c) => c.role === 'main') ?? bible.characters?.[0];

  switch (pillar) {
    case 'protagonist': {
      const name = main?.name || bible.protagonist?.name;
      const desc = main?.description || bible.protagonist?.description;
      const occ = main?.occupation || bible.protagonist?.occupation;
      return !!(name && (desc || occ));
    }
    case 'want': {
      const v =
        main?.wants ||
        bible.protagonist?.goal ||
        bible.protagonist?.want ||
        bible.protagonist?.need;
      if (!v || v.length < 3) return false;
      if (looksLikePlot(v)) return false;
      return true;
    }
    case 'obstacle': {
      const conflict = bible.conflict?.mainConflict;
      const antagonist = bible.conflict?.antagonist;
      return !!(conflict && conflict.length >= 5) || !!(antagonist && antagonist.length >= 2);
    }
    case 'stakes': {
      const v = bible.conflict?.stakes;
      return !!(v && v.length >= 3);
    }
    case 'settingTime': {
      const v = bible.world?.setting;
      return !!(v && v.length >= 3);
    }
    case 'tone': {
      const v = bible.theme;
      return !!(v && v.length >= 3);
    }
    case 'endingFeeling': {
      const v = bible.endingVibe;
      return !!(v && v.length >= 3);
    }
    default:
      return false;
  }
}

/**
 * Produce a short, human subject label for the protagonist from whatever we
 * know. Used to ground pillar question text — e.g. "What does Marcus want?"
 * instead of the pronoun-vague "What do they want?"
 */
export function protagonistLabel(bible: Partial<StoryBible>): string {
  const main = bible.characters?.find((c) => c.role === 'main') ?? bible.characters?.[0];
  const name = main?.name || bible.protagonist?.name;
  if (name) return name;

  const occupation = main?.occupation || bible.protagonist?.occupation;
  if (occupation) {
    const article = /^[aeiou]/i.test(occupation.trim()) ? 'the' : 'the';
    return `${article} ${occupation.trim()}`;
  }

  const desc = main?.description || bible.protagonist?.description;
  if (desc) {
    // Take the first clause, trimmed. Prefix with "the" unless it already
    // starts with a pronoun/article.
    const first = desc.split(/[,.;]/)[0].trim();
    if (/^(the|a|an|their|his|her|my)\s/i.test(first)) return first;
    return first ? `the ${first}` : 'your protagonist';
  }

  return 'your protagonist';
}

/**
 * Rewrite each pillar's question text to reference the protagonist by name
 * or role when known, rather than the pronoun "they".
 */
export function buildPillarQuestionText(pillar: PillarKey, bible: Partial<StoryBible>): string {
  const subject = protagonistLabel(bible);
  switch (pillar) {
    case 'protagonist':
      return BROAD_QUESTIONS.protagonist.text;
    case 'want':
      return subject === 'your protagonist'
        ? 'What does your main character want more than anything?'
        : `What does ${subject} want more than anything?`;
    case 'obstacle':
      return subject === 'your protagonist'
        ? "What's the biggest force standing in your main character's way?"
        : `What's the biggest force standing in ${subject}'s way?`;
    case 'stakes':
      return subject === 'your protagonist'
        ? 'What happens if your main character fails?'
        : `What happens if ${subject} fails?`;
    case 'settingTime':
      return BROAD_QUESTIONS.settingTime.text;
    case 'tone':
      return BROAD_QUESTIONS.tone.text;
    case 'endingFeeling':
      return BROAD_QUESTIONS.endingFeeling.text;
  }
}

/**
 * True when we have the protagonist's role/description but NOT a name — the
 * case where we should ask a targeted name follow-up instead of the generic
 * "Who is your main character?"
 */
export function protagonistNameIsMissing(bible: Partial<StoryBible>): boolean {
  const main = bible.characters?.find((c) => c.role === 'main') ?? bible.characters?.[0];
  const name = main?.name || bible.protagonist?.name;
  const desc = main?.description || bible.protagonist?.description;
  const occ = main?.occupation || bible.protagonist?.occupation;
  return !name && !!(desc || occ);
}

/**
 * Build the fixed Phase 1 question for a specific pillar. Pure — no AI call.
 * Question text is grounded in the protagonist when we know them.
 *
 * Special case: for the protagonist pillar, if we already know the role but
 * not the name, ask for the name specifically (and do not pre-fill the
 * suggestion card — the role is not a valid name to submit).
 */
export function buildPillarQuestion(
  pillar: PillarKey,
  suggestion: string | null,
  bible: Partial<StoryBible> = {},
): Question {
  const def = BROAD_QUESTIONS[pillar];

  if (pillar === 'protagonist' && protagonistNameIsMissing(bible)) {
    const label = protagonistLabel(bible);
    return {
      id: generateUUID(),
      text: `What should we call ${label}?`,
      presentationMode: 'free-form',
      chipOptions: undefined,
      allowSurpriseMe: true,
      allowSkip: true,
      targeting: 'pillar.protagonist.name',
      level: 1,
      pillarKey: pillar,
      suggestedAnswer: undefined, // role is not a name — don't mislead the user
      fallbackBiblePath: 'protagonist.name',
    };
  }

  return {
    id: generateUUID(),
    text: buildPillarQuestionText(pillar, bible),
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
