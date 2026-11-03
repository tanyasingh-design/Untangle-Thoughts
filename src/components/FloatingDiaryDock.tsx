import React from 'react';
import { Plus, BookOpen, ChevronRight } from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface FloatingDiaryDockProps {
  pages: DiaryPage[];
  activePageId: string;
  onOpenPastEntries: () => void;
  onNewPage: () => void;
  isPlanOpen: boolean;
  onTogglePlan: () => void;
}

/**
 * FloatingDiaryDock:
 * Bauhaus Humanist blackout dock matching the user's inspiration:
 * - Solid black structural container with sharp shadow
 * - Bold uppercase + NEW PAGE and PAST JOURNALS with burnt-tangerine badge
 * - Crisp white rectangular PLAN OF ACTION button
 */
export const FloatingDiaryDock: React.FC<FloatingDiaryDockProps> = ({
  pages,
  activePageId,
  onOpenPastEntries,
  onNewPage,
  isPlanOpen,
  onTogglePlan,
}) => {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 bg-black border-2 border-black select-none flex-nowrap whitespace-nowrap shadow-[3px_3px_0px_#000]">
      {/* New page button */}
      <button
        onClick={onNewPage}
        className="flex items-center gap-1.5 px-3.5 py-2 font-comic font-bold text-xs uppercase tracking-wider text-white hover:bg-stone-800 transition-all cursor-pointer active:scale-95 whitespace-nowrap flex-nowrap shrink-0"
        title="Start a new worry entry"
      >
        <Plus className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="whitespace-nowrap">New page</span>
      </button>

      <div className="h-5 w-[1.5px] bg-stone-700 shrink-0" />

      {/* Past entries modal trigger */}
      <button
        onClick={onOpenPastEntries}
        className="flex items-center gap-2 px-3.5 py-2 font-comic font-bold text-xs uppercase tracking-wider text-white hover:bg-stone-800 transition-all cursor-pointer active:scale-95 whitespace-nowrap flex-nowrap shrink-0"
        title="View past journal entries"
      >
        <BookOpen className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="whitespace-nowrap">Past journals</span>
        <span className="w-5 h-5 bg-[#d64933] text-white font-comic text-[11px] flex items-center justify-center font-bold shrink-0">
          {pages.length}
        </span>
      </button>

      <div className="h-5 w-[1.5px] bg-stone-700 shrink-0" />

      {/* Plan of action button */}
      <button
        onClick={onTogglePlan}
        className={`flex items-center gap-1.5 px-4 py-2 font-comic font-bold text-xs uppercase tracking-wider border-2 border-black transition-all cursor-pointer active:scale-95 whitespace-nowrap flex-nowrap shrink-0 ${
          isPlanOpen
            ? 'bg-[#92dce5] text-black shadow-[2px_2px_0px_#000]'
            : 'bg-white hover:bg-stone-100 text-black shadow-[2px_2px_0px_#000]'
        }`}
        title="Open Plan of Action side panel"
      >
        <span className="whitespace-nowrap">Plan of action</span>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform shrink-0 ${isPlanOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
};
