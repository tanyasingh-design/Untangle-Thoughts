import React, { useState, useEffect, useRef } from 'react';
import { Wind, Check, ArrowRight } from 'lucide-react';
import { ComicBox } from './ComicBox';

interface MindfulReleaseNodeProps {
  onComplete: () => void;
  onOpenPlan: () => void;
  isActive: boolean;
}

type BreathPhase = 'intro' | 'inhale' | 'hold' | 'exhale' | 'finished';

/**
 * MindfulReleaseNode:
 * 1. Shows empathetic acceptance text first
 * 2. Deep breath auto-working (no manual button clicks needed!)
 * 3. Smooth animated SVG breathing pacer circle (3 cycles)
 * 4. Animated "LET THE WORRY GO" text reveal
 * 5. Auto-transitions to the terminal closure node
 */
export const MindfulReleaseNode: React.FC<MindfulReleaseNodeProps> = ({
  onComplete,
  onOpenPlan,
  isActive,
}) => {
  const [phase, setPhase] = useState<BreathPhase>('intro');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [progressSec, setProgressSec] = useState(0);
  const [isLetGoRevealed, setIsLetGoRevealed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-start breathing sequence once active
  useEffect(() => {
    if (!isActive) return;

    // Phase 1: Show text for 1.6s, then start breathing automatically
    const startTimer = setTimeout(() => {
      setPhase('inhale');
    }, 1600);

    return () => clearTimeout(startTimer);
  }, [isActive]);

  // Handle automatic breathing cycle: Inhale (3.2s) -> Hold (1.2s) -> Exhale (3.2s) -> next cycle
  useEffect(() => {
    if (phase === 'intro' || phase === 'finished') return;

    let duration = 3200;
    if (phase === 'hold') duration = 1200;
    if (phase === 'exhale') duration = 3200;

    const timer = setTimeout(() => {
      if (phase === 'inhale') {
        setPhase('hold');
      } else if (phase === 'hold') {
        setPhase('exhale');
      } else if (phase === 'exhale') {
        if (currentCycle < 3) {
          setCurrentCycle((c) => c + 1);
          setPhase('inhale');
        } else {
          // All 3 breaths complete!
          setPhase('finished');
          setIsLetGoRevealed(true);
        }
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [phase, currentCycle]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // When finished, reveal "LET THE WORRY GO" and auto-transition to closure node
  useEffect(() => {
    if (isLetGoRevealed) {
      const finishTimer = setTimeout(() => {
        onCompleteRef.current();
      }, 2400);

      return () => clearTimeout(finishTimer);
    }
  }, [isLetGoRevealed]);

  // Instruction text based on phase
  const getPhaseText = () => {
    switch (phase) {
      case 'intro':
        return 'Settling your thoughts... breathing begins in a moment.';
      case 'inhale':
        return 'Inhale gently and deeply... expanding your lungs.';
      case 'hold':
        return 'Hold softly... resting in calm presence.';
      case 'exhale':
        return 'Slowly exhale and release... let the tension drift away.';
      case 'finished':
        return 'Your body is grounded. The present moment is safe.';
    }
  };

  // SVG pacer scale factor
  const getPacerScale = () => {
    if (phase === 'inhale') return 1.35;
    if (phase === 'hold') return 1.35;
    if (phase === 'exhale') return 0.85;
    if (phase === 'finished') return 1.05;
    return 1.0;
  };

  return (
    <ComicBox seed={5} className="w-[450px]">
      <div className="relative text-left select-none">
        {/* Step 1: Text shown first with gentle ink calligraphy */}
        <span className="font-lacquer text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1">
          MINDFUL ACCEPTANCE · EMOTIONAL FREEDOM
        </span>

        <p className="text-base md:text-lg font-medium font-lacquer text-stone-700 leading-relaxed mb-4">
          "I know how hard it is to sit with this feeling. But since this is outside your direct behavioral control today, overthinking will only steal joy from your present. Let's breathe together and gently set it down."
        </p>

        {/* Step 2: Auto-working Deep Breathing Pacer */}
        <div className="pt-3 border-t border-stone-200">
          <div className="flex items-center justify-between text-sm font-lacquer mb-2 font-bold">
            <span className="flex items-center gap-1.5 text-stone-500">
              <Wind className="w-4 h-4 text-black animate-pulse" />
              <span>GUIDED GROUNDING BREATH:</span>
            </span>
            <span className="font-lacquer font-bold text-base text-black">
              {phase === 'finished' ? '3 / 3 ✓' : `${currentCycle} / 3`}
            </span>
          </div>

          {/* Visual Breathing Ring Pacer */}
          <div className="my-3 py-3 flex flex-col items-center justify-center bg-stone-50/70 border border-stone-200">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Animated expanding/contracting SVG breath circle */}
              <svg 
                viewBox="0 0 100 100" 
                className="w-full h-full transition-transform duration-[3200ms] ease-in-out"
                style={{
                  transform: `scale(${getPacerScale()})`,
                }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#000000"
                  strokeWidth={phase === 'hold' ? '3' : '2'}
                  strokeDasharray={phase === 'finished' ? 'none' : '6 3'}
                  className={phase === 'inhale' || phase === 'exhale' ? 'animate-spin-slow' : ''}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="34"
                  fill={phase === 'finished' ? '#000000' : 'rgba(0,0,0,0.06)'}
                  stroke="#000000"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Center icon / status */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {phase === 'finished' ? (
                  <Check className="w-8 h-8 text-white stroke-[3] animate-bounce" />
                ) : (
                  <span className="font-lacquer text-xs font-bold uppercase tracking-wider text-black">
                    {phase === 'inhale' ? 'Inhale' : phase === 'hold' ? 'Hold' : phase === 'exhale' ? 'Exhale' : 'Ready'}
                  </span>
                )}
              </div>
            </div>

            {/* Live guidance subtitle */}
            <p className="mt-2 text-sm font-lacquer font-bold text-stone-700 text-center tracking-wide min-h-[22px]">
              {getPhaseText()}
            </p>

            {/* Cycle step indicators */}
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3].map((cycleNum) => {
                const isPassed = currentCycle > cycleNum || phase === 'finished';
                const isCurrent = currentCycle === cycleNum && phase !== 'finished';
                return (
                  <div 
                    key={cycleNum} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isPassed 
                        ? 'w-7 bg-black' 
                        : isCurrent 
                        ? 'w-7 bg-stone-400 animate-pulse' 
                        : 'w-4 bg-stone-200'
                    }`} 
                  />
                );
              })}
            </div>
          </div>

          {/* Step 3: "LET THE WORRY GO" Calligraphy Text Reveal */}
          {isLetGoRevealed ? (
            <div className="mt-3 pt-2 text-center animate-badge-pop">
              <span className="text-xs font-bold font-lacquer text-stone-400 uppercase tracking-widest block mb-0.5">
                RELEASE COMPLETED
              </span>
              <h3 className="font-lacquer text-2xl md:text-3xl font-bold tracking-wider text-black uppercase underline decoration-2 underline-offset-4 mb-2">
                LET THE WORRY GO.
              </h3>
              <p className="text-xs font-lacquer text-stone-500 mb-2">
                Transitioning to closure seal in a moment...
              </p>
              <button
                type="button"
                onClick={onComplete}
                className="inline-flex items-center gap-1.5 text-sm font-bold font-lacquer text-black hover:underline cursor-pointer"
              >
                <span>Continue to Closure Seal →</span>
              </button>
            </div>
          ) : (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setPhase('finished');
                  setIsLetGoRevealed(true);
                  setTimeout(() => onComplete(), 800);
                }}
                className="text-xs text-stone-400 hover:text-black font-lacquer underline cursor-pointer"
              >
                Skip ahead to release →
              </button>
            </div>
          )}
        </div>
      </div>
    </ComicBox>
  );
};
