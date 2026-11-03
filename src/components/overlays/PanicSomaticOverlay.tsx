import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

interface PanicSomaticOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type BreathPhase = 'inhale gently' | 'hold softly' | 'release slowly';

const PHASE_COPY: Record<
  BreathPhase,
  {
    instruction: string;
    subtext: string;
  }
> = {
  'inhale gently': {
    instruction: 'Watch the coil wind outward as you draw in a slow, quiet breath.',
    subtext: 'Let your ribs expand naturally without forcing the air.',
  },
  'hold softly': {
    instruction: 'Rest inside the open loops. Let your shoulders stay dropped.',
    subtext: 'Nothing needs to be figured out in this pause.',
  },
  'release slowly': {
    instruction: 'Follow the ink as it unwinds and carries the tension away.',
    subtext: 'Let the breath fall out at its own unhurried pace.',
  },
};

interface CoilGeometry {
  guidePath: string;
  activePath: string;
  tipX: number;
  tipY: number;
  centerX: number;
  centerY: number;
}

/**
 * Generates an organic hand-drawn Archimedean spiral coil with subtle
 * calligraphic wave harmonics, plus the active wound segment up to `progress`.
 */
function buildCoilGeometry(
  progress: number,
  expansion: number,
  timeSec: number
): CoilGeometry {
  const cx = 110;
  const cy = 110;
  const totalPoints = 200;
  const turns = 2.35;
  const minR = 14;
  const maxR = 82 * expansion;
  const baseRotation = timeSec * 0.04;

  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= totalPoints; i++) {
    const u = i / totalPoints; // 0 -> 1
    const theta = u * turns * Math.PI * 2 + baseRotation;

    // Slow, barely-there organic hand-drawn wave along the spiral rings
    const harmonic =
      Math.sin(theta * 2 - timeSec * 0.3) * 1.6 * Math.sin(u * Math.PI) +
      Math.cos(theta * 3 + timeSec * 0.2) * 0.7 * u;

    const r = minR + (maxR - minR) * Math.pow(u, 0.92) + harmonic;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    points.push({ x, y });
  }

  const toSvgPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
    return d;
  };

  const activeCount = Math.max(
    2,
    Math.min(points.length, Math.round(progress * totalPoints) + 1)
  );
  const activePts = points.slice(0, activeCount);
  const tip = activePts[activePts.length - 1] || { x: cx, y: cy };

  return {
    guidePath: toSvgPath(points),
    activePath: toSvgPath(activePts),
    tipX: tip.x,
    tipY: tip.y,
    centerX: points[0].x,
    centerY: points[0].y,
  };
}

