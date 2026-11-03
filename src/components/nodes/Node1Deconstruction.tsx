import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Clock, 
  Eye, 
  Check, 
  ArrowRight, 
  Sparkles,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { FramingSession, WorryContext } from '../../types/metacognitive';
import { analyzeAbstractText, SENSORY_TAG_OPTIONS } from '../../utils/clinicalMct';

interface Node1Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onProceedToNode2: () => void;
  isAnalyzing: boolean;
  onTriggerAiUnpack: () => void;
}

export const Node1Deconstruction: React.FC<Node1Props> = ({
  session,
  onUpdateSession,
  onProceedToNode2,
  isAnalyzing,
  onTriggerAiUnpack,
}) => {
  const [showHelperTooltip, setShowHelperTooltip] = useState(false);

  // Analyze text changes locally for instantaneous UI feedback
  useEffect(() => {
    const analysis = analyzeAbstractText(session.rawWorryText);
    onUpdateSession({
      abstractnessIndex: analysis.abstractnessIndex,
      matchedAbstractTerms: analysis.matchedTerms,
      isTooAbstract: analysis.isTooAbstract,
    });
  }, [session.rawWorryText]);

  const handleContextChange = (ctx: WorryContext) => {
    onUpdateSession({ context: ctx });
  };

  const toggleSensoryTag = (tagId: string) => {
    const current = [...session.sensoryGroundingTags];
    const index = current.indexOf(tagId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(tagId);
    }
    onUpdateSession({ sensoryGroundingTags: current });
  };

  const contexts: WorryContext[] = ['Work', 'Family', 'Health', 'Finance', 'Relationships', 'General'];

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded-lg p-5 blackout-card-sm transition-all text-[var(--text-primary)]">
      {/* Node Header */}
      <div className="flex items-start justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--accent-black)] text-[var(--accent-white)]">
              NODE 01
            </span>
            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Input &amp; Concrete Deconstruction
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Strip away abstract verbal rumination and anchor your mind in verifiable physical facts.
          </p>
        </div>

        <button
          onClick={() => setShowHelperTooltip(!showHelperTooltip)}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded"
          title="Clinical rationale (Borkovec Avoidance Theory)"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelperTooltip && (
        <div className="mb-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded text-xs leading-relaxed text-[var(--text-secondary)] animate-fadeIn">
          <strong className="text-[var(--text-primary)] font-semibold block mb-1">
            Clinical Rationale (Thomas Borkovec's Avoidance Theory):
          </strong>
          Chronic worry operates as an abstract verbal-linguistic fog that covertly avoids concrete sensory representations. Forcing your mind to identify specific physical coordinates, words, and sensory anchors breaks this avoidance trap and activates natural emotional integration.
        </div>
      )}

      {/* 1. Context Selector */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
          Situational Context
        </label>
        <div className="flex flex-wrap gap-1.5">
          {contexts.map((ctx) => (
            <button
              key={ctx}
              type="button"
              onClick={() => handleContextChange(ctx)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                session.context === ctx
                  ? 'bg-[var(--accent-black)] text-[var(--accent-white)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
              }`}
            >
              {ctx}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Raw Worry Input Field */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Unfiltered Raw Worry Text
          </label>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
            {session.rawWorryText.length} / 1000 chars
          </span>
        </div>

        <div className="relative">
          <textarea
            value={session.rawWorryText}
            onChange={(e) => onUpdateSession({ rawWorryText: e.target.value.slice(0, 1000) })}
            placeholder="Type your unedited worry exactly as it echoes in your thoughts (e.g. 'Everything on this project will fail and everyone will blame me')..."
            rows={3}
            className="w-full p-3 text-xs leading-relaxed bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded focus:outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--border-strong)] transition-all resize-y"
          />
        </div>

        {/* Live Abstract Indicators & Catastrophic Warning */}
        {session.matchedAbstractTerms.length > 0 && (
          <div className="mt-2 p-2.5 bg-[#fef9c3] border border-[#facc15] rounded flex items-start gap-2 text-xs text-[#713f12]">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-[#ca8a04]" />
            <div className="flex-1">
              <span className="font-semibold block">Abstract / Catastrophic Indicators Detected:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {session.matchedAbstractTerms.map((term, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-[#fef08a] border border-[#eab308] font-mono font-medium rounded text-[11px]"
                  >
                    "{term}"
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] leading-tight text-[#854d0e]">
                Abstract language triggers perseverative worry loops. Unpack into concrete facts below.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Mandatory Concrete Grounding Fields (PRD Section 1.2a & 2.1) */}
      <div className="space-y-3 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <ShieldCheck size={14} />
          <span>Concrete Situational Unpacking Fields</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Who specifically was there?
            </label>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs">
              <User size={13} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={session.whoWasThere || ''}
                onChange={(e) => onUpdateSession({ whoWasThere: e.target.value })}
                placeholder="Names or specific roles..."
                className="w-full bg-transparent focus:outline-none text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Where are you physically positioned?
            </label>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs">
              <MapPin size={13} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={session.locationDetails || ''}
                onChange={(e) => onUpdateSession({ locationDetails: e.target.value })}
                placeholder="e.g., Office desk, wooden chair..."
                className="w-full bg-transparent focus:outline-none text-xs"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
            Exact words said or verifiable historical fact (no adjectives)
          </label>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs">
            <Clock size={13} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              type="text"
              value={session.exactWordsSaid || ''}
              onChange={(e) => onUpdateSession({ exactWordsSaid: e.target.value })}
              placeholder="What specifically was stated or occurred?"
              className="w-full bg-transparent focus:outline-none text-xs"
            />
          </div>
        </div>

        {/* Sensory Grounding Tags */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
            Sensory Grounding Anchors (Check present physical sensations)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SENSORY_TAG_OPTIONS.map((tag) => {
              const selected = session.sensoryGroundingTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleSensoryTag(tag.id)}
                  className={`px-2 py-1 text-[11px] rounded transition-colors flex items-center gap-1 cursor-pointer ${
                    selected
                      ? 'bg-[var(--accent-black)] text-[var(--accent-white)]'
                      : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {selected && <Check size={11} strokeWidth={3} />}
                  <span>{tag.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Output Summary Card */}
      {session.concreteFactSummary && (
        <div className="mb-4 p-3 bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded text-xs">
          <div className="flex items-center justify-between text-[var(--text-tertiary)] mb-1 text-[11px] font-mono">
            <span>CONCRETE_FACT_SUMMARY</span>
            <span>STRIPPED OF ADJECTIVES</span>
          </div>
          <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">
            {session.concreteFactSummary}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onTriggerAiUnpack}
          disabled={isAnalyzing || session.rawWorryText.trim().length < 5}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-medium)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Sparkles size={13} />
          <span>{isAnalyzing ? 'Analyzing Situational Facts...' : 'AI Concrete Deconstruction'}</span>
        </button>

        <button
          type="button"
          onClick={onProceedToNode2}
          disabled={session.rawWorryText.trim().length < 5}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button disabled:opacity-50 cursor-pointer"
        >
          <span>Proceed to Node 2: Defusion</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
