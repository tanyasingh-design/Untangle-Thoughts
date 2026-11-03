import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, ArrowRight } from 'lucide-react';
import { DiaryPage } from '../types/worryTree';

interface PastEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: DiaryPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
  onDeletePage?: (id: string) => void;
}

// Alternating organic left-side ink wave paths inspired by Reference Image 2
const LEFT_INK_WAVES = [
  'M 0 22 C 35 12, 65 14, 95 20 C 125 24, 155 22, 185 22',
  'M 0 26 C 40 20, 75 18, 92 10 C 102 4, 90 2, 86 12 C 82 22, 115 24, 185 22',
  'M 0 14 C 25 14, 35 26, 65 26 L 185 26',
  'M 0 34 C 30 22, 55 6, 75 8 C 95 10, 115 28, 185 24',
  'M 0 22 C 45 20, 85 28, 130 26 C 155 25, 170 23, 185 22',
];

export const PastEntriesModal: React.FC<PastEntriesModalProps> = ({
  isOpen,
  onClose,
  pages,
  activePageId,
  onSelectPage,
  onNewPage,
  onDeletePage,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/20 backdrop-blur-xs select-none font-serif"
        >
          {/* Backdrop click */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Minimalist Snow-White Literary Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl bg-[#faf9f6] border border-zinc-200/90 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[82vh]"
          >
            {/* Quiet Editorial Header */}
            <div className="px-7 pt-6 pb-4 flex items-center justify-between border-b border-zinc-200/50">
              <div>
                <h3 className="text-base font-serif italic text-zinc-900">
                  past lines &amp; reflections.
                </h3>
                <p className="text-xs font-serif text-zinc-400 mt-0.5">
                  Every worry you have set down on paper.
                </p>
              </div>

              <div className="flex items-center">
                <button
                  onClick={onClose}
                  className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Flowing Ink Line Rows OR Animated Empty State */}
            <div className="flex-1 overflow-y-auto py-8 space-y-6">
              {pages.length === 0 ? (
                /* Empty State with Animated Cursive Line Through About Creating a Worry */
                <div className="py-6 flex items-center justify-between">
                  {/* Left Animated Cursive Line with Loop */}
                  <div className="shrink-0 flex items-center">
                    <svg
                      width="155"
                      height="52"
                      viewBox="0 0 155 52"
                      fill="none"
                      className="overflow-visible"
                    >
                      <motion.path
                        d="M 0 28 C 35 28, 65 18, 88 12 C 100 8, 104 2, 95 2 C 84 2, 82 24, 100 30 C 120 36, 138 26, 155 28"
                        stroke="#18181b"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                  </div>

                  {/* Center Empty State Prompt Nestled in the Line */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.4 }}
                    className="flex-1 px-4 text-center"
                  >
                    <p className="text-[14.5px] font-serif text-zinc-900 leading-snug">
                      “Your paper is quiet and clear.”
                    </p>
                    <p className="text-[12px] font-serif italic text-zinc-500 mt-1 leading-relaxed">
                      Whenever a worry begins to weigh on you, draw a new line to set it gently down.
                    </p>
                    <button
                      onClick={() => {
                        onNewPage();
                        onClose();
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-[12px] font-serif italic text-zinc-900 underline underline-offset-4 hover:text-black cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>create a worry line</span>
                    </button>
                  </motion.div>

                  {/* Right Animated Tail Line */}
                  <div className="shrink-0 flex items-center">
                    <svg
                      width="115"
                      height="42"
                      viewBox="0 0 115 42"
                      fill="none"
                      className="overflow-visible"
                    >
                      <motion.path
                        d="M 0 22 C 35 16, 75 28, 115 20"
                        stroke="#18181b"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.9, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                  </div>
                </div>
              ) : (
                pages.map((p, idx) => {
                  const isActive = p.id === activePageId;
                  const displayQuote = p.rootWorry?.trim()
                    ? `“${p.rootWorry.trim()}”`
                    : `“${p.title || 'An unwritten thought'}”`;
                  const subline =
                    p.canActOnWorry === 'no'
                      ? 'Outside my hands — gently released.'
                      : p.actionTrio?.what
                      ? `Step: ${p.actionTrio.what}`
                      : 'Unfolding quietly along the line.';
                  const wavePath = LEFT_INK_WAVES[idx % LEFT_INK_WAVES.length];

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectPage(p.id);
                        onClose();
                      }}
                      className="group relative flex items-center justify-between cursor-pointer py-1 transition-opacity hover:opacity-100"
                    >
                      {/* Left Flowing Ink Line Segment */}
                      <div className="shrink-0 flex items-center">
                        <svg
                          width="165"
                          height="42"
                          viewBox="0 0 185 42"
                          fill="none"
                          className="overflow-visible"
                        >
                          <motion.path
                            d={wavePath}
                            stroke={isActive ? '#18181b' : '#71717a'}
                            strokeWidth={isActive ? '1.8' : '1.3'}
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                              duration: 0.85,
                              delay: idx * 0.08,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                        </svg>
                      </div>

                      {/* Center Quote & Italic Subline (Nestled in the break of the line) */}
                      <div className="flex-1 px-4 text-center min-w-0">
                        <p
                          className={`text-[14px] font-serif leading-snug truncate transition-colors ${
                            isActive
                              ? 'text-zinc-950 font-medium'
                              : 'text-zinc-700 group-hover:text-zinc-950'
                          }`}
                        >
                          {displayQuote}
                        </p>
                        <p className="text-[12px] font-serif italic text-zinc-500 mt-0.5 truncate">
                          {subline}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-1 text-[10.5px] font-serif italic text-zinc-400">
                          <span>{p.date}</span>
                          <span>·</span>
                          <span>{(p.category || 'general').toLowerCase()}</span>
                          {isActive && (
                            <>
                              <span>·</span>
                              <span className="text-zinc-800 underline underline-offset-2">
                                current line
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Tail Ink Segment + Always-Available Delete Button */}
                      <div className="shrink-0 flex items-center gap-1.5 pr-3">
                        {onDeletePage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePage(p.id);
                            }}
                            className="opacity-50 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all cursor-pointer"
                            title="Delete this worry line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <svg width="45" height="24" viewBox="0 0 45 24" fill="none">
                          <path
                            d="M 0 12 C 15 14, 30 10, 45 12"
                            stroke={isActive ? '#18181b' : '#71717a'}
                            strokeWidth={isActive ? '1.8' : '1.3'}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Literary Footer */}
            <div className="py-4 px-6 border-t border-zinc-200/50 text-center bg-[#faf9f6]">
              <button
                onClick={() => {
                  onNewPage();
                  onClose();
                }}
                className="group inline-flex items-center gap-1.5 text-sm font-serif italic text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                <span>begin a new line</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
