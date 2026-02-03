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
   * Test if the API key is valid and has proper permissions
   */
  async testApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = this.ensureClient();

      // Make a minimal API call to test the key
      await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });

      return { valid: true };
    } catch (error: any) {
      console.error('API key test failed:', error);

      // Parse OpenAI error messages
      if (error?.status === 401) {
        return { valid: false, error: 'Invalid API key. Please check your key and try again.' };
      } else if (error?.status === 429) {
        return { valid: false, error: 'Rate limit exceeded or insufficient credits. Please check your OpenAI account billing.' };
      } else if (error?.status === 403) {
        return { valid: false, error: 'This API key does not have access to GPT-4o. Please check your OpenAI account permissions.' };
      } else if (error?.message?.includes('billing')) {
        return { valid: false, error: 'Billing issue detected. Please add payment method to your OpenAI account at platform.openai.com/account/billing' };
      } else {
        return { valid: false, error: `API error: ${error?.message || 'Unknown error. Please verify your API key and account status.'}` };
      }
    }
  }

  /**
   * Extract semantic intent from a question to detect duplicates
   */
  private extractQuestionIntent(question: string): string {
    const normalized = question.toLowerCase()
      .replace(/[?!.,]/g, '')
      .replace(/your|the|a|an/g, '')
      .trim();

    const intents = [
      // Protagonist identity questions (MUST BE FIRST - most specific)
      { pattern: /who is.*protagonist|protagonist.*who|tell me about.*protagonist|describe.*protagonist|protagonist.*describe|protagonist.*name|name.*protagonist|main character.*who|who.*main character/i, key: 'protagonist_identity' },

      // Specific protagonist details
      { pattern: /occupation|job|does.*living|profession|what does.*do for/i, key: 'protagonist_occupation' },
      { pattern: /afraid|fear|scared/i, key: 'protagonist_fears' },
      { pattern: /drives|motivates|motivation|why do they want|why does.*want/i, key: 'protagonist_motivation' },
      { pattern: /want|desire.*achieve|goal.*achieve|achieve|aspire/i, key: 'protagonist_goal' },
      { pattern: /appearance|looks like|physical.*description/i, key: 'protagonist_appearance' },
      { pattern: /personality|character traits|kind of person/i, key: 'protagonist_personality' },

      // Antagonist
      { pattern: /antagonist|opposes|against|villain|enemy|standing in.*way|who.*opposes/i, key: 'antagonist_identity' },

      // Conflict
      { pattern: /conflict|problem|challenge|main.*issue|central.*struggle/i, key: 'main_conflict' },

      // World/Setting
      { pattern: /setting|place|where.*take place|world.*like|location/i, key: 'world_setting' },
      { pattern: /world.*unique|world.*special|rules.*world|how.*world work/i, key: 'world_rules' },

      // Demographics (should rarely match due to contextual rules)
      { pattern: /race|ethnicity/i, key: 'demographics_race' },
      { pattern: /age|old|years old/i, key: 'demographics_age' },

      // Relationships
      { pattern: /relationship|friend|family|important people|close to/i, key: 'relationships' },

      // Stakes
      { pattern: /stakes|risk|lose|happens if.*fail|consequence/i, key: 'stakes' },

      // Secondary characters
      { pattern: /other character|secondary character|supporting character|anyone else/i, key: 'secondary_characters' },
    ];

    for (const intent of intents) {
      if (intent.pattern.test(question)) {
        return intent.key;
      }
    }

    return normalized;
  }

  /**
   * Check if a question is a semantic duplicate of previous questions
   * OR if it asks for data already in the Story Bible
   */
  private isQuestionDuplicate(
    newQuestion: string,
    questionHistory: QuestionHistory[],
    currentBible?: Partial<StoryBible>
  ): boolean {
    // Check 0: Does this ask for data we already have?
    if (currentBible) {
      const protagonistName = currentBible.protagonist?.name || currentBible.characters?.[0]?.name;
      const protagonistOccupation = currentBible.protagonist?.occupation || currentBible.characters?.[0]?.occupation;
      const protagonistGoal = currentBible.protagonist?.goal || currentBible.characters?.[0]?.wants;
      const mainConflict = currentBible.conflict?.mainConflict;

      if (protagonistName && /protagonist.*name|name.*protagonist|who is.*protagonist/i.test(newQuestion)) {
        console.log(`Duplicate detected: Asking for protagonist name but we already have "${protagonistName}"`);
        return true;
      }

      if (protagonistOccupation && /occupation|job|do for.*living|profession/i.test(newQuestion)) {
        console.log(`Duplicate detected: Asking for occupation but we already have "${protagonistOccupation}"`);
        return true;
      }

      if (protagonistGoal && /goal|want.*achieve|trying to/i.test(newQuestion)) {
        console.log(`Duplicate detected: Asking for goal but we already have "${protagonistGoal}"`);
        return true;
      }

      if (mainConflict && /main.*conflict|problem|challenge/i.test(newQuestion)) {
        console.log(`Duplicate detected: Asking for conflict but we already have "${mainConflict}"`);
        return true;
      }
    }
    const newIntent = this.extractQuestionIntent(newQuestion);
    const newQuestionNormalized = newQuestion.toLowerCase()
      .replace(/[?!.,]/g, '')
      .replace(/your|the|a|an|is|are|does|do|can|you/g, '')
      .trim();

    for (const hist of questionHistory) {
      const oldIntent = this.extractQuestionIntent(hist.question);

      // Check 1: Same semantic intent
      if (newIntent === oldIntent) {
        console.log(`Duplicate detected: "${newQuestion}" matches intent "${newIntent}" with previous question "${hist.question}"`);
        return true;
      }

      // Check 2: High text similarity (checking if questions are too similar)
      const oldQuestionNormalized = hist.question.toLowerCase()
        .replace(/[?!.,]/g, '')
        .replace(/your|the|a|an|is|are|does|do|can|you/g, '')
        .trim();

      // If normalized questions share >70% of significant words, likely duplicate
      const newWords = new Set(newQuestionNormalized.split(/\s+/).filter(w => w.length > 3));
      const oldWords = new Set(oldQuestionNormalized.split(/\s+/).filter(w => w.length > 3));

      if (newWords.size > 0 && oldWords.size > 0) {
        const intersection = new Set([...newWords].filter(x => oldWords.has(x)));
        const similarity = intersection.size / Math.min(newWords.size, oldWords.size);

        if (similarity > 0.7) {
          console.log(`Duplicate detected: "${newQuestion}" has ${Math.round(similarity * 100)}% similarity with "${hist.question}"`);
          return true;
        }
      }
    }

    return false;
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

    // Try up to 3 times to generate a non-duplicate question
    const MAX_ATTEMPTS = 3;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const question = await this._generateSingleQuestion(client, currentBible, questionHistory);

      if (!question) {
        return null;
      }

      // Check for duplication
      if (!this.isQuestionDuplicate(question.text, questionHistory, currentBible)) {
        return question;
      }

      console.log(`Attempt ${attempt + 1}: Question was duplicate, regenerating...`);
    }

    console.log('Failed to generate non-duplicate question after 3 attempts');
    return null;
  }

  /**
   * Internal method to generate a single question from AI
   */
  private async _generateSingleQuestion(
    client: OpenAI,
    currentBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[]
  ): Promise<Question | null> {
    const prompt = `You are conducting an adaptive story interview. Generate the NEXT SINGLE QUESTION to ask.

ANTI-DUPLICATION RULES (MOST CRITICAL):
⚠️ NEVER ask questions that are semantically similar to ones already asked
⚠️ Review ALL previous questions before generating a new one
⚠️ If you've asked "Who is your protagonist?" DO NOT ask "Can you describe your protagonist?" or "Tell me about your protagonist" - these are DUPLICATES
⚠️ If you've asked about the protagonist's identity, move on to SPECIFIC details: occupation, fears, motivations
⚠️ If you've asked about the main conflict, DO NOT rephrase it - move to a different topic

CONTEXTUAL QUESTION RULES (CRITICAL):
- ONLY ask about race/ethnicity if the story's theme or conflict explicitly involves identity, discrimination, or cultural heritage
- ONLY ask about physical appearance if it's plot-relevant (e.g., mistaken identity, disguise, doppelganger)
- ONLY ask about age if it matters to the story (coming-of-age, generational conflict, age-based discrimination)
- ONLY ask about location details if the setting is central to the plot
- Focus on PLOT-RELEVANT questions: motivations, conflicts, relationships, stakes, character goals
- Prioritize EMOTIONAL and CHARACTER questions over demographic details
- NEVER ask demographic questions just for completeness

CURRENT STORY BIBLE:
${JSON.stringify(currentBible, null, 2)}

QUESTIONS ALREADY ASKED (${questionHistory.length}):
${questionHistory.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}

DATA ALREADY CAPTURED:
- Protagonist name: ${currentBible.protagonist?.name || currentBible.characters?.[0]?.name || 'NOT YET CAPTURED'}
- Protagonist description: ${currentBible.protagonist?.description || currentBible.characters?.[0]?.description || 'NOT YET CAPTURED'}
- Protagonist occupation: ${currentBible.protagonist?.occupation || currentBible.characters?.[0]?.occupation || 'NOT YET CAPTURED'}
- Protagonist goal: ${currentBible.protagonist?.goal || currentBible.characters?.[0]?.wants || 'NOT YET CAPTURED'}
- Main conflict: ${currentBible.conflict?.mainConflict || 'NOT YET CAPTURED'}
- Antagonist: ${currentBible.conflict?.antagonist || currentBible.characters?.find(c => c.role === 'antagonist')?.name || 'NOT YET CAPTURED'}

QUESTION PRIORITY SYSTEM (ask in this order):

TIER 1 - CORE PROTAGONIST DETAILS:
🚫 CRITICAL RULE: If protagonist name is already captured (shown above), NEVER ask for name/identity again
🚫 If you already asked "Who is your protagonist?", DO NOT ask "What is your protagonist's name?" - SKIP to missing details

ASK ONLY IF NOT ALREADY CAPTURED:
- If NO protagonist info at all AND no identity question asked yet: "Who is your protagonist?"
- If protagonist name EXISTS, ask about MISSING details ONLY:
  * If occupation is "NOT YET CAPTURED": "What does [name] do for a living?"
  * If goal is "NOT YET CAPTURED": "What does [name] want to achieve?"
  * If protagonist fears is "NOT YET CAPTURED": "What is [name] most afraid of?"
  * If motivation is "NOT YET CAPTURED": "What drives [name]?"

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

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5,
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
    } catch (error) {
      console.error('Error generating question:', error);
      return null;
    }
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
   * Generate multiple AI answer options for "Give me an idea!"
   * Returns 4 options: Neutral, Negative, Positive, Wild Card
   */
  async generateAIAnswerOptions(
    question: Question,
    storyBible: Partial<StoryBible>
  ): Promise<string[]> {
    const client = this.ensureClient();

    const prompt = `You are helping a user develop their story. Generate 4 creative answer options for this question with different tones.

QUESTION: ${question.text}

CURRENT STORY CONTEXT:
${JSON.stringify(storyBible, null, 2)}

Generate EXACTLY 4 answer options with different tones:
1. NEUTRAL: Balanced, straightforward, middle-ground answer
2. NEGATIVE: Darker, more conflicted, challenging answer that adds complications
3. POSITIVE: Lighter, more hopeful, optimistic answer
4. WILD-CARD: GENRE-BENDING PLOT TWIST - This should be SURPRISING and challenge genre expectations

IMPORTANT for WILD-CARD:
- Think GENRE-BENDING or PLOT TWIST territory
- Examples:
  * If story is realistic drama → Wild Card adds supernatural element
  * If story is fantasy → Wild Card adds sci-fi twist
  * If story is romance → Wild Card adds thriller/mystery element
  * If story is straightforward → Wild Card adds unexpected complexity
- Must remain coherent and grounded in story logic
- Should genuinely surprise while maintaining narrative cohesion

All options should:
- Fit the existing story context
- Be concise (1-2 sentences)
- Be distinct and interesting

Return JSON with labeled options:
{
  "neutral": "answer text",
  "negative": "answer text",
  "positive": "answer text",
  "wildCard": "answer text"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Generate AI Answer Options', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { neutral: '', negative: '', positive: '', wildCard: '' };

    // Return in order: Neutral, Negative, Positive, Wild Card
    return [
      data.neutral || '',
      data.negative || '',
      data.positive || '',
      data.wildCard || ''
    ].filter(s => s.length > 0);
  }

  /**
   * Generate a beat summary using Story Bible context
   * Returns 4 options: Neutral, Negative, Positive, Wild Card
   */
  async generateBeatWithContext(
    beatNumber: BeatNumber,
    beatTitle: string,
    storyBible: StoryBible,
    previousBeats: Beat[]
  ): Promise<string[]> {
    const client = this.ensureClient();

    const mainCharacter = storyBible.characters?.[0] || storyBible.protagonist;
    const antagonist = storyBible.characters?.find(c => c.role === 'antagonist');

    const prompt = `You are creating Beat #${beatNumber}: "${beatTitle}" for a story outline.

CRITICAL: You MUST use ALL the information from the Story Bible below. Do NOT create generic scenarios.

COMPLETE STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

PREVIOUS BEATS:
${previousBeats.map(b => `Beat ${b.number}: ${b.summary}`).join('\n\n')}

MANDATORY REQUIREMENTS:
1. Use the EXACT protagonist from the Story Bible (name: ${mainCharacter?.name || 'the protagonist'})
2. Use the EXACT setting/world described: ${storyBible.world?.setting || 'the world'}
3. Incorporate the main conflict: ${storyBible.conflict?.mainConflict || 'the conflict'}
4. Reference the antagonist if present: ${antagonist?.name || storyBible.conflict?.antagonist || 'the antagonist'}
5. If theme is specified (${storyBible.theme}), reflect it in the beat
6. Flow naturally from previous beats
7. Each alternative must be EXACTLY ONE SENTENCE (not 2-3)

Generate EXACTLY 4 options with different tones:
1. NEUTRAL: Balanced, straightforward progression
2. NEGATIVE: Things go wrong, setbacks, complications, darker turn
3. POSITIVE: Things go well, progress, hope, lighter turn
4. WILD-CARD: Unexpected twist, surprise direction, game-changer

Return JSON with labeled options:
{
  "neutral": "one sentence summary",
  "negative": "one sentence summary",
  "positive": "one sentence summary",
  "wildCard": "one sentence summary"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Generate Beat', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { neutral: '', negative: '', positive: '', wildCard: '' };

    // Return in order: Neutral, Negative, Positive, Wild Card
    return [
      data.neutral || '',
      data.negative || '',
      data.positive || '',
      data.wildCard || ''
    ].filter(s => s.length > 0);
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

  /**
   * Auto-complete all empty beats at once
   * Uses neutral tone for a balanced story
   */
  async autoCompleteBeats(
    beats: Beat[],
    storyBible: StoryBible
  ): Promise<Record<number, string>> {
    const client = this.ensureClient();

    // Find all empty beats
    const emptyBeats = beats.filter(b => !b.summary || b.status === 'empty');
    if (emptyBeats.length === 0) {
      return {};
    }

    // Get already completed beats for context
    const completedBeats = beats.filter(b => b.summary && b.status === 'complete');

    const prompt = `You are auto-completing a story outline. Generate ONE SENTENCE for each empty beat using NEUTRAL tone (balanced, straightforward).

COMPLETE STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

ALREADY COMPLETED BEATS (for context):
${completedBeats.map(b => `Beat ${b.number}: ${b.summary}`).join('\n')}

BEATS TO COMPLETE:
${emptyBeats.map(b => `Beat ${b.number}: ${b.title}`).join('\n')}

MANDATORY REQUIREMENTS:
1. Use the EXACT protagonist name: ${storyBible.protagonist?.name || 'the protagonist'}
2. Use the EXACT setting: ${storyBible.world?.setting || 'the world'}
3. Incorporate the conflict: ${storyBible.conflict?.mainConflict || 'the conflict'}
4. Each beat must be EXACTLY ONE SENTENCE
5. Use NEUTRAL tone (not too positive or negative, balanced)
6. Flow naturally from completed beats

Return JSON with beat numbers as keys:
{
  "1": "one sentence summary",
  "5": "one sentence summary",
  "12": "one sentence summary"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Auto-Complete Beats', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : {};

    // Convert string keys to numbers
    const result: Record<number, string> = {};
    for (const [key, value] of Object.entries(data)) {
      const beatNumber = parseInt(key);
      if (typeof value === 'string' && value.trim()) {
        result[beatNumber] = value.trim();
      }
    }

    return result;
  }

  /**
   * Calculate emotional intensity and tension for a beat
   */
  async calculateEmotionalIntensity(
    beatSummary: string,
    selectedTone: EmotionalTone,
    beatNumber: BeatNumber,
    beatTitle: BeatTitle
  ): Promise<{ intensity: number; tension: number }> {
    const client = this.ensureClient();

    const prompt = `Analyze this story beat and determine its emotional intensity and dramatic tension.

BEAT #${beatNumber}: "${beatTitle}"
SUMMARY: ${beatSummary}
SELECTED TONE: ${selectedTone}

Return JSON:
{
  "intensity": <number from -10 to +10>,
  "tension": <number from 0 to 10>
}

GUIDELINES:
- intensity is about emotional valence (good vs bad feelings)
  * -10 = darkest/most tragic/hopeless
  * 0 = neutral/balanced
  * +10 = most hopeful/uplifting/triumphant
- tension is about dramatic stakes (calm vs high-stakes)
  * 0 = calm, peaceful, no conflict
  * 5 = moderate stakes/conflict
  * 10 = maximum conflict/life-or-death stakes
- A scene can be positive but high tension (winning after struggle)
- A scene can be negative but low tension (quiet sadness)
- Wild-card beats tend to have unexpected intensity/tension patterns`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,  // Low temp for consistent scoring
    });

    this.trackTokens('Calculate Emotional Intensity', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { intensity: 0, tension: 5 };

    return {
      intensity: Math.max(-10, Math.min(10, data.intensity || 0)),
      tension: Math.max(0, Math.min(10, data.tension || 5)),
    };
  }

  /**
   * Extract character hierarchy from Story Bible and question history
   */
  async extractCharacterHierarchy(
    storyBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[]
  ): Promise<Character[]> {
    const client = this.ensureClient();

    const prompt = `Analyze the story information and identify character hierarchy.

STORY BIBLE:
${JSON.stringify(storyBible, null, 2)}

QUESTION HISTORY:
${questionHistory.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}

Identify:
1. MAIN CHARACTER (protagonist) - the central character whose journey we follow
2. SUPPORTING CHARACTERS (allies, mentors, sidekicks, friends, family)
3. ANTAGONIST (villain, opposing force, primary obstacle)

For EACH character, extract:
- name: Character's name
- wants: What they consciously desire/pursue
- weaknesses: Their flaws, vulnerabilities, blind spots
- description, occupation, fears, etc. if mentioned

Return JSON with a "characters" array:
{
  "characters": [
    {
      "id": "main-1",
      "role": "main",
      "name": "...",
      "wants": "...",
      "weaknesses": "...",
      "description": "...",
      "occupation": "...",
      "fears": "...",
      "motivations": "...",
      "personality": "..."
    }
  ]
}

Include ALL characters mentioned, even if information is incomplete.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    this.trackTokens('Extract Character Hierarchy', response.usage);

    const content = response.choices[0].message.content;
    const data = content ? JSON.parse(content) : { characters: [] };

    return data.characters || [];
  }

  // ============================================================================
  // LEVEL 1 & LEVEL 2 QUESTION GENERATION (NEW)
  // ============================================================================

  /**
   * Check if logline is complete (all 4 components present)
   * Used to determine if Level 1 is complete and Level 2 should begin
   */
  isLoglineComplete(storyBible: Partial<StoryBible>): boolean {
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
   * Master question generation method (routes to Level 1 or Level 2)
   * REPLACES generateSmartQuestion for new flow
   */
  async generateNextQuestion(
    currentBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[],
    beats: Beat[]
  ): Promise<Question | null> {
    // Determine current level based on logline completeness
    const loglineComplete = this.isLoglineComplete(currentBible);

    if (!loglineComplete) {
      // Level 1: Logline questions (up to 7 max)
      return this.generateLoglineQuestion(currentBible, questionHistory);
    } else {
      // Level 2: Beat refinement questions
      return this.generateBeatRefinementQuestion(currentBible, questionHistory, beats);
    }
  }

  /**
   * Generate Level 1 logline question (adaptive, up to 7 questions max)
   * Gathers the 4 core logline components
   */
  async generateLoglineQuestion(
    currentBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[]
  ): Promise<Question | null> {
    const client = this.ensureClient();

    // Max 7 questions for Level 1
    if (questionHistory.length >= 7) {
      return null;
    }

    // Check which logline components are missing
    const loglineComponents = {
      protagonist: !!(currentBible.protagonist?.name && currentBible.protagonist?.description),
      goal: !!(currentBible.protagonist?.goal || currentBible.protagonist?.want || currentBible.protagonist?.need),
      obstacle: !!(currentBible.conflict?.mainConflict || currentBible.conflict?.antagonist),
      stakes: !!currentBible.conflict?.stakes
    };

    // If all 4 components present, Level 1 is complete
    if (Object.values(loglineComponents).every(v => v)) {
      return null;
    }

    // Determine which component to ask about
    const missingComponent = Object.keys(loglineComponents).find(
      key => !loglineComponents[key as keyof typeof loglineComponents]
    );

    if (!missingComponent) return null;

    // Generate adaptive question based on missing component and existing context
    const questionPrompt = `Generate a conversational question to gather: ${missingComponent}

Initial Story Idea: ${currentBible.initialInput || 'Not provided'}
Already Know: ${JSON.stringify(currentBible, null, 2)}

Previous Questions:
${questionHistory.map(h => h.question).join('\n')}

The question should:
- Be natural and adaptive to what we already know
- Not repeat information from previous questions
- Target the missing logline component: ${missingComponent}
- Be conversational and engaging

IMPORTANT: This is a Level 1 question (building the logline). Keep it simple and direct.

Return JSON:
{
  "question": "<conversational question>"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: questionPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Generate Logline Question (Level 1)', response.usage);

    const content = response.choices[0].message.content;
    if (!content) return null;

    const questionData = JSON.parse(content);

    return {
      id: this.generateUUID(),
      text: questionData.question,
      presentationMode: 'free-form',
      chipOptions: undefined,
      allowSurpriseMe: false,  // No "Surprise Me" in Level 1
      allowSkip: false,
      targeting: `logline-${missingComponent}`,
      level: 1
    };
  }

  /**
   * Generate Level 2 beat refinement question
   * Targets incomplete beats based on Story Bible gaps
   */
  async generateBeatRefinementQuestion(
    currentBible: Partial<StoryBible>,
    questionHistory: QuestionHistory[],
    beats: Beat[]
  ): Promise<Question | null> {
    const client = this.ensureClient();

    // Stop after reasonable number of questions (can be adjusted)
    if (questionHistory.length >= 20) return null;

    // Import beat validation utilities
    const { calculateBeatCompletionStatus } = await import('../../utils/beatValidation');
    const { BEAT_CONTRACTS } = await import('../../constants/beatContracts');

    // Calculate beat completion status
    const completionStatus = calculateBeatCompletionStatus(currentBible, beats);

    // Prioritize beats 1-3 (foundation)
    const foundationBeats = completionStatus.filter(b => b.beatNumber <= 3);
    const incompleteFoundation = foundationBeats.find(b => !b.isComplete && b.canBeGenerated);

    // If foundation incomplete, ask for that
    const targetBeat = incompleteFoundation ||
      completionStatus.find(b => !b.isComplete && b.canBeGenerated);

    if (!targetBeat) return null;

    const contract = BEAT_CONTRACTS[targetBeat.beatNumber];

    // Pick a missing Story Bible field
    const targetField = targetBeat.missingRequirements[0];

    // Generate contextual question
    const questionPrompt = `Generate a conversational question to gather: ${targetField}

Context:
- Beat ${targetBeat.beatNumber}: ${contract.title}
- Purpose: ${contract.purpose}
- Already know: ${JSON.stringify(currentBible, null, 2)}

Previous Questions:
${questionHistory.slice(-5).map(h => h.question).join('\n')}

The question should:
- Be natural and conversational
- Reference existing story elements (character names, settings)
- Target the missing field: ${targetField}
- Help complete Beat ${targetBeat.beatNumber}

Return JSON:
{
  "question": "<conversational question>",
  "presentationMode": "free-form"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: questionPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    this.trackTokens('Generate Beat Refinement Question (Level 2)', response.usage);

    const content = response.choices[0].message.content;
    if (!content) return null;

    const questionData = JSON.parse(content);

    return {
      id: this.generateUUID(),
      text: questionData.question,
      presentationMode: questionData.presentationMode || 'free-form',
      chipOptions: undefined,
      allowSurpriseMe: true,  // "Surprise Me" available in Level 2
      allowSkip: false,
      targeting: `beat-${targetBeat.beatNumber}:${targetField}`,
      level: 2
    };
  }

  /**
   * Generate UUID for questions
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const openaiService = new OpenAIService();
