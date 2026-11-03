import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

interface ClinicalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  number: string;
  phase: string;
  title: string;
  whatYouDo: string;
  scienceTerm: string;
  citation: string;
  whyItWorks: string;
  svgPath: string;
}

const PRACTICE_STEPS: GuideStep[] = [
  {
    number: 'I',
    phase: 'Step One · Externalize',
    title: 'Put the heavy thought onto the paper line.',
    whatYouDo:
      'Type the exact worry occupying your mind onto the open line and select the area of life it touches (work, health, relationships, finances, or growth).',
    scienceTerm: 'Affect Labeling & Cognitive Defusion',
    citation: 'Lieberman et al. (UCLA Neuroimaging) · Hayes (ACT)',
    whyItWorks:
      'When a worry stays unspoken inside your head, your brain treats the thought as an immediate physical threat. Putting feelings into written words ("affect labeling") activates the right ventrolateral prefrontal cortex (rvlPFC), which directly dampens amygdala alarm and creates psychological distance ("cognitive defusion").',
    svgPath: 'M 4 22 C 32 10, 64 30, 96 20 C 122 12, 146 22, 168 22',
  },
  {
    number: 'II',
    phase: 'Step Two · Soften & Reframe',
    title: 'Reframe the negative narrative before trying to solve it.',
    whatYouDo:
      'Follow the line into its gentle loop. Pause to read—or cycle through—a kinder, grounded perspective before making any decision.',
    scienceTerm: 'Cognitive Reappraisal & Broaden-and-Build',
    citation: 'Gross (Stanford Emotion Regulation) · Fredrickson (UNC)',
    whyItWorks:
      'Under a negative thought, "cortisol narrowing" locks your attention onto worst-case scenarios, disabling creative problem-solving. Shifting a harsh thought into a constructive, compassionate reframe ("cognitive reappraisal") down-regulates limbic threat arousal and restores prefrontal executive function so you can see clearly again.',
    svgPath:
      'M 4 26 C 42 24, 72 20, 92 10 C 104 3, 88 2, 84 14 C 80 26, 118 24, 168 22',
  },
  {
    number: 'III',
    phase: 'Step Three · The Fork in the Line',
    title: 'Separate what is in your hands from what is not.',
    whatYouDo:
      'At the fork, answer one honest question: "Can I do something about this today?" Choose either "Yes, a small step" or "No, outside my hands."',
    scienceTerm: 'Metacognitive Sorting & Locus of Control',
    citation: 'Butler & Hope (Oxford CBT) · Wells (Metacognitive Therapy)',
    whyItWorks:
      'Chronic anxiety thrives on confusing hypothetical "what-if" scenarios with real-time solvable problems—a loop known as perseverative cognition. Explicitly sorting your locus of control interrupts rumination and tells your nervous system whether to mobilize gentle action or practice acceptance.',
    svgPath:
      'M 4 22 L 76 22 M 76 22 C 104 22, 120 10, 166 10 M 76 22 C 104 22, 120 34, 166 34',
  },
  {
    number: 'IV',
    phase: 'Step Four · Micro-Step or Release',
    title: 'Close the mental loop with a tiny plan or a grounding anchor.',
    whatYouDo:
      'If actionable, write one small step (What, When, and How). If outside your hands, write a comforting anchor truth and release the line.',
    scienceTerm: 'Implementation Intentions & The Zeigarnik Effect',
    citation: 'Gollwitzer (1999) · Zeigarnik (Working Memory Closure)',
    whyItWorks:
      'Unresolved worries stay active in working memory like open browser tabs ("the Zeigarnik effect"). Translating a vague worry into a concrete What-When-How plan ("implementation intention") signals task closure to the prefrontal cortex—while releasing uncontrollable worries engages the parasympathetic vagal brake.',
    svgPath:
      'M 4 28 C 36 28, 56 12, 86 12 C 116 12, 134 22, 168 22',
  },
];

