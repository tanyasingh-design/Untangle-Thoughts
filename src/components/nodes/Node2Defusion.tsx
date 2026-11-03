import React, { useState } from 'react';
import { 
  Eye, 
  HelpCircle, 
  CheckCircle2, 
  Compass, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert
} from 'lucide-react';
import { FramingSession, DefusionFrameType } from '../../types/metacognitive';

interface Node2Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onProceedToNode3: () => void;
  onBackToNode1: () => void;
}

export const Node2Defusion: React.FC<Node2Props> = ({
  session,
  onUpdateSession,
  onProceedToNode3,
  onBackToNode1,
}) => {
  const [showSelfAsContextModal, setShowSelfAsContextModal] = useState<boolean>(false);
  const [showHelperTooltip, setShowHelperTooltip] = useState<boolean>(false);

  // Active defusion frame
  const activeDefusion = session.defusionReframings?.find(
    (d) => d.type === session.selectedDefusionFrame
  ) || {
    type: 'THOUGHT_OBSERVATION' as DefusionFrameType,
    framedThought: `I notice my mind is generating the thought that "${session.rawWorryText || 'I might fail'}"`,
    metaphorPrompt: 'Observe this sentence as text appearing across a billboard, separate from who is reading it.'
  };

  const handleSelectFrame = (type: DefusionFrameType) => {
    onUpdateSession({ selectedDefusionFrame: type });
  };

  const handleVerificationChoice = (choice: 'literal_fact' | 'transient_event') => {
    onUpdateSession({ thoughtNatureVerification: choice });

    if (choice === 'literal_fact') {
      // PRD Section 2.2a Retry / Fusion Loop:
      // If user selects "Literal Present Fact", pause progression and trigger Self-as-Context Overlay
      setShowSelfAsContextModal(true);
    }
  };

  const handleBeliefRating = (rating: number) => {
    onUpdateSession({ metacognitiveBeliefRating: rating });
    if (rating >= 4) {
      setShowSelfAsContextModal(true);
    }
  };

  const handleResolveSelfAsContext = () => {
    setShowSelfAsContextModal(false);
    onUpdateSession({
      thoughtNatureVerification: 'transient_event',
      selfAsContextOverlayDismissed: true,
      metacognitiveBeliefRating: Math.min(session.metacognitiveBeliefRating || 3, 2),
    });
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded-lg p-5 blackout-card-sm transition-all text-[var(--text-primary)]">
      {/* Node Header */}
      <div className="flex items-start justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--accent-black)] text-[var(--accent-white)]">
              NODE 02
            </span>
            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Metacognitive Defusion Step
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Shift from "Object Mode" (fused with thoughts as absolute truth) to "Metacognitive Mode" (observing thoughts as transient mental events).
          </p>
        </div>

        <button
          onClick={() => setShowHelperTooltip(!showHelperTooltip)}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded"
          title="Clinical rationale (Cognitive Defusion & Self-as-Context)"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelperTooltip && (
        <div className="mb-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded text-xs leading-relaxed text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)] font-semibold block mb-1">
            Clinical Rationale (Adrian Wells' MCT &amp; ACT Defusion):
          </strong>
          When in Object Mode, the mind treats the thought "I am going to fail" as an imminent physical emergency. In Metacognitive Mode, you recognize that the thought is an ephemeral cognitive output produced by your brain's threat prediction network, not external reality.
        </div>
      )}

      {/* Frame Type Selector */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
          Cognitive Defusion Perspective
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectFrame('THOUGHT_OBSERVATION')}
            className={`p-2.5 text-left rounded border transition-all cursor-pointer ${
              session.selectedDefusionFrame === 'THOUGHT_OBSERVATION'
                ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            <div className="text-xs font-semibold mb-0.5">Thought Observation</div>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
              Linguistic distancing ("I notice my mind is generating...")
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectFrame('PASSENGERS_ON_BUS')}
            className={`p-2.5 text-left rounded border transition-all cursor-pointer ${
              session.selectedDefusionFrame === 'PASSENGERS_ON_BUS'
                ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            <div className="text-xs font-semibold mb-0.5">Passengers on the Bus</div>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
              You drive; anxious thoughts are noisy back-seat passengers.
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectFrame('LEAVES_ON_STREAM')}
            className={`p-2.5 text-left rounded border transition-all cursor-pointer ${
              session.selectedDefusionFrame === 'LEAVES_ON_STREAM'
                ? 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            <div className="text-xs font-semibold mb-0.5">Leaves on a Stream</div>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
              Observe thoughts floating past on leaves down the current.
            </div>
          </button>
        </div>
      </div>

      {/* Visual Cognitive Card with Defusion Border (PRD Section 2.2 Functional Acceptance Criteria) */}
      <div className="mb-4 defusion-frame-container rounded-lg p-4 border-2 border-dashed border-[var(--border-medium)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono tracking-wider uppercase text-[var(--text-tertiary)] font-bold">
            [ COGNITIVE DEFUSION CARD · OBSERVER PERSPECTIVE ]
          </span>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
            FRAME: {session.selectedDefusionFrame}
          </span>
        </div>

        <div className="my-2 p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded shadow-sm">
          <p className="text-sm font-medium text-[var(--text-primary)] italic leading-relaxed">
            "{activeDefusion.framedThought}"
          </p>
        </div>

        <p className="text-xs text-[var(--text-secondary)] mt-2 font-serif italic">
          Tip: {activeDefusion.metaphorPrompt}
        </p>
      </div>

      {/* Metacognitive Awareness Verification & Retry Loop (PRD Section 2.2 & 3.2) */}
      <div className="mb-4 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded">
        <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
          Metacognitive Verification: Is this thought a literal present fact or a transient mental event?
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleVerificationChoice('literal_fact')}
            className={`p-2.5 rounded text-left border text-xs font-medium transition-all cursor-pointer ${
              session.thoughtNatureVerification === 'literal_fact'
                ? 'bg-amber-50 border-amber-400 text-amber-900'
                : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            <div className="font-semibold text-xs">A Literal Present Fact</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              "It is an absolute, unavoidable physical reality right now."
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleVerificationChoice('transient_event')}
            className={`p-2.5 rounded text-left border text-xs font-medium transition-all cursor-pointer ${
              session.thoughtNatureVerification === 'transient_event'
                ? 'bg-[var(--accent-black)] text-[var(--accent-white)] border-[var(--border-strong)]'
                : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            <div className="font-semibold text-xs flex items-center justify-between">
              <span>A Transient Mental Event</span>
              {session.thoughtNatureVerification === 'transient_event' && (
                <CheckCircle2 size={13} className="text-white" />
              )}
            </div>
            <div className="text-[11px] opacity-80 mt-0.5">
              "It is a temporary neural firing produced by my mind's worry alarm."
            </div>
          </button>
        </div>
      </div>

      {/* Metacognitive Belief Rating (1-5 Scale) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Belief in Thought Literalness (Cognitive Fusion Level)
          </label>
          <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
            Score: {session.metacognitiveBeliefRating || 2} / 5
          </span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => handleBeliefRating(score)}
              className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded border transition-colors cursor-pointer ${
                (session.metacognitiveBeliefRating || 2) === score
                  ? 'bg-[var(--accent-black)] text-[var(--accent-white)] border-[var(--border-strong)]'
                  : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
          <span>1: Completely defused (just a thought)</span>
          <span>5: Totally fused (feels 100% literal fact)</span>
        </div>
      </div>

      {/* Self-as-Context Modal Overlay (PRD Section 2.2a) */}
      {showSelfAsContextModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-strong)] rounded-lg p-6 max-w-lg w-full blackout-card animate-fadeIn">
            <div className="flex items-center gap-2 text-[var(--text-primary)] mb-3">
              <Compass size={20} className="shrink-0" />
              <h3 className="text-base font-bold tracking-tight">
                Self-as-Context Metacognitive Realignment
              </h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
              You selected that this thought is a literal present fact (or indicated high cognitive fusion). In Metacognitive Therapy, we step back into the <strong className="text-[var(--text-primary)]">Observing Self</strong>:
            </p>

            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded mb-4 text-xs font-medium text-[var(--text-primary)] leading-relaxed italic">
              "Notice who is observing this thought right now. If you can observe the thought from the outside, can you be the thought itself, or are you the silent context in which it appears and fades?"
            </div>

            <p className="text-[11px] text-[var(--text-tertiary)] mb-5">
              The sky is not harmed by dark clouds passing through it. You are the continuous conscious arena; the worry is just weather passing across the landscape.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleResolveSelfAsContext}
                className="px-4 py-2 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
              >
                I am the Observer — Recognize as Transient Mental Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onBackToNode1}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-medium)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Back to Node 1</span>
        </button>

        <button
          type="button"
          onClick={onProceedToNode3}
          disabled={session.thoughtNatureVerification !== 'transient_event'}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button disabled:opacity-40 cursor-pointer"
        >
          <span>Proceed to Node 3: Spectrum Analysis</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
