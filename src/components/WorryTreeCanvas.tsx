import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  ExternalLink,
  X,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { DiaryPage } from '../types/worryTree';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  createGoogleCalendarEvent,
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

// Intimate two-part comforting reframes before the fork
const CONTEXTUAL_REFRAMES: Record<string, Array<{ quote: string; sub: string }>> = {
  General: [
    {
      quote: '“I know this feels heavy right now.”',
      sub: "But you don't have to carry the whole future today—one gentle breath is enough.",
    },
    {
      quote: '“This feeling is only a passing visitor.”',
      sub: 'You have walked through uncertainty before and found your footing.',
    },
    {
      quote: '“Overthinking is just my mind trying to protect me.”',
      sub: 'It is safe to soften my shoulders and pause for a moment.',
    },
  ],
  Work: [
    {
      quote: '“This single task does not define my worth.”',
      sub: 'I am a human being, not a machine, and my best today is enough.',
    },
    {
      quote: "“I don't have to solve tomorrow's work tonight.”",
      sub: 'One calm, realistic step at a time will carry me through.',
    },
  ],
  Health: [
    {
      quote: '“My body is doing its best to keep me safe.”',
      sub: "Ruminating on what-ifs won't heal me, but patience and rest will help.",
    },
    {
      quote: '“I can meet tension with a little more kindness.”',
      sub: 'Right now, in this present breath, I am okay.',
    },
  ],
  Relationships: [
    {
      quote: '“I care deeply, and that is why it hurts.”',
      sub: 'I can only hold my own honesty and give the rest space to breathe.',
    },
    {
      quote: "“I don't have to carry the whole weight alone.”",
      sub: 'Gentle patience with myself and others is enough for today.',
    },
  ],
  Finances: [
    {
      quote: "“Panic won't change tomorrow's numbers.”",
      sub: 'I have resilience, and I will figure this out piece by piece.',
    },
  ],
  'Personal Growth': [
    {
      quote: '“I am not falling behind in my life.”',
      sub: 'Life moves in waves and loops, never in a rigid straight line.',
    },
  ],
};