export const PanicSomaticOverlay: React.FC<PanicSomaticOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale gently');
  const [counter, setCounter] = useState(6);
  const [coil, setCoil] = useState<CoilGeometry>(() =>
    buildCoilGeometry(0.28, 0.88, 0)
  );

  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTimeRef.current = null;
      setBreathPhase('inhale gently');
      setCounter(6);
      return;
    }

    const inhaleDuration = 6.0; // 6s slow inhale
    const holdDuration = 4.0;   // 4s gentle hold
    const releaseDuration = 6.0; // 6s slow exhale
    const cycleDuration = inhaleDuration + holdDuration + releaseDuration; // 16s total cycle

    const animate = (now: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }
      const elapsedSec = (now - startTimeRef.current) / 1000;
      const cyclePos = elapsedSec % cycleDuration;

      let nextPhase: BreathPhase = 'inhale gently';
      let progress = 0.28;
      let expansion = 0.88;
      let nextCounter = 6;

      if (cyclePos < inhaleDuration) {
        // Inhale gently (6s): coil winds slowly outward and expands
        const phaseElapsed = cyclePos;
        const t = phaseElapsed / inhaleDuration;
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
        nextPhase = 'inhale gently';
        progress = 0.28 + 0.72 * ease;
        expansion = 0.88 + 0.12 * ease;
        nextCounter = Math.max(1, Math.min(6, Math.ceil(inhaleDuration - phaseElapsed)));
      } else if (cyclePos < inhaleDuration + holdDuration) {
        // Hold softly (4s): full coil stays open and floats quietly
        const phaseElapsed = cyclePos - inhaleDuration;
        const t = phaseElapsed / holdDuration;
        nextPhase = 'hold softly';
        progress = 1.0;
        expansion = 1.0 + 0.02 * Math.sin(t * Math.PI);
        nextCounter = Math.max(1, Math.min(4, Math.ceil(holdDuration - phaseElapsed)));
      } else {
        // Release slowly (6s): coil unwinds slowly inward
        const phaseElapsed = cyclePos - inhaleDuration - holdDuration;
        const t = phaseElapsed / releaseDuration;
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
        nextPhase = 'release slowly';
        progress = 1.0 - 0.72 * ease;
        expansion = 1.0 - 0.12 * ease;
        nextCounter = Math.max(1, Math.min(6, Math.ceil(releaseDuration - phaseElapsed)));
      }

      setBreathPhase((prev) => (prev !== nextPhase ? nextPhase : prev));
      setCounter((prev) => (prev !== nextCounter ? nextCounter : prev));
      setCoil(buildCoilGeometry(progress, expansion, elapsedSec));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen]);

  const activeCopy = PHASE_COPY[breathPhase];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-serif select-none"
        >
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="bg-[#faf9f6] border border-zinc-200/90 rounded-2xl max-w-md w-full px-8 py-8 shadow-xl relative z-10 text-center overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-1 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="text-xs font-serif italic text-zinc-400 mb-1">
              a quiet pause
            </p>
            <h2 className="text-base font-serif text-zinc-900 mb-3">
              “Let your shoulders drop for a moment.”
            </h2>

            {/* Living Winding & Unwinding Ink Coil */}
            <div className="my-2 flex flex-col items-center justify-center">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg
                  width="220"
                  height="220"
                  viewBox="0 0 220 220"
                  fill="none"
                  className="overflow-visible"
                >
                  {/* Faint complete coil whisper guide */}
                  <path
                    d={coil.guidePath}
                    stroke="#e4e4e7"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Active winding/unwinding dark ink coil */}
                  <path
                    d={coil.activePath}
                    stroke="#18181b"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Quiet anchor dot at the inner core of the coil */}
                  <circle
                    cx={coil.centerX}
                    cy={coil.centerY}
                    r="2"
                    fill="#71717a"
                  />

                  {/* Soft breathing halo around the active ink nib tip */}
                  <circle
                    cx={coil.tipX}
                    cy={coil.tipY}
                    r="7"
                    stroke="#18181b"
                    strokeOpacity="0.16"
                    strokeWidth="1"
                  />

                  {/* Active ink nib dot gliding along the coil */}
                  <circle
                    cx={coil.tipX}
                    cy={coil.tipY}
                    r="3.2"
                    fill="#18181b"
                  />
                </svg>
              </div>

              {/* Crisp, Un-distorted Phase & Countdown Indicator */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-base font-serif italic text-zinc-900">
                  {breathPhase}
                </span>
                <span className="text-zinc-300">·</span>
                <span className="text-xs font-serif text-zinc-400 tabular-nums">
                  {counter}s
                </span>
              </div>
            </div>

            {/* Properly Wrapped Comforting Guidance */}
            <div className="min-h-[3.75rem] flex flex-col items-center justify-center mt-2 mb-6 px-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={breathPhase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-xs mx-auto space-y-1"
                >
                  <p className="text-xs font-serif italic text-zinc-700 leading-relaxed">
                    {activeCopy.instruction}
                  </p>
                  <p className="text-[11px] font-serif italic text-zinc-400 leading-relaxed">
                    {activeCopy.subtext}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              onClick={onClose}
              className="group inline-flex items-center gap-1.5 text-xs font-serif italic text-zinc-800 hover:text-black underline underline-offset-4 cursor-pointer"
            >
              <span>Return to the line...</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
