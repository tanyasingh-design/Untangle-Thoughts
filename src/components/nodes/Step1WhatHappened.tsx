import React from 'react';
import { ArrowRight } from 'lucide-react';
import { FramingSession } from '../../types/metacognitive';

interface Step1Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onCompleteStep: () => void;
  isAnalyzing?: boolean;
  onTriggerAiUnpack?: () => void;
}

export const Step1WhatHappened: React.FC<Step1Props> = ({
  session,
  onUpdateSession,
  onCompleteStep,
}) => {
  const text = session.rawWorryText || '';
  const canContinue = text.trim().length >= 3;

  return (
    <div className="bg-white border border-zinc-300 rounded-2xl p-7 shadow-sm transition-all w-[420px] md:w-[460px] text-zinc-900 select-text">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px]">
          1
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Step 1 of 4
        </span>
      </div>

      {/* Main Question */}
      <h2 className="text-lg font-bold tracking-tight text-zinc-950 mb-1">
        What is on your mind?
      </h2>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        Write down whatever thought, problem, or worry is bothering you.
      </p>

      {/* Spacious Input Box */}
      <div className="mb-5">
        <textarea
          value={text}
          onChange={(e) => {
            const val = e.target.value;
            onUpdateSession({ 
              rawWorryText: val,
              title: val.trim() ? val.slice(0, 28) + (val.length > 28 ? '...' : '') : 'New Session'
            });
          }}
          placeholder="e.g. I am worried I won't finish the presentation in time and everyone will judge me..."
          rows={4}
          className="w-full p-3.5 text-sm leading-relaxed bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:bg-white transition-all resize-none placeholder:text-zinc-400 break-words"
          autoFocus
        />
      </div>

      {/* Continue Action */}
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onCompleteStep}
          disabled={!canContinue}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
        >
          <span>Continue</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
