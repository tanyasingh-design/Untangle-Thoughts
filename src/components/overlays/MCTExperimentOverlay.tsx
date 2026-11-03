import React, { useState, useEffect } from 'react';
import { Sparkles, Timer, CheckCircle2, ArrowRight, RotateCcw, X } from 'lucide-react';

interface MCTExperimentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MCTExperimentOverlay: React.FC<MCTExperimentOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [targetObject, setTargetObject] = useState<'A bright pink elephant' | 'A shiny red sports car' | 'A green apple'>('A shiny red sports car');
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [experimentSuccess, setExperimentSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      setStep(3);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const handleStartTimer = () => {
    setTimerSeconds(30);
    setTimerActive(true);
    setStep(2);
  };

  const handleReset = () => {
    setStep(1);
    setTimerSeconds(30);
    setTimerActive(false);
    setExperimentSuccess(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-[var(--text-primary)]">
      <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-strong)] rounded-xl max-w-lg w-full p-6 blackout-card shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Close Experiment"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border-subtle)]">
          <Sparkles size={18} />
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500 block">
              QUICK EXPERIMENT
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              30-Second Thought Control Test
            </h2>
          </div>
        </div>

        {/* Step 1: Baseline Target */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              When worry feels overwhelming, our brain convinces us: <em className="text-[var(--text-primary)] font-semibold">"I have no control over what pops into my head."</em>
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Let's run a quick 30-second test together to prove that you have real power over where your attention goes.
            </p>

            <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Choose a random object:
              </label>
              <div className="flex flex-col gap-2">
                {[
                  'A shiny red sports car',
                  'A bright pink elephant',
                  'A green apple',
                ].map((obj) => (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => setTargetObject(obj as any)}
                    className={`p-2.5 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                      targetObject === obj
                        ? 'bg-[var(--accent-black)] text-[var(--accent-white)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-zinc-100 rounded-xl text-xs text-[var(--text-secondary)]">
              <strong>Your Challenge:</strong> For the next 30 seconds, whenever the thought of <em>"{targetObject}"</em> pops up, simply say "not right now" and postpone thinking about it until the timer finishes.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleStartTimer}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
              >
                <Timer size={14} />
                <span>Start 30-Second Challenge</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Running Timer */}
        {step === 2 && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-28 h-28 rounded-full border-4 border-[var(--border-strong)] flex flex-col items-center justify-center bg-[var(--bg-surface)]">
              <span className="text-2xl font-mono font-extrabold text-[var(--text-primary)]">
                {timerSeconds}s
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-tertiary)] mt-0.5">
                Remaining
              </span>
            </div>

            <p className="text-xs text-center text-[var(--text-secondary)] max-w-sm leading-relaxed">
              Hold the intention: <em>"I will postpone thinking about '{targetObject}' until the bell rings."</em> If the thought appears, let it pass like traffic outside a window.
            </p>

            <button
              type="button"
              onClick={() => {
                setTimerActive(false);
                setStep(3);
              }}
              className="text-xs text-[var(--text-tertiary)] underline hover:text-[var(--text-primary)] cursor-pointer"
            >
              Skip to results
            </button>
          </div>
        )}

        {/* Step 3: Empirical Debrief */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded text-xs leading-relaxed space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] text-sm">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Empirical Clinical Finding</span>
              </div>
              <p className="text-[var(--text-secondary)]">
                Notice what just happened. Even if the thought knocked on your mind's door, you had the executive capacity to postpone actively dwelling on it for 30 seconds.
              </p>
              <p className="text-[var(--text-secondary)] font-medium">
                This proves empirically that <strong className="text-[var(--text-primary)]">you do have executive control over mental processing</strong>. Thoughts do not force you to engage them. You can decide when, where, and if to think.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Repeat Experiment</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
              >
                Return to Canvas with Disconfirmed Metabelief
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
