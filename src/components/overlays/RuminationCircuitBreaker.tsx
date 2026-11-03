import React, { useState, useEffect } from 'react';
import { ShieldAlert, Footprints, Coffee, Eye, X } from 'lucide-react';

interface RuminationCircuitBreakerProps {
  isOpen: boolean;
  onDismiss: () => void;
  wordCount: number;
  sessionMinutes: number;
}

export const RuminationCircuitBreaker: React.FC<RuminationCircuitBreakerProps> = ({
  isOpen,
  onDismiss,
  wordCount,
  sessionMinutes,
}) => {
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(300); // 5 minutes recommended cooling off

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-[var(--text-primary)]">
      <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-strong)] rounded-xl max-w-lg w-full p-6 blackout-card shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <div className="p-2 rounded bg-amber-100 text-amber-800">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-700 block">
              CLINICAL CIRCUIT-BREAKER · PROTOCOL 4.2
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Rumination Loop Detected
            </h2>
          </div>
        </div>

        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed mb-5">
          <p>
            You have spent <strong className="text-[var(--text-primary)]">{sessionMinutes} minutes</strong> journaling and entered over <strong className="text-[var(--text-primary)]">{wordCount} words</strong>.
          </p>
          <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded text-xs leading-relaxed text-[var(--text-primary)]">
            <strong>Clinical Safety Rule (Davey &amp; Meeten's AMA Worry Trap):</strong>
            <p className="mt-1 text-[var(--text-secondary)]">
              Extended analysis often becomes a perseverative "As-Many-As-Can" safety ritual disguised as problem-solving. True metacognitive mastery requires stepping away from the screen rather than perpetually analyzing.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <span className="font-semibold text-[var(--text-primary)] block">
              Mandatory Physical Disengagement Steps:
            </span>
            <div className="flex items-center gap-2">
              <Footprints size={14} className="text-zinc-600 shrink-0" />
              <span>Step away from your desk and walk for 5 minutes.</span>
            </div>
            <div className="flex items-center gap-2">
              <Coffee size={14} className="text-zinc-600 shrink-0" />
              <span>Drink a glass of water slowly, noting the cool sensation.</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-zinc-600 shrink-0" />
              <span>Look at an object 20 feet away to relax ocular tension.</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
          <div className="text-[11px] font-mono text-[var(--text-tertiary)]">
            Recommended pause: <strong className="text-[var(--text-primary)]">{formatTimer(cooldownRemaining)}</strong>
          </div>

          <button
            onClick={onDismiss}
            className="px-4 py-2 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
          >
            I have physically disengaged · Unlock
          </button>
        </div>
      </div>
    </div>
  );
};
