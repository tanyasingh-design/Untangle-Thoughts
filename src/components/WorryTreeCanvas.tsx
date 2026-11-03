import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  RotateCcw, 
  ArrowRight,
  Check
} from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface WorryTreeCanvasProps {
  page: DiaryPage;
  onUpdatePage: (updated: DiaryPage | ((prev: DiaryPage) => DiaryPage)) => void;
  onNewPage?: () => void;
  onOpenPlan?: () => void;
  isPlanOpen?: boolean;
}

const GENTLE_CONTEXTS: Array<'General' | 'Work' | 'Health' | 'Relationships' | 'Finances' | 'Personal Growth'> = [
  'General', 'Work', 'Health', 'Relationships', 'Finances', 'Personal Growth'
];

// Intimate two-part comforting reframes before the fork
const CONTEXTUAL_REFRAMES: Record<string, Array<{ quote: string; sub: string }>> = {
  General: [
    {
      quote: "“I know this feels heavy right now.”",
      sub: "But you don't have to carry the whole future today—one gentle breath is enough."
    },
    {
      quote: "“This feeling is only a passing visitor.”",
      sub: "You have walked through uncertainty before and found your footing."
    },
    {
      quote: "“Overthinking is just my mind trying to protect me.”",
      sub: "It is safe to soften my shoulders and pause for a moment."
    }
  ],
  Work: [
    {
      quote: "“This single task does not define my worth.”",
      sub: "I am a human being, not a machine, and my best today is enough."
    },
    {
      quote: "“I don't have to solve tomorrow's work tonight.”",
      sub: "One calm, realistic step at a time will carry me through."
    }
  ],
  Health: [
    {
      quote: "“My body is doing its best to keep me safe.”",
      sub: "Ruminating on what-ifs won't heal me, but patience and rest will help."
    },
    {
      quote: "“I can meet tension with a little more kindness.”",
      sub: "Right now, in this present breath, I am okay."
    }
  ],
  Relationships: [
    {
      quote: "“I care deeply, and that is why it hurts.”",
      sub: "I can only hold my own honesty and give the rest space to breathe."
    },
    {
      quote: "“I don't have to carry the whole weight alone.”",
      sub: "Gentle patience with myself and others is enough for today."
    }
  ],
  Finances: [
    {
      quote: "“Panic won't change tomorrow's numbers.”",
      sub: "I have resilience, and I will figure this out piece by piece."
    }
  ],
  'Personal Growth': [
    {
      quote: "“I am not falling behind in my life.”",
      sub: "Life moves in waves and loops, never in a rigid straight line."
    }
  ]
};

