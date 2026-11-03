import React from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { FramingSession } from '../../types/metacognitive';

interface Step2Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onCompleteStep: () => void;
  onGoBack: () => void;
}

export const Step2ThoughtCheck: React.FC<Step2Props> = ({
  session,
  onUpdateSession,
  onCompleteStep,
  onGoBack,
}) => {
  const currentVerification = session.thoughtNatureVerification;
  const userThought = session.rawWorryText || 'Something might go wrong';

  const handleSelect = (choice: 'transient_event' | 'literal_fact') => {
    onUpdateSession({
      thoughtNatureVerification: choice,
      parsedThoughtString: userThought,
    });
  };

  const canContinue = currentVerification === 'transient_event' || currentVerification === 'literal_fact';

  return (
    <div className="bg-white border border-zinc-300 rounded-2xl p-7 shadow-sm transition-all w-[420px] md:w-[460px] text-zinc-900 select-text">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px]">
          2
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Step 2 of 4
        </span>
      </div>

      {/* Main Question */}
      <h2 className="text-lg font-bold tracking-tight text-zinc-950 mb-1">
        Check your thought
      </h2>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        Let's look at what your mind is telling you right now:
      </p>

      {/* Thought Preview Box with text wrapping */}
      <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 mb-5 break-words">
        <p className="text-xs font-medium text-zinc-800 italic leading-relaxed whitespace-pre-wrap">
          "{userThought}"
        </p>
      </div>

      {/* Two Clean, Direct Choices */}
      <div className="space-y-2.5 mb-6">
        <button
          type="button"
          onClick={() => handleSelect('transient_event')}
          className={`w-full p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
            currentVerification === 'transient_event'
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
              : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800'
          }`}
        >
          <div>
            <div className="text-xs font-bold">
              It's a future worry or prediction
            </div>
            <div className={`text-[11px] mt-0.5 ${currentVerification === 'transient_event' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              My mind is anticipating what might happen later.
            </div>
          </div>
          {currentVerification === 'transient_event' && (
            <CheckCircle2 size={16} className="text-white shrink-0 ml-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSelect('literal_fact')}
          className={`w-full p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
            currentVerification === 'literal_fact'
              ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
              : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800'
          }`}
        >
          <div>
            <div className="text-xs font-bold">
              It is happening right now as a fact
            </div>
            <div className={`text-[11px] mt-0.5 ${currentVerification === 'literal_fact' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              It is a real physical event occurring in this moment.
            </div>
          </div>
          {currentVerification === 'literal_fact' && (
            <CheckCircle2 size={16} className="text-white shrink-0 ml-2" />
          )}
        </button>
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
        <button
          type="button"
          onClick={onGoBack}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>Back</span>
        </button>

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
