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
    worryWindow: {
      isSet: false,
      durationMinutes: 15,
    },
  },
  {
    id: 'page-designer',
    title: "I feel like I'm not a good designer",
    date: 'Oct 29',
    category: 'Work',
    sessionDurationMinutes: 12,
    rootWorry: "I feel like I'm not a good designer",
    triggerContext: 'Work',
    situationEvent: 'Lead critique in design review call',
    mindStory: 'I might freeze up and fail the final client demo',
    positiveReframe: "Am I good enough, or do I need to become better before I can feel confident in myself?",
    canActOnWorry: 'yes',
    combinedBestWorst: {
      bestCase: "Draft is praised and we ship the final design on schedule",
      worstCase: "Lead asks for another review pass, and I have to revise"
    },
    canActNow: 'no',
    knowWhenAct: 'yes',
    scheduledDate: '2026-11-04',
    scheduledTime: '10:00',
    calendarEventCreated: true,
    calendarEventSummary: 'Gentle Step: Rehearse slide 1 out loud',
    signOffWorry: {
      date: "Tomorrow at 10:00 AM",
      name: "Alex"
    },
    canAct: 'yes',
    decisionNeeded: 'yes',
    activePathway: 'make_a_decision',
    makeDecision: {
      decisionFacing: 'Rewrite presentation or practice as-is',
      bestCase: 'I deliver confidently and get approval',
      worstCase: 'I freeze up and feel embarrassed',
      gutFeelings: 'Nervous but eager to do well',
      pluses: ['Clearer messaging', 'Shows dedication', 'Reduces risk'],
      minuses: ['Takes 2 hours', 'Less sleep tonight'],
      intuitiveConclusion: 'Practice 3 key slides only',
      rationalConclusion: 'Slides are fine; focus on delivery',
      decision: 'Keep current slides and practice speech',
      nextStep: 'Rehearse slide 1 out loud'
    },
    controlTiming: 'stuck',
    stuckDecision: {
      bestCase: 'I pass the review and ship the final design',
      worstCase: 'I freeze up and feel embarrassed in front of team',
      gutVote: '📝 Prepare 1 key point',
      aiPriorities: {
        topPriority: {
          action: 'Write down 1 core user journey walkthrough story (5 mins)',
          why: 'Directly shields you from freezing up during review.'
        },
        secondary: {
          action: 'Align spacing tokens in Figma'
        },
        letGo: {
          action: 'Stop trying to predict client reaction. You cannot control that.'
        }
      }
    },
    branches: [
      {
        id: 'br-1',
        questionLabel: 'What happened?',
        userAnswer: "My lead said my draft wasn't ready for the review.",
        followUpQuestionLabel: 'What was said?',
        followUpAnswer: "'I think this needs another pass.'",
        isAiBranch: true,
      },
      {
        id: 'br-2',
        questionLabel: 'Where was it?',
        userAnswer: 'Tuesday, around 3:30 pm, after standup.',
      },
      {
        id: 'br-3',
        questionLabel: 'Who was there?',
        userAnswer: 'My lead and two engineers, on a call.',
      },
      {
        id: 'br-4',
        questionLabel: 'How did it feel?',
        userAnswer: 'Hot face, tight chest. Wanted to close my laptop.',
        followUpQuestionLabel: 'Where in body?',
        followUpAnswer: 'Chest, face, hands? Write it here.',
        isAiBranch: true,
      },
      {
        id: 'br-5',
        questionLabel: 'Anything else?',
        userAnswer: '',
      },
    ],
    factsCard: {
      text: 'Tuesday, 3:30 pm. My lead said the draft needed another pass. Two engineers were on the call.',
      confirmed: true,
    },
    thoughtReframe: {
      text: "I'm having the thought that I'm not a good designer.",
      nature: 'passing_event',
    },
    controlDials: [
      { id: 'cd-1', label: 'Whether the review goes well', value: 0.20 },
      { id: 'cd-2', label: 'How my lead reacts', value: 0.15 },
      { id: 'cd-3', label: 'My next draft', value: 0.80 },
    ],
    actionPlan: {
      ifClause: 'If I open the draft Wed 10 am',
      thenClause: "Then I'll list the three changes asked for",
      untilClause: 'Until it fits one page, or 11:30 am',
    },
    worryWindow: {
      isSet: true,
      scheduledTime: '4:30 PM',
      durationMinutes: 15,
    },
  },
  {
    id: 'page-milestone',
    title: 'Quarterly milestone uncertainty',
    date: 'Oct 27',
    category: 'Work',
    sessionDurationMinutes: 8,
    rootWorry: "We might miss our sprint target before Friday's executive review.",
    branches: [
      {
        id: 'br-m1',
        questionLabel: 'What happened?',
        userAnswer: 'Two backend PRs got held up in architectural review.',
        followUpQuestionLabel: 'What was said?',
        followUpAnswer: "'Need more unit test coverage before merging.'",
        isAiBranch: true,
      },
      {
        id: 'br-m2',
        questionLabel: 'Where was it?',
        userAnswer: 'Slack engineering channel, 11:15 AM.',
      },
      {
        id: 'br-m3',
        questionLabel: 'Who was there?',
        userAnswer: 'Tech lead and QA manager.',
      },
      {
        id: 'br-m4',
        questionLabel: 'How did it feel?',
        userAnswer: 'Racing pulse, restless leg, feeling rushed.',
      },
    ],
    factsCard: {
      text: 'Two PRs awaiting unit test reviews from tech lead before Friday.',
      confirmed: true,
    },
    thoughtReframe: {
      text: "I'm having the thought that the entire release will fail because of me.",
      nature: 'passing_event',
    },
    controlDials: [
      { id: 'cd-m1', label: 'When tech lead approves the PR', value: 0.10 },
      { id: 'cd-m2', label: 'Writing the 3 missing test cases myself', value: 0.90 },
      { id: 'cd-m3', label: 'Executive reaction', value: 0.05 },
    ],
    actionPlan: {
      ifClause: 'If I start paired testing at 1:30 PM',
      thenClause: 'Then I will write the missing assertions for auth endpoints',
      untilClause: 'Until all 3 unit test suites turn green',
    },
    worryWindow: {
      isSet: false,
      durationMinutes: 15,
    },
  },
  {
    id: 'page-rent',
    title: 'Rent and budget next month',
    date: 'Oct 24',
    category: 'Money',
    sessionDurationMinutes: 6,
    rootWorry: 'Sudden car repair bill might make next month tight.',
    branches: [
      {
        id: 'br-r1',
        questionLabel: 'What happened?',
        userAnswer: 'Brake pads and rotor replacement quote came out to $480.',
      },
      {
        id: 'br-r2',
        questionLabel: 'Where was it?',
        userAnswer: 'Auto shop receipt received Monday afternoon.',
      },
      {
        id: 'br-r3',
        questionLabel: 'Who was there?',
        userAnswer: 'Mechanic at the front desk.',
      },
      {
        id: 'br-r4',
        questionLabel: 'How did it feel?',
        userAnswer: 'Sinking feeling in the stomach, clenched jaw.',
      },
    ],
    factsCard: {
      text: 'Car repair was $480. Checking discretionary budget for November.',
      confirmed: true,
    },
    thoughtReframe: {
      text: "I'm having the thought that I am financially reckless.",
      nature: 'passing_event',
    },
    controlDials: [
      { id: 'cd-r1', label: 'Past repair cost', value: 0.00 },
      { id: 'cd-r2', label: 'November dining out budget adjustment', value: 0.85 },
      { id: 'cd-r3', label: 'Checking savings reserve', value: 1.00 },
    ],
    actionPlan: {
      ifClause: 'If I log into banking portal tonight after dinner',
      thenClause: 'Then I will transfer $480 from the emergency fund',
      untilClause: 'Until the checking balance reflects the baseline $1,000 threshold',
    },
    worryWindow: {
      isSet: false,
      durationMinutes: 15,
    },
  },
];
