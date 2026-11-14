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
  otherPages?: DiaryPage[];
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
      quote: '“Do you need to have this whole worry figured out right now, or can you take just one calm step first?”',
      sub: "You don't have to carry the entire future today—clarity grows naturally once you touch one small piece.",
    },
    {
      quote: '“Is your mind showing you a proven fact, or just an anxious story trying to protect you?”',
      sub: 'You have walked through uncertainty before and found your footing one honest step at a time.',
    },
    {
      quote: '“Are you already good enough as you are right now, or are you holding yourself to an impossible standard?”',
      sub: 'It is safe to soften your shoulders and meet this moment without harsh self-judgment.',
    },
  ],
  Work: [
    {
      quote: '“Are you truly unprepared for this, or is your mind just rehearsing worst-case scenarios?”',
      sub: 'Draft three simple points, take a breath, and trust the capability you have built.',
    },
    {
      quote: '“Does this single task define your worth, or is it just one piece of work you can approach step by step?”',
      sub: 'You are a human being, not a machine, and doing one calm, realistic step today is enough.',
    },
    {
      quote: "“Do you have to solve tomorrow's entire workload tonight, or can you focus only on the next ten minutes?”",
      sub: 'Done calmly and imperfectly is far healthier than chasing an exhausting perfection.',
    },
  ],
  Health: [
    {
      quote: '“Will worrying harder heal your body faster, or does your body need patience and gentle care today?”',
      sub: 'Ruminating on what-ifs drains your energy, while one kind choice gives your body real support.',
    },
    {
      quote: '“Do you need an overnight transformation, or can you care for your health one small habit at a time?”',
      sub: 'Right now, in this present breath, you can meet your body with kindness instead of pressure.',
    },
  ],
  Relationships: [
    {
      quote: '“Do you have to carry every emotion in this relationship alone, or can you hold your part with honest boundaries?”',
      sub: 'You care deeply, and that is why it hurts—give both yourself and others a little breathing room.',
    },
    {
      quote: '“Does a tense moment mean connection is broken, or do hearts just need quiet space before talking?”',
      sub: 'Gentle patience with yourself and a calm voice are enough for today.',
    },
  ],
  Finances: [
    {
      quote: "“Will panicking change tomorrow's numbers, or can you look at just one practical piece calmly?”",
      sub: 'Your worth is never measured by a balance sheet, and you will figure this out step by step.',
    },
  ],
  'Personal Growth': [
    {
      quote: '“Are you already good enough, or is your mind telling you to be perfect before you can feel confident?”',
      sub: 'Confidence does not require perfection first—you are allowed to trust yourself while you are still growing.',
    },
    {
      quote: '“Are you truly falling behind, or are you just comparing your own chapter to someone else’s timeline?”',
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

function extractClientTopic(raw: string): string {
  const cleaned = raw
    .replace(/^(the\s+)?(fear|worry|anxiety|feeling|stress|pressure)\s+(of|about|that|over|around)\s+/i, '')
    .replace(/^i\s+(am\s+|feel\s+|have\s+to\s+|need\s+to\s+|want\s+to\s+|can'?t\s+)?(worried|worrying|anxious|scared|afraid|stressed|trying\s+to)?\s*(about|of|that|to)?\s*/i, '')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/[.?!]+$/, '')
    .trim();
  if (!cleaned) return 'this situation';
  const words = cleaned.split(/\s+/);
  const shortPhrase = words.length > 6 ? words.slice(0, 6).join(' ') : cleaned;
  return shortPhrase.toLowerCase();
}

function ensureClientSecondPersonQuote(rawQuote: string): string {
  let q = rawQuote.trim().replace(/^["“”']+/, '').replace(/["“”']+$/, '');
  q = q
    .replace(/\bAm I\b/g, 'Are you')
    .replace(/\bam I\b/g, 'are you')
    .replace(/\bDo I\b/g, 'Do you')
    .replace(/\bdo I\b/g, 'do you')
    .replace(/\bCan I\b/g, 'Can you')
    .replace(/\bcan I\b/g, 'can you')
    .replace(/\bWill I\b/g, 'Will you')
    .replace(/\bwill I\b/g, 'will you')
    .replace(/\bShould I\b/g, 'Should you')
    .replace(/\bshould I\b/g, 'should you')
    .replace(/\bHave I\b/g, 'Have you')
    .replace(/\bhave I\b/g, 'have you')
    .replace(/\bI am\b/g, 'you are')
    .replace(/\bI'm\b/g, "you're")
    .replace(/\bI’m\b/g, 'you’re')
    .replace(/\bI have\b/g, 'you have')
    .replace(/\bI need\b/g, 'you need')
    .replace(/\bI can\b/g, 'you can')
    .replace(/\bI will\b/g, 'you will')
    .replace(/\bI feel\b/g, 'you feel')
    .replace(/\bI think\b/g, 'you think')
    .replace(/\bI\b/g, 'you')
    .replace(/\bMy\b/g, 'Your')
    .replace(/\bmy\b/g, 'your')
    .replace(/\bMyself\b/g, 'Yourself')
    .replace(/\bmyself\b/g, 'yourself')
    .replace(/\bme\b/g, 'you');
  if (q.length > 0) {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  }
  return `“${q}”`;
}

function hashClientWorry(str: string): number {
  let hash = 0;
  const clean = str.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function extractConstructiveClientSubject(raw: string): string {
  const cleaned = raw
    .replace(/^(the\s+)?(fear|worry|anxiety|feeling|stress|pressure|thought)\s+(of|about|that|over|around)\s+/i, '')
    .replace(/^i\s+(am\s+|feel\s+|have\s+to\s+|need\s+to\s+|want\s+to\s+|can'?t\s+)?(worried|worrying|anxious|scared|afraid|stressed|trying\s+to|struggling\s+to)?\s*(about|of|that|to|with)?\s*/i, '')
    .replace(/^(not\s+(getting|finding|having|landing|passing|making|being\s+able\s+to|knowing\s+how\s+to)|can'?t\s+(get|find|land|pass|make|do|finish|start|handle|stop)|unable\s+to\s+(get|find|land|pass|do|finish|start)|failing\s+(to\s+|at\s+|in\s+)?|losing\s+|missing\s+|lack\s+of\s+|having\s+no\s+|no\s+)/i, '')
    .replace(/\b(a|an|the|my|your|our|some|any)\b/gi, ' ')
    .replace(/[.?!,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleaned || /^(it|this|that|everything|anything|nothing|something)$/i.test(cleaned)) {
    return '';
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function isMalformedClientActionChip(chip: string): boolean {
  const lower = chip.trim().toLowerCase();
  if (!lower || lower.length < 4) return true;
  return /\b(for|on|of|about)\s+(not\b|no\b|can'?t\b|cannot\b|never\b|unable\b|failing\b|being\b|having\b)/i.test(
    lower
  );
}

function deduplicateAndRotateClientItems(
  candidate: {
    detectedCategory: (typeof GENTLE_CONTEXTS)[number];
    what: string[];
    how: string[];
    when: string[];
    reaffirmations: Array<{ quote: string; sub: string }>;
  },
  rawWorry: string,
  excludeWhat: string[] = [],
  excludeQuotes: string[] = []
) {
  const topic = extractClientTopic(rawWorry);
  const constructiveGoal = extractConstructiveClientSubject(rawWorry);

  const dynamicReframe = {
    quote: `“Do you need to have ${topic} completely figured out right now, or can you handle one small piece calmly first?”`,
    sub: `You do not have to solve every detail of ${topic} in a single sitting—one grounded step today is enough.`,
  };

  const excludeQuoteSet = new Set(excludeQuotes.map((q) => q.trim().toLowerCase()));
  const excludeWhatSet = new Set(excludeWhat.map((w) => w.trim().toLowerCase()));

  const secondPersonReaffirmations = candidate.reaffirmations.map((r) => ({
    quote: ensureClientSecondPersonQuote(r.quote),
    sub: r.sub,
  }));

  let filteredReaffirmations = secondPersonReaffirmations.filter(
    (r) => !excludeQuoteSet.has(r.quote.trim().toLowerCase())
  );

  const hash = hashClientWorry(rawWorry);
  if (filteredReaffirmations.length === 0) {
    filteredReaffirmations = [dynamicReframe, ...secondPersonReaffirmations];
  } else if (
    excludeQuoteSet.size > 0 &&
    secondPersonReaffirmations[0] &&
    excludeQuoteSet.has(secondPersonReaffirmations[0].quote.trim().toLowerCase())
  ) {
    filteredReaffirmations = [dynamicReframe, ...filteredReaffirmations];
  } else if (rawWorry.trim().length > 0 && filteredReaffirmations.length > 1) {
    const startIdx = hash % filteredReaffirmations.length;
    filteredReaffirmations = [
      ...filteredReaffirmations.slice(startIdx),
      ...filteredReaffirmations.slice(0, startIdx),
    ];
  }

  let filteredWhat = candidate.what
    .filter((w) => !isMalformedClientActionChip(w))
    .filter((w) => !excludeWhatSet.has(w.trim().toLowerCase()));

  if (filteredWhat.length < 4) {
    const constructiveBackupPool = constructiveGoal
      ? [
          `prepare 1 part of ${constructiveGoal}`,
          `list 2 options for ${constructiveGoal}`,
          `15m focus on ${constructiveGoal}`,
          `ask 1 tip on ${constructiveGoal}`,
        ]
      : [
          'write 2 concrete options',
          'do 15 mins focused prep',
          'pick 1 controllable piece',
          'ask 1 trusted person',
        ];
    for (const item of constructiveBackupPool) {
      if (
        !isMalformedClientActionChip(item) &&
        !excludeWhatSet.has(item.toLowerCase()) &&
        !filteredWhat.includes(item)
      ) {
        filteredWhat.push(item);
      }
    }
  }

  return {
    detectedCategory: candidate.detectedCategory,
    what: filteredWhat.slice(0, 4),
    how: candidate.how.slice(0, 3),
    when: candidate.when.slice(0, 3),
    reaffirmations: filteredReaffirmations.slice(0, 4),
  };
}

export const WorryTreeCanvas: React.FC<WorryTreeCanvasProps> = ({
  page,
  otherPages = [],
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

  // Extract previously used quotes and steps from other sessions so a new line never repeats stale guidance
  const otherPagesRef = useRef<DiaryPage[]>(otherPages);
  otherPagesRef.current = otherPages;

  const activePageIdRef = useRef<string>(page.id);
  activePageIdRef.current = page.id;

  const getPreviousSessionExclusions = useCallback(() => {
    const excludeWhat: string[] = [];
    const excludeQuotes: string[] = [];
    for (const p of otherPagesRef.current) {
      if (p.id === activePageIdRef.current) continue;
      if (p.actionTrio?.what?.trim()) {
        excludeWhat.push(p.actionTrio.what.trim());
      }
      if (p.positiveReframe?.trim()) {
        const match = p.positiveReframe.trim().match(/^(“[^”]+”|"[^"]+")/);
        if (match?.[1]) {
          excludeQuotes.push(match[1].trim());
        }
      }
    }
    return { excludeWhat, excludeQuotes };
  }, []);

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

  const [reframeIdx, setReframeIdx] = useState(0);
  const reframeIdxRef = useRef(0);
  reframeIdxRef.current = reframeIdx;

  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  const manualCategoryOverrideRef = useRef<boolean>(false);
  const lastFetchedWorryRef = useRef<string>('');
  const aiResolvedWorryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Instant contextual baseline for category detection and second-person dilemma reframes tailored to the worry text
  const getLocalContextualSuggestions = useCallback(
    (worryText: string, categoryText: string = 'General') => {
      const raw = (worryText || '').trim();
      const text = raw.toLowerCase();
      const { excludeWhat, excludeQuotes } = getPreviousSessionExclusions();

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
        if (/can'?t\s+afford|cost\s+of\s+living|credit\s+card|bank\s+account|student\s+loan|pay\s+rent|pay\s+bills|unnecessary\s+expense|budget\s+room/i.test(text)) {
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

      const displayTopic = extractClientTopic(raw);
      const constructiveSubject = extractConstructiveClientSubject(raw);

      const finalize = (res: {
        detectedCategory: (typeof GENTLE_CONTEXTS)[number];
        what: string[];
        how: string[];
        when: string[];
        reaffirmations: Array<{ quote: string; sub: string }>;
      }) => deduplicateAndRotateClientItems(res, raw, excludeWhat, excludeQuotes);

      if (!raw) {
        return {
          detectedCategory,
          what: [],
          how: [],
          when: [],
          reaffirmations: CONTEXTUAL_REFRAMES[detectedCategory] || CONTEXTUAL_REFRAMES.General,
        };
      }

      // 1. Job Search / Fresher / Getting a Job / Placement / Unemployment / Resume / Career Entry
      if (
        /\b(fresher|not\s+getting\s+(a\s+|any\s+)?(job|role|offer|work|placement|internship)|can'?t\s+(find|get|land)\s+(a\s+)?(job|role|work|internship)|no\s+job|unemploy|job\s*hunt|job\s*search|looking\s+for\s+(a\s+)?job|apply(ing)?\s+for\s+jobs?|placement|campus\s+drive|career\s+start|entry[- ]level|resume|cv|job\s+market|hiring|job\s+application|job\s+opening|getting\s+hired|\bjob\b)\b/i.test(
          text
        )
      ) {
        const isFresher = /\b(fresher|campus|entry[- ]level|graduate|first\s+job|college|internship|placement)\b/i.test(
          text
        );
        return finalize({
          detectedCategory: 'Work',
          what: isFresher
            ? [
                'tailor 1 fresher resume',
                'apply to 2 entry roles',
                'practice 1 intro answer',
                'message 1 alum for tips',
              ]
            : [
                'update 1 resume section',
                'apply to 2 matching roles',
                'practice 1 interview story',
                'reach out to 1 contact',
              ],
          how: ['one role at a time', '25-min focused block', 'without comparing timelines'],
          when: ['right now', 'this afternoon', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: isFresher
                ? '“Does waiting for your first job offer mean you lack talent, or are you still on the path to your first match?”'
                : '“Does a slow job search erase your capability, or does it just mean you have not met the right team yet?”',
              sub: 'Every career starts with one door opening—refining one resume section or applying to two roles today is real progress.',
            },
            {
              quote: '“Do you need to solve your entire career tonight, or just take one calm step in your job search today?”',
              sub: 'You cannot control hiring timelines, but you can control twenty focused minutes on your resume or skills right now.',
            },
            {
              quote: '“Are unanswered applications a verdict on your worth, or just a normal numbers game before your first yes?”',
              sub: 'You only need one offer to begin—treat yourself kindly and focus on one thoughtful application at a time.',
            },
            {
              quote: '“What if you focused on two quality applications today and gave yourself permission to rest afterward?”',
              sub: 'Steady, calm daily effort will carry you further than exhausting yourself with worry.',
            },
          ],
        });
      }

      // 2. Job Interview / Technical Round / Coding Test
      if (
        /\b(interview|interviews|technical\s+round|coding\s+round|coding\s+test|hr\s+round|mock\s+interview|recruiter\s+call|pitch|demo|viva|assessment)\b/i.test(
          text
        )
      ) {
        return finalize({
          detectedCategory: 'Work',
          what: [
            'rehearse 2 key stories',
            'review 3 common questions',
            'write 2 questions to ask',
            'do 1 5-min mock answer',
          ],
          how: ['speaking slowly out loud', 'bullet points only', 'calmly with water'],
          when: ['in 10 mins', 'this evening', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: '“Are you truly unprepared for this interview, or is your mind just rehearsing worst-case scenarios?”',
              sub: 'Reviewing two honest examples of your work and speaking slowly will ground your confidence when you begin.',
            },
            {
              quote: '“Do you need to memorize every possible answer, or just show how you think clearly and honestly?”',
              sub: 'Interviewers connect with genuine problem-solving, not robotic perfection—one calm breath before speaking is enough.',
            },
          ],
        });
      }

      // 3. Exams / Studying / Grades / Academic
      if (
        /\b(exam|exams|midterm|finals?|quiz|test|syllabus|study|studying|revision|chapter|lecture|grade|grades|gpa|semester|assignment|homework|essay|thesis|dissertation|paper|failing\s+(my\s+)?(class|course|exam|test))\b/i.test(
          text
        )
      ) {
        return finalize({
          detectedCategory: 'Work',
          what: [
            'study 1 core topic now',
            'solve 3 practice questions',
            'summarize 1 page of notes',
            'review 1 weak concept',
          ],
          how: ['25-min study timer', 'phone in another room', 'one chapter at a time'],
          when: ['right now', 'this evening', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: '“Do you have to master the entire syllabus in one hour, or can you learn one core topic right now?”',
              sub: 'Studying one focused section for twenty-five minutes builds real retention and quiets exam panic.',
            },
          ],
        });
      }

      // 4. Work Deadlines / Boss / Workload / Projects
      if (
        /\b(deadline|workload|backlog|project|client|boss|manager|coworker|colleague|standup|meeting|email|inbox|report|deliverable|presentation|slides|promotion|performance\s+review|laid\s+off|layoff|fired)\b/i.test(
          text
        )
      ) {
        return finalize({
          detectedCategory: 'Work',
          what: [
            'list top 2 priorities',
            'draft rough first version',
            'send 1 clear status note',
            'do 15m on first section',
          ],
          how: ['rough draft first', '15-min focus block', 'one task at a time'],
          when: ['right now', 'in 15 mins', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: '“Do you have to finish the entire workload perfectly right now, or just complete the first rough piece?”',
              sub: 'Starting with an imperfect 15-minute draft breaks the paralysis and puts you back in control.',
            },
          ],
        });
      }

      // 5. Housing / Room Hunt / Apartment Search
      if (
        /\b(room\s*hunt|house\s*hunt|apartment|flat|studio|housing|landlord|sublet|neighborhood|viewing|listings?|roommate\s*search|place\s+to\s+live|find\s+a\s+(room|place|flat|apartment)|rent\s+a\s+(room|place|flat|apartment))\b/i.test(
          text
        )
      ) {
        return finalize({
          detectedCategory: /budget|rent|afford|cost|cheap|price|money|deposit/i.test(text)
            ? 'Finances'
            : 'Personal Growth',
          what: ['set max rent cap', 'list 3 room must-haves', 'message 2 listings', 'book 1 room viewing'],
          how: ['within your rent cap', 'one listing at a time', 'comparing calmly'],
          when: ['this evening', 'tomorrow morning', 'this weekend'],
          reaffirmations: [
            {
              quote: '“Do you have to find the perfect room tonight, or just shortlist two safe, affordable options first?”',
              sub: 'Finding the right space is a step-by-step search—sending two messages or booking one viewing today is real progress.',
            },
          ],
        });
      }

      // 6. Impulse Spending / Cravings to Spend / Unnecessary Expenses
      if (
        /\b(craving|impulse|unnecessary\s+expense|unnecessary\s+spend|overspend|shopping|splurg|temptation|control\s+my\s+(craving|spending|expense)|stop\s+buying|spending\s+habit)\b/i.test(
          text
        )
      ) {
        return finalize({
          detectedCategory: 'Finances',
          what: ['wait 24h before buying', 'remove saved card', 'move $10 to savings', 'write 1 true need'],
          how: ['24-hour pause rule', 'without self-blame', 'one urge at a time'],
          when: ['right now', 'before checkout', 'for 24 hours'],
          reaffirmations: [
            {
              quote: '“Is this craving asking for another purchase, or is your mind just looking for a quick moment of comfort?”',
              sub: 'Pausing for twenty-four hours lets the wave of impulse pass while keeping your financial goals gently intact.',
            },
          ],
        });
      }

      // 7. General Finances / Bills / Debt / Money
      if (detectedCategory === 'Finances') {
        return finalize({
          detectedCategory: 'Finances',
          what: [
            'check 1 account balance',
            'list 3 upcoming bills',
            'set 1 weekly spend limit',
            'pause 1 unused subscription',
          ],
          how: ['just the numbers', 'calmly with tea', 'one item at a time'],
          when: ['this evening', 'tomorrow morning', 'this weekend'],
          reaffirmations: [
            {
              quote: '“Will panicking tonight change the numbers, or can you look at one practical piece calmly?”',
              sub: 'Your worth as a person is never measured by a balance sheet—facing one small number today builds clarity.',
            },
          ],
        });
      }

      // 8. Health / Sleep / Fitness
      if (detectedCategory === 'Health') {
        return finalize({
          detectedCategory: 'Health',
          what: [
            'take a 15-min gentle walk',
            'drink 1 glass of water',
            'prep 1 nourishing meal',
            'rest eyes for 15 mins',
          ],
          how: ['kindly to your body', 'at an easy pace', 'one habit today'],
          when: ['right now', 'this evening', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: '“Will harsh worry heal your body faster, or does your body need steady, gentle care today?”',
              sub: 'One small supportive choice today does far more for your wellbeing than hours of self-criticism.',
            },
          ],
        });
      }

      // 9. Relationships
      if (detectedCategory === 'Relationships') {
        return finalize({
          detectedCategory: 'Relationships',
          what: [
            'write unsent thoughts first',
            'send 1 calm honest message',
            'ask for a 10-min talk',
            'take 30m quiet space',
          ],
          how: ['with calm "I" statements', 'listening without rush', 'with kind boundaries'],
          when: ['once things cool', 'this evening', 'tomorrow morning'],
          reaffirmations: [
            {
              quote: '“Do you have to fix this entire relationship tonight, or can you hold your part with calm boundaries?”',
              sub: 'Giving both yourself and the other person a little breathing room allows honest clarity to return.',
            },
          ],
        });
      }

      // 10. Constructive Goal Fallback (never slices negative words like "not getting")
      return finalize({
        detectedCategory,
        what: constructiveSubject
          ? [
              `list 2 options for ${constructiveSubject}`,
              `do 15m prep on ${constructiveSubject}`,
              `take 1 step toward ${constructiveSubject}`,
              `ask 1 tip on ${constructiveSubject}`,
            ]
          : [
              'write 2 concrete options',
              'pick 1 controllable step',
              'do 10m focused prep',
              'ask 1 person for input',
            ],
        how: ['one small piece', '15-min calm block', 'without perfection'],
        when: ['in 10 mins', 'this evening', 'tomorrow morning'],
        reaffirmations: [
          {
            quote: `“Do you need to have ${displayTopic} completely solved right now, or can you take just one calm step first?”`,
            sub: 'You do not have to carry the whole weight of this at once—setting it on paper is already a beginning.',
          },
          {
            quote: `“Are you truly unprepared for ${displayTopic}, or is your mind just rehearsing worst-case scenarios?”`,
            sub: 'Even when things feel uncertain, you can choose one small, grounded response today.',
          },
          {
            quote: `“Is your mind showing you the whole truth about ${displayTopic}, or just the loudest anxious story?”`,
            sub: `You have navigated hard moments before, and you will find your footing with ${displayTopic} too.`,
          },
          {
            quote: `“What if you stopped fighting the uncertainty around ${displayTopic} and focused only on what is in your hands today?”`,
            sub: 'Release the pressure to fix everything right now and be kind to your mind.',
          },
        ],
      });
    },
    [getPreviousSessionExclusions]
  );

  // AI-generated contextual suggestions (what / how / when) — populated with semantic & AI-tailored suggestions
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

  const applyTailoredSuggestions = useCallback(
    (
      nextData: {
        detectedCategory?: string;
        what?: string[];
        how?: string[];
        when?: string[];
        reaffirmations?: Array<{ quote: string; sub: string }>;
      },
      options?: { preserveVisibleReframe?: boolean; isAiTailored?: boolean }
    ) => {
      if (nextData.what && nextData.how && nextData.when) {
        setTrioSuggestions({
          what: nextData.what.filter((w) => !isMalformedClientActionChip(w)),
          how: nextData.how,
          when: nextData.when,
        });
      }

      const nextReaffirmations =
        Array.isArray(nextData.reaffirmations) && nextData.reaffirmations.length > 0
          ? nextData.reaffirmations.map((r) => ({
              quote: ensureClientSecondPersonQuote(r.quote),
              sub: r.sub,
            }))
          : undefined;

      if (nextReaffirmations) {
        setWorryReaffirmations((prevList) => {
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

        // 2. Update positiveReframe when new AI/contextual reframes arrive
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

        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    },
    [onUpdatePage]
  );

  const fetchWorryTrioSuggestions = useCallback(
    async (worryText: string, categoryText: string, force = false) => {
      const trimmed = (worryText || '').trim();
      if (!trimmed) {
        setTrioSuggestions({ what: [], how: [], when: [] });
        setIsLoadingTrioSuggestions(false);
        return;
      }

      const requestPageId = activePageIdRef.current;
      const key = `${requestPageId}:${trimmed.toLowerCase()}`;
      if (!force && lastFetchedWorryRef.current === key) return;
      lastFetchedWorryRef.current = key;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const { excludeWhat, excludeQuotes } = getPreviousSessionExclusions();
      const localContextual = getLocalContextualSuggestions(trimmed, categoryText || 'General');
      const alreadyHasAiForThisWorry = aiResolvedWorryRef.current === key;

      if (!unlockedRef.current.reframe || !alreadyHasAiForThisWorry) {
        applyTailoredSuggestions(localContextual, {
          preserveVisibleReframe: alreadyHasAiForThisWorry,
          isAiTailored: true,
        });
      }

      setIsLoadingTrioSuggestions(true);

      // Fire ultra-fast category detection in parallel with full trio + reframe generation
      fetch('/api/detect-worry-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootWorry: trimmed }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((catData) => {
          if (controller.signal.aborted || activePageIdRef.current !== requestPageId) return;
          if (catData?.detectedCategory && GENTLE_CONTEXTS.includes(catData.detectedCategory)) {
            applyTailoredSuggestions(
              { detectedCategory: catData.detectedCategory },
              { preserveVisibleReframe: true, isAiTailored: false }
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
            excludeWhat,
            excludeQuotes,
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted || activePageIdRef.current !== requestPageId) return;
        if (res.ok) {
          const data = await res.json();
          if (controller.signal.aborted || activePageIdRef.current !== requestPageId) return;
          if (
            Array.isArray(data.what) &&
            data.what.length > 0 &&
            Array.isArray(data.how) &&
            data.how.length > 0 &&
            Array.isArray(data.when) &&
            data.when.length > 0
          ) {
            const shouldPreserveReframe = !force && aiResolvedWorryRef.current === key;
            aiResolvedWorryRef.current = key;
            applyTailoredSuggestions(
              {
                detectedCategory: data.detectedCategory,
                what: data.what,
                how: data.how,
                when: data.when,
                reaffirmations: Array.isArray(data.reaffirmations) ? data.reaffirmations : undefined,
              },
              { preserveVisibleReframe: shouldPreserveReframe, isAiTailored: true }
            );
          }
        }
      } catch {
        if (!controller.signal.aborted && activePageIdRef.current === requestPageId) {
          applyTailoredSuggestions(localContextual, {
            preserveVisibleReframe: true,
            isAiTailored: true,
          });
        }
      } finally {
        if (!controller.signal.aborted && activePageIdRef.current === requestPageId) {
          setIsLoadingTrioSuggestions(false);
        }
      }
    },
    [applyTailoredSuggestions, getLocalContextualSuggestions, getPreviousSessionExclusions]
  );

  // Complete Session Isolation when switching pages or clicking "begin a new line"
  useEffect(() => {
    activePageIdRef.current = page.id;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    lastFetchedWorryRef.current = '';
    aiResolvedWorryRef.current = '';
    manualCategoryOverrideRef.current = false;
    reframeIdxRef.current = 0;
    setReframeIdx(0);
    setIsLoadingTrioSuggestions(false);
    setCustomEventTitle('');
    setShowCalendarConfirmModal(false);

    // Immediately clear previous page's AI suggestions so stale context never bleeds across sessions
    setTrioSuggestions({ what: [], how: [], when: [] });

    const currentWorry = (page.rootWorry || '').trim();
    const hasWorry = currentWorry.length > 0;
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

    const nextUnlocked = {
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
    unlockedRef.current = nextUnlocked;
    setUnlocked(nextUnlocked);

    const freshLocal = getLocalContextualSuggestions(currentWorry, page.category || 'General');
    setWorryReaffirmations(freshLocal.reaffirmations);

    if (currentWorry) {
      fetchWorryTrioSuggestions(currentWorry, page.category || 'General', true);
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // Automatically detect context, second-person dilemma reframes, and AI suggestions when the worry text changes
  useEffect(() => {
    const trimmed = page.rootWorry?.trim() || '';
    if (!trimmed) {
      setTrioSuggestions({ what: [], how: [], when: [] });
      return;
    }
    const key = `${page.id}:${trimmed.toLowerCase()}`;
    const localContextual = getLocalContextualSuggestions(trimmed, page.category || 'General');
    applyTailoredSuggestions(localContextual, {
      preserveVisibleReframe: aiResolvedWorryRef.current === key,
      isAiTailored: false,
    });

    const timer = setTimeout(() => {
      fetchWorryTrioSuggestions(trimmed, localContextual.detectedCategory || page.category || 'General');
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
  const rawActiveReframeItem = reframeList[reframeIdx % reframeList.length];
  const activeReframeItem = {
    quote: ensureClientSecondPersonQuote(rawActiveReframeItem.quote),
    sub: rawActiveReframeItem.sub,
  };

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
    if (e.pointerType === 'touch') return;
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

  // Shuffle comforting dilemma reframe when the user clicks "another perspective"
  const handleShuffleReframe = () => {
    const next = (reframeIdx + 1) % reframeList.length;
    reframeIdxRef.current = next;
    setReframeIdx(next);
    const item = reframeList[next];
    onUpdatePage((prev) => ({
      ...prev,
      positiveReframe: `${item.quote} ${item.sub}`,
    }));
    // If the user has cycled through all current perspectives, ask the AI in the background for a fresh batch
    if (next === 0 && page.rootWorry?.trim()) {
      fetchWorryTrioSuggestions(page.rootWorry, page.category || 'General', true);
    }
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
                reframeIdxRef.current = 0;
                setReframeIdx(0);
                lastFetchedWorryRef.current = '';
                aiResolvedWorryRef.current = '';

                const local = getLocalContextualSuggestions(nextWorry, 'General');
                const chosenReframe = local.reaffirmations[0];
                setTrioSuggestions({
                  what: local.what,
                  how: local.how,
                  when: local.when,
                });
                setWorryReaffirmations(local.reaffirmations);

                // If the user goes back to edit the root worry after filling out downstream branches,
                // fold back downstream forks & clear old choices/steps so stale answers don't linger
                const nextUnlocked = {
                  reframe: Boolean(nextWorry.trim()) && unlockedRef.current.reframe,
                  fork: false,
                  noActEnd: false,
                  actionTrio: false,
                  actNowFork: false,
                  doNowEnd: false,
                  knowWhenFork: false,
                  scheduleEnd: false,
                  noBandwidthEnd: false,
                };
                unlockedRef.current = nextUnlocked;
                setUnlocked(nextUnlocked);

                onUpdatePage((prev) => ({
                  ...prev,
                  rootWorry: nextWorry,
                  category: nextWorry.trim()
                    ? (local.detectedCategory as typeof prev.category)
                    : 'General',
                  positiveReframe:
                    nextWorry.trim() && chosenReframe
                      ? `${chosenReframe.quote} ${chosenReframe.sub}`
                      : '',
                  canAct: null,
                  canActOnWorry: null,
                  canActNow: null,
                  knowWhenAct: null,
                  actionTiming: null,
                  letWorryGoSealed: false,
                  calendarEventCreated: false,
                  actionTrio: {
                    what: '',
                    how: '',
                    when: '',
                    completed: false,
                  },
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
                className="mt-3 flex items-center justify-center gap-3 flex-wrap"
              >
                <button
                  type="button"
                  onClick={handleShuffleReframe}
                  className="py-1 px-1.5 text-[11.5px] sm:text-[11px] font-serif italic text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer underline underline-offset-2 touch-manipulation"
                >
                  ↻ another perspective
                </button>
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
              3. FORK 1: Single question along the main stem,
              then splits into Upper Curve (Yes) & Lower Curve (No)
          ======================================================== */}
          {unlocked.fork && (
            <div ref={stepForkRef} className="flex items-center shrink-0 relative">
              <svg
                width="480"
                height="380"
                viewBox="0 0 480 380"
                fill="none"
                className="overflow-visible select-none"
              >
                {/* Incoming horizontal stem carrying the single fork question */}
                <motion.path
                  id="fork1-stem"
                  d="M 0 190 C 80 186, 165 194, 255 190"
                  stroke="#18181b"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ pathLength: { duration: 0.75, ease: 'easeOut' } }}
                />

                {/* Single Question Along the Main Line Before the Split */}
                <g transform="translate(0, -10)">
                  <SvgCurvedTypewriter
                    href="#fork1-stem"
                    startOffset="6%"
                    delay={0.45}
                    speed={0.022}
                    text="is this something I can act on?"
                    className="fill-zinc-800 font-serif text-[13.5px] tracking-wide"
                  />
                </g>

                {/* UPPER FORK CURVE (Yes - something I can act on) */}
                <motion.path
                  id="fork1-upper"
                  d="M 255 190 C 325 188, 380 135, 465 45"
                  stroke={canActDecision === 'yes' ? '#18181b' : '#52525b'}
                  strokeWidth={canActDecision === 'yes' ? '2.1' : '1.5'}
                  strokeLinecap="round"
                  className="cursor-pointer transition-colors hover:stroke-black"
                  onClick={() => handleForkChoice('yes')}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.05, delay: 0.7, ease: [0.22, 1, 0.36, 1] },
                  }}
                />

                {/* LOWER FORK CURVE (No - outside my hands today) */}
                <motion.path
                  id="fork1-lower"
                  d="M 255 190 C 325 192, 380 245, 465 335"
                  stroke={canActDecision === 'no' ? '#18181b' : '#52525b'}
                  strokeWidth={canActDecision === 'no' ? '2.1' : '1.5'}
                  strokeLinecap="round"
                  className="cursor-pointer transition-colors hover:stroke-black"
                  onClick={() => handleForkChoice('no')}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    pathLength: { duration: 1.05, delay: 0.7, ease: [0.22, 1, 0.36, 1] },
                  }}
                />
              </svg>

              {/* Interactive branch tips */}
              <div className="flex flex-col justify-between h-[320px] -ml-3 z-10 pointer-events-auto">
                <motion.button
                  type="button"
                  onClick={() => handleForkChoice('yes')}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.45 }}
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
                  transition={{ delay: 1.6 }}
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
              "What can I gently do about this worry? How?"
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
                  className="flex items-center justify-center gap-2.5 mt-0.5 mb-2.5 flex-wrap"
                >
                  <p className="text-[12px] font-serif italic text-zinc-500">
                    <TypewriterText
                      text="Write one word or tap a suggestion for your worry below."
                      delay={1.65}
                      speed={0.017}
                    />
                  </p>
                  {isLoadingTrioSuggestions ? (
                    <span className="text-[10.5px] font-serif italic text-zinc-400 animate-pulse whitespace-nowrap">
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
                      className="inline-flex items-center gap-1 py-0.5 px-1 text-[11px] sm:text-[10.5px] font-serif italic text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer underline underline-offset-2 whitespace-nowrap touch-manipulation"
                    >
                      <span>↻ refresh</span>
                    </button>
                  )}
                </div>

                {/* 2 Compact Journal Notes in a Horizontal Row with Left-Aligned AI-Tailored Suggestion Chips */}
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
                      {trioSuggestions.what.length > 0 ? (
                        trioSuggestions.what.map((word) => (
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
                        ))
                      ) : isLoadingTrioSuggestions ? (
                        <span className="text-[10.5px] font-serif italic text-zinc-400 animate-pulse py-1">
                          tailoring steps to your worry...
                        </span>
                      ) : null}
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
                      {trioSuggestions.how.length > 0 ? (
                        trioSuggestions.how.map((word) => (
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
                        ))
                      ) : isLoadingTrioSuggestions ? (
                        <span className="text-[10.5px] font-serif italic text-zinc-400 animate-pulse py-1">
                          tailoring approach...
                        </span>
                      ) : null}
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
                  5. FORK 2: Single question along the main stem,
                  then splits into Upper Curve (Yes) & Lower Curve (No)
              ======================================================== */}
              {unlocked.actNowFork && (
                <div ref={stepActNowForkRef} className="flex flex-row items-center shrink-0">
                  <svg
                    width="420"
                    height="260"
                    viewBox="0 0 420 260"
                    fill="none"
                    className="overflow-visible select-none"
                  >
                    <motion.path
                      id="fork2-stem"
                      d="M 0 130 C 75 127, 155 133, 235 130"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.7 } }}
                    />

                    {/* Single Question Along the Main Line Before the Split */}
                    <g transform="translate(0, -10)">
                      <SvgCurvedTypewriter
                        href="#fork2-stem"
                        startOffset="6%"
                        delay={0.45}
                        speed={0.022}
                        text="can I act on this right now?"
                        className="fill-zinc-800 font-serif text-[12.5px] italic"
                      />
                    </g>

                    {/* Upper Curve: Yes, I can act now */}
                    <motion.path
                      id="act-now-yes-curve"
                      d="M 235 130 C 290 128, 340 92, 405 42"
                      stroke={actNowDecision === 'yes' ? '#18181b' : '#71717a'}
                      strokeWidth={actNowDecision === 'yes' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleActNowChoice('yes')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.95, delay: 0.65 } }}
                    />

                    {/* Lower Curve: No, not right now */}
                    <motion.path
                      id="act-now-no-curve"
                      d="M 235 130 C 290 132, 340 168, 405 218"
                      stroke={actNowDecision === 'no' ? '#18181b' : '#71717a'}
                      strokeWidth={actNowDecision === 'no' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleActNowChoice('no')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.95, delay: 0.65 } }}
                    />
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
                  6. FORK 3: Single question along the main stem,
                  then splits into Upper Curve (Yes -> Schedule) & Lower Curve (No)
              ======================================================== */}
              {unlocked.knowWhenFork && (
                <div ref={stepKnowWhenForkRef} className="flex flex-row items-center shrink-0">
                  <svg
                    width="435"
                    height="260"
                    viewBox="0 0 435 260"
                    fill="none"
                    className="overflow-visible select-none"
                  >
                    <motion.path
                      id="fork3-stem"
                      d="M 0 130 C 80 127, 165 133, 250 130"
                      stroke="#18181b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.7 } }}
                    />

                    {/* Single Question Along the Main Line Before the Split */}
                    <g transform="translate(0, -10)">
                      <SvgCurvedTypewriter
                        href="#fork3-stem"
                        startOffset="5%"
                        delay={0.45}
                        speed={0.022}
                        text="do I know when I can act on it?"
                        className="fill-zinc-800 font-serif text-[12.5px] italic"
                      />
                    </g>

                    {/* Upper Curve: Yes, I know when -> Schedule it */}
                    <motion.path
                      id="know-when-yes-curve"
                      d="M 250 130 C 305 128, 355 92, 420 42"
                      stroke={knowWhenDecision === 'yes' ? '#18181b' : '#71717a'}
                      strokeWidth={knowWhenDecision === 'yes' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleKnowWhenChoice('yes')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.95, delay: 0.65 } }}
                    />

                    {/* Lower Curve: No, I don't have the bandwidth/opportunity yet */}
                    <motion.path
                      id="know-when-no-curve"
                      d="M 250 130 C 305 132, 355 168, 420 218"
                      stroke={knowWhenDecision === 'no' ? '#18181b' : '#71717a'}
                      strokeWidth={knowWhenDecision === 'no' ? '2.0' : '1.45'}
                      strokeLinecap="round"
                      className="cursor-pointer"
                      onClick={() => handleKnowWhenChoice('no')}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ pathLength: { duration: 0.95, delay: 0.65 } }}
                    />
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
