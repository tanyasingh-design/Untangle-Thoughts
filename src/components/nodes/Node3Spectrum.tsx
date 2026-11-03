import React, { useState } from 'react';
import { 
  Sliders, 
  HelpCircle, 
  Split, 
  Plus, 
  Trash2, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  AlertCircle,
  Shield,
  Heart,
  Briefcase,
  Activity,
  Award
} from 'lucide-react';
import { 
  FramingSession, 
  SituationalElement, 
  ValueCategory 
} from '../../types/metacognitive';
import { VALUES_TAXONOMY, validateStopSignal } from '../../utils/clinicalMct';

interface Node3Props {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onProceedToNode4: () => void;
  onBackToNode2: () => void;
}

export const Node3Spectrum: React.FC<Node3Props> = ({
  session,
  onUpdateSession,
  onProceedToNode4,
  onBackToNode2,
}) => {
  const [showHelperTooltip, setShowHelperTooltip] = useState(false);
  const [newElementText, setNewElementText] = useState('');

  const elements = session.situationalElements || [];

  const handleSliderChange = (id: string, val: number) => {
    const updated = elements.map((elem) => {
      if (elem.id === id) {
        const category = val >= 0.5 ? ('CONTROLLABLE' as const) : ('UNCONTROLLABLE' as const);
        return {
          ...elem,
          sliderValue: val,
          category,
          // Set defaults if transitioning
          selectedValueId: elem.selectedValueId || (val >= 0.5 ? 'CAREER_GROWTH' : undefined),
          uncontrollableEmotion: elem.uncontrollableEmotion || (val < 0.5 ? 'Anxious uncertainty' : undefined),
          valuedActivity: elem.valuedActivity || (val < 0.5 ? 'Present-moment engagement' : undefined),
        };
      }
      return elem;
    });
    onUpdateSession({ situationalElements: updated });
  };

  const handleUpdateElement = (id: string, updates: Partial<SituationalElement>) => {
    const updated = elements.map((elem) => {
      if (elem.id === id) {
        return { ...elem, ...updates };
      }
      return elem;
    });
    onUpdateSession({ situationalElements: updated });
  };

  const handleAddElement = () => {
    if (!newElementText.trim()) return;
    const newElem: SituationalElement = {
      id: `elem-${Date.now()}`,
      description: newElementText.trim(),
      sliderValue: 0.5,
      category: 'CONTROLLABLE',
      selectedValueId: 'CAREER_GROWTH',
      ifTriggerCondition: '',
      thenActionCommitment: '',
      executionStopSignalCriteria: '',
    };
    onUpdateSession({ situationalElements: [...elements, newElem] });
    setNewElementText('');
  };

  const handleRemoveElement = (id: string) => {
    onUpdateSession({
      situationalElements: elements.filter((e) => e.id !== id),
    });
  };

  const uncontrollableItems = elements.filter((e) => e.sliderValue < 0.5);
  const controllableItems = elements.filter((e) => e.sliderValue >= 0.5);

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-medium)] rounded-lg p-5 blackout-card-sm transition-all text-[var(--text-primary)]">
      {/* Node Header */}
      <div className="flex items-start justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--accent-black)] text-[var(--accent-white)]">
              NODE 03
            </span>
            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Decision Branch — Spectrum Analysis
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Replace binary all-or-nothing traps with a continuous agency slider. Deconstruct the situation into controllable actions vs. uncontrollable factors.
          </p>
        </div>

        <button
          onClick={() => setShowHelperTooltip(!showHelperTooltip)}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded"
          title="Clinical rationale (Multi-Spectrum Actionability & AMA Rules)"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelperTooltip && (
        <div className="mb-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded text-xs leading-relaxed text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)] font-semibold block mb-1">
            Clinical Rationale (Disrupting Perseverative AMA Worry Rules):
          </strong>
          Traditional apps force a binary "Is this in your control? Yes/No" choice, triggering endless debates. Real life is mixed. By breaking worries into discrete sub-components and adjusting a spectrum slider, uncontrollable aspects are surrendered to ACT Acceptance, while controllable actions are locked into strict 'If-Then' implementation plans with external stop signals.
        </div>
      )}

      {/* Add new situational element */}
      <div className="mb-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded">
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
          Deconstruct Situation into Specific Components
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newElementText}
            onChange={(e) => setNewElementText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddElement();
            }}
            placeholder="Add another situational component (e.g. 'How the client responds' or 'Drafting the slide deck')..."
            className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--border-strong)]"
          />
          <button
            type="button"
            onClick={handleAddElement}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Sliders for each component */}
      <div className="mb-6 space-y-3">
        {elements.map((elem) => {
          const isControllable = elem.sliderValue >= 0.5;
          return (
            <div
              key={elem.id}
              className="p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-medium)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)] flex-1">
                  {elem.description}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      isControllable
                        ? 'bg-[var(--accent-black)] text-[var(--accent-white)]'
                        : 'bg-zinc-200 text-zinc-800'
                    }`}
                  >
                    {isControllable ? 'BRANCH 3B: CONTROLLABLE' : 'BRANCH 3A: UNCONTROLLABLE'}
                  </span>
                  <button
                    onClick={() => handleRemoveElement(elem.id)}
                    className="text-[var(--text-tertiary)] hover:text-red-600 transition-colors p-0.5"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Spectrum Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-[var(--text-tertiary)] shrink-0 w-24 text-left">
                  0.0 Totally External
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={elem.sliderValue}
                  onChange={(e) => handleSliderChange(elem.id, parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[var(--accent-black)]"
                />
                <span className="text-[10px] font-medium text-[var(--text-tertiary)] shrink-0 w-24 text-right">
                  1.0 Direct Agency
                </span>
                <span className="font-mono text-xs font-semibold w-10 text-right">
                  {Math.round(elem.sliderValue * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Split-View Breakdown (PRD Section 2.3 & 3.2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Branch 3A: ACT Acceptance & Present Moment */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
            <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Branch 3A: Uncontrollable Aspects ({uncontrollableItems.length})
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mb-3 leading-relaxed">
            External events, future outcomes, and others' reactions. Handled via <strong className="text-[var(--text-primary)]">ACT Acceptance</strong> and willingness statements.
          </p>

          {uncontrollableItems.length === 0 ? (
            <div className="text-xs text-[var(--text-tertiary)] italic py-3 text-center">
              No uncontrollable items identified (drag slider &lt; 50%).
            </div>
          ) : (
            <div className="space-y-3">
              {uncontrollableItems.map((elem) => (
                <div
                  key={elem.id}
                  className="p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs space-y-2"
                >
                  <div className="font-medium text-[var(--text-primary)]">{elem.description}</div>
                  
                  {/* Willingness Statement Formulation Template (PRD 3A.3) */}
                  <div className="p-2.5 bg-[var(--bg-surface)] rounded text-[11px] space-y-1.5">
                    <span className="font-semibold block text-[var(--text-secondary)]">
                      Willingness Statement (Make room for distress):
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-[var(--text-tertiary)]">Emotion:</span>
                        <input
                          type="text"
                          value={elem.uncontrollableEmotion || ''}
                          onChange={(e) =>
                            handleUpdateElement(elem.id, { uncontrollableEmotion: e.target.value })
                          }
                          placeholder="e.g. anticipatory anxiety / uncertainty"
                          className="flex-1 px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-[var(--text-tertiary)]">Valued Activity:</span>
                        <input
                          type="text"
                          value={elem.valuedActivity || ''}
                          onChange={(e) =>
                            handleUpdateElement(elem.id, { valuedActivity: e.target.value })
                          }
                          placeholder="e.g. presenting with calm clarity"
                          className="flex-1 px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-1 pt-1 border-t border-[var(--border-subtle)] text-[11px] font-serif italic text-[var(--text-primary)]">
                      "I am willing to make room for the feeling of{' '}
                      <strong>{elem.uncontrollableEmotion || '[Emotion]'}</strong> while directing my focus to{' '}
                      <strong>{elem.valuedActivity || '[Valued Activity]'}</strong>."
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch 3B: Action Execution & Implementation Intentions */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-black)]"></span>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Branch 3B: Controllable Aspects ({controllableItems.length})
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mb-3 leading-relaxed">
            Personal agency. Handled via <strong className="text-[var(--text-primary)]">Values Alignment</strong> &amp; strict 'If-Then' implementation plans with external stop signals.
          </p>

          {controllableItems.length === 0 ? (
            <div className="text-xs text-[var(--text-tertiary)] italic py-3 text-center">
              No controllable items identified (drag slider &gt;= 50%).
            </div>
          ) : (
            <div className="space-y-3">
              {controllableItems.map((elem) => {
                const stopSignalValidation = validateStopSignal(elem.executionStopSignalCriteria || '');
                return (
                  <div
                    key={elem.id}
                    className="p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs space-y-2.5"
                  >
                    <div className="font-medium text-[var(--text-primary)]">{elem.description}</div>

                    {/* Values Anchor */}
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                        Anchor Value
                      </label>
                      <select
                        value={elem.selectedValueId || 'CAREER_GROWTH'}
                        onChange={(e) =>
                          handleUpdateElement(elem.id, { selectedValueId: e.target.value as ValueCategory })
                        }
                        className="w-full px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-xs focus:outline-none"
                      >
                        {VALUES_TAXONOMY.map((val) => (
                          <option key={val.id} value={val.id}>
                            {val.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 'If-Then' Implementation Intention Construction (PRD 2.4 & 3B.3) */}
                    <div className="space-y-1.5 p-2.5 bg-[var(--bg-surface)] rounded text-[11px]">
                      <div className="font-semibold text-[var(--text-secondary)]">
                        Implementation Intention &amp; Bounded Stop Signal:
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-10 font-bold shrink-0 text-[var(--text-primary)]">IF:</span>
                          <input
                            type="text"
                            value={elem.ifTriggerCondition || ''}
                            onChange={(e) =>
                              handleUpdateElement(elem.id, { ifTriggerCondition: e.target.value })
                            }
                            placeholder="Specific trigger (e.g. When I sit at my desk at 10 AM)..."
                            className="flex-1 px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="w-10 font-bold shrink-0 text-[var(--text-primary)]">THEN:</span>
                          <input
                            type="text"
                            value={elem.thenActionCommitment || ''}
                            onChange={(e) =>
                              handleUpdateElement(elem.id, { thenActionCommitment: e.target.value })
                            }
                            placeholder="Specific behavioral action (e.g. I will write the 1-page test report)..."
                            className="flex-1 px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="w-10 font-bold shrink-0 text-[var(--text-primary)]">UNTIL:</span>
                          <input
                            type="text"
                            value={elem.executionStopSignalCriteria || ''}
                            onChange={(e) =>
                              handleUpdateElement(elem.id, {
                                executionStopSignalCriteria: e.target.value,
                              })
                            }
                            placeholder="Objective external milestone (e.g. Clock hits 10:45 AM or PDF is exported)..."
                            className="flex-1 px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs"
                          />
                        </div>
                      </div>

                      {/* Stop signal feedback if user entered internal feeling */}
                      {!stopSignalValidation.isValid && elem.executionStopSignalCriteria && (
                        <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[10px] leading-tight flex items-start gap-1">
                          <AlertCircle size={12} className="shrink-0 mt-0.5 text-amber-600" />
                          <span>{stopSignalValidation.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onBackToNode2}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--border-medium)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Back to Node 2</span>
        </button>

        <button
          type="button"
          onClick={onProceedToNode4}
          disabled={elements.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--accent-black)] text-[var(--accent-white)] blackout-button disabled:opacity-40 cursor-pointer"
        >
          <span>Proceed to Node 4: Synthesis &amp; Blueprint</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
