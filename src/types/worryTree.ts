export interface TreeBranch {
  id: string;
  questionLabel: string;
  userAnswer: string;
  followUpQuestionLabel?: string;
  followUpAnswer?: string;
  isAiBranch?: boolean;
  stepType?: 'trigger' | 'what_happened' | 'body_thought' | 'custom';
}

export interface ControlDialItem {
  id: string;
  label: string;
  value: number; // 0.00 to 1.00
}

export type PathwayType = 'make_a_decision' | 'action_plan' | 'non_actionable' | null;

export interface NonActionableState {
  influence?: string;    // "What can you influence?" (max 5 words)
  helpsNow?: string;     // "What helps now?" (max 5 words)
  canRevisit?: string;   // "Can you revisit it?" (max 5 words)
  copingPlan?: string;   // Coping / Revisit outcome
}

export interface ActionPlanState {
  changeable?: string;   // "What can you change?" (max 5 words)
  action?: string;       // "What can you do?" (max 5 words)
  whenAct?: string;      // "When will you act?" (max 5 words)
  actionOutcome?: string;// Action outcome
  nextStep?: string;     // "What will you do first?" (max 5 words)
}

export interface MakeDecisionState {
  decisionFacing?: string;      // Node 01: Make a Decision ("What decision are you facing?")
  bestCase?: string;            // Node 02: Best-case scenario ("What could go right?")
  worstCase?: string;           // Node 03: Worst-case scenario ("What could go wrong?")
  gutFeelings?: string;         // Node 04: Gut feelings ("How do you feel about it?")
  pluses: string[];             // Node 05: Pluses (Benefits)
  minuses: string[];            // Node 05: Minuses (Drawbacks)
  intuitiveConclusion?: string; // Node 06: Intuitive conclusion ("What does instinct suggest?")
  rationalConclusion?: string;  // Node 07: Rational conclusion ("What does evidence suggest?")
  decision?: string;            // Node 08: Decision ("What is your decision?")
  nextStep?: string;            // Node 09: Next step ("What will you do first?")
}

export interface DiaryPage {
  id: string;
  title: string;
  date: string;
  category: 'Work' | 'Education' | 'Health' | 'Social' | 'Finances' | 'Relationships' | 'Personal Growth' | 'School' | 'Money' | 'Other' | 'General';
  sessionDurationMinutes: number;
  rootWorry: string;
  triggerContext?: string;
  situationEvent?: string; // Follow-up node: "What happened?" (2-3 words prompt, max 5 words answer)
  mindStory?: string;      // Explore fear node: "What's the fear?" (max 5 words answer)
  
  // PRD Gate 1: "Can you act on it?" (Yes / No)
  canAct?: 'yes' | 'no' | null;

  // Node T3: Positive Reframe Inquiry
  positiveReframe?: string;
  positiveReframeOptions?: string[];

  // Node A1: "Is this worry something you can act on?" (Yes / No)
  canActOnWorry?: 'yes' | 'no' | null;

  // Node D1: Combined Best & Worst Case
  combinedBestWorst?: {
    bestCase: string;
    worstCase: string;
  };

  // Action Ladder: What -> How -> When
  actionLadder?: {
    whatCanDo?: string;
    howCanDo?: string;
    whenTiming?: 'now' | 'scheduled' | null;
  };

  // Action Trio: What / When / How (3 horizontal boxes in a row)
  actionTrio?: {
    what: string;
    when: string;
    how: string;
    completed?: boolean;
  };
  actionTiming?: 'now' | 'later' | null;
  anchorThought?: string;
  letWorryGoSealed?: boolean;

  // Node E1: "Can you act on this now?" (Yes / No)
  canActNow?: 'yes' | 'no' | null;
  immediateAction?: string; // "Let's do it!" micro-step

  // When check & Sign off
  knowWhenAct?: 'yes' | 'no' | null;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  calendarEventCreated?: boolean;
  calendarEventLink?: string;
  calendarEventSummary?: string;
  signOffWorry?: {
    date: string;
    name: string;
    signatureDrawing?: string;
    mode?: 'draw' | 'type';
  };

  // Cognitive Release Mindful Acceptance
  cognitiveRelease?: {
    reassuranceText?: string;
    breathsCompleted?: number;
    parked?: boolean;
  };

  // PRD Gate 2: "Decision needed?" (Yes / No) - only active if canAct === 'yes'
  decisionNeeded?: 'yes' | 'no' | null;

  // Active pathway derived from gates
  activePathway?: PathwayType;

  // Pathway specific states
  nonActionable?: NonActionableState;
  actionPlanState?: ActionPlanState;
  makeDecision?: MakeDecisionState;

  // Legacy compatibility fields
  controlTiming?: 'right_now' | 'later' | 'stuck' | null;
  rightNowAction?: {
    selectedChip?: string;
    ifThenRule?: string;
  };
  laterBreathing?: {
    completed: boolean;
    secondsElapsed: number;
  };
  stuckDecision?: {
    bestCase?: string;
    worstCase?: string;
    gutVote?: string;
    aiPriorities?: {
      topPriority?: { action: string; why: string };
      secondary?: { action: string };
      letGo?: { action: string };
    };
    finalDecision?: string;
  };
  branches: TreeBranch[];
  factsCard: {
    text: string;
    confirmed: boolean;
  };
  thoughtReframe: {
    text: string;
    nature: 'passing_event' | 'fact_now' | 'unselected';
  };
  controlDials: ControlDialItem[];
  actionPlan: {
    ifClause: string;
    thenClause: string;
    untilClause: string;
  };
  worryWindow: {
    isSet: boolean;
    scheduledTime?: string;
    durationMinutes: number;
  };
}

export const INITIAL_DIARY_PAGES: DiaryPage[] = [
  {
    id: 'page-new',
    title: 'New Worry Journal',
    date: 'Today',
    category: 'General',
    sessionDurationMinutes: 1,
    rootWorry: '',
    triggerContext: '',
    situationEvent: '',
    mindStory: '',
    canAct: null,
    canActOnWorry: null,
    decisionNeeded: null,
    activePathway: null,
    makeDecision: {
      pluses: [],
      minuses: [],
    },
    controlTiming: null,
    branches: [],
    factsCard: {
      text: '',
      confirmed: false,
    },
    thoughtReframe: {
      text: '',
      nature: 'unselected',
    },
    controlDials: [
      { id: 'cd-1', label: 'Situation aspect', value: 0.3 },
      { id: 'cd-2', label: 'My next direct step', value: 0.8 },
    ],
    actionPlan: {
      ifClause: '',
      thenClause: '',
      untilClause: '',
    },
    actionTrio: {
      what: '',
      when: '',
      how: '',
      completed: false,
    },
    actionTiming: null,
    anchorThought: '',
    letWorryGoSealed: false,
    worryWindow: {
      isSet: false,
      durationMinutes: 15,
    },
  },
];
