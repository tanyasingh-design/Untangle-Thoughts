import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  ArrowLeft, 
  RotateCcw,
  Smile,
  ShieldCheck
} from 'lucide-react';
import { FramingSession } from '../../types/metacognitive';

interface Step4Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onGoBack: () => void;
  onRestartNewSession: () => void;
  onSetGlobalPostponement: (timeString: string | null) => void;
}

export const Step4ActionPlan: React.FC<Step4Props> = ({
  session,
  onUpdateSession,
  onGoBack,
  onRestartNewSession,
  onSetGlobalPostponement,
}) => {
  const [copied, setCopied] = useState(false);
  const [postponeTime, setPostponeTime] = useState('17:00');
  const [postponedSet, setPostponedSet] = useState(!!session.postponementTimestamp);

  const controllableItems = session.situationalElements?.filter((e) => e.category === 'CONTROLLABLE') || [];
  const uncontrollableItems = session.situationalElements?.filter((e) => e.category === 'UNCONTROLLABLE') || [];

  const handleSetPostponement = () => {
    const formatted = `Today at ${postponeTime}`;
    onUpdateSession({
      postponementTimestamp: formatted,
      isCompleted: true,
    });
    onSetGlobalPostponement(formatted);
    setPostponedSet(true);
  };

  const handleCopyPlan = () => {
    let text = `MY ACTION PLAN: ${session.title || 'Framing'}\n\n`;
    text += `1. SITUATION:\n${session.rawWorryText}\n\n`;
    text += `2. THINGS I CAN DO TODAY:\n`;
    if (controllableItems.length === 0) {
      text += `None right now. Ready to rest.\n`;
    } else {
      controllableItems.forEach((item, i) => {
        text += `${i + 1}. ${item.description}\n`;
        if (item.ifTriggerCondition) text += `   - When: ${item.ifTriggerCondition}\n`;
        if (item.thenActionCommitment) text += `   - Action: ${item.thenActionCommitment}\n`;
        if (item.executionStopSignalCriteria) text += `   - Stop at: ${item.executionStopSignalCriteria}\n`;
      });
    }
    text += `\n3. THINGS I AM LETTING GO OF:\n`;
    uncontrollableItems.forEach((item, i) => {
      text += `- ${item.description} (surrendered)\n`;
    });
    if (session.postponementTimestamp) {
      text += `\n4. WORRY PAUSED UNTIL: ${session.postponementTimestamp}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-strong)] rounded-2xl p-6 blackout-card shadow-lg transition-all text-[var(--text-primary)] w-[520px] md:w-[580px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[var(--accent-black)] text-white flex items-center justify-center font-bold text-xs">
            4
          </span>
          <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            Your Clear Action Plan
          </h2>
        </div>
        <button
          onClick={handleCopyPlan}
          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg border border-zinc-300 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy Plan'}</span>
        </button>
      </div>

      {/* Action Plan Card */}
      <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-50 mb-4 space-y-3.5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            What You Were Holding
          </span>
          <p className="text-xs font-medium text-zinc-900 mt-0.5">
            "{session.rawWorryText}"
          </p>
        </div>

        {/* Action list */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
            Your Concrete Steps Today:
          </span>
          {controllableItems.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No direct actions required. You can rest peacefully.</p>
          ) : (
            <div className="space-y-2">
              {controllableItems.map((item, idx) => (
                <div key={item.id} className="p-2.5 bg-white border border-zinc-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-zinc-800" />
                    <span>{item.description}</span>
                  </div>
                  <div className="text-[11px] text-zinc-600 pl-5">
                    When <strong>{item.ifTriggerCondition || 'ready'}</strong>, I will <strong>{item.thenActionCommitment || 'take this step'}</strong> until <strong>{item.executionStopSignalCriteria || 'finished'}</strong>.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Letting go */}
        {uncontrollableItems.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
              Things You Are Leaving to the Universe:
            </span>
            <ul className="text-xs text-zinc-600 space-y-1 pl-4 list-disc">
              {uncontrollableItems.map((item) => (
                <li key={item.id}>{item.description}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Friendly Worry-Later Scheduler */}
      <div className="p-4 rounded-xl border border-zinc-200 bg-white mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Clock size={16} className="text-zinc-800" />
          <h3 className="text-xs font-bold text-zinc-900">
            Want to pause this worry until later?
          </h3>
        </div>
        <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
          If your mind tries to bring this back up right away, tell it: <em>"I already have a plan, and I will only think about this at my scheduled time."</em>
        </p>

        {postponedSet ? (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-medium text-emerald-900 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
            <span>
              Worry paused until <strong>{session.postponementTimestamp}</strong>. Your mind is free to enjoy the present moment.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={postponeTime}
              onChange={(e) => setPostponeTime(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-zinc-50 font-mono"
            />
            <button
              type="button"
              onClick={handleSetPostponement}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-black)] text-white blackout-button cursor-pointer"
            >
              Set 15-Minute Worry Time
            </button>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onGoBack}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer text-[var(--text-secondary)]"
        >
          <ArrowLeft size={13} />
          <span>Back to Step 3</span>
        </button>

        <button
          type="button"
          onClick={onRestartNewSession}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
        >
          <Sparkles size={13} />
          <span>Start a Fresh Framing</span>
        </button>
      </div>
    </div>
  );
};