export const ClinicalGuideModal: React.FC<ClinicalGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [modalTab, setModalTab] = useState<'how-it-works' | 'reason-behind'>('how-it-works');
  const [reframeState, setReframeState] = useState<'negative' | 'reframed'>('reframed');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-zinc-900/25 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 font-serif select-none"
        >
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-[#faf9f6] border border-zinc-200/90 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl relative z-10 overflow-hidden"
          >
            {/* Header — Editorial Monograph Masthead + Top-Level Modal Tabs */}
            <div className="px-7 sm:px-9 pt-6 pb-4 border-b border-zinc-200/60 bg-[#faf9f6] shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 text-[11px] tracking-[0.16em] uppercase text-zinc-400 font-serif">
                    <span>Clinical Field Notes</span>
                    <span>·</span>
                    <span>CBT &amp; Affective Neuroscience</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif italic text-zinc-900 mt-1">
                    how untangle works — the practice &amp; the why.
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer shrink-0 mt-0.5"
                  aria-label="Close guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Primary Modal Tab Switcher: "How it works" vs. "The reason behind it" */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Guide sections"
                  className="inline-flex items-center bg-[#e5e2d9] p-1 rounded-lg border border-zinc-300/80"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === 'how-it-works'}
                    onClick={() => setModalTab('how-it-works')}
                    className={`px-4 py-1.5 rounded-md text-xs sm:text-[13px] font-serif transition-all cursor-pointer ${
                      modalTab === 'how-it-works'
                        ? 'bg-zinc-900 text-[#faf9f6] shadow-xs font-medium'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-[#efede7]/60'
                    }`}
                  >
                    How it works (Step-by-Step)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={modalTab === 'reason-behind'}
                    onClick={() => setModalTab('reason-behind')}
                    className={`px-4 py-1.5 rounded-md text-xs sm:text-[13px] font-serif transition-all cursor-pointer ${
                      modalTab === 'reason-behind'
                        ? 'bg-zinc-900 text-[#faf9f6] shadow-xs font-medium'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-[#efede7]/60'
                    }`}
                  >
                    The reason behind it (Why Reframing Works)
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Editorial Body */}
            <div className="px-7 sm:px-9 py-6 overflow-y-auto flex-1">
              <AnimatePresence mode="wait">
                {modalTab === 'how-it-works' ? (
                  <motion.div
                    key="tab-how-it-works"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <span className="text-[10.5px] uppercase tracking-[0.15em] text-zinc-400 block">
                          Step-by-Step Protocol
                        </span>
                        <h3 className="text-base sm:text-lg font-serif italic text-zinc-900">
                          What you do on the line — and what happens in your mind
                        </h3>
                      </div>
                    </div>

                    {/* Earlier Vertical Spine Timeline Design */}
                    <div className="relative border-l border-zinc-300/80 ml-3 sm:ml-4 pl-6 sm:pl-8 space-y-7 py-1">
                      {PRACTICE_STEPS.map((step, idx) => (
                        <motion.div
                          key={step.number}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: idx * 0.06 }}
                          className="relative group"
                        >
                          {/* Roman Numeral Node on the Vertical Ink Spine */}
                          <div className="absolute -left-[37px] sm:-left-[45px] top-0.5 w-6 h-6 rounded-full bg-[#faf9f6] border border-zinc-300 flex items-center justify-center text-[11px] font-serif italic text-zinc-700">
                            {step.number}
                          </div>

                          {/* Step Header + Bespoke Hand-Drawn Ink Motif */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-200/60">
                            <div>
                              <span className="text-[10.5px] uppercase tracking-[0.14em] text-zinc-400 block">
                                {step.phase}
                              </span>
                              <h4 className="text-[15px] sm:text-base font-serif text-zinc-900 font-medium mt-0.5">
                                {step.title}
                              </h4>
                            </div>

                            <svg
                              width="148"
                              height="36"
                              viewBox="0 0 172 44"
                              fill="none"
                              className="shrink-0 opacity-85"
                            >
                              <motion.path
                                d={step.svgPath}
                                stroke="#18181b"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.8, delay: 0.1 + idx * 0.1 }}
                              />
                            </svg>
                          </div>

                          {/* Two-Column Breakdown: What You Do vs. The Science Why */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3">
                            {/* Column A: What You Do */}
                            <div className="md:col-span-5">
                              <div className="text-[10.5px] uppercase tracking-[0.13em] text-zinc-400 mb-1">
                                What you do
                              </div>
                              <p className="text-[13px] font-serif text-zinc-800 leading-relaxed">
                                {step.whatYouDo}
                              </p>
                            </div>

                            {/* Column B: The Science / Why It Works */}
                            <div className="md:col-span-7 md:border-l md:border-zinc-200/70 md:pl-4">
                              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                                <span className="text-[11px] font-serif italic font-medium text-zinc-900">
                                  Why · {step.scienceTerm}
                                </span>
                                <span className="text-[10.5px] font-serif text-zinc-400">
                                  {step.citation}
                                </span>
                              </div>
                              <p className="text-[12.5px] font-serif text-zinc-600 leading-relaxed">
                                {step.whyItWorks}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tab-reason-behind"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Interactive Reframing Mechanism Box */}
                    <div className="border border-zinc-200/90 rounded-xl bg-[#f3f1eb]/75 p-5 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-zinc-200/80">
                        <div>
                          <span className="text-[10.5px] uppercase tracking-[0.15em] text-zinc-500 block">
                            The Core Mechanism · Why We Reframe First
                          </span>
                          <h3 className="text-base sm:text-lg font-serif italic text-zinc-900 mt-0.5">
                            Why turning a negative thought into a constructive one changes your brain
                          </h3>
                        </div>

                        {/* Unmistakable Segmented Tab Bar */}
                        <div
                          role="tablist"
                          aria-label="Brain state comparison"
                          className="inline-flex items-center bg-[#e5e2d9] p-1 rounded-lg border border-zinc-300/80 self-start lg:self-auto shrink-0"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={reframeState === 'negative'}
                            onClick={() => setReframeState('negative')}
                            className={`px-3 py-1.5 rounded-md text-xs font-serif transition-all cursor-pointer flex items-center gap-1.5 ${
                              reframeState === 'negative'
                                ? 'bg-zinc-900 text-[#faf9f6] shadow-xs font-medium'
                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-[#efede7]/60'
                            }`}
                          >
                            <span>1. Unreframed thought</span>
                          </button>

                          <button
                            type="button"
                            role="tab"
                            aria-selected={reframeState === 'reframed'}
                            onClick={() => setReframeState('reframed')}
                            className={`px-3 py-1.5 rounded-md text-xs font-serif transition-all cursor-pointer flex items-center gap-1.5 ${
                              reframeState === 'reframed'
                                ? 'bg-zinc-900 text-[#faf9f6] shadow-xs font-medium'
                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-[#efede7]/60'
                            }`}
                          >
                            <span>2. Reframed perspective</span>
                          </button>
                        </div>
                      </div>

                      {/* Visual Ink Line Comparison + Scientific Breakdown */}
                      <div className="pt-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                        {/* Left: Dynamic Ink Illustration of the Brain's Thought Path */}
                        <div className="md:col-span-5 bg-[#faf9f6] border border-zinc-200/80 rounded-lg p-4 flex flex-col items-center justify-center min-h-[136px]">
                          <svg
                            width="100%"
                            height="68"
                            viewBox="0 0 240 68"
                            fill="none"
                            className="overflow-visible"
                          >
                            {reframeState === 'negative' ? (
                              <motion.path
                                key="negative-path"
                                d="M 10 36 C 35 36, 48 12, 68 50 C 85 10, 62 8, 92 52 C 112 8, 88 14, 118 50 C 138 12, 115 20, 146 46 C 165 16, 152 44, 182 32 C 202 24, 215 38, 230 34"
                                stroke="#18181b"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0.4 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.7, ease: 'easeInOut' }}
                              />
                            ) : (
                              <motion.path
                                key="reframed-path"
                                d="M 10 38 C 36 38, 48 18, 66 42 C 78 22, 68 14, 84 28 C 106 46, 134 20, 168 28 C 194 34, 210 28, 230 28"
                                stroke="#18181b"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0.4 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                              />
                            )}
                          </svg>
                          <p className="text-[11.5px] font-serif italic text-zinc-500 text-center mt-1">
                            {reframeState === 'negative'
                              ? '“If I fail at this, everything falls apart.” — knotted rumination loop'
                              : '“This feels heavy because I care; I only need one small step today.” — open path'}
                          </p>
                        </div>

                        {/* Right: Neuroscience Explanation */}
                        <div className="md:col-span-7 space-y-2.5">
                          {reframeState === 'negative' ? (
                            <motion.div
                              key="neg-copy"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-2"
                            >
                              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-serif">
                                State A · Negativity Bias &amp; Amygdala Hijack
                              </div>
                              <p className="text-[13.5px] text-zinc-800 leading-relaxed">
                                Our brains evolved with a <span className="italic font-medium text-zinc-950">negativity bias</span>—treating harsh, self-critical thoughts like physical danger. This triggers an <span className="italic font-medium text-zinc-950">amygdala hijack</span>, releasing cortisol and narrowing attention onto the threat.
                              </p>
                              <p className="text-[12.5px] text-zinc-500 italic leading-relaxed">
                                Result: Your prefrontal cortex goes offline. Trying to solve a problem while inside a negative thought only creates more rumination.
                              </p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="pos-copy"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-2"
                            >
                              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500 font-serif">
                                State B · Cognitive Reappraisal &amp; Prefrontal Regulation
                              </div>
                              <p className="text-[13.5px] text-zinc-800 leading-relaxed">
                                Reframing is not toxic positivity—in clinical psychology it is called <span className="italic font-medium text-zinc-950">cognitive reappraisal</span>. Offering yourself a realistic, compassionate perspective recruits the <span className="italic font-medium text-zinc-950">prefrontal cortex</span> to quiet limbic alarm.
                              </p>
                              <p className="text-[12.5px] text-zinc-500 italic leading-relaxed">
                                Result: According to Fredrickson’s Broaden-and-Build theory, softening negative affect widens your attentional field so you can either take one clear step or peacefully let go.
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Three Research Pillars Explaining the Sequence */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="border border-zinc-200/80 rounded-xl p-4 bg-[#faf9f6]">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 block">
                          01 · Externalizing
                        </span>
                        <h4 className="text-sm font-serif italic font-medium text-zinc-900 mt-0.5">
                          Affect Labeling
                        </h4>
                        <p className="text-xs text-zinc-600 leading-relaxed mt-1.5">
                          UCLA fMRI research (Lieberman et al.) shows that putting raw distress into written words activates the <span className="italic text-zinc-800">rvlPFC</span>, acting as a neural brake on emotional overwhelm.
                        </p>
                      </div>

                      <div className="border border-zinc-200/80 rounded-xl p-4 bg-[#faf9f6]">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 block">
                          02 · Sorting Control
                        </span>
                        <h4 className="text-sm font-serif italic font-medium text-zinc-900 mt-0.5">
                          Worry Decision Tree
                        </h4>
                        <p className="text-xs text-zinc-600 leading-relaxed mt-1.5">
                          Oxford CBT protocols (Butler &amp; Hope) prove that anxiety persists when we treat uncontrollable <span className="italic text-zinc-800">hypothetical worries</span> like actionable tasks. Splitting the line breaks that loop.
                        </p>
                      </div>

                      <div className="border border-zinc-200/80 rounded-xl p-4 bg-[#faf9f6]">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 block">
                          03 · Closing the Loop
                        </span>
                        <h4 className="text-sm font-serif italic font-medium text-zinc-900 mt-0.5">
                          The Zeigarnik Effect
                        </h4>
                        <p className="text-xs text-zinc-600 leading-relaxed mt-1.5">
                          Unfinished worries occupy working memory. Defining a concrete <span className="italic text-zinc-800">What–When–How</span> micro-step (Gollwitzer, 1999) lets your brain safely close the open mental tab.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="py-4 px-7 sm:px-9 border-t border-zinc-200/60 flex items-center justify-between bg-[#faf9f6] shrink-0">
              <button
                type="button"
                onClick={() =>
                  setModalTab(modalTab === 'how-it-works' ? 'reason-behind' : 'how-it-works')
                }
                className="text-xs font-serif italic text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                {modalTab === 'how-it-works'
                  ? 'Read the brain science: Why reframing works →'
                  : '← View the 4-step practice'}
              </button>
              <button
                onClick={onClose}
                className="group inline-flex items-center gap-2 text-sm font-serif italic text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer ml-auto"
              >
                <span className="border-b border-zinc-400 group-hover:border-zinc-900 pb-0.5 transition-colors">
                  Return to your line
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
