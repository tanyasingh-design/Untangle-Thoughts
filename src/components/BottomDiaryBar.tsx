import React from 'react';
import { Plus, BookOpen, ChevronRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface BottomDiaryBarProps {
  pages: DiaryPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  isPlanOpen: boolean;
  onTogglePlan: () => void;
}

export const BottomDiaryBar: React.FC<BottomDiaryBarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onNewPage,
  isPlanOpen,
  onTogglePlan,
}) => {
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const answeredCount = activePage 
    ? activePage.branches.filter((b) => b.userAnswer.trim().length > 0).length 
    : 0;

  return (
    <div className="h-14 bg-[#f6f3ed] border-t border-[#e6e1d7] px-4 flex items-center justify-between z-20 select-none shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
      {/* Left: New Page & Diary Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto py-1 max-w-[65%] no-scrollbar">
        {/* + New page button */}
        <button
          onClick={onNewPage}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New page</span>
        </button>

        <div className="h-5 w-px bg-stone-300 flex-shrink-0" />

        {/* Diary Page tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {pages.map((p) => {
            const isActive = p.id === activePageId;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPage(p.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs transition-all flex flex-col text-left border ${
                  isActive
                    ? 'bg-white border-stone-300 text-stone-900 shadow-xs font-medium'
                    : 'bg-stone-200/50 hover:bg-stone-200 border-transparent text-stone-600 hover:text-stone-900'
                }`}
              >
                <span className="truncate max-w-[130px] font-sans">
                  {p.title || 'Untitled Page'}
                </span>
                <span className="text-[10px] text-stone-400">
                  {p.date} · {p.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Status text & Toggle Plan Panel */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1 text-[11px] text-stone-500 font-serif italic">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-0.5 inline" />
          <span>
            {answeredCount} {answeredCount === 1 ? 'question' : 'questions'} answered. Confirm the facts card in the plan panel.
          </span>
        </div>

        <button
          onClick={onTogglePlan}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isPlanOpen
              ? 'bg-purple-100 text-purple-900 border-purple-300'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
          }`}
        >
          <span>Plan</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isPlanOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
