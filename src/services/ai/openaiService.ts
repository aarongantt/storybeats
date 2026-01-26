import OpenAI from 'openai';
import type {
  StoryBible,
  Question,
  Beat,
  BeatNumber,
  PitchPackage,
  QuestionHistory,
} from '../../types/story';

interface TokenUsageCallback {
  (operation: string, promptTokens: number, completionTokens: number): void;
}

class OpenAIService {
  private client: OpenAI | null = null;
  private tokenCallback: TokenUsageCallback | null = null;

  initialize(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // For demo purposes - in production, use a backend
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
   * Extract Story Bible data from initial user input
   */
  async extractStoryBible(initialInput: string): Promise<Partial<StoryBible>> {
    const client = this.ensureClient();

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
    "description": "extract unique world features (e.g., 'ancient cursed artifacts')",
    "rules": ["extract any world rules mentioned"]
  },
  "conflict": {
    "mainConflict": "extract the central problem/challenge",
    "antagonist": "extract who/what opposes protagonist (could be 'thieves', 'ancient spirit', person's name)",
    "stakes": "extract what's at risk or what happens if they fail"
  },
  "theme": "infer theme if obvious (e.g., 'survival', 'duty vs survival')",
  "secondaryCharacters": [{"name": "...", "role": "...", "relationship": "relationship to protagonist"} for any other characters mentioned]
}

Be THOROUGH. Extract even small details. Better to capture too much than too little.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Extract Story Bible', response.usage);

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate 5-10 adaptive questions based on what's missing from Story Bible
   */
  async generateSmartQuestion(
    currentBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[]
  ): Promise<Question | null> {
    const client = this.ensureClient();

    // Stop after 10 questions
    const questionCount = questionHistory.length;
    if (questionCount >= 10) return null;

    const prompt = `You are conducting an adaptive story interview. Generate the NEXT SINGLE QUESTION to ask.

CURRENT STORY BIBLE:
${JSON.stringify(currentBible, null, 2)}

QUESTIONS ALREADY ASKED (${questionHistory.length}):
${questionHistory.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}

QUESTION PRIORITY SYSTEM (ask in this order):

TIER 1 - CORE PROTAGONIST DETAILS (ask these first):
- If no protagonist.name: "Who is your protagonist?" or "What is your protagonist's name?"
- If no protagonist.description: "Can you describe your protagonist?" (appearance, personality, background)
- If no protagonist.goal: "What does your protagonist want to achieve?"
- If protagonist.name exists but missing occupation: "What does [name] do for a living?" or "What is [name]'s occupation?"
- If protagonist exists but missing fears: "What is your protagonist most afraid of?"
- If protagonist exists but missing deeper motivations: "What drives your protagonist?" or "Why do they want this?"

TIER 2 - CONFLICT & ANTAGONIST:
- If no conflict.mainConflict: "What is the main problem or challenge in your story?"
- If no conflict.antagonist: "Who or what opposes your protagonist?" or "What's standing in their way?"

TIER 3 - WORLD DETAILS:
- If world.setting exists but no world.description: "What makes this world unique?" or "What are the rules of this world?"
- If world.setting exists but no world.rules: "Are there any special rules or limitations in this world?"

TIER 4 - SECONDARY ELEMENTS:
- Secondary characters: "Are there any other important characters in your story?"
- Relationships: "Who are the most important people in your protagonist's life?"
- Stakes: "What happens if your protagonist fails?"

CRITICAL RULES:
1. NEVER ask about information that's ALREADY FULLY ANSWERED in the Story Bible
2. NEVER ask semantically similar questions to ones already asked
3. DO ask follow-up questions to deepen existing information (e.g., if you have protagonist name, ask about occupation, fears, desires)
4. Work through the TIER system - finish Tier 1 before moving to Tier 2
5. Keep questions short and conversational
6. Always set "allowSurpriseMe" to true
7. Use the protagonist's name in questions if you know it

Return JSON in this format:
{
  "question": "Your question here",
  "presentationMode": "free-form",
  "chipOptions": null,
  "allowSurpriseMe": true,
  "targeting": "protagonist.goal" (Story Bible field path)
}

If you have COMPLETE protagonist details (name, description, goal, occupation/background, fears/motivations), complete conflict info, and antagonist info, return null.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    this.trackTokens('Generate Question', response.usage);

    const content = response.choices[0].message.content;
    if (!content) return null;

    const data = JSON.parse(content);
    if (!data.question) return null;

    return {
      id: `q-${Date.now()}`,
      text: data.question,
      presentationMode: data.presentationMode || 'free-form',
      chipOptions: data.chipOptions || undefined,
      allowSurpriseMe: data.allowSurpriseMe || false,
      allowSkip: true,
      targeting: data.targeting || '',
    };
  }

  /**
   * Analyze user's answer and extract Story Bible updates
   */
  async analyzeResponse(
    question: Question,
    answer: string,
    currentBible: Partial<StoryBible>
  ): Promise<Partial<StoryBible>> {
    const client = this.ensureClient();

    const prompt = `Extract ALL relevant story information from this Q&A and update the Story Bible.

QUESTION: ${question.text}
ANSWER: ${answer}

CURRENT STORY BIBLE:
${JSON.stringify(currentBible, null, 2)}

EXTRACTION RULES:
1. Extract protagonist details: name, description, goals, wants, needs, occupation, background, fears, motivations, personality
2. Extract world setting, rules, unique features
3. Extract main conflict, antagonist details, stakes
4. Extract any secondary characters mentioned with their relationships
5. Extract theme if implied
6. Be thorough - capture every detail mentioned in the answer
7. Preserve all existing data and ADD to it

Return a JSON object with ONLY the fields that should be updated or added. Use the exact Story Bible structure:
{
  "protagonist": {
    "name": "...",
    "description": "...",
    "goal": "...",
    "want": "...",
    "need": "...",
    "occupation": "...",
    "background": "...",
    "fears": "...",
    "motivations": "...",
    "personality": "..."
  },
  "world": { "setting": "...", "description": "...", "rules": ["..."] },
  "conflict": { "mainConflict": "...", "antagonist": "...", "stakes": "..." },
  "theme": "...",
  "secondaryCharacters": [{ "name": "...", "role": "...", "relationship": "..." }]
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Analyze Response', response.usage);

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate multiple AI answer options for "Surprise Me"
   */
  async generateAIAnswerOptions(
    question: Question,
    storyBible: Partial<StoryBible>
  ): Promise<string[]> {
    const client = this.ensureClient();

    const prompt = `You are helping a user develop their story. Generate 3-5 creative answer options for this question.

QUESTION: ${question.text}

CURRENT STORY CONTEXT:
${JSON.stringify(storyBible, null, 2)}

Generate 3-5 different creative answers that fit the existing story context. Each should be distinct and interesting.
Keep each answer concise (1-2 sentences).

Return JSON:
{
  "options": ["answer 1", "answer 2", "answer 3"]
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    });

    this.trackTokens('Generate AI Answer Options', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { options: [] };
    return data.options || [];
  }

  /**
   * Generate a beat summary using Story Bible context
   */
  async generateBeatWithContext(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[]
  ): Promise<string[]> {
    const client = this.ensureClient();

    const prompt = `You are creating Beat #${beatNumber}: "${beatTitle}" for a story outline.

CRITICAL: You MUST use ALL the information from the Story Bible below. Do NOT create generic scenarios.

COMPLETE STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

PREVIOUS BEATS:
${previousBeats.map(b => `Beat ${b.number}: ${b.summary}`).join('\n\n')}

MANDATORY REQUIREMENTS:
1. Use the EXACT protagonist from the Story Bible (name: ${storyBible.protagonist?.name || 'the protagonist'})
2. Use the EXACT setting/world described: ${storyBible.world?.setting || 'the world'}
3. Incorporate the main conflict: ${storyBible.conflict?.mainConflict || 'the conflict'}
4. Reference the antagonist if present: ${storyBible.conflict?.antagonist || 'the antagonist'}
5. If theme is specified (${storyBible.theme}), reflect it in the beat
6. Flow naturally from previous beats
7. Each alternative should be 2-3 sentences

Generate 3-5 SPECIFIC alternative beat summaries that use the protagonist's name, the actual setting, and the real conflict from your Story Bible.

Return JSON:
{
  "alternatives": ["summary 1", "summary 2", "summary 3"]
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    });

    this.trackTokens('Generate Beat', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { alternatives: [] };
    return data.alternatives || [];
  }

  /**
   * Regenerate a specific beat with new alternatives
   */
  async regenerateBeat(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[]
  ): Promise<string[]> {
    // Generate alternatives based on the current beat
    return this.generateBeatWithContext(beatNumber, beatTitle, storyBible, previousBeats);
  }

  /**
   * Generate pitch package (logline, synopsis, outline)
   */
  async generatePitch(
    storyBible: StoryBible,
    beats: Beat[],
    format: string
  ): Promise<PitchPackage> {
    const client = this.ensureClient();

    const beatsText = beats
      .filter(b => b.status === 'complete')
      .map(b => `Beat ${b.number}: ${b.summary}`)
      .join('\n\n');

    const prompt = `Generate a pitch package for this story.

STORY BEATS:
${beatsText}

STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

FORMAT: ${format}

Return JSON:
{
  "logline": "One sentence logline",
  "shortSynopsis": "One paragraph synopsis",
  "onePageSynopsis": "Longer synopsis (3-4 paragraphs)",
  "numberedOutline": "Numbered beat outline"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Generate Pitch', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : {};

    return {
      logline: data.logline || '',
      shortSynopsis: data.shortSynopsis || '',
      onePageSynopsis: data.onePageSynopsis || '',
      numberedOutline: data.numberedOutline || '',
      createdAt: new Date().toISOString(),
    };
  }
}

export const openaiService = new OpenAIService();
