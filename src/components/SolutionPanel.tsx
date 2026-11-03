import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Copy,
  Check,
  FileText, 
  Sliders,
  Zap, 
  Calendar, 
  HeartHandshake, 
  CheckCircle2,
  Wind
} from 'lucide-react';
import { DiaryPage } from '../types/worryTree';
import { exportPlannerAsHdImage } from '../utils/exportPlanner';

interface SolutionPanelProps {
  page: DiaryPage;
  onUpdatePage: (updated: DiaryPage | ((prev: DiaryPage) => DiaryPage)) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SolutionPanel:
 * Redesigned as an authentic Paper Modal Sheet showing important details about the user's worry journey.
 * - Floats centered as a physical paper notepad sheet with sketch drop-shadow.
 * - ALL action buttons are strictly ICON-ONLY with descriptive title tooltips.
 */
export const SolutionPanel: React.FC<SolutionPanelProps> = ({
  page,
  onUpdatePage,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'focus_note' | 'clinical_tools'>('focus_note');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDialChange = (id: string, nextVal: number) => {
    onUpdatePage((current) => ({
      ...current,
      controlDials: current.controlDials.map((d) =>
        d.id === id ? { ...d, value: Math.round(nextVal * 100) / 100 } : d
      ),
    }));
  };

  const handleDownloadHdPng = async () => {
    setIsExporting(true);
    try {
      await exportPlannerAsHdImage(page);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    const summary = [
      `DECENTER FOCUS PLANNER · ${page.date}`,
      `Category: ${page.category}`,
      `Worry: "${page.rootWorry || 'N/A'}"`,
      page.situationEvent ? `Trigger: ${page.situationEvent}` : '',
      page.positiveReframe ? `Perspective: "${page.positiveReframe}"` : '',
      page.canActOnWorry === 'yes'
        ? `Action Plan: 1. ${page.actionLadder?.whatCanDo || ''} | 2. ${page.actionLadder?.howCanDo || ''} | 3. Timing: ${page.actionLadder?.whenTiming || ''}`
        : 'Outcome: Mindful Acceptance (Outside Behavioral Control)',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 sm:p-6 no-print overflow-y-auto select-none"
      onClick={onClose}
    >
      {/* Physical Paper Notepad Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white border-[2.5px] border-black shadow-[8px_8px_0px_#000] rounded-[2px] max-w-xl w-full my-auto flex flex-col overflow-hidden animate-node-opening"
      >
        {/* Paper Top Binding Bar */}
        <div className="bg-black text-white px-4 py-3 flex items-center justify-between border-b-[2.5px] border-black">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#d64933] border border-white" />
            <h2 className="text-sm font-bauhaus font-extrabold uppercase tracking-wider text-white">
              Focus Planner
            </h2>
            <span className="text-[11px] font-journal text-[#92dce5] ml-1">
              • {page.category}
            </span>
          </div>

          {/* ALL BUTTONS ARE ICON-ONLY */}
          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle: Icon Only */}
            <button
              onClick={() => setActiveTab(activeTab === 'focus_note' ? 'clinical_tools' : 'focus_note')}
              className={`p-1.5 border border-white transition-all cursor-pointer ${
                activeTab === 'clinical_tools' ? 'bg-[#92dce5] text-black' : 'bg-transparent text-white hover:bg-[#1f1f1f]'
              }`}
              title={activeTab === 'focus_note' ? 'Switch to Control Dials' : 'Switch to Focus Note'}
              aria-label="Toggle View"
            >
              {activeTab === 'focus_note' ? (
                <Sliders className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </button>

            {/* Copy Summary: Icon Only */}
            <button
              onClick={handleCopySummary}
              className="p-1.5 border border-white hover:bg-[#1f1f1f] text-white transition-all cursor-pointer active:scale-95"
              title={copied ? 'Copied to Clipboard!' : 'Copy Summary'}
              aria-label="Copy Summary"
            >
              {copied ? <Check className="w-4 h-4 text-[#92dce5]" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Download PNG: Icon Only */}
            <button
              onClick={handleDownloadHdPng}
              disabled={isExporting}
              className="p-1.5 border border-white hover:bg-[#1f1f1f] text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Download Retina PNG Image"
              aria-label="Download PNG"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Print/PDF: Icon Only */}
            <button
              onClick={handlePrintPdf}
              className="p-1.5 border border-white hover:bg-[#1f1f1f] text-white transition-all cursor-pointer active:scale-95"
              title="Print / Save as PDF"
              aria-label="Print PDF"
            >
              <Printer className="w-4 h-4" />
            </button>

            <div className="h-4 w-[1px] bg-white/40 mx-0.5" />

            {/* Close Modal: Icon Only */}
            <button
              onClick={onClose}
              className="p-1.5 border border-white bg-[#d64933] text-white hover:bg-[#b83824] transition-all cursor-pointer active:scale-95"
              title="Close Focus Planner"
              aria-label="Close Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Content Area */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 bg-white">
          {activeTab === 'focus_note' ? (
            <div id="printable-focus-planner" className="space-y-4 font-journal text-black">
              {/* Paper Memo Header Strip */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-black/15">
                <div>
                  <span className="text-[11px] font-bauhaus uppercase tracking-widest text-[#7c7c7c] block">
                    Metacognitive Unpacking Note
                  </span>
                  <span className="text-sm font-journal text-black font-bold">
                    Date: {page.date}
                  </span>
                </div>
                <div className="bg-[#92dce5] px-2.5 py-1 border-2 border-black text-xs font-bauhaus uppercase font-extrabold shadow-[1.5px_1.5px_0px_#000]">
                  {page.category}
                </div>
              </div>

              {/* 1. The Root Worry */}
              <div className="bg-[#eee5e9]/40 p-3.5 border-2 border-black shadow-[2px_2px_0px_#000]">
                <span className="text-xs font-bauhaus uppercase tracking-wider text-[#d64933] block mb-1">
                  1. The Worry On Your Mind
                </span>
                <p className="text-xl md:text-2xl font-journal font-bold text-black leading-tight">
                  {page.rootWorry ? `"${page.rootWorry}"` : 'No worry entered yet'}
                </p>
              </div>

              {/* 2. Sparking Situation Trigger */}
              {page.situationEvent && (
                <div className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_#000]">
                  <span className="text-xs font-bauhaus uppercase tracking-wider text-[#7c7c7c] block mb-0.5">
                    2. Sparking Event / Anchor
                  </span>
                  <p className="text-base font-journal text-black leading-snug">
                    {page.situationEvent}
                  </p>
                </div>
              )}

              {/* 3. Mindful Perspective Reframe */}
              {page.positiveReframe && (
                <div className="border-2 border-black p-3.5 bg-[#92dce5]/20 shadow-[2px_2px_0px_#000]">
                  <span className="text-xs font-bauhaus uppercase tracking-wider text-black block mb-1">
                    3. Perspective Check
                  </span>
                  <p className="text-base font-handwriting italic text-black leading-relaxed font-bold">
                    "{page.positiveReframe}"
                  </p>
                </div>
              )}

              {/* 4. Action Ladder or Mindful Acceptance */}
              {page.canActOnWorry === 'yes' && (
                <div className="border-2 border-black p-4 bg-white shadow-[3px_3px_0px_#000] space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                    <div className="flex items-center gap-1.5 text-black font-bauhaus text-xs uppercase tracking-wider font-extrabold">
                      <CheckCircle2 className="w-4 h-4 text-[#d64933]" />
                      <span>Action Ladder (Can Act · Yes)</span>
                    </div>
                  </div>

                  {/* Step 1: What */}
                  {page.actionLadder?.whatCanDo && (
                    <div className="bg-[#eee5e9]/50 p-2.5 border border-black">
                      <span className="text-[11px] font-bauhaus uppercase text-black block mb-0.5 font-bold">
                        First Kind Step (What):
                      </span>
                      <p className="text-sm font-journal text-black leading-snug">
                        {page.actionLadder.whatCanDo}
                      </p>
                    </div>
                  )}

                  {/* Step 2: How */}
                  {page.actionLadder?.howCanDo && (
                    <div className="bg-[#eee5e9]/50 p-2.5 border border-black">
                      <span className="text-[11px] font-bauhaus uppercase text-black block mb-0.5 font-bold">
                        Comfortable Method (How):
                      </span>
                      <p className="text-sm font-journal text-black leading-snug">
                        {page.actionLadder.howCanDo}
                      </p>
                    </div>
                  )}

                  {/* Step 3: When & Commitment */}
                  {page.actionLadder?.whenTiming === 'now' && page.immediateAction && (
                    <div className="bg-[#92dce5]/30 p-3 border-2 border-black">
                      <div className="flex items-center gap-1.5 text-black font-bauhaus text-xs uppercase mb-1 font-extrabold">
                        <Zap className="w-4 h-4 text-[#d64933]" />
                        <span>Action Right Now:</span>
                      </div>
                      <p className="text-sm font-journal font-bold text-black leading-snug">
                        {page.immediateAction}
                      </p>
                    </div>
                  )}

                  {page.actionLadder?.whenTiming === 'scheduled' && page.signOffWorry && (
                    <div className="bg-[#eee5e9] p-3 border-2 border-black space-y-2">
                      <div className="flex items-center gap-1.5 text-black font-bauhaus text-xs uppercase font-extrabold">
                        <Calendar className="w-4 h-4 text-black" />
                        <span>Scheduled Commitment:</span>
                      </div>
                      <p className="text-sm font-journal font-bold text-black">
                        {page.signOffWorry.date || 'Scheduled for later'}
                      </p>

                      {page.signOffWorry.signatureDrawing ? (
                        <div>
                          <span className="text-[10px] font-bauhaus uppercase text-[#7c7c7c] block mb-1">
                            Signature:
                          </span>
                          <div className="bg-white p-1 border-2 border-black inline-block shadow-[1.5px_1.5px_0px_#000]">
                            <img
                              src={page.signOffWorry.signatureDrawing}
                              alt="User commitment signature"
                              className="h-10 w-auto object-contain"
                            />
                          </div>
                        </div>
                      ) : page.signOffWorry.name ? (
                        <p className="text-xs font-journal text-black pt-1">
                          Signed off by: <span className="font-bold underline">{page.signOffWorry.name}</span>
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Cognitive Release / Mindful Acceptance */}
              {page.canActOnWorry === 'no' && (
                <div className="border-2 border-black p-4 bg-[#92dce5]/20 shadow-[3px_3px_0px_#000] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-black font-bauhaus text-xs uppercase tracking-wider font-extrabold">
                    <HeartHandshake className="w-4 h-4 text-black" />
                    <span>Mindful Acceptance & Emotional Freedom</span>
                  </div>
                  <p className="text-base font-handwriting italic text-black leading-relaxed">
                    "I give myself permission to release what is outside my hands today. My mind has completed its job, and I return gently to the present."
                  </p>
                  <div className="text-xs text-black flex items-center gap-1.5 pt-1 font-bauhaus font-bold">
                    <Wind className="w-4 h-4 text-black" />
                    <span>Grounding breaths completed: {page.cognitiveRelease?.breathsCompleted || 0} / 3</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Control Dials (MCT) */
            <div className="space-y-4">
              <div className="border-2 border-black p-4 bg-white shadow-[3px_3px_0px_#000] space-y-3">
                <div className="border-b-2 border-black/10 pb-2">
                  <h3 className="text-xs font-bauhaus font-bold text-black uppercase tracking-wider">
                    Perceived Control Dials
                  </h3>
                  <p className="text-xs font-journal text-[#7c7c7c]">
                    Calibrate how much direct influence you have over this situation
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  {page.controlDials.map((dial) => (
                    <div key={dial.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bauhaus text-black">
                        <span>{dial.label}</span>
                        <span className="font-bauhaus text-[11px] font-bold text-black">
                          {Math.round(dial.value * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={dial.value}
                        onChange={(e) => handleDialChange(dial.id, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#eee5e9] border border-black rounded-none appearance-none cursor-pointer accent-black"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
