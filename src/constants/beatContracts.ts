import { BeatTitle } from '../types/story';
import type { BeatNumber } from '../types/story';

/**
 * Machine-readable beat contract
 * Each beat must satisfy these requirements to be considered valid
 */
export interface BeatContract {
  beatNumber: BeatNumber;
  title: BeatTitle;

  // Structural requirements
  purpose: string;
  structuralObligation: string;
  requiredStoryBibleFields: string[];

  // Change requirements
  requiredChange: {
    before: string;
    after: string;
  };

  // Direction modifiers
  directionModifiers: {
    positive: string;
    negative: string;
    neutral: string;
    wildCard: string;
  };

  // Validation rules
  mustNotInclude: string[];
  mustNotResolve: string[];

  // Dependencies
  requiredPreviousBeats: BeatNumber[];

  // AI prompts
  therapistPrompt: string;
  writerPrompt: string;
  validatorPrompt: string;
}

/**
 * All 12 beat contracts
 * Based on machine-readable instructions from 12 Story Beats document
 */
export const BEAT_CONTRACTS: Record<BeatNumber, BeatContract> = {
  1: {
    beatNumber: 1,
    title: BeatTitle.MeetTheMainCharacter,
    purpose: 'Anchor the story in a present moment through the protagonist.',
    structuralObligation: 'Generate a present-tense narrative moment that introduces the protagonist through action. Establish emotional baseline and immediate context. Do not include backstory unless unavoidable for comprehension.',
    requiredStoryBibleFields: ['protagonist.name', 'protagonist.description'],
    requiredChange: {
      before: 'No narrative anchor',
      after: 'Protagonist exists in a specific moment with observable behavior'
    },
    directionModifiers: {
      positive: 'Protagonist appears capable, hopeful, or in control',
      negative: 'Protagonist appears diminished, trapped, or failing',
      neutral: 'Protagonist appears ordinary, emotionally flat, or routine-bound',
      wildCard: 'Entry is unconventional with a surprising genre-bending element or plot twist that remains grounded'
    },
    mustNotInclude: ['backstory dumps', 'conflict resolution', 'world exposition'],
    mustNotResolve: [],
    requiredPreviousBeats: [],
    therapistPrompt: "What's missing to introduce the protagonist in a specific moment?",
    writerPrompt: 'Write a present-tense scene showing the protagonist in action. Establish who they are through behavior, not explanation.',
    validatorPrompt: 'Does this beat anchor the story in a specific moment with observable protagonist behavior? Rate 0-1.'
  },

  2: {
    beatNumber: 2,
    title: BeatTitle.TheCharactersWorld,
    purpose: "Define the rules and pressures of the protagonist's environment.",
    structuralObligation: 'Reveal the norms, constraints, or expectations of the world through interaction or observation. Avoid exposition dumps. Demonstrate what the world rewards and punishes.',
    requiredStoryBibleFields: ['world.setting', 'world.description'],
    requiredChange: {
      before: 'We know the protagonist only',
      after: 'We understand the forces acting on the protagonist'
    },
    directionModifiers: {
      positive: 'World appears supportive or aligned',
      negative: 'World appears hostile, indifferent, or oppressive',
      neutral: 'World appears stable or bureaucratic',
      wildCard: 'World contradicts genre or expectation without breaking logic'
    },
    mustNotInclude: ['protagonist backstory', 'conflict resolution'],
    mustNotResolve: [],
    requiredPreviousBeats: [1],
    therapistPrompt: 'What are the rules and pressures of this world?',
    writerPrompt: "Show the world's norms through interaction. What does this world reward? What does it punish?",
    validatorPrompt: 'Does this beat reveal forces acting on the protagonist through demonstration (not exposition)? Rate 0-1.'
  },

  3: {
    beatNumber: 3,
    title: BeatTitle.TheCatalyst,
    purpose: 'Introduce a concrete, personal conflict.',
    structuralObligation: 'Introduce a specific problem that directly affects the protagonist. The problem must be undeniable and non-trivial. Avoid abstract or distant threats.',
    requiredStoryBibleFields: ['conflict.mainConflict'],
    requiredChange: {
      before: 'Life is stable',
      after: 'A problem exists that cannot resolve itself'
    },
    directionModifiers: {
      positive: 'Problem presents as opportunity or challenge',
      negative: 'Problem presents as threat or loss',
      neutral: 'Problem is ambiguous or unclear',
      wildCard: 'Problem defies expectation but remains personal'
    },
    mustNotInclude: ['problem resolution'],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2],
    therapistPrompt: 'What concrete problem appears that the protagonist cannot ignore?',
    writerPrompt: 'Introduce the specific problem. Make it personal, undeniable, and non-trivial.',
    validatorPrompt: 'Does this beat introduce a concrete problem that directly affects the protagonist? Rate 0-1.'
  },

  4: {
    beatNumber: 4,
    title: BeatTitle.TheDrivingConflict,
    purpose: 'Escalate the problem and narrow options.',
    structuralObligation: 'Escalate stakes, urgency, or resistance. Show consequences of avoidance. Keep the protagonist reactive rather than decisive.',
    requiredStoryBibleFields: ['conflict.stakes'],
    requiredChange: {
      before: 'Ignoring the problem is possible',
      after: 'Ignoring the problem has visible cost'
    },
    directionModifiers: {
      positive: 'Escalation hints at growth or advantage',
      negative: 'Escalation worsens danger or loss',
      neutral: 'Escalation clarifies complexity',
      wildCard: 'Escalation comes from an unexpected source'
    },
    mustNotInclude: ['protagonist commitment'],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3],
    therapistPrompt: 'What are the consequences if the protagonist continues to avoid this problem?',
    writerPrompt: 'Show the cost of inaction. Escalate urgency, stakes, or resistance.',
    validatorPrompt: 'Does this beat show visible consequences of avoidance and escalate the problem? Rate 0-1.'
  },

  5: {
    beatNumber: 5,
    title: BeatTitle.AHardChoice,
    purpose: 'Commit the protagonist to the conflict.',
    structuralObligation: 'Force the protagonist to make a meaningful choice or take an action that cannot be undone. The choice must close off the old normal. Avoid partial or reversible decisions.',
    requiredStoryBibleFields: ['protagonist.wants'],
    requiredChange: {
      before: 'Protagonist is being pushed',
      after: 'Protagonist has stepped in'
    },
    directionModifiers: {
      positive: 'Choice is courageous or morally sound',
      negative: 'Choice is selfish, fearful, or mistaken',
      neutral: 'Choice is forced or pragmatic',
      wildCard: 'Choice reframes the conflict unexpectedly'
    },
    mustNotInclude: ['reversible decisions'],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3, 4],
    therapistPrompt: 'What irreversible choice does the protagonist make that commits them to the conflict?',
    writerPrompt: 'Show the protagonist making a choice they cannot undo. Close off their old normal.',
    validatorPrompt: 'Does this beat show an irreversible choice that commits the protagonist? Rate 0-1.'
  },

  6: {
    beatNumber: 6,
    title: BeatTitle.CrossingTheLine,
    purpose: 'Demonstrate cause and effect.',
    structuralObligation: 'Show clear consequences of the prior choice. Introduce complications, allies, or opposition. Avoid escalation without causal logic.',
    requiredStoryBibleFields: ['secondaryCharacters'],
    requiredChange: {
      before: 'Conflict is singular',
      after: 'Conflict is complex and unstable'
    },
    directionModifiers: {
      positive: 'Consequences open new possibilities',
      negative: 'Consequences compound harm',
      neutral: 'Consequences balance gains and losses',
      wildCard: 'Consequences emerge in an unusual but logical form'
    },
    mustNotInclude: [],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3, 4, 5],
    therapistPrompt: 'What complications arise from the protagonist\'s choice?',
    writerPrompt: 'Show the consequences of the choice. Introduce allies, opposition, or complications.',
    validatorPrompt: 'Does this beat demonstrate clear consequences with causal logic? Rate 0-1.'
  },

  7: {
    beatNumber: 7,
    title: BeatTitle.ThingsGetMessy,
    purpose: 'Collapse the current strategy.',
    structuralObligation: 'Deliver a major failure, loss, or revelation. Invalidate the protagonist\'s current approach. Ensure the loss is meaningful and lasting.',
    requiredStoryBibleFields: ['protagonist.weaknesses', 'conflict.antagonist'],
    requiredChange: {
      before: 'Protagonist believes they are managing the situation',
      after: 'That belief is destroyed'
    },
    directionModifiers: {
      positive: 'Disaster reveals hidden truth or leverage',
      negative: 'Disaster deepens loss or isolation',
      neutral: 'Disaster stabilizes but scars',
      wildCard: 'Disaster takes an unexpected form without reducing impact'
    },
    mustNotInclude: [],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6],
    therapistPrompt: 'What major failure or revelation destroys the protagonist\'s current approach?',
    writerPrompt: 'Deliver a meaningful loss or revelation that invalidates the protagonist\'s strategy.',
    validatorPrompt: 'Does this beat collapse the protagonist\'s current belief or approach? Rate 0-1.'
  },

  8: {
    beatNumber: 8,
    title: BeatTitle.ATruthIsRevealed,
    purpose: 'Reaffirm forward motion.',
    structuralObligation: 'Have the protagonist consciously choose to continue. Clarify motivation and stakes. Show resolve without guaranteeing success.',
    requiredStoryBibleFields: ['protagonist.motivations', 'conflict.stakes'],
    requiredChange: {
      before: 'Continuing is optional',
      after: 'Turning back is unacceptable'
    },
    directionModifiers: {
      positive: 'Commitment is hopeful or purposeful',
      negative: 'Commitment is grim or desperate',
      neutral: 'Commitment is resigned',
      wildCard: 'Commitment defies genre expectation while remaining sincere'
    },
    mustNotInclude: [],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6, 7],
    therapistPrompt: 'Why does the protagonist choose to continue despite the disaster?',
    writerPrompt: 'Show the protagonist consciously choosing to move forward. Clarify their motivation.',
    validatorPrompt: 'Does this beat show resolve and conscious choice to continue? Rate 0-1.'
  },

  9: {
    beatNumber: 9,
    title: BeatTitle.EverythingStartsToFallApart,
    purpose: 'Align forces toward an inevitable clash.',
    structuralObligation: 'Narrow narrative possibilities. Increase inevitability and tension. Do not introduce new core conflicts.',
    requiredStoryBibleFields: ['conflict.mainConflict', 'conflict.antagonist'],
    requiredChange: {
      before: 'Ending direction is unclear',
      after: 'Ending direction is visible'
    },
    directionModifiers: {
      positive: 'Escalation empowers the protagonist',
      negative: 'Escalation favors opposition',
      neutral: 'Escalation balances forces',
      wildCard: 'Escalation subverts expectation without stalling momentum'
    },
    mustNotInclude: ['new core conflicts'],
    mustNotResolve: ['main conflict'],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6, 7, 8],
    therapistPrompt: 'How do forces align toward the final confrontation?',
    writerPrompt: 'Narrow possibilities. Make the confrontation feel inevitable.',
    validatorPrompt: 'Does this beat increase inevitability and make the ending direction visible? Rate 0-1.'
  },

  10: {
    beatNumber: 10,
    title: BeatTitle.TheLowestPoint,
    purpose: 'Resolve the primary external conflict.',
    structuralObligation: 'Force direct confrontation with the core conflict. Maximize risk and consequence. Resolve the external struggle through action.',
    requiredStoryBibleFields: ['conflict.mainConflict', 'conflict.antagonist', 'protagonist.wants'],
    requiredChange: {
      before: 'Outcome is unknown',
      after: 'Outcome is decided'
    },
    directionModifiers: {
      positive: 'Victory or meaningful success',
      negative: 'Failure or costly success',
      neutral: 'Mixed or ambiguous outcome',
      wildCard: 'Outcome subverts genre while resolving conflict'
    },
    mustNotInclude: [],
    mustNotResolve: [],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    therapistPrompt: 'How does the protagonist confront the core conflict directly?',
    writerPrompt: 'Force the confrontation. Maximize risk. Resolve the external conflict through action.',
    validatorPrompt: 'Does this beat resolve the primary external conflict through direct confrontation? Rate 0-1.'
  },

  11: {
    beatNumber: 11,
    title: BeatTitle.BecomingSomeoneNew,
    purpose: 'Show consequences of the confrontation.',
    structuralObligation: 'Depict immediate results of the confrontation. Avoid new tension. Allow emotional and situational consequences to land.',
    requiredStoryBibleFields: [],
    requiredChange: {
      before: 'Events are in motion',
      after: 'Consequences have settled'
    },
    directionModifiers: {
      positive: 'Aftermath shows healing or gain',
      negative: 'Aftermath shows loss or emptiness',
      neutral: 'Aftermath shows stability',
      wildCard: 'Aftermath reframes meaning without reopening conflict'
    },
    mustNotInclude: ['new tension'],
    mustNotResolve: [],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    therapistPrompt: 'What are the immediate consequences of the confrontation?',
    writerPrompt: 'Show the aftermath. Let consequences land without new tension.',
    validatorPrompt: 'Does this beat show settled consequences without introducing new tension? Rate 0-1.'
  },

  12: {
    beatNumber: 12,
    title: BeatTitle.HowItAllEnds,
    purpose: 'Provide emotional and thematic closure.',
    structuralObligation: 'Reveal how the protagonist has changed. Echo or contrast the opening beat. Provide emotional closure without explanation.',
    requiredStoryBibleFields: [],
    requiredChange: {
      before: 'Emotional arc is unresolved',
      after: 'Story is complete'
    },
    directionModifiers: {
      positive: 'Growth, peace, or fulfillment',
      negative: 'Tragedy, resignation, or moral cost',
      neutral: 'Acceptance or equilibrium',
      wildCard: 'Ending challenges expectation while answering the core question'
    },
    mustNotInclude: [],
    mustNotResolve: [],
    requiredPreviousBeats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    therapistPrompt: 'How has the protagonist changed from the beginning?',
    writerPrompt: 'Show how the protagonist has changed. Echo or contrast the opening. Provide closure.',
    validatorPrompt: 'Does this beat reveal character change and provide emotional closure? Rate 0-1.'
  }
};

/**
 * Global rules that apply to all beats
 */
export const GLOBAL_BEAT_RULES = {
  singleContinuousSequence: 'The story is a single continuous sequence of beats',
  respectLockedCanon: 'Each beat must respect all locked canon',
  applyDirectionVector: 'Apply the user-selected direction vector (tone)',
  noFutureInvalidation: 'No beat may introduce elements that invalidate future beats',
  noEarlyResolution: 'No beat may resolve conflicts reserved for later beats',
  proportionalOutput: 'Output length should be proportional and concise unless otherwise specified'
};
