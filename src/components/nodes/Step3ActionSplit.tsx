import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Check } from 'lucide-react';
import { FramingSession, SituationalElement } from '../../types/metacognitive';

interface Step3Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onCompleteStep: () => void;
  onGoBack: () => void;
}

export const Step3ActionSplit: React.FC<Step3Props> = ({
  session,
  onUpdateSession,
  onCompleteStep,
  onGoBack,
}) => {
  // Existing element or initialize
  const existingElement = session.situationalElements?.[0];
  const [mode, setMode] = useState<'action' | 'letgo'>(
    existingElement?.category === 'UNCONTROLLABLE' ? 'letgo' : 'action'
  );

  const [actionText, setActionText] = useState(
    existingElement?.thenActionCommitment || existingElement?.description || ''
  );
  const [whenText, setWhenText] = useState(existingElement?.ifTriggerCondition || '');

  const handleModeChange = (newMode: 'action' | 'letgo') => {
    setMode(newMode);
    saveUpdates(newMode, actionText, whenText);
  };

  const saveUpdates = (currentMode: 'action' | 'letgo', act: string, when: string) => {
    const updatedElement: SituationalElement = {
      id: existingElement?.id || `elem-${Date.now()}`,
      description: currentMode === 'action' 
        ? (act.trim() || 'Take my next step') 
        : 'Outcomes and external events out of my direct control',
      sliderValue: currentMode === 'action' ? 0.9 : 0.1,
      category: currentMode === 'action' ? 'CONTROLLABLE' : 'UNCONTROLLABLE',
      thenActionCommitment: currentMode === 'action' ? act : undefined,
      ifTriggerCondition: currentMode === 'action' ? when : undefined,
      uncontrollableEmotion: currentMode === 'letgo' ? 'uncertainty' : undefined,
      valuedActivity: currentMode === 'letgo' ? 'focusing on what is right in front of me' : undefined,
    };
    onUpdateSession({ situationalElements: [updatedElement] });
  };

  const handleActionChange = (val: string) => {
    setActionText(val);
    saveUpdates(mode, val, whenText);
  };

  const handleWhenChange = (val: string) => {
    setWhenText(val);
    saveUpdates(mode, actionText, val);
  };

  const canContinue = mode === 'letgo' || actionText.trim().length > 0;

  return (
    <div className="bg-white border border-zinc-300 rounded-2xl p-7 shadow-sm transition-all w-[420px] md:w-[460px] text-zinc-900 select-text">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[11px]">
          3
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Step 3 of 4
        </span>
      </div>

      {/* Main Question */}
      <h2 className="text-lg font-bold tracking-tight text-zinc-950 mb-1">
        What can you do about it?
      </h2>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        Choose whether this is something you can take a step on today, or if it is out of your hands.
      </p>

      {/* Two Clean Segment Buttons */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl mb-5">
        <button
          type="button"
          onClick={() => handleModeChange('action')}
          className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'action'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          I can take an action
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('letgo')}
          className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'letgo'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          It's out of my hands
        </button>
      </div>

      {/* Option A: Taking Action */}
      {mode === 'action' ? (
        <div className="space-y-3.5 mb-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
              What is one small step you can do?
            </label>
            <input
              type="text"
              value={actionText}
              onChange={(e) => handleActionChange(e.target.value)}
              placeholder="e.g. Write the first draft of the report..."
              className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:bg-white transition-all text-zinc-900 placeholder:text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
              When will you do it? <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={whenText}
              onChange={(e) => handleWhenChange(e.target.value)}
              placeholder="e.g. At 2:00 PM today, or after lunch"
              className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 focus:bg-white transition-all text-zinc-900 placeholder:text-zinc-400"
            />
          </div>
        </div>
      ) : (
        /* Option B: Out of my hands */
        <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 mb-6 text-xs text-zinc-600 leading-relaxed space-y-2">
          <p className="font-semibold text-zinc-900">
            Give yourself permission to let it go.
          </p>
          <p>
            You cannot control what other people think, say, or what the future brings. You only have control over your own actions today.
          </p>
        </div>
      )}

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
          <span>See Action Plan</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
