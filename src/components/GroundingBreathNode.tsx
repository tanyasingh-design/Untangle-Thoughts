import React, { useState, useEffect } from 'react';
import { Wind, Check, RotateCcw, ArrowRight } from 'lucide-react';
import { ComicBox } from './ComicBox';

interface GroundingBreathNodeProps {
  onContinueToClosure: () => void;
  onFocus?: () => void;
  isActive: boolean;
}

type BreathPhase = 'intro' | 'inhale' | 'hold' | 'exhale' | 'finished';

/**
 * GroundingBreathNode:
 * Hand-drawn comic somatic reset node in ice-cyan paper fill (#dcf2f8).
 * - Organic breathing pacer with hand-drawn ink circle
 * - Inked buttons and clean comic typography
 */
export const GroundingBreathNode: React.FC<GroundingBreathNodeProps> = ({
  onContinueToClosure,
  onFocus,
  isActive,
}) => {
  const [phase, setPhase] = useState<BreathPhase>('intro');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    if (phase === 'intro') {
      const startTimer = setTimeout(() => {
        setPhase('inhale');
      }, 1200);
      return () => clearTimeout(startTimer);
    }
  }, [isActive, phase]);

  useEffect(() => {
    if (phase === 'intro' || phase === 'finished') return;

    let duration = 3500;
    if (phase === 'hold') duration = 1500;
    if (phase === 'exhale') duration = 3500;

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
          setPhase('finished');
          setHasCompletedOnce(true);
        }
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [phase, currentCycle]);

  const handleRestartBreathing = () => {
    setCurrentCycle(1);
    setPhase('inhale');
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'intro':
        return 'Gently settling into your chair... breathing begins.';
      case 'inhale':
        return 'Slowly inhale through your nose... expanding chest.';
      case 'hold':
        return 'Hold softly... resting in quiet presence.';
      case 'exhale':
        return 'Exhale completely through your mouth... releasing tension.';
      case 'finished':
        return 'Your body is anchored and safe in the present.';
    }
  };

  const getPacerScale = () => {
    if (phase === 'inhale') return 1.35;
    if (phase === 'hold') return 1.35;
    if (phase === 'exhale') return 0.82;
    if (phase === 'finished') return 1.05;
    return 1.0;
  };

  return (
    <div 
      onClick={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="cursor-default select-auto w-[460px]"
    >
      <ComicBox fill="white" seed={7}>
        <div className="relative text-left select-none">
          <div className="mb-2">
            <span className="font-comic text-xl font-bold text-black uppercase block leading-snug tracking-wide">
              SYNCHRONIZE YOUR BODY & NERVOUS SYSTEM. INHALE GENTLY, PAUSE, AND RELEASE:
            </span>
          </div>

          {/* Rhythmic Comic Breathing Pacer */}
          <div className="py-3 px-4 flex flex-col items-center justify-center bg-white/60 border-2 border-black my-2">
            <div className="flex items-center justify-between w-full mb-2 font-comic text-xs uppercase tracking-wider text-black">
              <span className="flex items-center gap-1.5 font-bold">
                <Wind className="w-4 h-4 text-black animate-pulse" />
                <span>GROUNDING PACE:</span>
              </span>
              <span className="font-bold text-sm">
                {phase === 'finished' ? '3 / 3 Complete ✓' : `${currentCycle} / 3`}
              </span>
            </div>

            {/* Visual Animated Concentric SVG Ring */}
            <div className="relative w-28 h-28 my-2 flex items-center justify-center">
              <svg 
                viewBox="0 0 100 100" 
                className="w-full h-full transition-transform duration-[3500ms] ease-in-out"
                style={{
                  transform: `scale(${getPacerScale()})`,
                }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2.8"
                  strokeDasharray={phase === 'finished' ? 'none' : '4 3'}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="34"
                  fill={phase === 'finished' ? '#dcf2f8' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2.5"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {phase === 'finished' ? (
                  <Check className="w-8 h-8 text-black stroke-[3]" />
                ) : (
                  <span className="font-comic text-base font-bold uppercase tracking-widest text-black">
                    {phase === 'inhale' ? 'Inhale' : phase === 'hold' ? 'Hold' : phase === 'exhale' ? 'Exhale' : 'Ready'}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-2 text-base font-comic font-bold text-black text-center tracking-wide min-h-[24px] uppercase">
              {getPhaseText()}
            </p>

            {/* Cycle step indicators */}
            <div className="flex items-center gap-2 mt-3 mb-1">
              {[1, 2, 3].map((cycleNum) => {
                const isPassed = currentCycle > cycleNum || phase === 'finished';
                const isCurrent = currentCycle === cycleNum && phase !== 'finished';
                return (
                  <div 
                    key={cycleNum} 
                    className={`h-2.5 border-2 border-black transition-all duration-300 ${
                      isPassed 
                        ? 'w-8 bg-[#ea582c]' 
                        : isCurrent 
                        ? 'w-8 bg-black animate-pulse' 
                        : 'w-4 bg-white'
                    }`} 
                  />
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-4 pt-3 border-t-2 border-black flex items-center justify-between gap-3">
            {hasCompletedOnce || phase === 'finished' ? (
              <>
                <button
                  type="button"
                  onClick={handleRestartBreathing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-comic font-bold tracking-wider text-black border-2 border-black bg-white hover:bg-stone-100 transition-all cursor-pointer active:scale-95"
                  title="Take another cycle of 3 grounding breaths"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="uppercase">Breathe Again</span>
                </button>

                <button
                  type="button"
                  onClick={onContinueToClosure}
                  className="px-5 py-2.5 bg-black text-white text-sm font-comic font-bold tracking-wider hover:bg-[#1f1f1f] transition-all cursor-pointer flex items-center gap-2 active:scale-95 border-2 border-black"
                >
                  <span className="uppercase">Continue to Closure Seal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs text-black/60 font-comic uppercase">
                  Deep breathing in progress...
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('finished');
                    setHasCompletedOnce(true);
                    onContinueToClosure();
                  }}
                  className="text-xs text-black font-comic font-bold underline hover:text-[#ea582c] cursor-pointer uppercase"
                >
                  Skip ahead to Closure Seal →
                </button>
              </div>
            )}
          </div>
        </div>
      </ComicBox>
    </div>
  );
};
