import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  ExternalLink,
  X,
  Download,
} from 'lucide-react';
import { DiaryPage } from '../types/worryTree';
import {
  buildGoogleCalendarTemplateUrl,
  downloadIcsCalendarFile,
} from '../utils/googleCalendarAuth';
import { formatReadableSchedule } from './PostcardExportModal';

interface WorryTreeCanvasProps {
  page: DiaryPage;
  onUpdatePage: (updated: DiaryPage | ((prev: DiaryPage) => DiaryPage)) => void;
  onNewPage?: () => void;
  onOpenExportPreview?: () => void;
  onOpenPlan?: () => void;
  isPlanOpen?: boolean;
}

const GENTLE_CONTEXTS: Array<
  'General' | 'Work' | 'Health' | 'Relationships' | 'Finances' | 'Personal Growth'
> = ['General', 'Work', 'Health', 'Relationships', 'Finances', 'Personal Growth'];

const CONTEXTUAL_REFRAMES: Record<string, Array<{ quote: string; sub: string }>> = {
  General: [
    {
      quote: '“Do I need to have this whole worry figured out right now, or can I take just one calm step first?”',
      sub: "You don't have to carry the entire future today—clarity grows naturally once you touch one small piece.",
    },
    {
      quote: '“Is my mind showing me a proven fact, or just an anxious story trying to protect me?”',
      sub: 'You have walked through uncertainty before and found your footing one honest step at a time.',
    },
    {
      quote: '“Am I good enough as I am right now, or am I holding myself to an impossible standard?”',
      sub: 'It is safe to soften your shoulders and meet this moment without harsh self-judgment.',
    },
  ],
  Work: [
    {
      quote: '“Does this single task define my worth, or is it just one piece of work I can approach step by step?”',
      sub: 'You are a human being, not a machine, and doing one calm, realistic step today is enough.',
    },
    {
      quote: "“Do I have to solve tomorrow's entire workload tonight, or can I focus only on the next ten minutes?”",
      sub: 'Done calmly and imperfectly is far healthier than chasing an exhausting perfection.',
    },
  ],
  Health: [
    {
      quote: '“Will worrying harder heal my body faster, or does my body need patience and gentle care today?”',
      sub: 'Ruminating on what-ifs drains your energy, while one kind choice gives your body real support.',
    },
    {
      quote: '“Do I need an overnight transformation, or can I care for my health one small habit at a time?”',
      sub: 'Right now, in this present breath, you can meet your body with kindness instead of pressure.',
    },
  ],
  Relationships: [
    {
      quote: '“Do I have to carry every emotion in this relationship alone, or can I hold my part with honest boundaries?”',
      sub: 'You care deeply, and that is why it hurts—give both yourself and others a little breathing room.',
    },
    {
      quote: '“Does a tense moment mean connection is broken, or do hearts just need quiet space before talking?”',
      sub: 'Gentle patience with yourself and a calm voice are enough for today.',
    },
  ],
  Finances: [
    {
      quote: "“Will panicking change tomorrow's numbers, or can I look at just one practical piece calmly?”",
      sub: 'Your worth is never measured by a balance sheet, and you will figure this out step by step.',
    },
  ],
  'Personal Growth': [
    {
      quote: '“Am I good enough, or do I need to become better before I can feel confident in myself?”',
      sub: 'Confidence does not require perfection first—you are allowed to trust yourself while you are still growing.',
    },
    {
      quote: '“Am I truly falling behind, or am I just comparing my own chapter to someone else’s timeline?”',
      sub: 'Life moves in waves and loops, never in a rigid straight line.',
    },
  ],
};

// Elastic spring drag helper for inline nodes — disables accidental drag while editing inputs
const getSpringDragProps = (isEditing: boolean) => ({
  drag: !isEditing,
  dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
  dragElastic: 0.22,
  dragMomentum: false,
  whileDrag: { scale: 1.025, cursor: 'grabbing' },
  transition: { type: 'spring' as const, stiffness: 260, damping: 20 },
});

// Helper to get YYYY-MM-DD for offset days from today
const getFutureDateIso = (daysToAdd: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getUpcomingWeekendIso = (): string => {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
  const daysUntilSat = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7 || 6;
  return getFutureDateIso(daysUntilSat);
};

// Parse a user's "when?" note or chip into timing intent ('now' | 'later' | 'unknown') + concrete YYYY-MM-DD & HH:mm
const parseWhenTextToSchedule = (
  whenText?: string
): {
  intent: 'now' | 'later' | 'unknown';
  label: string;
  date: string;
  time: string;
} => {
  const raw = (whenText || '').trim();
  const lower = raw.toLowerCase();

  if (!raw || /^(not sure|unsure|don'?t know|no idea|someday|maybe later)$/i.test(lower)) {
    return {
      intent: 'unknown',
      label: '',
      date: getFutureDateIso(1),
      time: '10:00',
    };
  }

  // Immediate / Right Now intent
  if (
    /\b(right now|now|immediately|in\s+[1-9]\s*m(in|ins|inutes)?|in\s+10\s*m(in|ins|inutes)?|after a deep breath|right after water|for 5 mins only)\b/i.test(
      lower
    )
  ) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return {
      intent: 'now',
      label: raw,
      date: getFutureDateIso(0),
      time: `${hh}:${mm}`,
    };
  }

  // Extract explicit clock time if present (e.g. "7 pm", "9:30 am", "21:00")
  let explicitTime: string | null = null;
  const amPmMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (amPmMatch) {
    let hour = parseInt(amPmMatch[1], 10);
    const mins = amPmMatch[2] || '00';
    const meridiem = amPmMatch[3].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    explicitTime = `${String(hour).padStart(2, '0')}:${mins}`;
  }

  if (/before bed|before sleep|bedtime/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(0),
      time: explicitTime || '21:30',
    };
  }

  if (/tonight|this evening|before tonight|evening/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(0),
      time: explicitTime || '20:00',
    };
  }

  if (/this afternoon|after lunch|afternoon/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(0),
      time: explicitTime || '15:00',
    };
  }

  if (/before lunch|next mealtime|lunchtime|noon/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(0),
      time: explicitTime || '12:30',
    };
  }

  if (/tomorrow morning/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(1),
      time: explicitTime || '09:00',
    };
  }

  if (/tomorrow/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(1),
      time: explicitTime || '10:00',
    };
  }

  if (/in 3 days|few days/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(3),
      time: explicitTime || '10:00',
    };
  }

  if (/weekend|saturday|sunday/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getUpcomingWeekendIso(),
      time: explicitTime || (/morning/i.test(lower) ? '09:30' : '11:00'),
    };
  }

  if (/next week/i.test(lower)) {
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(7),
      time: explicitTime || '10:00',
    };
  }

  if (
    /in 15 mins|in 20 mins|in 30 mins|in an hour|once things cool|after a short break|after a quiet walk|today/i.test(
      lower
    )
  ) {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const hh = String(d.getHours()).padStart(2, '0');
    return {
      intent: 'later',
      label: raw,
      date: getFutureDateIso(0),
      time: explicitTime || `${hh}:00`,
    };
  }

  return {
    intent: 'later',
    label: raw,
    date: getFutureDateIso(0),
    time: explicitTime || '19:00',
  };
};

/**
 * Character-by-character typewriter component for HTML text
 */
