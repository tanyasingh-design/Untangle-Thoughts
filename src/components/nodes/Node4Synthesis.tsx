import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Copy, 
  Download, 
  RotateCcw, 
  Sparkles, 
  Calendar, 
  Check, 
  ArrowLeft,
  FileCheck2,
  Lock
} from 'lucide-react';
import { FramingSession } from '../../types/metacognitive';
import { VALUES_TAXONOMY } from '../../utils/clinicalMct';

interface Node4Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onBackToNode3: () => void;
  onRestartNewSession: () => void;
  onSetGlobalPostponement: (timeString: string | null) => void;
}

export const Node4Synthesis: React.FC<Node4Props> = ({
  session,
  onUpdateSession,
  onBackToNode3,
  onRestartNewSession,
  onSetGlobalPostponement,
}) => {
  const [copied, setCopied] = useState(false);
  const [worryTimeInput, setWorryTimeInput] = useState<string>('17:00');

  const uncontrollableItems = session.situationalElements?.filter((e) => e.sliderValue < 0.5) || [];
  const controllableItems = session.situationalElements?.filter((e) => e.sliderValue >= 0.5) || [];

  const handlePostponementChoice = (isRestarting: boolean) => {
    onUpdateSession({ isRestartingWorry: isRestarting });
    if (isRestarting) {
      const now = new Date();
      // default 2 hours ahead
      now.setHours(now.getHours() + 2);
      const defaultTime = now.toTimeString().slice(0, 5);
      setWorryTimeInput(defaultTime);
    } else {
      onUpdateSession({ isCompleted: true });
    }
  };

  const handleConfirmPostponement = () => {
    const timeFormatted = `Today at ${worryTimeInput} (15-min window)`;
    onUpdateSession({
      postponementTimestamp: timeFormatted,
      isCompleted: true,
    });
    onSetGlobalPostponement(timeFormatted);
  };

  const generateMarkdownBlueprint = () => {
    let md = `# ACTION & ACCEPTANCE BLUEPRINT: ${session.title}\n`;
    md += `*Generated: ${new Date().toLocaleDateString()} | Context: ${session.context}*\n\n`;
    md += `## 1. Concrete Situation\n`;
    md += `${session.concreteFactSummary || session.rawWorryText}\n\n`;
    md += `## 2. Metacognitive Defusion\n`;
    md += `Core Thought: "${session.parsedThoughtString || session.rawWorryText}"\n`;
    md += `Defused Stance: "I notice my mind generating this thought as a transient mental event."\n\n`;
    
    md += `## 3. Branch 3A: Acceptance & Willingness (Uncontrollable Elements)\n`;
    if (uncontrollableItems.length === 0) {
      md += `*None identified*\n\n`;
    } else {
      uncontrollableItems.forEach((item, idx) => {
        md += `### 3A.${idx + 1} ${item.description}\n`;
        md += `- **Willingness**: "I am willing to make room for the feeling of ${item.uncontrollableEmotion || 'uncertainty'} while directing my focus to ${item.valuedActivity || 'present tasks'}."\n\n`;
      });
    }

    md += `## 4. Branch 3B: Values-Based Implementation Intentions (Controllable Elements)\n`;
    if (controllableItems.length === 0) {
      md += `*None identified*\n\n`;
    } else {
      controllableItems.forEach((item, idx) => {
        const valObj = VALUES_TAXONOMY.find((v) => v.id === item.selectedValueId);
        md += `### 3B.${idx + 1} ${item.description}\n`;
        md += `- **Value**: ${valObj?.label || 'General'}\n`;
        md += `- **Trigger (IF)**: ${item.ifTriggerCondition || 'When I begin work'}\n`;
        md += `- **Action (THEN)**: ${item.thenActionCommitment || 'I will execute the planned task'}\n`;
        md += `- **Stop Signal (UNTIL)**: ${item.executionStopSignalCriteria || 'When the task milestone is reached'}\n\n`;
      });
    }

    if (session.postponementTimestamp) {
      md += `## 5. Metacognitive Worry Postponement\n`;
      md += `Active Worry Window scheduled for: ${session.postponementTimestamp}\n`;
    }

    return md;
  };

  const handleCopy = () => {
    const md = generateMarkdownBlueprint();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded-lg p-5 blackout-card-sm transition-all text-[var(--text-primary)]">
      {/* Node Header */}
      <div className="flex items-start justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--accent-black)] text-[var(--accent-white)]">
              NODE 04
            </span>
            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Synthesis &amp; Postponement Protocol
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Aggregated Action-Acceptance Blueprint. Terminate ruminative perseveration and return to valued living.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            title="Copy blueprint as Markdown"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy MD'}</span>
          </button>
        </div>
      </div>

      {/* 4.1 Unified Session Artifact: Action_Acceptance_Blueprint */}
      <div className="mb-6 border border-[var(--border-strong)] rounded-lg p-4 bg-[var(--bg-panel)] blackout-card-sm">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5">
            <FileCheck2 size={16} className="text-[var(--text-primary)]" />
            <span className="font-bold text-xs uppercase tracking-wider">
              Action &amp; Acceptance Blueprint
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
            PERSIST_STATE: READY
          </span>
        </div>

        {/* Concrete anchor summary */}
        <div className="mb-3 p-2.5 bg-[var(--bg-surface)] rounded text-xs">
          <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] block mb-0.5">
            1. Verifiable Anchor Facts:
          </span>
          <p className="font-medium text-[var(--text-primary)]">
            {session.concreteFactSummary || session.rawWorryText}
          </p>
        </div>

        {/* Defused Stance */}
        <div className="mb-3 p-2.5 bg-[var(--bg-surface)] rounded text-xs">
          <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] block mb-0.5">
            2. Defused Observer Stance:
          </span>
          <p className="italic text-[var(--text-secondary)] font-serif">
            "I notice my mind is generating the thought: '{session.rawWorryText.slice(0, 100)}...'. I am the observer holding space for this thought, not the thought itself."
          </p>
        </div>

        {/* 3A Acceptance section */}
        <div className="mb-3">
          <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] block mb-1">
            3. Branch 3A: ACT Acceptance Protocols ({uncontrollableItems.length} elements)
          </span>
          <div className="space-y-1.5">
            {uncontrollableItems.map((item, idx) => (
              <div key={item.id} className="p-2 border border-[var(--border-subtle)] rounded text-xs">
                <span className="font-medium text-[var(--text-primary)]">{item.description}</span>
                <p className="text-[11px] text-[var(--text-secondary)] italic mt-0.5">
                  "I am willing to make room for the feeling of{' '}
                  <strong className="text-[var(--text-primary)]">{item.uncontrollableEmotion || 'anxiety'}</strong>{' '}
                  while directing my focus to{' '}
                  <strong className="text-[var(--text-primary)]">{item.valuedActivity || 'present tasks'}</strong>."
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3B Implementation Intentions section */}
        <div>
          <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] block mb-1">
            4. Branch 3B: Bounded 'If-Then' Action Intentions ({controllableItems.length} elements)
          </span>
          <div className="space-y-1.5">
            {controllableItems.map((item, idx) => {
              const valObj = VALUES_TAXONOMY.find((v) => v.id === item.selectedValueId);
              return (
                <div key={item.id} className="p-2 border border-[var(--border-subtle)] rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)]">{item.description}</span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                      {valObj?.label}
                    </span>
                  </div>
                  <div className="text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-1 p-1.5 bg-[var(--bg-surface)] rounded font-mono">
                    <div>
                      <span className="text-[var(--text-tertiary)] block">IF TRIGGER:</span>
                      <span className="text-[var(--text-primary)]">{item.ifTriggerCondition || 'At planned time'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)] block">THEN ACTION:</span>
                      <span className="text-[var(--text-primary)]">{item.thenActionCommitment || 'Take specific step'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)] block">UNTIL STOP SIGNAL:</span>
                      <span className="text-[var(--text-primary)]">{item.executionStopSignalCriteria || 'Milestone achieved'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4.2 Metacognitive Worry Postponement Scheduling (PRD Section 4.2) */}
      <div className="mb-5 p-4 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Metacognitive Worry Postponement Protocol
          </h3>
        </div>
        
        <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
          Is your mind attempting to restart Type 1 (what-if scenarios) or Type 2 (worrying about worrying) right now?
        </p>

        {session.isRestartingWorry === null ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handlePostponementChoice(true)}
              className="p-2.5 rounded text-left border border-[var(--border-medium)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface-hover)] text-xs font-medium cursor-pointer"
            >
              <div className="font-bold text-[var(--text-primary)]">Yes, mind is still trying to worry</div>
              <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                Activate 15-minute postponement window
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePostponementChoice(false)}
              className="p-2.5 rounded text-left border border-[var(--border-strong)] bg-[var(--accent-black)] text-[var(--accent-white)] text-xs font-medium cursor-pointer"
            >
              <div className="font-bold">No, mind is grounded and ready</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Finalize session and return to present activity
              </div>
            </button>
          </div>
        ) : session.isRestartingWorry ? (
          /* Postponement window selector */
          <div className="space-y-3 p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Schedule a 15-Minute "Worry Window":
              </span>
              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                Clinical MCT rule
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
              Do not engage in worry right now. Defer all cognitive problem-solving to a pre-scheduled, bounded 15-minute window later today. If worry intrudes before then, mentally say: <em>"I will process this at {worryTimeInput}."</em>
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Window Time:</label>
              <input
                type="time"
                value={worryTimeInput}
                onChange={(e) => setWorryTimeInput(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[var(--border-medium)] rounded bg-[var(--bg-panel)] font-mono"
              />
              <button
                type="button"
                onClick={handleConfirmPostponement}
                className="px-3.5 py-1 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
              >
                Lock Postponement Commitment
              </button>
            </div>

            {session.postponementTimestamp && (
              <div className="p-3 bg-zinc-100 border border-zinc-300 rounded flex items-center gap-2 text-xs font-medium text-zinc-900 mt-2">
                <Lock size={15} />
                <span>
                  Worry officially postponed to <strong>{session.postponementTimestamp}</strong>. Return to present activity.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
            <span>
              Session successfully completed and defused. Ready to engage in valued life activity.
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onBackToNode3}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-medium)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Back to Node 3</span>
        </button>

        <button
          type="button"
          onClick={onRestartNewSession}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button cursor-pointer"
        >
          <Sparkles size={13} />
          <span>Start New Framing Session</span>
        </button>
      </div>
    </div>
  );
};
