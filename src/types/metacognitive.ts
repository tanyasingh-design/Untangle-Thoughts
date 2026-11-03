export type WorryContext = 'Work' | 'Family' | 'Health' | 'Finance' | 'Relationships' | 'General';

export type DefusionFrameType = 'THOUGHT_OBSERVATION' | 'PASSENGERS_ON_BUS' | 'LEAVES_ON_STREAM';

export type ValueCategory = 'RELATIONSHIPS' | 'CAREER_GROWTH' | 'HEALTH' | 'PERSONAL_INTEGRITY';

export interface SituationalElement {
  id: string;
  description: string;
  sliderValue: number; // 0.00 to 1.00
  category: 'CONTROLLABLE' | 'UNCONTROLLABLE';
  // If uncontrollable (Branch 3A)
  uncontrollableEmotion?: string;
  valuedActivity?: string;
  willingnessStatement?: string;
  // If controllable (Branch 3B)
  selectedValueId?: ValueCategory;
  ifTriggerCondition?: string;
  thenActionCommitment?: string;
  executionStopSignalCriteria?: string;
}

export interface DefusionReframing {
  type: DefusionFrameType;
  framedThought: string;
  metaphorPrompt: string;
}

export interface SubWorryBranch {
  id: string;
  question: string;
  tags?: string[];
  thoughtNature?: 'transient_event' | 'literal_fact';
  canAct?: boolean;
  actionText?: string;
  whenText?: string;
  completed?: boolean;
}

export interface FramingSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  context: WorryContext;
  currentStep: number; // 1, 2, 3, 4
  completedSteps: number[];

  // Node 1: Input & Concrete Deconstruction
  rawWorryText: string;
  selectedChips?: string[];
  subWorries?: SubWorryBranch[];
  timestampAnchor: string;
  abstractnessIndex: number;
  matchedAbstractTerms: string[];
  isTooAbstract: boolean;
  whoWasThere?: string;
  exactWordsSaid?: string;
  locationDetails?: string;
  sensoryGroundingTags: string[];
  concreteFactSummary: string;

  // Node 2: Metacognitive Defusion Step
  parsedThoughtString: string;
  selectedDefusionFrame: DefusionFrameType;
  defusionReframings: DefusionReframing[];
  metacognitiveBeliefRating: number; // 1-5 (5 = strong fusion)
  thoughtNatureVerification: 'unselected' | 'literal_fact' | 'transient_event';
  selfAsContextOverlayDismissed: boolean;

  // Node 3: Decision Branch - Spectrum Analysis
  situationalElements: SituationalElement[];

  // Node 4: Synthesis & Postponement Protocol
  isRestartingWorry: boolean | null;
  postponementTimestamp?: string;
  postponementDurationMinutes?: number;
  isCompleted: boolean;

  // Telemetry & Safeguards
  wordCount: number;
  sessionDurationSeconds: number;
  panicDetected: boolean;
  metaWorryDetected: boolean;
  ruminationTriggered: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  nodeReference?: number;
}
