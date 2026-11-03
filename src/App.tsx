import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  ArrowRight,
} from 'lucide-react';
import { DiaryPage, INITIAL_DIARY_PAGES } from './types/worryTree';
import { WorryTreeCanvas } from './components/WorryTreeCanvas';
import { PastEntriesModal } from './components/PastEntriesModal';
import { PostcardExportModal } from './components/PostcardExportModal';
import { PanicSomaticOverlay } from './components/overlays/PanicSomaticOverlay';
import { ClinicalGuideModal } from './components/overlays/ClinicalGuideModal';

const STORAGE_KEY = 'decenter_worry_diary_pages_v6';

export default function App() {
  const [pages, setPages] = useState<DiaryPage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item) => item && typeof item === 'object' && typeof item.id === 'string'
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load diary pages from local storage:', e);
    }
    return INITIAL_DIARY_PAGES;
  });

  const [activePageId, setActivePageId] = useState<string>(() => {
    return pages[0]?.id || '';
  });

  const [showQuickCalm, setShowQuickCalm] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showPastEntriesModal, setShowPastEntriesModal] = useState(false);
  const [exportPreviewPage, setExportPreviewPage] = useState<DiaryPage | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) || pages[0] || null;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    } catch (e) {
      console.warn('Failed to save to local storage:', e);
    }
  }, [pages]);

  useEffect(() => {
    if (!activePage) return;
    const timer = setInterval(() => {
      setPages((prevPages) =>
        prevPages.map((p) => {
          if (p.id === activePage.id) {
            return {
              ...p,
              sessionDurationMinutes: (p.sessionDurationMinutes || 0) + 1,
            };
          }
          return p;
        })
      );
    }, 60000);
    return () => clearInterval(timer);
  }, [activePage?.id]);

  const handleUpdateActivePage = (updated: DiaryPage | ((prev: DiaryPage) => DiaryPage)) => {
    setPages((prev) => {
      let targetId = activePageId;
      if (!prev.some((p) => p.id === targetId) && prev.length > 0) {
        targetId = prev[0].id;
        setActivePageId(targetId);
      }
      return prev.map((p) => {
        if (p.id === targetId) {
          const next = typeof updated === 'function' ? updated(p) : updated;
          if (next.id && next.id !== targetId) {
            setActivePageId(next.id);
          }
          return next;
        }
        return p;
      });
    });
  };

  const handleCreateNewPage = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const newPage: DiaryPage = {
      id: `page-${Date.now()}`,
      title: 'Untitled Reflection',
      date: dateStr,
      category: 'General',
      sessionDurationMinutes: 1,
      rootWorry: '',
      triggerContext: '',
      situationEvent: '',
      mindStory: '',
      canAct: null,
      canActOnWorry: null,
      decisionNeeded: null,
      activePathway: null,
      makeDecision: {
        pluses: [],
        minuses: [],
      },
      controlTiming: null,
      branches: [],
      factsCard: {
        text: '',
        confirmed: false,
      },
      thoughtReframe: {
        text: '',
        nature: 'unselected',
      },
      controlDials: [],
      actionPlan: {
        ifClause: '',
        thenClause: '',
        untilClause: '',
      },
      actionTrio: {
        what: '',
        when: '',
        how: '',
        completed: false,
      },
      actionTiming: null,
      anchorThought: '',
      letWorryGoSealed: false,
      worryWindow: {
        isSet: false,
        durationMinutes: 15,
      },
    };

    setPages((prev) => [newPage, ...prev]);
    setActivePageId(newPage.id);
  };

  // Allow deleting any page, including the very last one
  const handleDeletePage = (pageId: string) => {
    const remaining = pages.filter((p) => p.id !== pageId);
    setPages(remaining);
    if (remaining.length === 0) {
      setActivePageId('');
    } else if (activePageId === pageId) {
      setActivePageId(remaining[0].id);
    }
  };

  const [isHeartHovered, setIsHeartHovered] = useState(false);
  const [heartClickCount, setHeartClickCount] = useState(0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#faf9f6] text-zinc-900 font-serif overflow-hidden selection:bg-zinc-200">
      {/* Editorial Ink-Line Navigation Bar (3-Zone Top Bar Contract) */}
      <header className="h-14 px-8 bg-[#faf9f6]/95 backdrop-blur-xs border-b border-zinc-200/40 flex items-center justify-between gap-6 select-none z-20 shrink-0">
        {/* Zone 1: Brand Wordmark with Unspooling Ink Loop */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
          }}
          className="group inline-flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span className="font-serif italic text-[19px] tracking-tight text-zinc-900">
            untangle.
          </span>
          <svg
            width="64"
            height="20"
            viewBox="0 0 64 20"
            fill="none"
            className="overflow-visible opacity-85 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          >
            <motion.path
              d="M 2 13 C 14 13, 24 5, 19 3 C 14 1, 13 15, 27 14 C 40 13, 50 11, 62 12"
              stroke="#18181b"
              strokeWidth="1.4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
        </a>

        {/* Zone 2: Quiet Literary Navigation Links Connected by Hand-Drawn Ink Strokes */}
        <nav className="flex items-center gap-4 text-[13.5px] font-serif italic text-zinc-500 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowPastEntriesModal(true)}
            className="group relative py-1 text-zinc-600 hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>past lines ({pages.length})</span>
            <span className="absolute left-0 right-0 -bottom-0.5 h-[1px] bg-zinc-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
          </button>

          <svg width="20" height="10" viewBox="0 0 22 10" fill="none" className="text-zinc-300 shrink-0" aria-hidden="true">
            <path d="M 2 5 C 8 3, 14 7, 20 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>

          <button
            onClick={() => setShowQuickCalm(true)}
            className="group relative py-1 text-zinc-600 hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>a quiet pause</span>
            <span className="absolute left-0 right-0 -bottom-0.5 h-[1px] bg-zinc-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
          </button>

          <svg width="20" height="10" viewBox="0 0 22 10" fill="none" className="text-zinc-300 shrink-0" aria-hidden="true">
            <path d="M 2 5 C 8 7, 14 3, 20 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>

          <button
            onClick={() => setShowGuideModal(true)}
            className="group relative py-1 text-zinc-600 hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>how it works</span>
            <span className="absolute left-0 right-0 -bottom-0.5 h-[1px] bg-zinc-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
          </button>
        </nav>

        {/* Zone 3: Single Primary Action with Hand-Drawn Ink Underline */}
        <button
          onClick={handleCreateNewPage}
          className="group relative inline-flex flex-col items-end py-1 text-[13.5px] font-serif italic text-zinc-900 hover:text-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 stroke-[1.75] transition-transform duration-200 group-hover:rotate-90" />
            <span>begin a new line</span>
          </span>
          <svg
            width="108"
            height="6"
            viewBox="0 0 108 6"
            fill="none"
            className="mt-0.5 overflow-visible"
            aria-hidden="true"
          >
            <path
              d="M 2 3.5 C 32 1.5, 72 5, 106 2.5"
              stroke="#18181b"
              strokeWidth="1.25"
              strokeLinecap="round"
              className="opacity-70 group-hover:opacity-100 transition-opacity duration-200"
            />
          </svg>
        </button>
      </header>

      {/* 100% Full-Width Horizontal Canvas or Animated Empty State */}
      <main className="flex-1 w-full relative overflow-hidden bg-[#faf9f6]">
        {activePage ? (
          <WorryTreeCanvas
            key={activePage.id}
            page={activePage}
            onUpdatePage={handleUpdateActivePage}
            onNewPage={handleCreateNewPage}
            onOpenExportPreview={() => setExportPreviewPage(activePage)}
          />
        ) : (
          /* Full-Canvas Empty State: Animated Horizontal Cursive Line Through About Creating a Worry */
          <div className="w-full h-full flex items-center justify-center px-8 select-none">
            <div className="w-full max-w-4xl flex items-center justify-between">
              {/* Left Flowing Animated Cursive Line with Loop */}
              <div className="flex-1 flex items-center">
                <svg
                  width="100%"
                  height="90"
                  viewBox="0 0 280 90"
                  preserveAspectRatio="none"
                  fill="none"
                  className="overflow-visible"
                >
                  <motion.path
                    d="M 0 48 C 65 48, 115 32, 155 20 C 175 14, 182 4, 166 4 C 148 4, 144 38, 174 46 C 210 56, 245 40, 280 46"
                    stroke="#18181b"
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
              </div>

              {/* Center Prompt Nestled in the Break of the Line */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.45 }}
                className="w-[310px] shrink-0 px-6 text-center"
              >
                <p className="text-[15px] font-serif text-zinc-900 leading-snug">
                  “There are no worries resting here.”
                </p>
                <p className="text-[12.5px] font-serif italic text-zinc-500 mt-1 leading-relaxed">
                  Whenever a thought begins to occupy your mind, draw a new line to untangle it gently.
                </p>
                <button
                  onClick={handleCreateNewPage}
                  className="group mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-serif italic text-zinc-900 hover:text-black underline underline-offset-4 cursor-pointer"
                >
                  <span>Begin a new worry line</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.div>

              {/* Right Flowing Animated Cursive Line */}
              <div className="flex-1 flex items-center">
                <svg
                  width="100%"
                  height="90"
                  viewBox="0 0 260 90"
                  preserveAspectRatio="none"
                  fill="none"
                  className="overflow-visible"
                >
                  <motion.path
                    d="M 0 46 C 55 34, 115 58, 175 42 C 210 34, 235 46, 260 44"
                    stroke="#18181b"
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.15, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Editorial Bottom-Center Signature with Interactive Continuous Ink-Line Heart */}
      <footer className="w-full h-11 px-8 bg-[#faf9f6]/95 flex items-center justify-center select-none z-20 shrink-0">
        <div
          onMouseEnter={() => setIsHeartHovered(true)}
          onMouseLeave={() => setIsHeartHovered(false)}
          onClick={() => setHeartClickCount((c) => c + 1)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setHeartClickCount((c) => c + 1);
            }
          }}
          className="group relative inline-flex items-center justify-center gap-2 py-1 px-4 text-[13px] font-serif italic text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <span className="tracking-wide leading-none transition-colors duration-300">
            crafted gently with
          </span>

          {/* Continuous Single-Stroke Ink Line that Loops into a Heart */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg
              width="64"
              height="24"
              viewBox="0 0 68 26"
              fill="none"
              className="overflow-visible block"
              aria-hidden="true"
            >
              {/* Soft warm blush fill inside the heart loop on hover */}
              <motion.path
                d="M 34 21.5 C 24 16, 19.5 9, 24 4.8 C 27.8 1.5, 33 4.5, 34 9.5 C 35 4.5, 40.2 1.5, 44 4.8 C 48.5 9, 44 16, 34 21.5 Z"
                fill="#ffe4e6"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: isHeartHovered ? 0.85 : 0,
                }}
                transition={{ duration: 0.3 }}
              />

              {/* Faint guide path so the line never disappears completely while re-drawing */}
              <path
                d="M 2 15.5 C 14 15.5, 24 21, 34 21.5 C 24 16, 19.5 9, 24 4.8 C 27.8 1.5, 33 4.5, 34 9.5 C 35 4.5, 40.2 1.5, 44 4.8 C 48.5 9, 44 16, 34 21.5 C 44 21, 54 15.5, 66 15.5"
                stroke="#e4e4e7"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Primary continuous ink stroke that unspools into the heart */}
              <motion.path
                key={isHeartHovered ? `hover-${heartClickCount}` : 'rest'}
                d="M 2 15.5 C 14 15.5, 24 21, 34 21.5 C 24 16, 19.5 9, 24 4.8 C 27.8 1.5, 33 4.5, 34 9.5 C 35 4.5, 40.2 1.5, 44 4.8 C 48.5 9, 44 16, 34 21.5 C 44 21, 54 15.5, 66 15.5"
                stroke={isHeartHovered ? '#be123c' : '#18181b'}
                strokeWidth={isHeartHovered ? '1.65' : '1.4'}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: isHeartHovered ? 0.85 : 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </svg>
          </div>

          <span className="relative inline-flex items-center leading-none">
            <span className="text-zinc-700 group-hover:text-zinc-950 transition-colors">
              by <span className="not-italic font-medium text-zinc-900">Tanya Singh</span>
            </span>
            {/* Hand-drawn signature underline flourish that sketches in on hover */}
            <svg
              width="98"
              height="6"
              viewBox="0 0 98 6"
              fill="none"
              className="absolute left-0 -bottom-2 overflow-visible pointer-events-none"
              aria-hidden="true"
            >
              <motion.path
                d="M 2 4 C 28 1.5, 64 5, 96 2"
                stroke={isHeartHovered ? '#be123c' : '#71717a'}
                strokeWidth="1.15"
                strokeLinecap="round"
                initial={{ pathLength: 0.35, opacity: 0.35 }}
                animate={{
                  pathLength: isHeartHovered ? 1 : 0.35,
                  opacity: isHeartHovered ? 0.95 : 0.35,
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </span>
        </div>
      </footer>

      {/* Past Entries Modal */}
      <PastEntriesModal
        isOpen={showPastEntriesModal}
        onClose={() => setShowPastEntriesModal(false)}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onNewPage={handleCreateNewPage}
        onDeletePage={handleDeletePage}
        onPreviewExportPage={(p) => {
          setShowPastEntriesModal(false);
          setExportPreviewPage(p);
        }}
      />

      {/* Postcard Preview & PNG Export Modal */}
      <PostcardExportModal
        isOpen={Boolean(exportPreviewPage)}
        onClose={() => setExportPreviewPage(null)}
        page={exportPreviewPage ? (pages.find((p) => p.id === exportPreviewPage.id) || exportPreviewPage) : null}
      />

      {/* Somatic Quick Calm Overlay */}
      <PanicSomaticOverlay
        isOpen={showQuickCalm}
        onClose={() => setShowQuickCalm(false)}
      />

      {/* Clinical Guide Modal */}
      <ClinicalGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
}