const TypewriterText: React.FC<{
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
}> = ({ text, delay = 0, speed = 0.02, className = '' }) => {
  const chars = Array.from(text);
  return (
    <motion.span
      key={text}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay,
            staggerChildren: speed,
          },
        },
      }}
      className={className}
    >
      {chars.map((char, index) => (
        <motion.span
          key={`${index}-${char}`}
          variants={{
            hidden: { opacity: 0, y: 2 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.11 }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
};

/**
 * Character-by-character typewriter inside an SVG <textPath> so text writes itself along a curve
 */
const SvgCurvedTypewriter: React.FC<{
  href: string;
  text: string;
  startOffset?: string;
  delay?: number;
  speed?: number;
  className?: string;
}> = ({ href, text, startOffset = '10%', delay = 0.85, speed = 0.024, className = '' }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setVisibleCount((prev) => {
          if (prev >= text.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, speed * 1000);
      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(startTimer);
  }, [text, delay, speed]);

  return (
    <text className={className}>
      <textPath href={href} startOffset={startOffset}>
        {text.slice(0, visibleCount)}
      </textPath>
    </text>
  );
};

export const WorryTreeCanvas: React.FC<WorryTreeCanvasProps> = ({
  page,
  onUpdatePage,
  onNewPage,
  onOpenExportPreview,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs for smooth horizontal & vertical auto-panning
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const stepForkRef = useRef<HTMLDivElement>(null);
  const stepFinalNoActRef = useRef<HTMLDivElement>(null);
  const stepActionTrioRef = useRef<HTMLDivElement>(null);
  const stepActNowForkRef = useRef<HTMLDivElement>(null);
  const stepFinalDoNowRef = useRef<HTMLDivElement>(null);
  const stepKnowWhenForkRef = useRef<HTMLDivElement>(null);
  const stepFinalScheduleRef = useRef<HTMLDivElement>(null);
  const stepFinalNoBandwidthRef = useRef<HTMLDivElement>(null);

  // Google Calendar Confirmation Modal State
  const [showCalendarConfirmModal, setShowCalendarConfirmModal] = useState<boolean>(false);
  const [customEventTitle, setCustomEventTitle] = useState<string>('');

  // Mobile touch & drag-and-drop / node-editing state
  const [isEditingNode, setIsEditingNode] = useState<boolean>(false);
  const [isCanvasGrabbing, setIsCanvasGrabbing] = useState<boolean>(false);
  const canvasPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const springDrag = getSpringDragProps(isEditingNode);

  // Progression stages
  const [unlocked, setUnlocked] = useState<{
    reframe: boolean;
    fork: boolean;
    noActEnd: boolean;
    actionTrio: boolean;
    actNowFork: boolean;
    doNowEnd: boolean;
    knowWhenFork: boolean;
    scheduleEnd: boolean;
    noBandwidthEnd: boolean;
  }>(() => {
    const hasWorry = Boolean(page.rootWorry && page.rootWorry.trim().length > 0);
    const hasReframe = Boolean(page.positiveReframe && page.positiveReframe.trim().length > 0);
    const canAct = page.canActOnWorry || page.canAct;
    const hasTrio = Boolean(
      page.actionTrio?.completed ||
        page.actionTrio?.what?.trim() ||
        page.actionTrio?.how?.trim() ||
        page.actionTrio?.when?.trim()
    );
    const actNow =
      page.canActNow ||
      (page.actionTiming === 'now' ? 'yes' : page.actionTiming === 'later' ? 'no' : null);
    const knowWhen = page.knowWhenAct;

    return {
      reframe: hasWorry,
      fork: hasWorry && hasReframe,
      noActEnd: canAct === 'no',
      actionTrio: canAct === 'yes',
      actNowFork: canAct === 'yes' && hasTrio,
      doNowEnd: canAct === 'yes' && actNow === 'yes',
      knowWhenFork: canAct === 'yes' && actNow === 'no',
      scheduleEnd: canAct === 'yes' && actNow === 'no' && knowWhen === 'yes',
      noBandwidthEnd: canAct === 'yes' && actNow === 'no' && knowWhen === 'no',
    };
  });

  useEffect(() => {
    const hasWorry = Boolean(page.rootWorry && page.rootWorry.trim().length > 0);
    const hasReframe = Boolean(page.positiveReframe && page.positiveReframe.trim().length > 0);
    const canAct = page.canActOnWorry || page.canAct;
    const hasTrio = Boolean(
      page.actionTrio?.completed ||
        page.actionTrio?.what?.trim() ||
        page.actionTrio?.how?.trim() ||
        page.actionTrio?.when?.trim()
    );
    const actNow =
      page.canActNow ||
      (page.actionTiming === 'now' ? 'yes' : page.actionTiming === 'later' ? 'no' : null);
    const knowWhen = page.knowWhenAct;

    setUnlocked({
      reframe: hasWorry,
      fork: hasWorry && hasReframe,
      noActEnd: canAct === 'no',
      actionTrio: canAct === 'yes',
      actNowFork: canAct === 'yes' && hasTrio,
      doNowEnd: canAct === 'yes' && actNow === 'yes',
      knowWhenFork: canAct === 'yes' && actNow === 'no',
      scheduleEnd: canAct === 'yes' && actNow === 'no' && knowWhen === 'yes',
      noBandwidthEnd: canAct === 'yes' && actNow === 'no' && knowWhen === 'no',
    });
  }, [page.id]);

  const [reframeIdx, setReframeIdx] = useState(0);
  const reframeIdxRef = useRef(0);
  reframeIdxRef.current = reframeIdx;

  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  const manualCategoryOverrideRef = useRef<boolean>(false);

  // Instant contextual baseline for category detection, micro-action chips, and insightful dilemma reframes
  const getLocalContextualSuggestions = useCallback((worryText: string, categoryText: string = 'General') => {
    const raw = (worryText || '').trim();
    const text = raw.toLowerCase();

    // Multi-category scoring so phrases like "Weight gain" or "over pressure for good lifestyle and status"
    // never fall back to a stale previous category
    let detectedCategory: (typeof GENTLE_CONTEXTS)[number] = 'General';

    if (text) {
      const scores: Record<Exclude<(typeof GENTLE_CONTEXTS)[number], 'General'>, number> = {
        Health: 0,
        Relationships: 0,
        Finances: 0,
        Work: 0,
        'Personal Growth': 0,
      };

      if (/weight\s*(gain|loss)|gaining\s*weight|losing\s*weight|body\s*image|out\s*of\s*shape|blood\s*pressure|hair\s*loss|back\s*pain|chest\s*pain|mental\s*health|panic\s*attack/i.test(text)) {
        scores.Health += 4;
      }
      if (/fights?\s+in\s+(the\s+)?house|at\s+home|mad\s+at\s+me|left\s+out|no\s+friends|break\s*up|relationship|family\s+tension/i.test(text)) {
        scores.Relationships += 4;
      }
      if (/good\s+enough|not\s+enough|fear\s+of\s+not|self[- ]doubt|imposter|impostor|lifestyle|status|social\s+status|good\s+life|society|expectations|pressure\s+to|peer\s+pressure|comparing\s+myself|keep\s+up\s+with|what\s+people\s+think|reputation|prestig|self[- ]worth|indecis|overthink|procrastinat|falling\s+behind/i.test(text)) {
        scores['Personal Growth'] += 4;
      }
      if (/can'?t\s+afford|cost\s+of\s+living|credit\s+card|bank\s+account|student\s+loan|pay\s+rent|pay\s+bills/i.test(text)) {
        scores.Finances += 4;
      }
      if (/job\s+interview|laid\s+off|work\s+deadline|final\s+exam|boss\s+is|performance\s+review/i.test(text)) {
        scores.Work += 4;
      }

      const healthTerms = text.match(
        /\b(weight|gain|gaining|overweight|underweight|bmi|fat|chubby|skinny|thin|calories|calorie|diet|dieting|binge|eating|appetite|food|sugar|carbs|metabolism|bloated|bloating|body|physique|shape|workout|gym|exercise|exercising|fitness|cardio|running|sedentary|sleep|sleeping|insomnia|oversleep|tired|exhausted|exhaustion|fatigue|drained|pain|ache|aching|sore|hurt|injury|injured|headache|migraine|stomach|nausea|dizzy|fever|flu|cold|cough|virus|infection|allergy|asthma|breathing|heart|cholesterol|diabetes|thyroid|hormone|period|cramps|pregnancy|pregnant|cancer|surgery|hospital|clinic|doctor|dentist|tooth|vision|eyes|hearing|skin|acne|rash|eczema|hair|balding|aging|knee|joint|muscle|medication|medicine|pills|checkup|diagnosis|scan|therapy|therapist|depression|depressed|panic|ptsd|adhd|health|healthy|unhealthy|sick|illness|symptom|symptoms|energy)\b/gi
      );
      if (healthTerms) scores.Health += healthTerms.length * 2;

      const relationshipTerms = text.match(
        /\b(fight|fights|fighting|fought|argue|arguing|argument|arguments|quarrel|yell|yelling|shout|shouting|conflict|tension|angry|upset|house|household|home|roommate|roommates|neighbor|family|parents|parent|mom|mother|dad|father|sister|brother|sibling|son|daughter|kids|child|children|baby|partner|spouse|husband|wife|boyfriend|girlfriend|fiance|ex|crush|date|dating|relationship|relationships|marriage|married|divorce|breakup|cheating|betrayal|jealous|jealousy|trust|ghosted|ignored|ignoring|friend|friends|friendship|social|awkward|lonely|loneliness|alone|isolated|excluded|rejected|rejection|abandon|boundaries|toxic|apologize|love)\b/gi
      );
      if (relationshipTerms) scores.Relationships += relationshipTerms.length * 2;

      const financeTerms = text.match(
        /\b(money|finance|finances|financial|bill|bills|rent|mortgage|lease|utilities|budget|budgeting|debt|debts|loan|loans|credit|interest|afford|affording|saving|savings|retirement|invest|investing|investment|stocks|crypto|expense|expenses|spending|overspending|bank|overdraft|balance|cost|costs|inflation|price|prices|expensive|broke|poor|bankrupt|paycheck|payday|salary|wage|income|tax|taxes|tuition|fee|fees|fine|insurance|refund|wealth|rich)\b/gi
      );
      if (financeTerms) scores.Finances += financeTerms.length * 2;

      const workTerms = text.match(
        /\b(work|working|job|jobs|career|profession|office|workplace|company|startup|business|boss|manager|supervisor|coworker|coworkers|colleague|team|client|clients|customer|interview|interviews|resume|cv|hiring|hired|fired|layoff|layoffs|unemployed|quit|quitting|resign|promotion|raise|deadline|deadlines|project|projects|task|tasks|deliverable|presentation|pitch|slides|demo|meeting|meetings|standup|slack|email|emails|inbox|report|code|coding|deployment|launch|workload|overtime|shift|commute|school|college|university|campus|degree|major|class|classes|course|lecture|professor|teacher|student|exam|exams|midterm|test|quiz|study|studying|homework|assignment|essay|thesis|research|grade|grades|gpa|scholarship|internship)\b/gi
      );
      if (workTerms) scores.Work += workTerms.length * 2;

      const growthTerms = text.match(
        /\b(enough|worthy|unworthy|worth|lifestyle|status|prestige|prestigious|reputation|image|expectations|expectation|pressure|pressured|society|standards|standard|comparison|comparing|compare|judged|judging|impress|proving|success|successful|ambition|ambitious|indecisive|indecision|decide|deciding|decision|decisions|choose|choosing|choice|choices|option|options|torn|unsure|uncertain|uncertainty|dilemma|hesitate|hesitating|doubt|doubting|overthink|overthinking|ruminate|ruminating|spiral|spiraling|looping|procrastinate|procrastinating|procrastination|avoid|avoiding|stuck|unmotivated|motivation|lazy|laziness|discipline|willpower|focus|distracted|overwhelmed|overwhelm|burnout|stressed|stress|future|direction|purpose|meaning|falling|behind|lost|mistake|mistakes|regret|regrets|guilt|guilty|embarrassed|shame|ashamed|failure|failing|failed|imposter|impostor|inadequate|insecure|insecurity|confidence|confident|perfectionism|perfectionist|habit|habits|routine|goal|goals|growth|improvement|change|changing|identity|potential|wasting)\b/gi
      );
      if (growthTerms) scores['Personal Growth'] += growthTerms.length * 2;

      let bestScore = 0;
      for (const [catName, score] of Object.entries(scores) as Array<
        [Exclude<(typeof GENTLE_CONTEXTS)[number], 'General'>, number]
      >) {
        if (score > bestScore) {
          bestScore = score;
          detectedCategory = catName;
        }
      }
    } else {
      detectedCategory =
        GENTLE_CONTEXTS.find((c) => c.toLowerCase() === (categoryText || 'General').toLowerCase().trim()) ||
        'General';
    }

    const cat = detectedCategory.toLowerCase();

    // 0A. Self-Worth / Fear of Not Being Good Enough / Impostor Syndrome / Confidence / Fear of Failure
    if (
      /good\s*enough|not\s*enough|worthy|unworthy|self[- ]worth|self[- ]doubt|self[- ]esteem|imposter|impostor|inadequate|inadequacy|inferior|insecure|insecurity|confidence|confident|fear\s+of\s+(not\s+being|failing|failure|rejection|being\s+judged)|falling\s+short|measure\s+up|mediocre/i.test(
        text
      )
    ) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['name 1 real strength', 'write 1 honest fact', 'do 1 small step', 'drop 1 harsh rule'],
        how: ['as a learner', 'without proving', 'kindly to myself'],
        when: ['right now', 'this evening', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Am I good enough, or do I need to become better before I can feel confident in myself?”',
            sub: 'Confidence does not wait for perfection—you are allowed to trust yourself while you are still growing.',
          },
          {
            quote: '“Is this fear proof that I am falling short, or am I measuring myself against an impossible standard?”',
            sub: 'Being hard on yourself only hides how far you have already come; your honest effort today is enough.',
          },
          {
            quote: '“Do I have to prove my worth through every outcome, or am I already worthy before I begin?”',
            sub: 'When your self-worth is not on trial, you can take small steps with curiosity instead of fear.',
          },
          {
            quote: '“What if being a work in progress is not a flaw, but the most human way to grow?”',
            sub: 'Give yourself permission to learn at a steady pace without treating every moment like a test.',
          },
        ],
      };
    }

    // 0B. Weight / Body Image / Diet / Fitness / Appearance
    if (
      /\b(weight|gain|gaining|overweight|underweight|bmi|fat|chubby|skinny|calories|calorie|diet|dieting|binge|eating|appetite|bloated|physique|shape|workout|gym|exercise|fitness)\b|weight\s*(gain|loss)|body\s*image|out\s*of\s*shape/i.test(
        text
      )
    ) {
      return {
        detectedCategory: 'Health',
        what: ['go for 10m walk', 'drink a glass water', 'plan 1 nourishing meal', 'stretch gently 5m'],
        how: ['with body kindness', 'no harsh judgment', 'one small habit'],
        when: ['right now', 'next mealtime', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Do I need to punish my body to change it, or can I care for it kindly one small habit at a time?”',
            sub: 'Lasting wellbeing grows from patience and steady care rather than harsh self-judgment today.',
          },
          {
            quote: '“Is my worth as a person measured by a scale, or do I deserve respect and kindness right now?”',
            sub: 'Treat your body like a dear friend you are gently supporting one day at a time.',
          },
          {
            quote: '“Do I have to fix my entire routine today, or is one ten-minute walk or nourishing meal enough?”',
            sub: 'Sustainable change happens quietly and peacefully, one calm choice at a time.',
          },
          {
            quote: '“Can I accept where my body is today while still taking gentle care of my health?”',
            sub: 'Let go of all-or-nothing pressure and focus on feeling cared for in this moment.',
          },
        ],
      };
    }

    // 0C. Lifestyle Pressure / Status / Expectations / Comparison
    if (
      /\b(lifestyle|status|prestige|prestigious|reputation|image|expectations|expectation|pressure|pressured|society|standards|comparison|comparing|compare|judged|impress|proving)\b/i.test(
        text
      )
    ) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['define my own enough', 'mute comparison feeds', 'name 1 real value', 'drop 1 expectation'],
        how: ['at my own pace', 'without comparing', 'honestly & simply'],
        when: ['right now', 'this evening', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Am I chasing what genuinely brings me peace, or exhausting myself to look successful to others?”',
            sub: 'A good life is measured by how calm and honest it feels inside, not how impressive it looks outside.',
          },
          {
            quote: '“Do I need higher status to feel worthy, or am I already enough without performing?”',
            sub: 'Stepping off the treadmill of comparison gives you back your own quiet joy.',
          },
          {
            quote: '“Whose timeline am I trying to satisfy—my own heart’s, or society’s shifting expectations?”',
            sub: 'Release the pressure to impress anyone today and breathe into what truly nourishes you.',
          },
          {
            quote: '“What if having peace of mind today is a higher achievement than keeping up with everyone else?”',
            sub: 'You already have enough and are enough in this present moment.',
          },
        ],
      };
    }

    // 1. Indecision / Decision-making
    if (/indecis|decid|decision|choos|choice|option|torn|unsure|dilemma|hesitat|second[- ]guess/i.test(text)) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['list 2 options', 'write pros & cons', 'pick 1 small choice', 'flip a coin test'],
        how: ['good enough choice', '5-min timer', 'without overthinking'],
        when: ['in 5 mins', 'after a deep breath', 'before tonight'],
        reaffirmations: [
          {
            quote: '“Do I need to find the one flawless choice, or can I pick a good-enough path and adjust as I go?”',
            sub: 'Clarity rarely comes from standing still—it grows after you take the first small step.',
          },
          {
            quote: '“Am I truly stuck, or am I just afraid of not being able to predict the whole future before I choose?”',
            sub: 'Choosing a good-enough option today sets your mind free from spinning in circles.',
          },
          {
            quote: '“Does a good decision require zero doubt, or can I move forward gently even while feeling unsure?”',
            sub: 'Give yourself permission to decide lightly and treat your choice as an experiment, not a verdict.',
          },
          {
            quote: '“What if both options can teach me something useful, and neither one will ruin my story?”',
            sub: 'Even a tiny decision unlocks momentum you cannot find by overthinking.',
          },
        ],
      };
    }

    // 2. Fights / Arguments / Home Tension
    if (
      /fight|fights|fighting|arguing|argument|yell|shouting|conflict|tension|mad at|angry|house|home|roommate|family|parents|mom|dad|sister|brother|partner|spouse|husband|wife|boyfriend|girlfriend/i.test(
        text
      )
    ) {
      return {
        detectedCategory: 'Relationships',
        what: ['take 5m quiet space', 'speak softly & briefly', 'write how i feel', 'step outside 5 mins'],
        how: ['calmly, low voice', 'listening first', 'without escalating'],
        when: ['right now', 'once things cool down', 'after a deep breath'],
        reaffirmations: [
          {
            quote: '“Do I have to absorb every loud emotion in the house, or can I step back and protect my calm first?”',
            sub: 'Taking five quiet minutes of space is not avoidance—it is how you keep your inner peace intact.',
          },
          {
            quote: '“Does a hard argument today mean everything is broken, or do heated moments just need quiet air first?”',
            sub: 'Choosing a calm pause or gentle boundary is an act of care for everyone in the room.',
          },
          {
            quote: '“Am I responsible for fixing everyone’s mood right now, or am I allowed to pause and breathe?”',
            sub: 'A few minutes of quiet space can soften even the sharpest disagreement.',
          },
          {
            quote: '“Can I care deeply about the people at home while still holding a boundary around my peace?”',
            sub: 'You can return to the conversation when hearts and voices feel more settled.',
          },
        ],
      };
    }

    // 3. Overthinking / Rumination
    if (/overthink|ruminat|spiral|racing mind|looping|can'?t stop thinking|analyz|obsess/i.test(text)) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['brain-dump on paper', 'name 1 true fact', 'step away 5 mins', 'focus on 1 task'],
        how: ['without judging it', 'on 1 small page', 'gently & slowly'],
        when: ['right now', 'for 5 mins only', 'before bed tonight'],
        reaffirmations: [
          {
            quote: '“Is replaying this thought ten more times helping me prepare, or is it just stealing my peace tonight?”',
            sub: 'You can notice your mind chattering without having to solve every "what if" right now.',
          },
          {
            quote: '“Are my anxious what-ifs proven facts, or just loud stories my tired mind is spinning?”',
            sub: 'Rest your attention on what is physically in front of you; that is enough for now.',
          },
          {
            quote: '“Do I need to solve the whole future in my head tonight, or can I set these thoughts down on paper?”',
            sub: 'You do not have to figure everything out in a single sitting.',
          },
          {
            quote: '“What if I noticed this worry like a cloud drifting past instead of an urgent command?”',
            sub: 'Stillness returns the moment you stop arguing with your thoughts and soften your shoulders.',
          },
        ],
      };
    }

    // 4. Procrastination / Putting off
    if (/procrastinat|putting off|avoid|stuck|unmotivat|behind on|delay|lazy|can'?t start/i.test(text)) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['do just 2 mins', 'open the file', 'write 1 rough line', 'clear desk space'],
        how: ['ugly draft first', '5-min timer', 'zero perfection'],
        when: ['in 2 mins', 'right after water', 'this afternoon'],
        reaffirmations: [
          {
            quote: '“Am I actually lazy, or is my mind freezing because I think I have to do this perfectly?”',
            sub: 'Starting imperfectly for two minutes breaks paralysis far better than waiting for motivation.',
          },
          {
            quote: '“Do I have to finish the whole task right now, or can I just touch the first corner for two minutes?”',
            sub: 'Give yourself permission to make a messy, pressure-free start right now.',
          },
          {
            quote: '“Will beating myself up for delaying make it easier to start, or will self-kindness get me moving?”',
            sub: 'Even five focused minutes changes the direction and weight of your whole day.',
          },
          {
            quote: '“What if doing ten percent of this imperfectly today is enough to loosen the knot?”',
            sub: 'Lower the bar until starting feels light, easy, and kind.',
          },
        ],
      };
    }

    // 5. Overwhelmed / Burnout / Stressed
    if (/overwhelm|burnout|burned out|too much|swamped|exhaust|drowning|everything at once|stressed/i.test(text)) {
      return {
        detectedCategory: detectedCategory === 'General' ? 'Personal Growth' : detectedCategory,
        what: ['pick only 1 thing', 'cross off 1 item', 'take 10-min pause', 'ask for extension'],
        how: ['one piece at a time', 'slowly, no rush', 'dropping perfection'],
        when: ['right now', 'in 10 mins', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Do I really have to carry the whole mountain at once, or just the single next step in front of me?”',
            sub: 'Set everything else down for the next ten minutes and let yourself breathe.',
          },
          {
            quote: '“Does resting when I am exhausted mean I am failing, or is rest how I stay whole?”',
            sub: 'You are human, not a machine; doing one gentle thing today is enough.',
          },
          {
            quote: '“Is everything asking for my urgency today truly worth trading away my inner peace?”',
            sub: 'Choose the single smallest step and let the rest wait patiently.',
          },
          {
            quote: '“Can I give myself permission to move slowly today and still trust that I will arrive?”',
            sub: 'Soften your jaw, drop your shoulders, and take things one piece at a time.',
          },
        ],
      };
    }

    // 6. Loneliness / Social anxiety
    if (/lonely|loneliness|alone|left out|awkward|social|no friends|isolated|ignored/i.test(text)) {
      return {
        detectedCategory: 'Relationships',
        what: ['text 1 warm hello', 'visit a cozy cafe', 'call someone kind', 'join 1 small group'],
        how: ['no pressure', 'warmly & briefly', 'just saying hi'],
        when: ['in 15 mins', 'this evening', 'this weekend'],
        reaffirmations: [
          {
            quote: '“Does feeling alone tonight mean I am unlovable, or am I just in a quiet season between connections?”',
            sub: 'Feeling lonely right now is a tender passing season, never a permanent truth about your worth.',
          },
          {
            quote: '“Do I need to be effortlessly outgoing to belong, or is my quiet, honest presence already enough?”',
            sub: 'Treat yourself with the same gentle companionship you offer to others.',
          },
          {
            quote: '“What if one small, low-pressure hello is all it takes to open a door to warmth?”',
            sub: 'Connection grows in small, unhurried moments—be gentle with your heart today.',
          },
          {
            quote: '“Can I be a comforting friend to myself tonight instead of judging myself for feeling alone?”',
            sub: 'Meaningful bonds are still ahead of you, one genuine moment at a time.',
          },
        ],
      };
    }

    // 7. Future / Direction / Life path
    if (/future|direction|purpose|where i'?m going|life path|falling behind|next chapter|career/i.test(text)) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['plan just this week', 'list 2 curiosities', 'read 1 story', 'talk to a mentor'],
        how: ['one week ahead', 'with curiosity', 'no 5-year pressure'],
        when: ['this evening', 'tomorrow morning', 'this weekend'],
        reaffirmations: [
          {
            quote: '“Am I truly falling behind, or am I measuring my own chapter against someone else’s timeline?”',
            sub: 'You only need enough light for the next small step, not the whole five-year map.',
          },
          {
            quote: '“Do I need the whole future figured out tonight, or can I just follow one honest curiosity this week?”',
            sub: 'Uncertainty about the future is also open space for new possibilities to take shape.',
          },
          {
            quote: '“Is a meaningful life built by rushing, or by showing up calmly one day at a time?”',
            sub: 'Stop comparing your quiet beginning to someone else’s highlight reel.',
          },
          {
            quote: '“What if not knowing every answer yet is a normal part of growing into my next chapter?”',
            sub: 'Every small skill and kindness you practice today carries you forward.',
          },
        ],
      };
    }

    // 8. Mistake / Regret / Guilt
    if (/mistake|messed up|guilt|regret|embarrass|ashamed|wrong|apolog|failed/i.test(text)) {
      return {
        detectedCategory: 'Personal Growth',
        what: ['send brief apology', 'note 1 lesson', 'fix 1 small part', 'forgive yourself'],
        how: ['kindly & honestly', 'like a good friend', 'without self-blame'],
        when: ['in 10 mins', 'today', 'after a quiet walk'],
        reaffirmations: [
          {
            quote: '“Does making a mistake mean I am broken, or does it simply mean I am human and learning?”',
            sub: 'Speak to yourself right now with the same grace you would offer a dear friend.',
          },
          {
            quote: '“Does one imperfect moment erase all the good I bring, or can I repair what I can and forgive the rest?”',
            sub: 'Self-kindness heals and teaches far better than harsh self-criticism ever could.',
          },
          {
            quote: '“Will punishing myself change what happened, or am I allowed to take the lesson and move forward lighter?”',
            sub: 'You can make amends where needed without putting your whole self-worth on trial.',
          },
          {
            quote: '“What if this stumble is something I will look back on with gentler eyes and wiser perspective?”',
            sub: 'Take a deep breath and let go of punishing yourself for being human.',
          },
        ],
      };
    }

    // 9. Exams / Studying / School
    if (/exam|test|study|class|grade|homework|assignment|thesis|lecture|school|college/i.test(text)) {
      return {
        detectedCategory: 'Work',
        what: ['review 1 topic', 'practice 3 questions', 'summarize 1 page', 'ask a classmate'],
        how: ['20-min timer', 'one page at a time', 'without multitasking'],
        when: ['in 10 mins', 'after a short break', 'tonight at 7 pm'],
        reaffirmations: [
          {
            quote: '“Does this single test define my intelligence, or can I focus calmly on learning one topic at a time?”',
            sub: 'Twenty calm minutes of focus is far stronger than hours of anxious rumination.',
          },
          {
            quote: '“Do I have to master the entire syllabus tonight, or is reviewing one page right now enough?”',
            sub: 'Open just one section, breathe steadily, and trust your preparation.',
          },
          {
            quote: '“Am I actually unprepared, or is my anxious mind just magnifying the pressure?”',
            sub: 'You know more than your worry is telling you right now.',
          },
          {
            quote: '“What if I measured today by twenty honest minutes of effort instead of a perfect score?”',
            sub: 'Step by step, you are building understanding at a steady pace.',
          },
        ],
      };
    }

    // 10. Work / Interview / Job / Deadlines
    if (/interview|job|resume|presentation|meeting|boss|client|deadline|project|work|email/i.test(text) || cat === 'work') {
      return {
        detectedCategory: 'Work',
        what: ['draft 3 bullet points', 'send 1 brief reply', 'outline next step', 'practice 1 answer'],
        how: ['rough draft first', '10-min focus block', 'one step at a time'],
        when: ['in 15 mins', 'before lunch', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Does this single work task define my worth, or can I handle it calmly one small step at a time?”',
            sub: 'Done calmly is far better than chasing an exhausting perfection.',
          },
          {
            quote: '“Am I truly unprepared for this, or is my mind just rehearsing worst-case scenarios?”',
            sub: 'Draft three simple points, take a breath, and trust the capability you have built.',
          },
          {
            quote: '“Do I have to solve the whole week’s workload right now, or just the next ten-minute block?”',
            sub: 'You have navigated demanding work days before and found your footing.',
          },
          {
            quote: '“What if a clear, good-enough draft today is far better than carrying perfectionist stress?”',
            sub: 'Let go of the whole week’s pressure and focus only on the next small piece.',
          },
        ],
      };
    }

    // 11. Money / Finances
    if (/money|bill|rent|budget|debt|afford|saving|expense|bank|cost|pay/i.test(text) || cat === 'finances') {
      return {
        detectedCategory: 'Finances',
        what: ['check 1 balance', 'list 3 main bills', 'pause 1 subscription', 'plan 1 week spend'],
        how: ['just the numbers', 'calmly with tea', 'one item at a time'],
        when: ['in 10 mins', 'this evening', 'this weekend'],
        reaffirmations: [
          {
            quote: '“Will panicking tonight change the numbers, or can I look at one practical piece calmly?”',
            sub: 'Your worth as a person is never measured by a balance sheet—you can navigate this step by step.',
          },
          {
            quote: '“Do I need to solve my entire financial future today, or just make one steady adjustment this week?”',
            sub: 'Clarity replaces fear the moment you look at one item at a time.',
          },
          {
            quote: '“Does a tight season mean I am failing, or am I learning to manage what I have with care?”',
            sub: 'Be gentle with yourself while you plan the next practical step.',
          },
          {
            quote: '“What if checking just this week’s numbers without self-judgment is enough for today?”',
            sub: 'Pour a cup of tea, check one item, and leave the rest for tomorrow.',
          },
        ],
      };
    }

    // 12. Sleep / Health / Body
    if (/sleep|insomnia|tired|pain|doctor|sick|health|symptom|workout|body|eat/i.test(text) || cat === 'health') {
      return {
        detectedCategory: 'Health',
        what: ['drink warm water', 'book checkup', 'stretch 5 mins', 'rest eyes 10 mins'],
        how: ['slowly & kindly', 'screens off', 'one breath at a time'],
        when: ['right now', 'before bed tonight', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: '“Will worrying harder heal my body faster, or does my body need patience and gentle care today?”',
            sub: 'Even resting your eyes and breathing slowly gives your nervous system real relief.',
          },
          {
            quote: '“Are my anxious health what-ifs helping me, or can I take one calm, practical step for my body?”',
            sub: 'One kind gesture toward your wellbeing today is a meaningful step.',
          },
          {
            quote: '“Is resting when I feel drained a waste of time, or is rest how my body restores itself?”',
            sub: 'Let your shoulders drop and allow yourself to slow down tonight.',
          },
          {
            quote: '“Can I listen to what my body needs right now with kindness instead of panic?”',
            sub: 'Drink some water, soften your breath, and be gentle with yourself.',
          },
        ],
      };
    }

    // 13. Relationships general
    if (cat === 'relationships' || /relationship|dating|breakup|trust|love/i.test(text)) {
      return {
        detectedCategory: 'Relationships',
        what: ['send a kind text', 'write down feelings', 'ask for a chat', 'give gentle space'],
        how: ['honestly & softly', 'listening first', 'without rushing'],
        when: ['in an hour', 'this evening', 'this weekend'],
        reaffirmations: [
          {
            quote: '“Do I need to force an instant answer right now, or can I express my heart honestly and give us grace?”',
            sub: 'Healthy connection happens at a calm pace—sometimes a little breathing room brings clarity.',
          },
          {
            quote: '“Am I trying to read someone else’s mind, or can I focus on what I can communicate kindly?”',
            sub: 'Start by writing down what you truly feel before rushing into words.',
          },
          {
            quote: '“Do I have to lose my own peace to keep connection, or do I deserve honesty and warmth?”',
            sub: 'Your feelings are valid, and you can hold them with gentleness today.',
          },
          {
            quote: '“What if patience and a soft, honest conversation can untangle what overthinking cannot?”',
            sub: 'Trust that clarity will come when you speak from a grounded place.',
          },
        ],
      };
    }

    const cleanSnippet = raw
      .replace(/^(the\s+)?(fear|worry|anxiety|feeling)\s+(of|about|that)\s+/i, '')
      .replace(/^i\s+(am\s+|feel\s+)?(worried|worrying|anxious|scared|afraid)\s+(about|of|that)?\s*/i, '')
      .trim();
    const displayTopic = cleanSnippet.length > 0 && cleanSnippet.length <= 42 ? cleanSnippet.toLowerCase() : 'this situation';

    return {
      detectedCategory,
      what: ['write 2 key thoughts', 'pick 1 tiny step', 'take 5m quiet pause', 'talk it through'],
      how: ['one tiny piece', '5-min timer', 'without perfection'],
      when: ['in 5 mins', 'before bed tonight', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: `“Do I need to have ${displayTopic} completely solved right now, or can I take just one calm step first?”`,
          sub: 'You do not have to carry the whole weight of this at once—setting it on paper is already a beginning.',
        },
        {
          quote: `“Is my mind showing me the whole truth about ${displayTopic}, or just the loudest worst-case story?”`,
          sub: 'Even when things feel uncertain, you can choose one small, grounded response today.',
        },
        {
          quote: '“Am I good enough to handle this one step at a time, or am I demanding instant perfection from myself?”',
          sub: `You have navigated hard moments before, and you will find your footing with ${displayTopic} too.`,
        },
        {
          quote: `“What if I stopped fighting the uncertainty around ${displayTopic} and focused only on what is in my hands today?”`,
          sub: 'Release the pressure to fix everything right now and be kind to your mind.',
        },
      ],
    };
  }, []);

  // AI-generated contextual suggestions (what / how / when) + worry-specific dilemma reframes
  const [trioSuggestions, setTrioSuggestions] = useState<{
    what: string[];
    how: string[];
    when: string[];
  }>(() => {
    const initial = getLocalContextualSuggestions(page.rootWorry || '', page.category || 'General');
    return { what: initial.what, how: initial.how, when: initial.when };
  });
  const [worryReaffirmations, setWorryReaffirmations] = useState<Array<{ quote: string; sub: string }>>(() => {
    const initial = getLocalContextualSuggestions(page.rootWorry || '', page.category || 'General');
    return initial.reaffirmations;
  });
  const [isLoadingTrioSuggestions, setIsLoadingTrioSuggestions] = useState<boolean>(false);
  const lastFetchedWorryRef = useRef<string>('');

  const applyTailoredSuggestions = useCallback(
    (
      nextData: {
        detectedCategory?: string;
        what?: string[];
        how?: string[];
        when?: string[];
        reaffirmations?: Array<{ quote: string; sub: string }>;
      },
      options?: { preserveVisibleReframe?: boolean }
    ) => {
      if (nextData.what && nextData.how && nextData.when) {
        setTrioSuggestions({
          what: nextData.what,
          how: nextData.how,
          when: nextData.when,
        });
      }

      const nextReaffirmations =
        Array.isArray(nextData.reaffirmations) && nextData.reaffirmations.length > 0
          ? nextData.reaffirmations
          : undefined;

      if (nextReaffirmations) {
        setWorryReaffirmations((prevList) => {
          // CRITICAL: If Node 2 (reframe) is already visible on screen and we are receiving a delayed
          // background response, keep the currently displayed quote at reframeIdxRef.current locked in
          // so the text NEVER switches 2 seconds after appearing!
          if (options?.preserveVisibleReframe && unlockedRef.current.reframe && prevList.length > 0) {
            const activeSlot = reframeIdxRef.current % prevList.length;
            const currentVisible = prevList[activeSlot];
            if (currentVisible) {
              const others = nextReaffirmations.filter((item) => item.quote !== currentVisible.quote);
              const merged = [...others];
              merged.splice(Math.min(activeSlot, merged.length), 0, currentVisible);
              return merged.slice(0, Math.max(4, activeSlot + 1));
            }
          }
          return nextReaffirmations;
        });
      }

      onUpdatePage((prev) => {
        const updates: Partial<typeof prev> = {};

        // 1. Auto-select the AI/contextual detected category if user hasn't manually locked a different category
        if (
          nextData.detectedCategory &&
          !manualCategoryOverrideRef.current &&
          GENTLE_CONTEXTS.includes(nextData.detectedCategory as any) &&
          prev.category !== nextData.detectedCategory
        ) {
          updates.category = nextData.detectedCategory as typeof prev.category;
        }

        // 2. Update positiveReframe only if we aren't preserving an already-visible reframe
        if (
          nextReaffirmations &&
          nextReaffirmations.length > 0 &&
          !(options?.preserveVisibleReframe && unlockedRef.current.reframe && prev.positiveReframe)
        ) {
          const idx = reframeIdxRef.current;
          const chosen = nextReaffirmations[idx % nextReaffirmations.length] || nextReaffirmations[0];
          const formatted = `${chosen.quote} ${chosen.sub}`;
          if (prev.positiveReframe !== formatted) {
            updates.positiveReframe = formatted;
          }
        }

        // 3. Replace any old generic or awkward fallback chip in actionTrio.what
        if (nextData.what && nextData.what.length > 0) {
          const oldGenericWhat = new Set([
            'write 1 small step',
            'tidy 1 corner',
            'prepare for 5 mins',
            'talk to someone',
          ]);
          const currentWhat = (prev.actionTrio?.what || '').toLowerCase().trim();
          const isStaleFallbackChip =
            oldGenericWhat.has(currentWhat) ||
            /^(note 1 step on |5m on |spend 5m on )/i.test(currentWhat);

          if (currentWhat && isStaleFallbackChip && !nextData.what.includes(currentWhat)) {
            updates.actionTrio = {
              what: nextData.what[0] || '',
              how:
                prev.actionTrio?.how === 'step by step' || prev.actionTrio?.how === 'without perfection'
                  ? nextData.how?.[0] || prev.actionTrio?.how || ''
                  : prev.actionTrio?.how || '',
              when: prev.actionTrio?.when || '',
              completed: prev.actionTrio?.completed,
            };
          }
        }

        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    },
    [onUpdatePage]
  );

  const fetchWorryTrioSuggestions = useCallback(
    async (worryText: string, categoryText: string, force = false) => {
      const trimmed = (worryText || '').trim();
      if (!trimmed) return;

      const key = `${trimmed.toLowerCase()}`;
      // Check before applying localContextual so repeated calls never reset AI reframes back to local fallbacks
      if (!force && lastFetchedWorryRef.current === key) return;
      lastFetchedWorryRef.current = key;

      const localContextual = getLocalContextualSuggestions(trimmed, categoryText || 'General');
      if (!unlockedRef.current.reframe) {
        applyTailoredSuggestions(localContextual);
      } else {
        // Only update trio chips & category if Node 2 is already visible
        applyTailoredSuggestions(
          {
            detectedCategory: localContextual.detectedCategory,
            what: localContextual.what,
            how: localContextual.how,
            when: localContextual.when,
          },
          { preserveVisibleReframe: true }
        );
      }

      setIsLoadingTrioSuggestions(true);

      // Fire ultra-fast category detection in parallel with full trio + reframe generation
      fetch('/api/detect-worry-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootWorry: trimmed }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((catData) => {
          if (catData?.detectedCategory && GENTLE_CONTEXTS.includes(catData.detectedCategory)) {
            applyTailoredSuggestions(
              { detectedCategory: catData.detectedCategory },
              { preserveVisibleReframe: true }
            );
          }
        })
        .catch(() => {});

      try {
        const res = await fetch('/api/worry-trio-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rootWorry: trimmed,
            category: localContextual.detectedCategory || categoryText || 'General',
            force,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (
            Array.isArray(data.what) &&
            data.what.length > 0 &&
            Array.isArray(data.how) &&
            data.how.length > 0 &&
            Array.isArray(data.when) &&
            data.when.length > 0
          ) {
            applyTailoredSuggestions(
              {
                detectedCategory: data.detectedCategory,
                what: data.what,
                how: data.how,
                when: data.when,
                reaffirmations: Array.isArray(data.reaffirmations) ? data.reaffirmations : undefined,
              },
              { preserveVisibleReframe: !force }
            );
          }
        }
      } catch {
        // Local contextual suggestions and reaffirmations are already applied
      } finally {
        setIsLoadingTrioSuggestions(false);
      }
    },
    [applyTailoredSuggestions, getLocalContextualSuggestions]
  );

  // Automatically detect context, dilemma reframes, and suggestions only when the worry text itself changes
  useEffect(() => {
    const trimmed = page.rootWorry?.trim() || '';
    if (!trimmed) return;
    const localContextual = getLocalContextualSuggestions(trimmed, 'General');
    applyTailoredSuggestions(localContextual, {
      preserveVisibleReframe: lastFetchedWorryRef.current === trimmed.toLowerCase(),
    });

    const timer = setTimeout(() => {
      fetchWorryTrioSuggestions(trimmed, localContextual.detectedCategory || 'General');
    }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.rootWorry]);

  const activeCategory =
    page.category && CONTEXTUAL_REFRAMES[page.category] ? page.category : 'General';
  const fallbackCategoryReframes = CONTEXTUAL_REFRAMES[activeCategory] || CONTEXTUAL_REFRAMES.General;
  const reframeList =
    worryReaffirmations && worryReaffirmations.length > 0
      ? worryReaffirmations
      : fallbackCategoryReframes;
  const activeReframeItem = reframeList[reframeIdx % reframeList.length];

  // Smooth horizontal & vertical pan to newly revealed or focused node without clipping
  const panToNode = useCallback(
    (targetRef: React.RefObject<HTMLDivElement | null>, delayMs = 260) => {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const target = targetRef.current;
        if (!target) return;

        if (container) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const targetScrollLeft =
            container.scrollLeft +
            (targetRect.left - containerRect.left) -
            containerRect.width / 2 +
            targetRect.width / 2;
          const targetScrollTop =
            container.scrollTop +
            (targetRect.top - containerRect.top) -
            containerRect.height / 2 +
            targetRect.height / 2;

          container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });
        } else {
          target.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'center',
          });
        }
      }, delayMs);
    },
    []
  );

  // Center Node 1 nicely on smaller screens on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      panToNode(step1Ref, 120);
    }
  }, [panToNode]);

  // Smoothly center a node when its input is focused on mobile/touch viewports
  const handleNodeInputFocus = useCallback(
    (nodeRef: React.RefObject<HTMLDivElement | null>) => {
      setIsEditingNode(true);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        panToNode(nodeRef, 180);
      }
    },
    [panToNode]
  );

  const handleNodeInputBlur = useCallback(() => {
    setIsEditingNode(false);
  }, []);

  // Desktop/trackpad grab-to-pan on canvas background while preserving native touch momentum scrolling
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // Let native 2D touch momentum scrolling & elastic node drag work seamlessly
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('input, textarea, button, a, label, [data-draggable-node="true"]')) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) return;
    canvasPanRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    setIsCanvasGrabbing(true);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasPanRef.current.active || !scrollContainerRef.current) return;
    const dx = e.clientX - canvasPanRef.current.startX;
    const dy = e.clientY - canvasPanRef.current.startY;
    scrollContainerRef.current.scrollLeft = canvasPanRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = canvasPanRef.current.scrollTop - dy;
  };

  const handleCanvasPointerUp = () => {
    if (canvasPanRef.current.active) {
      canvasPanRef.current.active = false;
      setIsCanvasGrabbing(false);
    }
  };

  // Step 1 -> Step 2 (Reframe)
  const handleWorryContinue = () => {
    if (!page.rootWorry || page.rootWorry.trim().length === 0) return;
    unlockedRef.current = { ...unlockedRef.current, reframe: true };
    setUnlocked((prev) => ({ ...prev, reframe: true }));
    onUpdatePage((prev) => ({
      ...prev,
      positiveReframe: `${activeReframeItem.quote} ${activeReframeItem.sub}`,
    }));
    fetchWorryTrioSuggestions(page.rootWorry, page.category || 'General');
    panToNode(step2Ref, 300);
  };

  // Shuffle comforting dilemma reframe only when the user explicitly clicks "another thought"
  const handleShuffleReframe = () => {
    const next = (reframeIdx + 1) % reframeList.length;
    reframeIdxRef.current = next;
    setReframeIdx(next);
    const item = reframeList[next];
    onUpdatePage((prev) => ({
      ...prev,
      positiveReframe: `${item.quote} ${item.sub}`,
    }));
  };

  // Step 2 -> Step 3 (First Fork: Is this worry something you can act on?)
  const handleReframeContinue = () => {
    setUnlocked((prev) => ({ ...prev, fork: true }));
    panToNode(stepForkRef, 300);
  };

  // First Fork Choice -> Upper (Yes, can act) or Lower (No, outside my hands)
  const handleForkChoice = (choice: 'yes' | 'no') => {
    onUpdatePage((prev) => ({
      ...prev,
      canActOnWorry: choice,
      canAct: choice,
      activePathway: choice === 'yes' ? 'action_plan' : 'non_actionable',
      letWorryGoSealed: choice === 'no' ? true : prev.letWorryGoSealed,
    }));

    if (choice === 'no') {
      setUnlocked((prev) => ({
        ...prev,
        noActEnd: true,
        actionTrio: false,
        actNowFork: false,
        doNowEnd: false,
        knowWhenFork: false,
        scheduleEnd: false,
        noBandwidthEnd: false,
      }));
      panToNode(stepFinalNoActRef, 350);
    } else {
      if (page.rootWorry?.trim()) {
        fetchWorryTrioSuggestions(page.rootWorry, page.category || 'General');
      }
      setUnlocked((prev) => ({
        ...prev,
        noActEnd: false,
        actionTrio: true,
      }));
      panToNode(stepActionTrioRef, 350);
    }
  };

  // Step 4 Action Trio (What? How? When?) -> Opens Fork 2 without auto-selecting or auto-opening downstream forks
  const handleActionTrioContinue = () => {
    const whenVal = page.actionTrio?.when?.trim() || '';
    const parsedWhen = parseWhenTextToSchedule(whenVal);

    onUpdatePage((prev) => ({
      ...prev,
      scheduledDate:
        parsedWhen.intent === 'later' ? parsedWhen.date : prev.scheduledDate,
      scheduledTime:
        parsedWhen.intent === 'later' ? parsedWhen.time : prev.scheduledTime,
      actionTrio: {
        what: prev.actionTrio?.what || '',
        when: prev.actionTrio?.when || '',
        how: prev.actionTrio?.how || '',
        completed: true,
      },
    }));
    setUnlocked((prev) => ({ ...prev, actNowFork: true }));
    panToNode(stepActNowForkRef, 350);
  };

  // Fork 2 ("Can you act on this worry now?") -> Yes (Take first step) or No (Do you know when you can act on it?)
  const handleActNowChoice = (choice: 'yes' | 'no') => {
    if (choice === 'yes') {
      onUpdatePage((prev) => ({
        ...prev,
        canActNow: 'yes',
        actionTiming: 'now',
        letWorryGoSealed: true,
      }));
      setUnlocked((prev) => ({
        ...prev,
        doNowEnd: true,
        knowWhenFork: false,
        scheduleEnd: false,
        noBandwidthEnd: false,
      }));
      panToNode(stepFinalDoNowRef, 350);
    } else {
      onUpdatePage((prev) => ({
        ...prev,
        canActNow: 'no',
        actionTiming: 'later',
      }));
      setUnlocked((prev) => ({
        ...prev,
        doNowEnd: false,
        knowWhenFork: true,
      }));
      panToNode(stepKnowWhenForkRef, 350);
    }
  };

  // Fork 3 ("Do you know when you can act on it?") -> Yes (Schedule it) or No (No bandwidth/opportunity right now)
  const handleKnowWhenChoice = (choice: 'yes' | 'no') => {
    const whenVal = page.actionTrio?.when?.trim() || '';
    const parsedWhen = parseWhenTextToSchedule(whenVal);
    const defaultDate =
      parsedWhen.intent === 'later'
        ? parsedWhen.date
        : page.scheduledDate || getFutureDateIso(1);
    const defaultTime =
      parsedWhen.intent === 'later'
        ? parsedWhen.time
        : page.scheduledTime || '10:00';
    const readable = formatReadableSchedule(defaultDate, defaultTime);

    onUpdatePage((prev) => ({
      ...prev,
      knowWhenAct: choice,
      letWorryGoSealed: true,
      scheduledDate: choice === 'yes' ? defaultDate : prev.scheduledDate,
      scheduledTime: choice === 'yes' ? defaultTime : prev.scheduledTime,
      actionTrio:
        choice === 'yes'
          ? {
              what: prev.actionTrio?.what || '',
              how: prev.actionTrio?.how || '',
              when: prev.actionTrio?.when?.trim() || readable,
              completed: true,
            }
          : prev.actionTrio,
    }));

    if (choice === 'yes') {
      setUnlocked((prev) => ({
        ...prev,
        scheduleEnd: true,
        noBandwidthEnd: false,
      }));
      panToNode(stepFinalScheduleRef, 350);
    } else {
      setUnlocked((prev) => ({
        ...prev,
        scheduleEnd: false,
        noBandwidthEnd: true,
      }));
      panToNode(stepFinalNoBandwidthRef, 350);
    }
  };

  // Update scheduled date/time and keep readable label in sync
  const handleScheduleDateTimeChange = (newDate: string, newTime: string, presetLabel?: string) => {
    const readable = formatReadableSchedule(newDate, newTime);
    onUpdatePage((prev) => ({
      ...prev,
      scheduledDate: newDate,
      scheduledTime: newTime,
      calendarEventCreated: false,
      signOffWorry: {
        ...(prev.signOffWorry || { name: '' }),
        date: readable,
      },
      actionTrio: {
        what: prev.actionTrio?.what || '',
        how: prev.actionTrio?.how || '',
        when: presetLabel || readable || prev.actionTrio?.when || '',
        completed: true,
      },
    }));
  };

  const parsedActiveWhen = parseWhenTextToSchedule(page.actionTrio?.when);
  const activeScheduledDate =
    parsedActiveWhen.intent === 'later' &&
    page.actionTrio?.when &&
    !page.actionTrio.when.includes(',')
      ? parsedActiveWhen.date
      : page.scheduledDate || getFutureDateIso(1);
  const activeScheduledTime =
    parsedActiveWhen.intent === 'later' &&
    page.actionTrio?.when &&
    !page.actionTrio.when.includes(',')
      ? parsedActiveWhen.time
      : page.scheduledTime || '10:00';

  // Build event payload from current page & custom title
  const buildCurrentCalendarPayload = useCallback(
    (overrideTitle?: string) => {
      const chosenDate = activeScheduledDate;
      const chosenTime = activeScheduledTime;
      const defaultSummary = page.actionTrio?.what?.trim()
        ? `Gentle Step: ${page.actionTrio.what.trim()}`
        : `Untangle Reflection: ${page.rootWorry?.trim() || 'Scheduled Step'}`;
      const summary = (overrideTitle ?? customEventTitle).trim() || defaultSummary;

      const descriptionLines = [
        `Thought untangled on paper: "${page.rootWorry || ''}"`,
        page.positiveReframe ? `\nKinder perspective: ${page.positiveReframe}` : '',
        page.actionTrio?.what ? `\nWhat I can gently do: ${page.actionTrio.what}` : '',
        page.actionTrio?.how ? `How I will approach it: ${page.actionTrio.how}` : '',
        `\n— Scheduled gently via untangle. (by Tanya Singh)`,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        summary,
        description: descriptionLines,
        date: chosenDate,
        time: chosenTime,
        durationMinutes: 30,
      };
    },
    [
      activeScheduledDate,
      activeScheduledTime,
      page.actionTrio?.what,
      page.actionTrio?.how,
      page.rootWorry,
      page.positiveReframe,
      customEventTitle,
    ]
  );

  // Open confirmation modal immediately (no OAuth sign-in needed)
  const handlePrepareCalendarEvent = () => {
    const defaultSummary = page.actionTrio?.what?.trim()
      ? `Gentle Step: ${page.actionTrio.what.trim()}`
      : `Untangle Reflection: ${page.rootWorry?.trim() || 'Scheduled Step'}`;
    if (!customEventTitle.trim()) {
      setCustomEventTitle(defaultSummary);
    }
    setShowCalendarConfirmModal(true);
  };

  // Mark as scheduled via Direct Google Calendar Template Link (Zero OAuth)
  const handleConfirmInstantCalendarLink = () => {
    const payload = buildCurrentCalendarPayload();
    const templateUrl = buildGoogleCalendarTemplateUrl(payload);
    onUpdatePage((prev) => ({
      ...prev,
      scheduledDate: payload.date,
      scheduledTime: payload.time,
      calendarEventCreated: true,
      calendarEventLink: templateUrl,
      calendarEventSummary: payload.summary,
    }));
    setShowCalendarConfirmModal(false);
  };

  // Download universal .ics calendar invite and mark as scheduled
  const handleDownloadIcsInvite = () => {
    const payload = buildCurrentCalendarPayload();
    downloadIcsCalendarFile(payload);
    const templateUrl = buildGoogleCalendarTemplateUrl(payload);
    onUpdatePage((prev) => ({
      ...prev,
      scheduledDate: payload.date,
      scheduledTime: payload.time,
      calendarEventCreated: true,
      calendarEventLink: prev.calendarEventLink || templateUrl,
      calendarEventSummary: payload.summary,
    }));
    setShowCalendarConfirmModal(false);
  };

  const canActDecision = page.canActOnWorry || page.canAct;
  const actNowDecision = page.canActNow;
  const knowWhenDecision = page.knowWhenAct;

  const readableScheduleDisplay = formatReadableSchedule(
    activeScheduledDate,
    activeScheduledTime,
    page.actionTrio?.when
  );
  const instantGoogleCalendarUrl = buildGoogleCalendarTemplateUrl(buildCurrentCalendarPayload());

  return (
    <>
      <div
        ref={scrollContainerRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        style={{ WebkitOverflowScrolling: 'touch' }}
        className={`w-full h-full overflow-x-auto overflow-y-auto no-scrollbar bg-[#faf9f6] text-zinc-900 select-none touch-pan-x touch-pan-y overscroll-contain ${
          isCanvasGrabbing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Horizontal & Vertical Continuous Track:
            Uses min-h-full (NOT h-full) and responsive padding so small mobile screens center naturally */}
        <div className="min-w-max min-h-full px-6 py-12 sm:px-16 sm:py-20 flex flex-row items-center">
          {/* ========================================================
              1. INITIAL HORIZONTAL LEAD-IN LINE (Left Edge -> Node 1)
          ======================================================== */}
          <div className="flex items-center shrink-0">
            <svg
              width="160"
              height="80"
              viewBox="0 0 160 80"
              fill="none"
              className="w-[72px] sm:w-[160px] h-[60px] sm:h-[80px] overflow-visible"
            >
              <motion.path
                d="M 0 42 C 45 26, 85 56, 125 40 C 142 34, 152 40, 160 40"
                stroke="#18181b"
                strokeWidth="1.6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </div>

          {/* ========================================================
              NODE 1: THE WORRY ("What is worrying you right now?")
              Small inline node nestled in the break of the line
          ======================================================== */}
          <motion.div
            ref={step1Ref}
            data-draggable-node="true"
            {...springDrag}
            className="w-[275px] sm:w-[270px] shrink-0 px-4 py-3 text-center select-text cursor-grab active:cursor-grabbing touch-manipulation"
          >
            <p className="text-[15px] sm:text-[14px] font-serif text-zinc-900 leading-snug">
              <TypewriterText text="“What is worrying you right now?”" delay={0.55} speed={0.024} />
            </p>
            <p className="text-[12.5px] sm:text-[12px] font-serif italic text-zinc-500 mt-0.5 mb-3 leading-snug">
              <TypewriterText
                text="Write something that's on your mind."
                delay={1.15}
                speed={0.017}
              />
            </p>

            {/* Compact Underlined Worry Input — 16px on mobile prevents iOS Safari auto-zoom on focus */}
            <input
              type="text"
              value={page.rootWorry}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onFocus={() => handleNodeInputFocus(step1Ref)}
              onBlur={handleNodeInputBlur}
              onChange={(e) => {
                const nextWorry = e.target.value;
                manualCategoryOverrideRef.current = false;
                const local = getLocalContextualSuggestions(nextWorry, 'General');
                onUpdatePage((prev) => ({
                  ...prev,
                  rootWorry: nextWorry,
                  category: nextWorry.trim()
                    ? (local.detectedCategory as typeof prev.category)
                    : 'General',
                }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                  handleWorryContinue();
                }
              }}
              enterKeyHint="done"
              placeholder="write one word or thought..."
              className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[16px] sm:text-[13px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0.5 pb-1 sm:pt-0 sm:pb-0.5 px-1 leading-tight sm:leading-none text-center focus:outline-none transition-colors touch-manipulation"
            />

            {/* Tiny Lowercase Context Pickers (Auto-detected by AI as you type, or tap to override) */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 flex-wrap mt-2.5 sm:mt-2 text-[12px] sm:text-[11px] font-serif italic text-zinc-400"
            >
              {GENTLE_CONTEXTS.map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => {
                    manualCategoryOverrideRef.current = true;
                    onUpdatePage((prev) => ({ ...prev, category: ctx }));
                    setReframeIdx(0);
                    if (page.rootWorry?.trim()) {
                      fetchWorryTrioSuggestions(page.rootWorry, ctx, true);
                    }
                  }}
                  className={`px-1.5 py-0.5 sm:px-1 sm:py-0 transition-colors cursor-pointer touch-manipulation ${
                    page.category === ctx
                      ? 'text-zinc-900 font-medium underline underline-offset-4'
                      : 'hover:text-zinc-700'
                  }`}
                >
                  {ctx.toLowerCase()}
                </button>
              ))}
            </div>

            <div onPointerDown={(e) => e.stopPropagation()} className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={handleWorryContinue}
                disabled={!page.rootWorry || page.rootWorry.trim().length === 0}
                className={`group inline-flex items-center gap-1 py-1 px-2 text-[13px] sm:text-[12px] font-serif italic transition-all touch-manipulation ${
                  page.rootWorry && page.rootWorry.trim().length > 0
                    ? 'text-zinc-900 font-medium underline underline-offset-4 hover:text-black cursor-pointer'
                    : 'text-zinc-400 cursor-not-allowed'
                }`}
              >
                {page.rootWorry && page.rootWorry.trim().length > 0 ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-zinc-800" />
                    <span>follow the line</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-3 sm:h-3 transition-transform group-hover:translate-x-0.5" />
                  </>
                ) : (
                  <>
                    <span>write a word to follow the line...</span>
                    <ArrowRight className="w-3 h-3 opacity-50" />
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* ========================================================
              2. HORIZONTAL CURSIVE LOOP LINE (Node 1 -> Node 2)
          ======================================================== */}
          {unlocked.reframe && (
            <div className="flex items-center shrink-0">
              <svg width="230" height="90" viewBox="0 0 230 90" fill="none" className="overflow-visible">
                <motion.path
                  d="M 0 45 C 45 45, 85 32, 112 24 C 128 19, 134 6, 122 6 C 108 6, 104 36, 128 44 C 160 54, 190 38, 230 45"
                  stroke="#18181b"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.2, ease: [0.22, 1, 0.36, 1] },
                  }}
                />
              </svg>
            </div>
          )}

          {/* ========================================================
              NODE 2: COMFORTING REFRAME (Nestled directly in the line)
          ======================================================== */}
          {unlocked.reframe && (
            <motion.div
              ref={step2Ref}
              data-draggable-node="true"
              {...springDrag}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.85 }}
              className="w-[295px] sm:w-[310px] shrink-0 px-4 py-3 text-center select-text cursor-grab active:cursor-grabbing touch-manipulation"
            >
              <p className="text-[14.5px] sm:text-[14px] font-serif text-zinc-900 leading-snug">
                <TypewriterText
                  text={activeReframeItem.quote}
                  delay={reframeIdx === 0 ? 0.9 : 0.06}
                  speed={0.02}
                />
              </p>
              <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1 leading-relaxed">
                <TypewriterText
                  text={activeReframeItem.sub}
                  delay={reframeIdx === 0 ? 1.65 : 0.45}
                  speed={0.016}
                />
              </p>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="mt-3 flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={handleReframeContinue}
                  className="group inline-flex items-center gap-1 py-1 px-1.5 text-[13px] sm:text-[12px] font-serif italic text-zinc-900 hover:underline underline-offset-4 cursor-pointer touch-manipulation"
                >
                  <span>follow the line</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-3 sm:h-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================
              3. FORK 1: "Is this worry something you can act on?"
              Splits into Upper Curve (Yes) & Lower Curve (No)
          ======================================================== */}
          {unlocked.fork && (
            <div ref={stepForkRef} className="flex items-center shrink-0 relative">
              <svg
                width="430"
                height="380"
                viewBox="0 0 430 380"
                fill="none"
                className="overflow-visible select-none"
              >
                {/* Incoming horizontal stem */}
                <motion.path
                  d="M 0 190 C 35 190, 55 190, 80 190"
                  stroke="#18181b"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ pathLength: { duration: 0.4, ease: 'easeOut' } }}
                />

                {/* UPPER FORK CURVE (Yes - something I can act on) */}
                <motion.path
                  id="fork1-upper"
                  d="M 80 190 C 175 188, 270 145, 415 45"
                  stroke={canActDecision === 'yes' ? '#18181b' : '#52525b'}
                  strokeWidth={canActDecision === 'yes' ? '2.1' : '1.5'}
                  strokeLinecap="round"
                  className="cursor-pointer transition-colors hover:stroke-black"
                  onClick={() => handleForkChoice('yes')}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.25, delay: 0.35, ease: [0.22, 1, 0.36, 1] },
                  }}
                />

                {/* LOWER FORK CURVE (No - outside my hands today) */}
                <motion.path
                  id="fork1-lower"
                  d="M 80 190 C 175 192, 270 235, 415 335"
                  stroke={canActDecision === 'no' ? '#18181b' : '#52525b'}
                  strokeWidth={canActDecision === 'no' ? '2.1' : '1.5'}
                  strokeLinecap="round"
                  className="cursor-pointer transition-colors hover:stroke-black"
                  onClick={() => handleForkChoice('no')}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.25, delay: 0.35, ease: [0.22, 1, 0.36, 1] },
                  }}
                />

                {/* Curved Text Over Upper Line */}
                <g
                  onClick={() => handleForkChoice('yes')}
                  className="cursor-pointer"
                  transform="translate(0, -10)"
                >
                  <SvgCurvedTypewriter
                    href="#fork1-upper"
                    startOffset="7%"
                    delay={1.15}
                    speed={0.024}
                    text="is this something I can act on?"
                    className="fill-zinc-800 font-serif text-[13.5px] tracking-wide hover:fill-black"
                  />
                </g>

                {/* Curved Text Under Lower Line */}
                <g
                  onClick={() => handleForkChoice('no')}
                  className="cursor-pointer"
                  transform="translate(0, 20)"
                >
                  <SvgCurvedTypewriter
                    href="#fork1-lower"
                    startOffset="7%"
                    delay={1.45}
                    speed={0.024}
                    text="or is it outside my hands today?"
                    className="fill-zinc-700 font-serif text-[13.5px] tracking-wide hover:fill-black"
                  />
                </g>
              </svg>

              {/* Interactive branch tips */}
              <div className="flex flex-col justify-between h-[320px] -ml-3 z-10 pointer-events-auto">
                <motion.button
                  type="button"
                  onClick={() => handleForkChoice('yes')}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.85 }}
                  className={`px-3.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-[12.5px] sm:text-[12px] font-serif italic transition-all cursor-pointer touch-manipulation ${
                    canActDecision === 'yes'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-[#faf9f6] text-zinc-600 hover:text-zinc-900 border border-zinc-300/80'
                  }`}
                >
                  yes, I can act →
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => handleForkChoice('no')}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.05 }}
                  className={`px-3.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-[12.5px] sm:text-[12px] font-serif italic transition-all cursor-pointer touch-manipulation ${
                    canActDecision === 'no'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-[#faf9f6] text-zinc-600 hover:text-zinc-900 border border-zinc-300/80'
                  }`}
                >
                  no, outside my hands →
                </motion.button>
              </div>
            </div>
          )}

          {/* ========================================================
              4A. LOWER BRANCH ("No." — Outside my hands)
          ======================================================== */}
          {unlocked.noActEnd && (
            <div
              ref={stepFinalNoActRef}
              className="flex flex-row items-center shrink-0 translate-y-16"
            >
              {/* Long flowy horizontal wave with gentle hill */}
              <svg width="240" height="90" viewBox="0 0 240 90" fill="none" className="overflow-visible">
                <motion.path
                  d="M 0 55 C 45 55, 75 14, 110 18 C 145 22, 165 55, 240 50"
                  stroke="#18181b"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.2, ease: [0.22, 1, 0.36, 1] },
                  }}
                />
              </svg>

              {/* Deeply Comforting "No" Endpoint Node */}
              <motion.div
                {...springDrag}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.9 }}
                className="w-[330px] shrink-0 px-5 py-4 text-center select-text"
              >
                <p className="text-[14.5px] font-serif text-zinc-900 leading-snug">
                  <TypewriterText
                    text="“This worry does not serve you, and you don't owe it your peace.”"
                    delay={1.0}
                    speed={0.022}
                  />
                </p>

                <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1.5 leading-relaxed">
                  <TypewriterText
                    text="Spending your gentle energy on what is outside your hands only steals joy from the present moment. Come back and reground yourself softly in the now."
                    delay={2.1}
                    speed={0.015}
                  />
                </p>

                <div className="w-8 h-[1px] bg-zinc-300 mx-auto my-3" />

                <p className="text-[13px] font-serif text-zinc-900 leading-relaxed">
                  <TypewriterText
                    text="“Breathe out slowly. You have permission to let the worry go.”"
                    delay={3.8}
                    speed={0.018}
                  />
                </p>

                {/* Postcard Preview & Fresh Line Actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 4.5 }}
                  className="mt-4 flex items-center justify-center gap-3 flex-wrap"
                >
                  {onOpenExportPreview && (
                    <button
                      type="button"
                      onClick={onOpenExportPreview}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900 text-white hover:bg-black text-[11.5px] font-serif italic transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>preview &amp; export postcard</span>
                    </button>
                  )}

                  {onNewPage && (
                    <button
                      type="button"
                      onClick={onNewPage}
                      className="text-[11.5px] font-serif italic text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                    >
                      begin a fresh line
                    </button>
                  )}
                </motion.div>
              </motion.div>

              {/* Trailing horizontal ink tail */}
              <svg width="110" height="60" viewBox="0 0 110 60" fill="none" className="overflow-visible">
                <motion.path
                  d="M 0 30 C 35 34, 70 26, 105 30"
                  stroke="#18181b"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ pathLength: { duration: 0.8, delay: 4.1 } }}
                />
              </svg>
            </div>
          )}

          {/* ========================================================
              4B. UPPER BRANCH ("Yes." — Can Act on This Worry)
              "What can I do about this worry? How? When?"
          ======================================================== */}
          {unlocked.actionTrio && (
            <div className="flex flex-row items-center shrink-0">
              {/* Horizontal wavy line from Upper Fork to Action Trio */}
              <svg width="200" height="80" viewBox="0 0 200 80" fill="none" className="overflow-visible">
                <motion.path
                  d="M 0 35 C 50 18, 95 52, 145 36 C 170 28, 185 35, 200 35"
                  stroke="#18181b"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
                  }}
                />
              </svg>

              {/* Compact 2-in-a-Row Journal Note Node (What / How) */}
              <motion.div
                ref={stepActionTrioRef}
                data-draggable-node="true"
                {...springDrag}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="w-[335px] sm:w-[435px] shrink-0 px-3.5 sm:px-4 py-3 text-center select-text cursor-grab active:cursor-grabbing touch-manipulation"
              >
                <p className="text-[14.5px] sm:text-[14px] font-serif text-zinc-900 leading-snug">
                  <TypewriterText
                    text="“What can I gently do about this worry?”"
                    delay={0.9}
                    speed={0.022}
                  />
                </p>
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 mt-0.5 mb-2.5 flex-wrap sm:flex-nowrap"
                >
                  <p className="text-[12px] font-serif italic text-zinc-500 sm:whitespace-nowrap">
                    <TypewriterText
                      text="Write one word or tap a suggestion for your worry below."
                      delay={1.65}
                      speed={0.017}
                    />
                  </p>
                  {isLoadingTrioSuggestions ? (
                    <span className="text-[10.5px] font-serif italic text-zinc-400 animate-pulse whitespace-nowrap shrink-0">
                      (tailoring...)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        fetchWorryTrioSuggestions(
                          page.rootWorry || 'general worry',
                          page.category || 'General',
                          true
                        )
                      }
                      title="Refresh AI suggestions for your worry"
                      className="inline-flex items-center gap-1 py-0.5 px-1 text-[11px] sm:text-[10.5px] font-serif italic text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer underline underline-offset-2 whitespace-nowrap shrink-0 touch-manipulation"
                    >
                      <span>↻ refresh</span>
                    </button>
                  )}
                </div>

                {/* 2 Compact Journal Notes in a Horizontal Row with Left-Aligned AI Suggestion Chips */}
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="grid grid-cols-2 gap-2.5 sm:gap-3 text-left items-stretch"
                >
                  {/* WHAT? */}
                  <div className="p-2.5 bg-white/85 border border-zinc-200/80 rounded-lg flex flex-col justify-start items-start text-left">
                    <div className="w-full">
                      <span className="block text-[11px] font-serif italic text-zinc-500 mb-0.5 text-left">
                        what?
                      </span>
                      <input
                        type="text"
                        value={page.actionTrio?.what || ''}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onFocus={() => handleNodeInputFocus(stepActionTrioRef)}
                        onBlur={handleNodeInputBlur}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdatePage((prev) => ({
                            ...prev,
                            actionTrio: {
                              what: val,
                              when: prev.actionTrio?.when || '',
                              how: prev.actionTrio?.how || '',
                            },
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && page.actionTrio?.what?.trim()) {
                            e.preventDefault();
                            (e.currentTarget as HTMLInputElement).blur();
                            handleActionTrioContinue();
                          }
                        }}
                        enterKeyHint="done"
                        placeholder="one small step..."
                        className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[16px] sm:text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0.5 pb-1 sm:pt-0 sm:pb-0.5 leading-tight sm:leading-none text-left focus:outline-none touch-manipulation"
                      />
                    </div>
                    <div className="flex flex-col items-start justify-start gap-1.5 mt-2.5 w-full text-left">
                      {trioSuggestions.what.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() =>
                            onUpdatePage((prev) => ({
                              ...prev,
                              actionTrio: {
                                what: word,
                                how: prev.actionTrio?.how || '',
                                when: prev.actionTrio?.when || '',
                              },
                            }))
                          }
                          className={`inline-flex items-center justify-start text-left px-2.5 py-1 sm:px-2 sm:py-0.5 rounded text-[11px] sm:text-[10px] font-serif italic transition-colors cursor-pointer touch-manipulation ${
                            page.actionTrio?.what?.toLowerCase() === word.toLowerCase()
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100/90 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70'
                          }`}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* HOW? */}
                  <div className="p-2.5 bg-white/85 border border-zinc-200/80 rounded-lg flex flex-col justify-start items-start text-left">
                    <div className="w-full">
                      <span className="block text-[11px] font-serif italic text-zinc-500 mb-0.5 text-left">
                        how?
                      </span>
                      <input
                        type="text"
                        value={page.actionTrio?.how || ''}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onFocus={() => handleNodeInputFocus(stepActionTrioRef)}
                        onBlur={handleNodeInputBlur}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdatePage((prev) => ({
                            ...prev,
                            actionTrio: {
                              what: prev.actionTrio?.what || '',
                              when: prev.actionTrio?.when || '',
                              how: val,
                            },
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            (page.actionTrio?.what?.trim() || page.actionTrio?.how?.trim())
                          ) {
                            e.preventDefault();
                            (e.currentTarget as HTMLInputElement).blur();
                            handleActionTrioContinue();
                          }
                        }}
                        enterKeyHint="done"
                        placeholder="calmly, no rush..."
                        className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[16px] sm:text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0.5 pb-1 sm:pt-0 sm:pb-0.5 leading-tight sm:leading-none text-left focus:outline-none touch-manipulation"
                      />
                    </div>
                    <div className="flex flex-col items-start justify-start gap-1.5 mt-2.5 w-full text-left">
                      {trioSuggestions.how.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() =>
                            onUpdatePage((prev) => ({
                              ...prev,
                              actionTrio: {
                                what: prev.actionTrio?.what || '',
                                how: word,
                                when: prev.actionTrio?.when || '',
                              },
                            }))
                          }
                          className={`inline-flex items-center justify-start text-left px-2.5 py-1 sm:px-2 sm:py-0.5 rounded text-[11px] sm:text-[10px] font-serif italic transition-colors cursor-pointer touch-manipulation ${
                            page.actionTrio?.how?.toLowerCase() === word.toLowerCase()
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100/90 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70'
                          }`}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Follow the line button: Enables as soon as at least 1 word is written in any note */}
                {(() => {
                  const hasAnyTrioWord = Boolean(
                    page.actionTrio?.what?.trim() || page.actionTrio?.how?.trim()
                  );
                  return (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mt-3 flex justify-center"
                    >
                      <button
                        type="button"
                        onClick={handleActionTrioContinue}
                        disabled={!hasAnyTrioWord}
                        className={`group inline-flex items-center gap-1 py-1 px-2 text-[13px] sm:text-[12px] font-serif italic transition-all touch-manipulation ${
                          hasAnyTrioWord
                            ? 'text-zinc-900 font-medium underline underline-offset-4 hover:text-black cursor-pointer'
                            : 'text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        {hasAnyTrioWord ? (
                          <>
                            <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-zinc-900" />
                            <span>done · follow the line</span>
                            <ArrowRight className="w-3.5 h-3.5 sm:w-3 sm:h-3 transition-transform group-hover:translate-x-0.5" />
                          </>
                        ) : (
                          <>
                            <span>write one word or pick a suggestion to follow the line...</span>
                            <ArrowRight className="w-3 h-3 opacity-50" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </motion.div>

              {/* ========================================================
                  5. FORK 2: "Can you act on this worry now?"
                  Upper Curve (Yes -> Take first step)
                  Lower Curve (No -> Do you know when you can act on it?)
              ======================================================== */}
              {unlocked.actNowFork && (
                <div ref={stepActNowForkRef} className="flex flex-row items-center shrink-0">
                  <svg
                    width="320"
                    height="260"
                    viewBox="0 0 320 260"
                    fill="none"
                    className="overflow-visible select-none"
                  >
                    <motion.path
                      d="M 0 130 L 55 130"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.35 } }}
                    />

                    {/* Upper Curve: Yes, I can act now */}
                    <motion.path
                      id="act-now-yes-curve"
                      d="M 55 130 C 125 128, 195 92, 305 42"
                      stroke={actNowDecision === 'yes' ? '#18181b' : '#71717a'}
                      strokeWidth={actNowDecision === 'yes' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleActNowChoice('yes')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.05, delay: 0.3 } }}
                    />

                    {/* Lower Curve: No, not right now */}
                    <motion.path
                      id="act-now-no-curve"
                      d="M 55 130 C 125 132, 195 168, 305 218"
                      stroke={actNowDecision === 'no' ? '#18181b' : '#71717a'}
                      strokeWidth={actNowDecision === 'no' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleActNowChoice('no')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.05, delay: 0.3 } }}
                    />

                    <g
                      onClick={() => handleActNowChoice('yes')}
                      className="cursor-pointer"
                      transform="translate(0, -8)"
                    >
                      <SvgCurvedTypewriter
                        href="#act-now-yes-curve"
                        startOffset="10%"
                        delay={0.95}
                        speed={0.025}
                        text="can I act on this right now?"
                        className="fill-zinc-800 font-serif text-[12.5px] italic"
                      />
                    </g>

                    <g
                      onClick={() => handleActNowChoice('no')}
                      className="cursor-pointer"
                      transform="translate(0, 17)"
                    >
                      <SvgCurvedTypewriter
                        href="#act-now-no-curve"
                        startOffset="10%"
                        delay={1.2}
                        speed={0.025}
                        text="or not right at this moment?"
                        className="fill-zinc-700 font-serif text-[12.5px] italic"
                      />
                    </g>
                  </svg>

                  <div className="flex flex-col justify-between h-[195px] -ml-2 z-10">
                    <button
                      type="button"
                      onClick={() => handleActNowChoice('yes')}
                      className={`px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-[12px] sm:text-[11px] font-serif italic cursor-pointer transition-all touch-manipulation ${
                        actNowDecision === 'yes'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-[#faf9f6] text-zinc-600 border border-zinc-300'
                      }`}
                    >
                      yes, now →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActNowChoice('no')}
                      className={`px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-[12px] sm:text-[11px] font-serif italic cursor-pointer transition-all touch-manipulation ${
                        actNowDecision === 'no'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-[#faf9f6] text-zinc-600 border border-zinc-300'
                      }`}
                    >
                      no, not now →
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================
                  5A. ENDPOINT: "Yes, act now"
                  "Take your first step towards your solution. -> Let the worry go."
              ======================================================== */}
              {unlocked.doNowEnd && (
                <div ref={stepFinalDoNowRef} className="flex flex-row items-center shrink-0">
                  <svg width="210" height="90" viewBox="0 0 210 90" fill="none" className="overflow-visible">
                    <motion.path
                      d="M 0 45 C 45 45, 75 30, 98 20 C 110 14, 114 4, 104 4 C 92 4, 90 32, 112 42 C 145 54, 175 42, 210 45"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.15, ease: [0.22, 1, 0.36, 1] } }}
                    />
                  </svg>

                  <motion.div
                    {...springDrag}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.85 }}
                    className="w-[315px] shrink-0 px-5 py-4 text-center select-text"
                  >
                    <p className="text-[14.5px] font-serif text-zinc-900 leading-snug">
                      <TypewriterText
                        text="“Take your first gentle step towards your solution.”"
                        delay={0.95}
                        speed={0.022}
                      />
                    </p>
                    <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1.5 leading-relaxed">
                      <TypewriterText
                        text="Even a tiny two-minute beginning dissolves the weight of overthinking and reminds you of your quiet strength."
                        delay={1.9}
                        speed={0.016}
                      />
                    </p>
                    <div className="w-8 h-[1px] bg-zinc-300 mx-auto my-3" />
                    <p className="text-[13px] font-serif text-zinc-900">
                      <TypewriterText
                        text="“Once begun, let the worry go.”"
                        delay={3.2}
                        speed={0.02}
                      />
                    </p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 3.9 }}
                      className="mt-4 flex items-center justify-center gap-3 flex-wrap"
                    >
                      {onOpenExportPreview && (
                        <button
                          type="button"
                          onClick={onOpenExportPreview}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900 text-white hover:bg-black text-[11.5px] font-serif italic transition-all shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>preview &amp; export postcard</span>
                        </button>
                      )}

                      {onNewPage && (
                        <button
                          type="button"
                          onClick={onNewPage}
                          className="text-[11.5px] font-serif italic text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                        >
                          begin a fresh line
                        </button>
                      )}
                    </motion.div>
                  </motion.div>

                  <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
                    <motion.path
                      d="M 0 30 C 30 34, 65 26, 95 30"
                      stroke="#18181b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.75, delay: 3.6 } }}
                    />
                  </svg>
                </div>
              )}

              {/* ========================================================
                  6. FORK 3 ("No, not now" -> "Do you know when you can act on it?")
                  Upper Curve (Yes -> Schedule it)
                  Lower Curve (No -> No bandwidth right now)
              ======================================================== */}
              {unlocked.knowWhenFork && (
                <div ref={stepKnowWhenForkRef} className="flex flex-row items-center shrink-0">
                  <svg
                    width="340"
                    height="260"
                    viewBox="0 0 340 260"
                    fill="none"
                    className="overflow-visible select-none"
                  >
                    <motion.path
                      d="M 0 130 L 55 130"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.35 } }}
                    />

                    {/* Upper Curve: Yes, I know when -> Schedule it */}
                    <motion.path
                      id="know-when-yes-curve"
                      d="M 55 130 C 130 128, 205 92, 325 42"
                      stroke={knowWhenDecision === 'yes' ? '#18181b' : '#71717a'}
                      strokeWidth={knowWhenDecision === 'yes' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleKnowWhenChoice('yes')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.05, delay: 0.3 } }}
                    />

                    {/* Lower Curve: No, I don't have the bandwidth/opportunity yet */}
                    <motion.path
                      id="know-when-no-curve"
                      d="M 55 130 C 130 132, 205 168, 325 218"
                      stroke={knowWhenDecision === 'no' ? '#18181b' : '#71717a'}
                      strokeWidth={knowWhenDecision === 'no' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleKnowWhenChoice('no')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.05, delay: 0.3 } }}
                    />

                    <g
                      onClick={() => handleKnowWhenChoice('yes')}
                      className="cursor-pointer"
                      transform="translate(0, -8)"
                    >
                      <SvgCurvedTypewriter
                        href="#know-when-yes-curve"
                        startOffset="8%"
                        delay={0.95}
                        speed={0.024}
                        text="do I know when I can act on it?"
                        className="fill-zinc-800 font-serif text-[12.5px] italic"
                      />
                    </g>

                    <g
                      onClick={() => handleKnowWhenChoice('no')}
                      className="cursor-pointer"
                      transform="translate(0, 17)"
                    >
                      <SvgCurvedTypewriter
                        href="#know-when-no-curve"
                        startOffset="8%"
                        delay={1.2}
                        speed={0.024}
                        text="or no bandwidth or opening yet?"
                        className="fill-zinc-700 font-serif text-[12.5px] italic"
                      />
                    </g>
                  </svg>

                  <div className="flex flex-col justify-between h-[195px] -ml-2 z-10">
                    <button
                      type="button"
                      onClick={() => handleKnowWhenChoice('yes')}
                      className={`px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-[12px] sm:text-[11px] font-serif italic cursor-pointer transition-all touch-manipulation ${
                        knowWhenDecision === 'yes'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-[#faf9f6] text-zinc-600 border border-zinc-300'
                      }`}
                    >
                      yes, schedule →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKnowWhenChoice('no')}
                      className={`px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-full text-[12px] sm:text-[11px] font-serif italic cursor-pointer transition-all touch-manipulation ${
                        knowWhenDecision === 'no'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-[#faf9f6] text-zinc-600 border border-zinc-300'
                      }`}
                    >
                      no, not yet →
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================
                  6A. ENDPOINT: "Yes, schedule it"
                  Includes Date & Time Picker + Mark in Google Calendar + Postcard Preview
              ======================================================== */}
              {unlocked.scheduleEnd && (
                <div ref={stepFinalScheduleRef} className="flex flex-row items-center shrink-0">
                  <svg width="210" height="90" viewBox="0 0 210 90" fill="none" className="overflow-visible">
                    <motion.path
                      d="M 0 45 C 45 45, 75 30, 98 20 C 110 14, 114 4, 104 4 C 92 4, 90 32, 112 42 C 145 54, 175 42, 210 45"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.15, ease: [0.22, 1, 0.36, 1] } }}
                    />
                  </svg>

                  <motion.div
                    data-draggable-node="true"
                    {...springDrag}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.85 }}
                    className="w-[335px] sm:w-[375px] shrink-0 px-4 sm:px-5 py-4 text-center select-text cursor-grab active:cursor-grabbing touch-manipulation"
                  >
                    <p className="text-[14.5px] font-serif text-zinc-900 leading-snug">
                      <TypewriterText
                        text="“Place it gently onto your calendar or someday log.”"
                        delay={0.95}
                        speed={0.022}
                      />
                    </p>
                    <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1.5 leading-relaxed">
                      <TypewriterText
                        text={`Because you have given this step a safe home (${
                          page.actionTrio?.when &&
                          !/^(yes|no)$/i.test(page.actionTrio.when.trim()) &&
                          !page.actionTrio.when.includes(readableScheduleDisplay)
                            ? `${page.actionTrio.when} · ${readableScheduleDisplay}`
                            : readableScheduleDisplay || 'for later'
                        }), your mind no longer has to keep holding it in the background today.`}
                        delay={1.85}
                        speed={0.014}
                      />
                    </p>

                    {/* Gentle Date & Time Picker Card */}
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="mt-3.5 p-3.5 bg-white/90 border border-zinc-200/90 rounded-xl shadow-2xs text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-serif italic text-zinc-500">
                          choose a gentle date &amp; time for yourself:
                        </span>
                      </div>

                      {/* Quick Date Presets — Automatically includes and selects whatever "when?" chip the user chose earlier */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                        {(() => {
                          const basePresets: Array<{ label: string; date: string; time: string }> = [];
                          const chosenWhen = page.actionTrio?.when?.trim() || '';
                          if (chosenWhen) {
                            const parsedChosen = parseWhenTextToSchedule(chosenWhen);
                            if (parsedChosen.intent === 'later' && chosenWhen.length <= 28) {
                              basePresets.push({
                                label: chosenWhen.toLowerCase(),
                                date: parsedChosen.date,
                                time: parsedChosen.time,
                              });
                            }
                          }

                          for (const w of trioSuggestions.when) {
                            const parsedW = parseWhenTextToSchedule(w);
                            if (
                              parsedW.intent === 'later' &&
                              !basePresets.some((p) => p.label.toLowerCase() === w.toLowerCase().trim())
                            ) {
                              basePresets.push({
                                label: w.toLowerCase().trim(),
                                date: parsedW.date,
                                time: parsedW.time,
                              });
                            }
                          }

                          const standardPresets = [
                            { label: 'before bed tonight', date: getFutureDateIso(0), time: '21:30' },
                            { label: 'tomorrow morning', date: getFutureDateIso(1), time: '09:00' },
                            { label: 'in 3 days', date: getFutureDateIso(3), time: '10:00' },
                            { label: 'this weekend', date: getUpcomingWeekendIso(), time: '11:00' },
                            { label: 'next week', date: getFutureDateIso(7), time: '10:00' },
                          ];

                          for (const sp of standardPresets) {
                            if (!basePresets.some((p) => p.label.toLowerCase() === sp.label.toLowerCase())) {
                              basePresets.push(sp);
                            }
                          }

                          return basePresets.slice(0, 6).map((preset) => {
                            const matchesWhenLabel =
                              Boolean(chosenWhen) &&
                              chosenWhen.toLowerCase() === preset.label.toLowerCase();
                            const matchesDateTime =
                              activeScheduledDate === preset.date &&
                              activeScheduledTime === preset.time;
                            const isSelected = matchesWhenLabel || matchesDateTime;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  handleScheduleDateTimeChange(preset.date, preset.time, preset.label)
                                }
                                className={`px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-full text-[11px] sm:text-[10.5px] font-serif italic transition-all cursor-pointer touch-manipulation ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-[#faf9f6] text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          });
                        })()}
                      </div>

                      {/* Concrete Date & Time Inputs (Single Clean Icon Each) */}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#faf9f6] hover:bg-zinc-100/70 border border-zinc-200/90 text-[12px] font-serif text-zinc-800 transition-colors cursor-pointer touch-manipulation">
                          <CalendarIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0 pointer-events-none" />
                          <input
                            type="date"
                            value={activeScheduledDate}
                            onFocus={() => handleNodeInputFocus(stepFinalScheduleRef)}
                            onBlur={handleNodeInputBlur}
                            onClick={(e) => {
                              const input = e.currentTarget as HTMLInputElement & {
                                showPicker?: () => void;
                              };
                              try {
                                input.showPicker?.();
                              } catch {
                                // ignore if browser already opened picker
                              }
                            }}
                            onChange={(e) =>
                              handleScheduleDateTimeChange(e.target.value, activeScheduledTime)
                            }
                            className="clean-date-time-input w-full bg-transparent text-[16px] sm:text-[12px] font-serif text-zinc-900 focus:outline-none cursor-pointer touch-manipulation"
                          />
                        </label>

                        <label className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#faf9f6] hover:bg-zinc-100/70 border border-zinc-200/90 text-[12px] font-serif text-zinc-800 transition-colors cursor-pointer touch-manipulation">
                          <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0 pointer-events-none" />
                          <input
                            type="time"
                            value={activeScheduledTime}
                            onFocus={() => handleNodeInputFocus(stepFinalScheduleRef)}
                            onBlur={handleNodeInputBlur}
                            onClick={(e) => {
                              const input = e.currentTarget as HTMLInputElement & {
                                showPicker?: () => void;
                              };
                              try {
                                input.showPicker?.();
                              } catch {
                                // ignore if browser already opened picker
                              }
                            }}
                            onChange={(e) =>
                              handleScheduleDateTimeChange(activeScheduledDate, e.target.value)
                            }
                            className="clean-date-time-input w-full bg-transparent text-[16px] sm:text-[12px] font-serif text-zinc-900 focus:outline-none cursor-pointer touch-manipulation"
                          />
                        </label>
                      </div>

                      {/* Google Calendar Action Area — Always Works Safely */}
                      <div className="mt-3 pt-2.5 border-t border-zinc-200/60 flex flex-col items-center gap-2">
                        {page.calendarEventCreated ? (
                          <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-[11.5px] font-serif">
                            <span className="inline-flex items-center gap-1.5 italic">
                              <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>Marked in Google Calendar</span>
                            </span>
                            <div className="inline-flex items-center gap-2.5">
                              {page.calendarEventLink && (
                                <a
                                  href={page.calendarEventLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] underline underline-offset-2 text-emerald-800 hover:text-emerald-950"
                                >
                                  <span>open</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={handlePrepareCalendarEvent}
                                className="text-[10.5px] font-serif italic text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                              >
                                edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full flex flex-col items-center gap-2">
                            <button
                              type="button"
                              onClick={handlePrepareCalendarEvent}
                              className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-black text-white text-[12px] font-serif italic inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>mark in Google Calendar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-8 h-[1px] bg-zinc-300 mx-auto my-3" />
                    <p className="text-[13px] font-serif text-zinc-900">
                      <TypewriterText
                        text="“It is safely anchored. Let the worry go.”"
                        delay={2.8}
                        speed={0.019}
                      />
                    </p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 3.4 }}
                      className="mt-4 flex items-center justify-center gap-3 flex-wrap"
                    >
                      {onOpenExportPreview && (
                        <button
                          type="button"
                          onClick={onOpenExportPreview}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900 text-white hover:bg-black text-[11.5px] font-serif italic transition-all shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>preview &amp; export postcard</span>
                        </button>
                      )}

                      {onNewPage && (
                        <button
                          type="button"
                          onClick={onNewPage}
                          className="text-[11.5px] font-serif italic text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                        >
                          begin a fresh line
                        </button>
                      )}
                    </motion.div>
                  </motion.div>

                  <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
                    <motion.path
                      d="M 0 30 C 30 34, 65 26, 95 30"
                      stroke="#18181b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.75, delay: 3.2 } }}
                    />
                  </svg>
                </div>
              )}

              {/* ========================================================
                  6B. ENDPOINT: "No." — No bandwidth right now
              ======================================================== */}
              {unlocked.noBandwidthEnd && (
                <div ref={stepFinalNoBandwidthRef} className="flex flex-row items-center shrink-0">
                  <svg width="220" height="90" viewBox="0 0 220 90" fill="none" className="overflow-visible">
                    <motion.path
                      d="M 0 55 C 45 55, 75 16, 110 20 C 145 24, 165 55, 220 48"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }}
                    />
                  </svg>

                  <motion.div
                    {...springDrag}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.9 }}
                    className="w-[330px] shrink-0 px-5 py-4 text-center select-text"
                  >
                    <p className="text-[14.5px] font-serif text-zinc-900 leading-snug">
                      <TypewriterText
                        text="“There is no use in hurting yourself with worry right now.”"
                        delay={1.0}
                        speed={0.022}
                      />
                    </p>
                    <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1.5 leading-relaxed">
                      <TypewriterText
                        text="You already know what you need to do, and it is completely okay that you do not have the bandwidth or opportunity today. Be gentle with your capacity."
                        delay={2.1}
                        speed={0.015}
                      />
                    </p>
                    <div className="w-8 h-[1px] bg-zinc-300 mx-auto my-3" />
                    <p className="text-[13px] font-serif text-zinc-900">
                      <TypewriterText
                        text="“Rest until the right moment opens. Let the worry go.”"
                        delay={3.9}
                        speed={0.018}
                      />
                    </p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 4.5 }}
                      className="mt-4 flex items-center justify-center gap-3 flex-wrap"
                    >
                      {onOpenExportPreview && (
                        <button
                          type="button"
                          onClick={onOpenExportPreview}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900 text-white hover:bg-black text-[11.5px] font-serif italic transition-all shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>preview &amp; export postcard</span>
                        </button>
                      )}

                      {onNewPage && (
                        <button
                          type="button"
                          onClick={onNewPage}
                          className="text-[11.5px] font-serif italic text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                        >
                          begin a fresh line
                        </button>
                      )}
                    </motion.div>
                  </motion.div>

                  <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
                    <motion.path
                      d="M 0 30 C 30 34, 65 26, 95 30"
                      stroke="#18181b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.75, delay: 4.2 } }}
                    />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          GOOGLE CALENDAR CONFIRMATION MODAL
          Uses Direct Pre-Filled Google Calendar Link + .ics Download
      ======================================================== */}
      <AnimatePresence>
        {showCalendarConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/35 backdrop-blur-xs font-serif select-none"
          >
            <div
              className="absolute inset-0"
              onClick={() => setShowCalendarConfirmModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="relative w-full max-w-md bg-[#faf9f6] border border-zinc-200 rounded-2xl shadow-xl p-6 z-10 select-text max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-200/70">
                <div>
                  <h4 className="text-[16px] font-serif italic text-zinc-900">
                    confirm Google Calendar event.
                  </h4>
                  <p className="text-[11.5px] font-serif text-zinc-500 mt-0.5">
                    Review your gentle step below and save it directly to your calendar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendarConfirmModal(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-left">
                <div>
                  <label className="block text-[11px] font-serif italic text-zinc-500 mb-1">
                    event title
                  </label>
                  <input
                    type="text"
                    value={customEventTitle}
                    onChange={(e) => setCustomEventTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-[13px] font-serif text-zinc-900 focus:outline-none focus:border-zinc-800"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[12px] font-serif">
                    <span className="italic text-zinc-500">when:</span>
                    <span className="text-zinc-900 font-medium">{readableScheduleDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-serif">
                    <span className="italic text-zinc-500">duration:</span>
                    <span className="text-zinc-700">30 minutes (gentle window)</span>
                  </div>
                  {page.actionTrio?.how && (
                    <div className="flex items-center justify-between text-[12px] font-serif">
                      <span className="italic text-zinc-500">approach:</span>
                      <span className="text-zinc-700 italic">{page.actionTrio.how}</span>
                    </div>
                  )}
                </div>

                {/* Direct Google Calendar Template Link + .ics Download */}
                <div className="p-3.5 rounded-xl bg-white border border-zinc-200/90 space-y-2.5">
                  <p className="text-[11px] font-serif text-zinc-500 leading-relaxed">
                    Opens Google Calendar’s event page pre-filled with your exact date, time, and notes, and marks this step complete right away.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <a
                      href={instantGoogleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleConfirmInstantCalendarLink}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-[12px] font-serif italic transition-all cursor-pointer"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>open &amp; save in Google Calendar</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={handleDownloadIcsInvite}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#faf9f6] hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-[11.5px] font-serif italic transition-colors cursor-pointer"
                      title="Download .ics calendar file for Apple Calendar, Outlook, or Google Calendar"
                    >
                      <Download className="w-3 h-3" />
                      <span>.ics file</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-200/70 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowCalendarConfirmModal(false)}
                  className="px-3.5 py-1 text-[12px] font-serif italic text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