// Elastic spring drag for small inline nodes
const springDrag = {
  drag: true,
  dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
  dragElastic: 0.25,
  whileDrag: { scale: 1.03, cursor: 'grabbing' },
  transition: { type: 'spring' as const, stiffness: 240, damping: 18 },
};

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

  // Google Calendar OAuth & Confirmation Modal State
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [showCalendarConfirmModal, setShowCalendarConfirmModal] = useState<boolean>(false);
  const [isCreatingCalendarEvent, setIsCreatingCalendarEvent] = useState<boolean>(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [customEventTitle, setCustomEventTitle] = useState<string>('');

  useEffect(() => {
    const unsubscribe = initAuth(
      () => setNeedsAuth(false),
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
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

  // AI-generated contextual suggestions for "What can I gently do about this worry?" (what / how / when)
  const [trioSuggestions, setTrioSuggestions] = useState<{
    what: string[];
    how: string[];
    when: string[];
  }>({
    what: ['write 1 small step', 'talk to someone', 'tidy 1 corner', 'prepare for 5 mins'],
    how: ['step by step', 'calmly, no rush', 'ask for help'],
    when: ['in 5 mins', 'tonight', 'tomorrow morning'],
  });
  const [isLoadingTrioSuggestions, setIsLoadingTrioSuggestions] = useState<boolean>(false);
  const lastFetchedWorryRef = useRef<string>('');

  const fetchWorryTrioSuggestions = useCallback(
    async (worryText: string, categoryText: string, force = false) => {
      const trimmed = (worryText || '').trim();
      if (!trimmed) return;
      const key = `${trimmed.toLowerCase()}::${(categoryText || 'General').toLowerCase()}`;
      if (!force && lastFetchedWorryRef.current === key) return;
      lastFetchedWorryRef.current = key;
      setIsLoadingTrioSuggestions(true);
      try {
        const res = await fetch('/api/worry-trio-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rootWorry: trimmed,
            category: categoryText || 'General',
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
            setTrioSuggestions({
              what: data.what,
              how: data.how,
              when: data.when,
            });
          }
        }
      } catch {
        // Keep existing or default suggestions gracefully
      } finally {
        setIsLoadingTrioSuggestions(false);
      }
    },
    []
  );

  // Automatically fetch AI suggestions tailored to the user's worry when worry is present
  useEffect(() => {
    const trimmed = page.rootWorry?.trim() || '';
    if (!trimmed) return;
    if (unlocked.reframe || unlocked.actionTrio) {
      fetchWorryTrioSuggestions(trimmed, page.category || 'General');
    }
  }, [page.rootWorry, page.category, unlocked.reframe, unlocked.actionTrio, fetchWorryTrioSuggestions]);

  const activeCategory =
    page.category && CONTEXTUAL_REFRAMES[page.category] ? page.category : 'General';
  const reframeList = CONTEXTUAL_REFRAMES[activeCategory] || CONTEXTUAL_REFRAMES.General;
  const activeReframeItem = reframeList[reframeIdx % reframeList.length];

  // Smooth horizontal & vertical pan to newly revealed step without clipping
  const panToNode = useCallback(
    (targetRef: React.RefObject<HTMLDivElement | null>, delayMs = 260) => {
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'center',
          });
        }
      }, delayMs);
    },
    []
  );

  // Step 1 -> Step 2 (Reframe)
  const handleWorryContinue = () => {
    if (!page.rootWorry || page.rootWorry.trim().length === 0) return;
    if (!page.positiveReframe) {
      onUpdatePage((prev) => ({
        ...prev,
        positiveReframe: `${activeReframeItem.quote} ${activeReframeItem.sub}`,
      }));
    }
    fetchWorryTrioSuggestions(page.rootWorry, page.category || 'General');
    setUnlocked((prev) => ({ ...prev, reframe: true }));
    panToNode(step2Ref, 300);
  };

  // Shuffle comforting reframe
  const handleShuffleReframe = () => {
    const next = (reframeIdx + 1) % reframeList.length;
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
      setUnlocked((prev) => ({
        ...prev,
        noActEnd: false,
        actionTrio: true,
      }));
      panToNode(stepActionTrioRef, 350);
    }
  };

  // Step 4 Action Trio (What? How? When?) -> Fork 2 ("Can you act on this worry now?")
  const handleActionTrioContinue = () => {
    onUpdatePage((prev) => ({
      ...prev,
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
    onUpdatePage((prev) => ({
      ...prev,
      canActNow: choice,
      actionTiming: choice === 'yes' ? 'now' : 'later',
      letWorryGoSealed: choice === 'yes' ? true : prev.letWorryGoSealed,
    }));

    if (choice === 'yes') {
      setUnlocked((prev) => ({
        ...prev,
        doNowEnd: true,
        knowWhenFork: false,
        scheduleEnd: false,
        noBandwidthEnd: false,
      }));
      panToNode(stepFinalDoNowRef, 350);
    } else {
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
    const defaultDate = page.scheduledDate || getFutureDateIso(1);
    const defaultTime = page.scheduledTime || '10:00';
    const readable = formatReadableSchedule(defaultDate, defaultTime);

    onUpdatePage((prev) => ({
      ...prev,
      knowWhenAct: choice,
      letWorryGoSealed: true,
      scheduledDate: choice === 'yes' ? prev.scheduledDate || defaultDate : prev.scheduledDate,
      scheduledTime: choice === 'yes' ? prev.scheduledTime || defaultTime : prev.scheduledTime,
      actionTrio:
        choice === 'yes'
          ? {
              what: prev.actionTrio?.what || '',
              how: prev.actionTrio?.how || '',
              when: prev.actionTrio?.when || readable,
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
  const handleScheduleDateTimeChange = (newDate: string, newTime: string) => {
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
        when: readable || prev.actionTrio?.when || '',
        completed: true,
      },
    }));
  };

  // Build event payload from current page & custom title
  const buildCurrentCalendarPayload = useCallback(
    (overrideTitle?: string) => {
      const chosenDate = page.scheduledDate || getFutureDateIso(1);
      const chosenTime = page.scheduledTime || '10:00';
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
      page.scheduledDate,
      page.scheduledTime,
      page.actionTrio?.what,
      page.actionTrio?.how,
      page.rootWorry,
      page.positiveReframe,
      customEventTitle,
    ]
  );

  // Open confirmation modal immediately (works with or without OAuth sign-in)
  const handlePrepareCalendarEvent = () => {
    setCalendarError(null);
    const defaultSummary = page.actionTrio?.what?.trim()
      ? `Gentle Step: ${page.actionTrio.what.trim()}`
      : `Untangle Reflection: ${page.rootWorry?.trim() || 'Scheduled Step'}`;
    if (!customEventTitle.trim()) {
      setCustomEventTitle(defaultSummary);
    }
    setShowCalendarConfirmModal(true);
  };

  // Google Sign-In handler (gracefully handles testing-mode popup close without scary raw errors)
  const handleGoogleLogin = async (openModalAfter = false) => {
    setCalendarError(null);
    setIsSigningInGoogle(true);
    const defaultSummary = page.actionTrio?.what?.trim()
      ? `Gentle Step: ${page.actionTrio.what.trim()}`
      : `Untangle Reflection: ${page.rootWorry?.trim() || 'Scheduled Step'}`;
    if (!customEventTitle.trim()) {
      setCustomEventTitle(defaultSummary);
    }

    try {
      const result = await googleSignIn();
      if (result?.accessToken) {
        setNeedsAuth(false);
        if (openModalAfter) {
          setShowCalendarConfirmModal(true);
        }
      }
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : '';
      // If user closed the "Google hasn't verified this app" popup or popup was blocked,
      // open the confirmation modal smoothly so they can use the Safe Instant Google Calendar link!
      setShowCalendarConfirmModal(true);
      if (code === 'POPUP_CLOSED') {
        setCalendarError(
          'Sign-in popup was closed — you can still mark this date in Google Calendar below using the Safe Instant Link (no sign-in needed), or click "Continue" on Google’s testing screen.'
        );
      } else if (code === 'POPUP_BLOCKED') {
        setCalendarError(
          'Your browser blocked the sign-in popup — use the Safe Instant Google Calendar button below to add your event directly.'
        );
      } else {
        setCalendarError(
          'Direct OAuth sync was skipped — use the Safe Instant Google Calendar button below to save your event right away.'
        );
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  // Mark as scheduled via Safe Instant Google Calendar Template Link (Zero OAuth Warning)
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

  // Execute Direct 1-Click Google Calendar API creation after explicit confirmation
  const handleConfirmAddCalendarEvent = async () => {
    setCalendarError(null);
    setIsCreatingCalendarEvent(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        await handleGoogleLogin(false);
      }

      const payload = buildCurrentCalendarPayload();
      const created = await createGoogleCalendarEvent(payload);

      onUpdatePage((prev) => ({
        ...prev,
        scheduledDate: payload.date,
        scheduledTime: payload.time,
        calendarEventCreated: true,
        calendarEventLink: created.htmlLink || buildGoogleCalendarTemplateUrl(payload),
        calendarEventSummary: payload.summary,
      }));
      setShowCalendarConfirmModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'NEEDS_AUTH' || message === 'POPUP_CLOSED') {
        setNeedsAuth(true);
        setCalendarError(
          'To use 1-click API sync, sign in with Google and click "Continue" on the testing screen — or click "Open & save in Google Calendar" above with zero sign-in.'
        );
      } else {
        setCalendarError(
          'Could not sync via API right now — click "Open & save in Google Calendar" above to save it directly.'
        );
      }
    } finally {
      setIsCreatingCalendarEvent(false);
    }
  };

  const canActDecision = page.canActOnWorry || page.canAct;
  const actNowDecision = page.canActNow;
  const knowWhenDecision = page.knowWhenAct;

  const activeScheduledDate = page.scheduledDate || getFutureDateIso(1);
  const activeScheduledTime = page.scheduledTime || '10:00';
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
        className="w-full h-full overflow-x-auto overflow-y-auto no-scrollbar bg-[#faf9f6] text-zinc-900 select-none"
      >
        {/* Horizontal & Vertical Continuous Track:
            Uses min-h-full (NOT h-full) and py-20 so tall branching trees never clip at top or bottom */}
        <div className="min-w-max min-h-full px-16 py-20 flex flex-row items-center">
          {/* ========================================================
              1. INITIAL HORIZONTAL LEAD-IN LINE (Left Edge -> Node 1)
          ======================================================== */}
          <div className="flex items-center shrink-0">
            <svg width="160" height="80" viewBox="0 0 160 80" fill="none" className="overflow-visible">
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
            {...springDrag}
            className="w-[270px] shrink-0 px-4 py-3 text-center select-text"
          >
            <p className="text-[14px] font-serif text-zinc-900 leading-snug">
              <TypewriterText text="“What is worrying you right now?”" delay={0.55} speed={0.024} />
            </p>
            <p className="text-[12px] font-serif italic text-zinc-500 mt-0.5 mb-3 leading-snug">
              <TypewriterText
                text="Write something that's on your mind."
                delay={1.15}
                speed={0.017}
              />
            </p>

            {/* Compact Underlined Worry Input — zero gap between text and line */}
            <input
              type="text"
              value={page.rootWorry}
              onChange={(e) => onUpdatePage((prev) => ({ ...prev, rootWorry: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleWorryContinue();
                }
              }}
              placeholder="write one word or thought..."
              className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[13px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 px-1 leading-none text-center focus:outline-none transition-colors"
            />

            {/* Tiny Lowercase Context Pickers */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2 text-[11px] font-serif italic text-zinc-400">
              {GENTLE_CONTEXTS.map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => {
                    onUpdatePage((prev) => ({ ...prev, category: ctx }));
                    setReframeIdx(0);
                  }}
                  className={`px-1 transition-colors cursor-pointer ${
                    page.category === ctx
                      ? 'text-zinc-900 font-medium underline underline-offset-4'
                      : 'hover:text-zinc-700'
                  }`}
                >
                  {ctx.toLowerCase()}
                </button>
              ))}
            </div>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={handleWorryContinue}
                disabled={!page.rootWorry || page.rootWorry.trim().length === 0}
                className={`group inline-flex items-center gap-1 text-[12px] font-serif italic transition-all ${
                  page.rootWorry && page.rootWorry.trim().length > 0
                    ? 'text-zinc-900 font-medium underline underline-offset-4 hover:text-black cursor-pointer'
                    : 'text-zinc-400 cursor-not-allowed'
                }`}
              >
                {page.rootWorry && page.rootWorry.trim().length > 0 ? (
                  <>
                    <Check className="w-3 h-3 text-zinc-800" />
                    <span>follow the line</span>
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
              {...springDrag}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.85 }}
              className="w-[250px] shrink-0 px-4 py-3 text-center select-text"
            >
              <p className="text-[14px] font-serif text-zinc-900 leading-snug">
                <TypewriterText text={activeReframeItem.quote} delay={0.95} speed={0.022} />
              </p>
              <p className="text-[12.5px] font-serif italic text-zinc-600 mt-1 leading-relaxed">
                <TypewriterText text={activeReframeItem.sub} delay={1.75} speed={0.017} />
              </p>

              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleShuffleReframe}
                  className="inline-flex items-center gap-1 text-[11px] font-serif italic text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
                  title="Another gentle thought"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>another thought</span>
                </button>

                <span className="text-zinc-300">·</span>

                <button
                  type="button"
                  onClick={handleReframeContinue}
                  className="group inline-flex items-center gap-1 text-[12px] font-serif italic text-zinc-900 hover:underline underline-offset-4 cursor-pointer"
                >
                  <span>follow the line</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
                  className={`px-3 py-1 rounded-full text-[12px] font-serif italic transition-all cursor-pointer ${
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
                  className={`px-3 py-1 rounded-full text-[12px] font-serif italic transition-all cursor-pointer ${
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

              {/* Compact 3-in-a-Row Journal Note Node (What / How / When) */}
              <motion.div
                ref={stepActionTrioRef}
                {...springDrag}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="w-[475px] shrink-0 px-4 py-3 text-center select-text"
              >
                <p className="text-[14px] font-serif text-zinc-900 leading-snug">
                  <TypewriterText
                    text="“What can I gently do about this worry?”"
                    delay={0.9}
                    speed={0.022}
                  />
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5 mb-2.5">
                  <p className="text-[12px] font-serif italic text-zinc-500">
                    <TypewriterText
                      text="Write one word or tap a suggestion for your worry below."
                      delay={1.65}
                      speed={0.017}
                    />
                  </p>
                  {isLoadingTrioSuggestions && (
                    <span className="text-[10.5px] font-serif italic text-zinc-400 animate-pulse">
                      (tailoring to your worry...)
                    </span>
                  )}
                </div>

                {/* 3 Compact Journal Notes in a Horizontal Row with AI-Tailored Suggestion Words */}
                <div className="grid grid-cols-3 gap-2.5 text-left">
                  {/* WHAT? */}
                  <div className="p-2.5 bg-white/85 border border-zinc-200/80 rounded-lg flex flex-col justify-between">
                    <div>
                      <span className="block text-[11px] font-serif italic text-zinc-500 mb-0.5">
                        what?
                      </span>
                      <input
                        type="text"
                        value={page.actionTrio?.what || ''}
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
                            handleActionTrioContinue();
                          }
                        }}
                        placeholder="one small step..."
                        className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
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
                          className={`px-1.5 py-0.5 rounded text-[10px] font-serif italic transition-colors cursor-pointer ${
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
                  <div className="p-2.5 bg-white/85 border border-zinc-200/80 rounded-lg flex flex-col justify-between">
                    <div>
                      <span className="block text-[11px] font-serif italic text-zinc-500 mb-0.5">
                        how?
                      </span>
                      <input
                        type="text"
                        value={page.actionTrio?.how || ''}
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
                          if (e.key === 'Enter' && (page.actionTrio?.what?.trim() || page.actionTrio?.how?.trim())) {
                            e.preventDefault();
                            handleActionTrioContinue();
                          }
                        }}
                        placeholder="calmly, no rush..."
                        className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
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
                          className={`px-1.5 py-0.5 rounded text-[10px] font-serif italic transition-colors cursor-pointer ${
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

                  {/* WHEN? */}
                  <div className="p-2.5 bg-white/85 border border-zinc-200/80 rounded-lg flex flex-col justify-between">
                    <div>
                      <span className="block text-[11px] font-serif italic text-zinc-500 mb-0.5">
                        when?
                      </span>
                      <input
                        type="text"
                        value={page.actionTrio?.when || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdatePage((prev) => ({
                            ...prev,
                            actionTrio: {
                              what: prev.actionTrio?.what || '',
                              when: val,
                              how: prev.actionTrio?.how || '',
                            },
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (page.actionTrio?.what?.trim() || page.actionTrio?.when?.trim())) {
                            e.preventDefault();
                            handleActionTrioContinue();
                          }
                        }}
                        placeholder="today / soon..."
                        className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
                      {trioSuggestions.when.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() =>
                            onUpdatePage((prev) => ({
                              ...prev,
                              actionTrio: {
                                what: prev.actionTrio?.what || '',
                                how: prev.actionTrio?.how || '',
                                when: word,
                              },
                            }))
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-serif italic transition-colors cursor-pointer ${
                            page.actionTrio?.when?.toLowerCase() === word.toLowerCase()
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
                    page.actionTrio?.what?.trim() ||
                      page.actionTrio?.how?.trim() ||
                      page.actionTrio?.when?.trim()
                  );
                  return (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        onClick={handleActionTrioContinue}
                        disabled={!hasAnyTrioWord}
                        className={`group inline-flex items-center gap-1 text-[12px] font-serif italic transition-all ${
                          hasAnyTrioWord
                            ? 'text-zinc-900 font-medium underline underline-offset-4 hover:text-black cursor-pointer'
                            : 'text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        {hasAnyTrioWord ? (
                          <>
                            <Check className="w-3 h-3 text-zinc-900" />
                            <span>done · follow the line</span>
                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-serif italic cursor-pointer transition-all ${
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
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-serif italic cursor-pointer transition-all ${
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
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-serif italic cursor-pointer transition-all ${
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
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-serif italic cursor-pointer transition-all ${
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.85 }}
                    className="w-[375px] shrink-0 px-5 py-4 text-center select-text"
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
                        text={`Because you have given this step a safe home (${readableScheduleDisplay || 'for later'}), your mind no longer has to keep holding it in the background today.`}
                        delay={1.85}
                        speed={0.014}
                      />
                    </p>

                    {/* Gentle Date & Time Picker Card */}
                    <div className="mt-3.5 p-3.5 bg-white/90 border border-zinc-200/90 rounded-xl shadow-2xs text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-serif italic text-zinc-500">
                          choose a gentle date &amp; time for yourself:
                        </span>
                      </div>

                      {/* Quick Date Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                        {[
                          { label: 'tomorrow', date: getFutureDateIso(1), time: '10:00' },
                          { label: 'in 3 days', date: getFutureDateIso(3), time: '10:00' },
                          { label: 'this weekend', date: getUpcomingWeekendIso(), time: '11:00' },
                          { label: 'next week', date: getFutureDateIso(7), time: '10:00' },
                        ].map((preset) => {
                          const isSelected = activeScheduledDate === preset.date;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleScheduleDateTimeChange(preset.date, preset.time)}
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-serif italic transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white'
                                  : 'bg-[#faf9f6] text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Concrete Date & Time Inputs (Single Clean Icon Each) */}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#faf9f6] hover:bg-zinc-100/70 border border-zinc-200/90 text-[12px] font-serif text-zinc-800 transition-colors cursor-pointer">
                          <CalendarIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0 pointer-events-none" />
                          <input
                            type="date"
                            value={activeScheduledDate}
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
                            className="clean-date-time-input w-full bg-transparent text-[12px] font-serif text-zinc-900 focus:outline-none cursor-pointer"
                          />
                        </label>

                        <label className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#faf9f6] hover:bg-zinc-100/70 border border-zinc-200/90 text-[12px] font-serif text-zinc-800 transition-colors cursor-pointer">
                          <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0 pointer-events-none" />
                          <input
                            type="time"
                            value={activeScheduledTime}
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
                            className="clean-date-time-input w-full bg-transparent text-[12px] font-serif text-zinc-900 focus:outline-none cursor-pointer"
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
                            {/* Primary Always-Working Mark in Google Calendar Button */}
                            <button
                              type="button"
                              onClick={handlePrepareCalendarEvent}
                              className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-black text-white text-[12px] font-serif italic inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>mark in Google Calendar</span>
                            </button>

                            {/* Optional 1-Click OAuth Connect or Connected Badge */}
                            {needsAuth ? (
                              <div className="w-full flex flex-col items-center gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleGoogleLogin(true)}
                                  disabled={isSigningInGoogle}
                                  className="gsi-material-button scale-90 origin-center"
                                >
                                  <div className="gsi-material-button-state"></div>
                                  <div className="gsi-material-button-content-wrapper">
                                    <div className="gsi-material-button-icon">
                                      <svg
                                        version="1.1"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 48 48"
                                        style={{ display: 'block' }}
                                      >
                                        <path
                                          fill="#EA4335"
                                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                        ></path>
                                        <path
                                          fill="#4285F4"
                                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                        ></path>
                                        <path
                                          fill="#FBBC05"
                                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                        ></path>
                                        <path
                                          fill="#34A853"
                                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                        ></path>
                                        <path fill="none" d="M0 0h48v48H0z"></path>
                                      </svg>
                                    </div>
                                    <span className="gsi-material-button-contents">
                                      {isSigningInGoogle ? 'Connecting...' : 'Sign in with Google'}
                                    </span>
                                    <span style={{ display: 'none' }}>Sign in with Google</span>
                                  </div>
                                </button>
                                <span className="text-[10px] font-serif italic text-zinc-400 text-center">
                                  optional: connect for 1-click API sync (or use instant mark above)
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-serif italic text-emerald-700">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Google Calendar 1-click API connected</span>
                              </span>
                            )}
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
          EXPLICIT USER CONFIRMATION MODAL FOR GOOGLE CALENDAR
          Supports both Safe Instant Google Calendar Link (Zero OAuth Warning)
          AND 1-Click Direct API Sync
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
              onClick={() => !isCreatingCalendarEvent && setShowCalendarConfirmModal(false)}
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
                    Review your gentle step below and choose how you would like to place it on your calendar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendarConfirmModal(false)}
                  disabled={isCreatingCalendarEvent}
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

                {calendarError && (
                  <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-[11.5px] font-serif text-amber-900 leading-relaxed">
                    {calendarError}
                  </div>
                )}

                {/* Option 1: Safe Instant Google Calendar Link (Zero OAuth Warning) */}
                <div className="p-3.5 rounded-xl bg-white border border-zinc-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-serif italic text-zinc-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Safe Instant Calendar Mark (Recommended)</span>
                    </span>
                    <span className="text-[10px] font-serif italic text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      no sign-in warning
                    </span>
                  </div>
                  <p className="text-[11px] font-serif text-zinc-500 leading-relaxed">
                    Opens Google Calendar’s official event page pre-filled with your exact date, time, and notes, and marks this step complete right away.
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

                {/* Option 2: Direct 1-Click API Sync via OAuth */}
                <div className="p-3.5 rounded-xl bg-white/70 border border-zinc-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-serif italic text-zinc-700">
                      Direct 1-Click API Sync (Developer Testing Mode)
                    </span>
                  </div>

                  {!needsAuth ? (
                    <button
                      type="button"
                      onClick={handleConfirmAddCalendarEvent}
                      disabled={isCreatingCalendarEvent}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-900 hover:bg-emerald-950 text-white text-[12px] font-serif italic transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isCreatingCalendarEvent
                          ? 'adding directly to primary calendar...'
                          : 'confirm & 1-click sync to primary calendar'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleGoogleLogin(false)}
                        disabled={isSigningInGoogle}
                        className="gsi-material-button"
                      >
                        <div className="gsi-material-button-state"></div>
                        <div className="gsi-material-button-content-wrapper">
                          <div className="gsi-material-button-icon">
                            <svg
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 48 48"
                              style={{ display: 'block' }}
                            >
                              <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                              ></path>
                              <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                              ></path>
                              <path
                                fill="#FBBC05"
                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                              ></path>
                              <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                              ></path>
                              <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                          </div>
                          <span className="gsi-material-button-contents">
                            {isSigningInGoogle ? 'Connecting...' : 'Sign in with Google'}
                          </span>
                          <span style={{ display: 'none' }}>Sign in with Google</span>
                        </div>
                      </button>
                      <p className="text-[10.5px] font-serif italic text-zinc-500 leading-relaxed">
                        Note: Because <span className="text-zinc-800 not-italic">Tanya Singh’s Apps</span> is in personal testing mode, Google shows a “Google hasn’t verified this app” screen. Click <span className="text-zinc-800 underline">Continue</span> (bottom-left) to authorize, or use the Safe Instant Calendar button above.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-200/70 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowCalendarConfirmModal(false)}
                  disabled={isCreatingCalendarEvent}
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