// Elastic spring drag for small inline nodes
const springDrag = {
  drag: true,
  dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
  dragElastic: 0.25,
  whileDrag: { scale: 1.03, cursor: 'grabbing' },
  transition: { type: 'spring' as const, stiffness: 240, damping: 18 }
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
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs for smooth horizontal auto-panning
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
        (page.actionTrio?.what && page.actionTrio?.when && page.actionTrio?.how)
    );
    const actNow = page.canActNow || (page.actionTiming === 'now' ? 'yes' : page.actionTiming === 'later' ? 'no' : null);
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
        (page.actionTrio?.what && page.actionTrio?.when && page.actionTrio?.how)
    );
    const actNow = page.canActNow || (page.actionTiming === 'now' ? 'yes' : page.actionTiming === 'later' ? 'no' : null);
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

  const activeCategory =
    page.category && CONTEXTUAL_REFRAMES[page.category] ? page.category : 'General';
  const reframeList = CONTEXTUAL_REFRAMES[activeCategory] || CONTEXTUAL_REFRAMES.General;
  const activeReframeItem = reframeList[reframeIdx % reframeList.length];

  // Smooth horizontal pan to newly revealed step
  const panToNode = useCallback((targetRef: React.RefObject<HTMLDivElement | null>, delayMs = 240) => {
    setTimeout(() => {
      if (targetRef.current) {
        targetRef.current.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'center',
        });
      }
    }, delayMs);
  }, []);

  // Step 1 -> Step 2 (Reframe)
  const handleWorryContinue = () => {
    if (!page.rootWorry || page.rootWorry.trim().length === 0) return;
    if (!page.positiveReframe) {
      onUpdatePage((prev) => ({
        ...prev,
        positiveReframe: `${activeReframeItem.quote} ${activeReframeItem.sub}`,
      }));
    }
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
    onUpdatePage((prev) => ({
      ...prev,
      knowWhenAct: choice,
      letWorryGoSealed: true,
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

  const canActDecision = page.canActOnWorry || page.canAct;
  const actNowDecision = page.canActNow;
  const knowWhenDecision = page.knowWhenAct;

  return (
    <div
      ref={scrollContainerRef}
      className="w-full h-full overflow-x-auto overflow-y-auto no-scrollbar bg-[#faf9f6] text-zinc-900 select-none flex items-center"
    >
      {/* Horizontal Continuous Track */}
      <div className="min-w-max h-full min-h-[600px] px-16 py-10 flex flex-row items-center">

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
            NODE 1: THE WORRY ("I worry about _______.")
            Small inline node nestled in the break of the line
        ======================================================== */}
        <motion.div
          ref={step1Ref}
          {...springDrag}
          className="w-[260px] shrink-0 px-4 py-3 text-center select-text"
        >
          <p className="text-[14px] font-serif text-zinc-900 leading-snug">
            <TypewriterText text="“I find myself worrying about...”" delay={0.55} speed={0.024} />
          </p>
          <p className="text-[12px] font-serif italic text-zinc-500 mt-0.5 mb-3 leading-snug">
            <TypewriterText
              text="Put it gently onto paper so you don't carry it alone."
              delay={1.2}
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
            placeholder="write the thought here..."
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
              className={`group inline-flex items-center gap-1 text-[12px] font-serif italic transition-all cursor-pointer ${
                page.rootWorry && page.rootWorry.trim().length > 0
                  ? 'text-zinc-800 hover:text-black'
                  : 'text-zinc-300 cursor-not-allowed'
              }`}
            >
              <span>Then follow the line...</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
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
            4A. LOWER BRANCH ("No." — Top-Left in Butler & Hope Worry Tree)
            "This worry does not serve you. Spending time on this worry is
             stealing joy from the present. Reground yourself in now."
        ======================================================== */}
        {unlocked.noActEnd && (
          <div
            ref={stepFinalNoActRef}
            className="flex flex-row items-center self-end mb-[14px] shrink-0"
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
              className="w-[310px] shrink-0 px-5 py-3 text-center select-text"
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

              {onNewPage && (
                <motion.button
                  type="button"
                  onClick={onNewPage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 4.9 }}
                  className="mt-4 text-[11px] font-serif italic text-zinc-400 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                >
                  begin a fresh line
                </motion.button>
              )}
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
          <div className="flex flex-row items-center self-start mt-[10px] shrink-0">
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
              className="w-[430px] shrink-0 px-4 py-2 text-center select-text"
            >
              <p className="text-[14px] font-serif text-zinc-900 leading-snug">
                <TypewriterText
                  text="“What can I gently do about this worry?”"
                  delay={0.9}
                  speed={0.022}
                />
              </p>
              <p className="text-[12px] font-serif italic text-zinc-500 mt-0.5 mb-3">
                <TypewriterText
                  text="Jot down what, how, and when in three small notes."
                  delay={1.65}
                  speed={0.017}
                />
              </p>

              {/* 3 Compact Journal Notes in a Horizontal Row */}
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="p-2.5 bg-white/80 border border-zinc-200/80 rounded-lg">
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
                    placeholder="one small step..."
                    className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                  />
                </div>

                <div className="p-2.5 bg-white/80 border border-zinc-200/80 rounded-lg">
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
                    placeholder="calmly, no rush..."
                    className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                  />
                </div>

                <div className="p-2.5 bg-white/80 border border-zinc-200/80 rounded-lg">
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
                    placeholder="today / soon..."
                    className="w-full bg-transparent border-b border-zinc-800 focus:border-black text-[12px] font-serif text-zinc-900 placeholder:text-zinc-400 placeholder:italic pt-0 pb-0.5 leading-none focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleActionTrioContinue}
                  className="group inline-flex items-center gap-1 text-[12px] font-serif italic text-zinc-900 hover:underline underline-offset-4 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>done · follow the line</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
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
              <div ref={stepFinalDoNowRef} className="flex flex-row items-center self-start shrink-0">
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
                  className="w-[295px] shrink-0 px-5 py-3 text-center select-text"
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

                  {onNewPage && (
                    <motion.button
                      type="button"
                      onClick={onNewPage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 4.1 }}
                      className="mt-4 text-[11px] font-serif italic text-zinc-400 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                    >
                      begin a fresh line
                    </motion.button>
                  )}
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
                Lower Curve (No -> Bottom-Right in Butler & Hope Worry Tree!)
            ======================================================== */}
            {unlocked.knowWhenFork && (
              <div ref={stepKnowWhenForkRef} className="flex flex-row items-center self-end shrink-0">
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
                "Schedule it in your Daily / Weekly / Someday Log. -> Let the worry go."
            ======================================================== */}
            {unlocked.scheduleEnd && (
              <div ref={stepFinalScheduleRef} className="flex flex-row items-center self-start shrink-0">
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
                  className="w-[300px] shrink-0 px-5 py-3 text-center select-text"
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
                      text={`Because you have given this step a safe home (${page.actionTrio?.when || 'for later'}), your mind no longer has to keep holding it in the background today.`}
                      delay={1.95}
                      speed={0.015}
                    />
                  </p>
                  <div className="w-8 h-[1px] bg-zinc-300 mx-auto my-3" />
                  <p className="text-[13px] font-serif text-zinc-900">
                    <TypewriterText
                      text="“It is safely anchored. Let the worry go.”"
                      delay={3.5}
                      speed={0.019}
                    />
                  </p>

                  {onNewPage && (
                    <motion.button
                      type="button"
                      onClick={onNewPage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 4.5 }}
                      className="mt-4 text-[11px] font-serif italic text-zinc-400 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                    >
                      begin a fresh line
                    </motion.button>
                  )}
                </motion.div>

                <svg width="100" height="60" viewBox="0 0 100 60" fill="none">
                  <motion.path
                    d="M 0 30 C 30 34, 65 26, 95 30"
                    stroke="#18181b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ pathLength: { duration: 0.75, delay: 4.0 } }}
                  />
                </svg>
              </div>
            )}

            {/* ========================================================
                6B. ENDPOINT: "No." — Bottom-Right in Butler & Hope Worry Tree!
                "There is no use in worrying. You already know what you need to do,
                 but you currently do not have the bandwidth or opportunity."
            ======================================================== */}
            {unlocked.noBandwidthEnd && (
              <div ref={stepFinalNoBandwidthRef} className="flex flex-row items-center self-end shrink-0">
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
                  className="w-[320px] shrink-0 px-5 py-3 text-center select-text"
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

                  {onNewPage && (
                    <motion.button
                      type="button"
                      onClick={onNewPage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 4.9 }}
                      className="mt-4 text-[11px] font-serif italic text-zinc-400 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
                    >
                      begin a fresh line
                    </motion.button>
                  )}
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
  );
};
