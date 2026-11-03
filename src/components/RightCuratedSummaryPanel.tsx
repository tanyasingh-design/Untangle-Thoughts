import React, { useState } from 'react';
import { 
  Copy, 
  Download, 
  Check, 
  Feather, 
  Plus, 
  Layers
} from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface RightCuratedSummaryPanelProps {
  page: DiaryPage;
  onOpenPastEntries: () => void;
  onNewPage: () => void;
  pastEntriesCount: number;
}

export const RightCuratedSummaryPanel: React.FC<RightCuratedSummaryPanelProps> = ({
  page,
  onOpenPastEntries,
  onNewPage,
  pastEntriesCount,
}) => {
  const [copied, setCopied] = useState(false);

  const canActDecision = page.canActOnWorry || page.canAct;
  const isHypothetical = canActDecision === 'no';
  const isActionable = canActDecision === 'yes';

  const whatValue = page.actionTrio?.what || page.actionLadder?.whatCanDo || '';
  const whenValue = page.actionTrio?.when || '';
  const howValue = page.actionTrio?.how || page.actionLadder?.howCanDo || '';
  const hasActionPlan = Boolean(whatValue.trim() || whenValue.trim() || howValue.trim());

  const anchorValue = page.anchorThought || page.cognitiveRelease?.reassuranceText || '';
  const isSealed = Boolean(page.letWorryGoSealed || page.signOffWorry?.date);

  const generateExportText = () => {
    let text = `DECENTER · WORRY JOURNAL\n`;
    text += `${page.date || 'Today'} · ${page.category || 'General'}\n\n`;
    
    text += `“${page.rootWorry || '(No worry written yet)'}”\n\n`;

    if (page.positiveReframe) {
      text += `A KIND PERSPECTIVE:\n“${page.positiveReframe}”\n\n`;
    }

    if (isHypothetical) {
      text += `PATH: Outside my hands today.\n`;
      text += `“Since this is outside my direct control, overthinking will only steal peace from my present. I choose to let it go.”\n\n`;
    } else if (isActionable) {
      text += `PATH: A step I can take.\n`;
      text += `• What: ${whatValue || '-'}\n`;
      text += `• When: ${whenValue || '-'}\n`;
      text += `• How:  ${howValue || '-'}\n`;
      if (page.actionTiming) {
        text += `• Timing: ${page.actionTiming === 'now' ? 'Do it now' : 'Scheduled'}\n`;
      }
      text += `\n`;
    }

    if (anchorValue) {
      text += `ANCHOR TRUTH:\n“${anchorValue}”\n\n`;
    }

    text += isSealed ? `STATUS: Worry released.` : `STATUS: In reflection.`;
    return text;
  };

  const handleCopy = () => {
    const text = generateExportText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = generateExportText();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worry-reflection-${page.id || 'entry'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-full h-full flex flex-col bg-white border-l border-zinc-200/80 select-none overflow-hidden font-serif">
      {/* Top Header of Right Panel */}
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-[#faf9f6]">
        <div>
          <h2 className="text-sm font-serif italic text-zinc-800">
            Journal Reflection
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPastEntries}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-full transition-colors cursor-pointer"
            title="Past Journals"
          >
            <Layers className="w-3 h-3" />
            <span>Past ({pastEntriesCount})</span>
          </button>
          <button
            onClick={onNewPage}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-zinc-900 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            title="Start New Worry Journal"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Scrollable Live Summary Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
        
        {/* Entry Meta */}
        <div className="border-b border-zinc-100 pb-3">
          <span className="text-xs text-zinc-400 font-sans tracking-wide uppercase">
            {page.date || 'Today'} · {page.category || 'General'}
          </span>
          <h3 className="text-base font-serif italic text-zinc-900 mt-1">
            {page.title || 'Untitled Thought'}
          </h3>
        </div>

        {/* The Thought */}
        <div>
          <span className="text-xs font-serif italic text-zinc-400 block mb-1">
            The Thought:
          </span>
          {page.rootWorry && page.rootWorry.trim() ? (
            <p className="text-zinc-900 font-serif leading-relaxed text-sm">
              “{page.rootWorry}”
            </p>
          ) : (
            <p className="text-zinc-400 italic text-xs">
              Waiting for you on the line...
            </p>
          )}

          {page.positiveReframe && (
            <div className="mt-3 pt-2 text-xs text-zinc-600 border-t border-zinc-100 italic">
              “{page.positiveReframe}”
            </div>
          )}
        </div>

        {/* The Nature / Direction of This Worry */}
        {canActDecision && (
          <div className="border-t border-zinc-100 pt-4">
            <span className="text-xs font-serif italic text-zinc-400 block mb-1">
              The Nature:
            </span>
            {isHypothetical ? (
              <p className="text-xs text-zinc-700 leading-relaxed">
                Outside your hands today. Release and gentle attention is the path.
              </p>
            ) : (
              <p className="text-xs text-zinc-700 leading-relaxed">
                Within your hands. A kind, concrete action can dissolve this.
              </p>
            )}
          </div>
        )}

        {/* Action Steps (What / When / How) */}
        {isActionable && hasActionPlan && (
          <div className="border-t border-zinc-100 pt-4 space-y-2">
            <span className="text-xs font-serif italic text-zinc-400 block mb-1">
              The Action:
            </span>
            {whatValue && (
              <div className="text-xs text-zinc-800">
                <span className="text-zinc-400 mr-1.5 font-sans uppercase text-[10px]">What:</span>
                {whatValue}
              </div>
            )}
            {whenValue && (
              <div className="text-xs text-zinc-800">
                <span className="text-zinc-400 mr-1.5 font-sans uppercase text-[10px]">When:</span>
                {whenValue}
              </div>
            )}
            {howValue && (
              <div className="text-xs text-zinc-800">
                <span className="text-zinc-400 mr-1.5 font-sans uppercase text-[10px]">How:</span>
                {howValue}
              </div>
            )}
            {page.actionTiming && (
              <div className="text-xs text-zinc-500 italic pt-1">
                {page.actionTiming === 'now' ? '→ Doing it now (2 minutes)' : `→ Scheduled for ${whenValue || 'later'}`}
              </div>
            )}
          </div>
        )}

        {/* What this worry means & positive closing note */}
        {isSealed && (
          <div className="border-t border-zinc-100 pt-4 space-y-3">
            <div>
              <span className="text-xs font-serif italic text-zinc-400 block mb-1">
                What This Worry Says About You:
              </span>
              <p className="text-xs text-zinc-800 font-serif leading-relaxed italic">
                “This worry is living proof that you care deeply about doing good and protecting what matters to you.”
              </p>
            </div>

            {page.cognitiveRelease?.reassuranceText && (
              <div>
                <span className="text-xs font-serif italic text-zinc-400 block mb-1">
                  A Positive Note to Carry Forward:
                </span>
                <p className="text-xs text-zinc-800 font-serif leading-relaxed italic">
                  “{page.cognitiveRelease.reassuranceText}”
                </p>
              </div>
            )}

            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full">
                <Check className="w-3 h-3 text-zinc-500" />
                <span>Reflection complete · Light heart</span>
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Export Bar */}
      <div className="p-4 border-t border-zinc-100 bg-[#faf9f6] flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-full text-xs transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-zinc-900" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-500" />
              <span>Copy</span>
            </>
          )}
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-full text-xs transition-colors cursor-pointer"
          title="Download as Markdown"
        >
          <Download className="w-3.5 h-3.5 text-zinc-500" />
          <span>Save</span>
        </button>
      </div>
    </aside>
  );
};
