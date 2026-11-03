import { FramingSession, SituationalElement, WorryContext } from '../types/metacognitive';

export const PANIC_REGEX = /(can'?t\s+breathe|heart\s+pounding|hyperventilat|chest\s+pain|suffocat|going\s+to\s+pass\s+out|choking|dying\s+right\s+now)/i;

export const METAWORRY_REGEX = /(going\s+crazy|worry\s+will\s+kill\s+me|losing\s+control\s+of\s+my\s+mind|cannot\s+control\s+my\s+worrying|can'?t\s+stop\s+this\s+thinking|losing\s+my\s+mind)/i;

export const ABSTRACT_KEYWORDS = [
  'always', 'never', 'ruined', 'disaster', 'impossible', 'everything', 'nothing',
  'completely failed', 'everyone', 'catastrophe', 'terrible', 'hopeless', 'pointless',
  'mess', 'ruin', 'destroy', 'broken', 'failure', 'worst'
];

export const SENSORY_TAG_OPTIONS = [
  { id: 'feet_on_floor', label: 'Feet planted on floor' },
  { id: 'ambient_hum', label: 'Ambient room hum' },
  { id: 'contact_chair', label: 'Back contact with chair' },
  { id: 'breath_temp', label: 'Cool air on inhalation' },
  { id: 'palms_on_table', label: 'Weight of hands on table' },
  { id: 'visual_horizon', label: 'Distant object in sight' },
  { id: 'chest_tension', label: 'Noticeable chest tension' },
  { id: 'jaw_clench', label: 'Slight jaw tension' }
];

export const VALUES_TAXONOMY = [
  {
    id: 'RELATIONSHIPS' as const,
    label: 'Relationships & Connection',
    description: 'Being an honest, present, and compassionate friend, partner, or teammate'
  },
  {
    id: 'CAREER_GROWTH' as const,
    label: 'Craft & Professional Integrity',
    description: 'Focusing on concrete craftsmanship, clear communication, and deliberate practice'
  },
  {
    id: 'HEALTH' as const,
    label: 'Health & Vitality',
    description: 'Nourishing physical and psychological resilience through grounded action'
  },
  {
    id: 'PERSONAL_INTEGRITY' as const,
    label: 'Personal Integrity & Courage',
    description: 'Acting in alignment with inner principles even when anxiety is present'
  }
];

export function analyzeAbstractText(text: string): {
  abstractnessIndex: number;
  matchedTerms: string[];
  isTooAbstract: boolean;
} {
  if (!text || text.trim().length === 0) {
    return { abstractnessIndex: 0, matchedTerms: [], isTooAbstract: false };
  }

  const lower = text.toLowerCase();
  const matchedTerms = ABSTRACT_KEYWORDS.filter(term => lower.includes(term));
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 4) {
    return { abstractnessIndex: 0.5, matchedTerms, isTooAbstract: true };
  }

  const index = Math.min(1.0, (matchedTerms.length * 2.2) / wordCount);
  return {
    abstractnessIndex: parseFloat(index.toFixed(2)),
    matchedTerms,
    isTooAbstract: index > 0.35
  };
}

// Validates whether the stop signal is based on an objective external milestone vs an internal feeling state
export function validateStopSignal(stopSignal: string): {
  isValid: boolean;
  message?: string;
} {
  if (!stopSignal || stopSignal.trim().length < 4) {
    return { isValid: false, message: 'Stop signal must be specified.' };
  }

  const internalFeelingKeywords = [
    'feel calm', 'feel secure', 'feel better', 'feel good', 'feel safe',
    'stop being anxious', 'no longer worry', 'feel peaceful', 'relax', 'feel sure'
  ];

  const lower = stopSignal.toLowerCase();
  const hasInternalFeeling = internalFeelingKeywords.some(kw => lower.includes(kw));

  if (hasInternalFeeling) {
    return {
      isValid: false,
      message: 'Per clinical ACT guidelines: The stop signal must be an external, observable milestone (e.g., "when the clock hits 2:30 PM" or "when the 1-page email is sent"), not an internal emotional feeling.'
    };
  }

  return { isValid: true };
}

// Sample starter session showcasing the clear 4-step progressive mind map
export const SAMPLE_INITIAL_SESSION: FramingSession = {
  id: 'session-demo-01',
  title: 'Client Review & Project Milestone',
  createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  updatedAt: new Date().toISOString(),
  context: 'Work',
  currentStep: 1,
  completedSteps: [1],
  rawWorryText: 'I feel like this upcoming project delivery might get delayed and everyone will be disappointed in me.',
  selectedChips: ['Work', 'Deadlines'],
  subWorries: [
    {
      id: 'sub-1',
      question: 'Will the client review go smoothly?',
      tags: ['Work', 'People'],
      thoughtNature: 'transient_event',
      canAct: true,
      actionText: 'Send the 1-page benchmark document before the call',
      whenText: 'Today at 2:00 PM',
      completed: true,
    },
    {
      id: 'sub-2',
      question: 'What if server latency spikes during demo?',
      tags: ['Uncertainty'],
      thoughtNature: 'transient_event',
      canAct: false,
      actionText: '',
      whenText: '',
      completed: true,
    }
  ],
  timestampAnchor: new Date().toISOString(),
  abstractnessIndex: 0.25,
  matchedAbstractTerms: ['everyone', 'delayed'],
  isTooAbstract: false,
  whoWasThere: 'Team lead and client account manager',
  exactWordsSaid: 'Please make sure the test results are documented before tomorrow afternoon',
  locationDetails: 'Office desk',
  sensoryGroundingTags: ['feet_on_floor', 'ambient_hum'],
  concreteFactSummary: 'Client review is tomorrow afternoon. Test results need to be compiled.',

  parsedThoughtString: 'I feel like this project might get delayed and everyone will be disappointed',
  selectedDefusionFrame: 'THOUGHT_OBSERVATION',
  defusionReframings: [
    {
      type: 'THOUGHT_OBSERVATION',
      framedThought: 'I notice my mind having the thought that this project might get delayed',
      metaphorPrompt: 'Observe this sentence like words on a passing billboard.'
    }
  ],
  metacognitiveBeliefRating: 2,
  thoughtNatureVerification: 'transient_event',
  selfAsContextOverlayDismissed: true,

  situationalElements: [
    {
      id: 'elem-1',
      description: 'Compiling the performance test results into a 1-page document',
      sliderValue: 0.85,
      category: 'CONTROLLABLE',
      selectedValueId: 'CAREER_GROWTH',
      ifTriggerCondition: 'When I sit at my desk at 10:00 AM',
      thenActionCommitment: 'I will write the test summary table',
      executionStopSignalCriteria: 'When the 1-page document is exported'
    },
    {
      id: 'elem-2',
      description: "How other people feel or react during the meeting",
      sliderValue: 0.15,
      category: 'UNCONTROLLABLE',
      uncontrollableEmotion: 'nervousness',
      valuedActivity: 'speaking clearly and listening calmly',
      willingnessStatement: 'I am willing to let go of predicting their reactions and focus on speaking clearly.'
    }
  ],

  isRestartingWorry: false,
  isCompleted: false,
  wordCount: 22,
  sessionDurationSeconds: 120,
  panicDetected: false,
  metaWorryDetected: false,
  ruminationTriggered: false
};
