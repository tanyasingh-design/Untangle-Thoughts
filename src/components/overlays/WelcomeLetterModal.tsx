import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface WelcomeLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  startUnfolded?: boolean;
}

export const WelcomeLetterModal: React.FC<WelcomeLetterModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-900/25 backdrop-blur-xs font-serif select-none"
        >
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Pure Personal Letter Sheet (No Header or Footer Bars) */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-lg max-h-[88vh] bg-[#faf9f6] border border-zinc-200/95 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Subtle Floating Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-6 p-1.5 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer z-20"
              title="Close letter"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Concise Letter Body */}
            <div className="px-7 sm:px-10 py-7 sm:py-8 overflow-y-auto flex-1 space-y-3.5 text-zinc-800">
              <p className="text-[15.5px] sm:text-[16.5px] font-serif italic text-zinc-900">
                Dear friend,
              </p>

              <p className="text-[13.5px] sm:text-[14px] font-serif leading-relaxed text-zinc-700">
                Some thoughts just refuse to leave, sitting in the back of your mind through dinner, conversations, and quiet moments. I know this feeling well. I worry about the most random things even when they don’t make sense, until a friend shared the worry tree with me and breaking them down helped more than I expected.
              </p>

              <p className="text-[13.5px] sm:text-[14px] font-serif leading-relaxed text-zinc-700">
                Worry feels like preparing, but most of the time it’s just a loop that leaves us tired and quietly steals slow mornings, quiet evenings, and laughs we half missed.
              </p>

              <p className="text-[13.5px] sm:text-[14px] font-serif leading-relaxed text-zinc-700">
                That’s why I made{' '}
                <span className="italic font-medium text-[#be123c] bg-[#ffe4e6]/75 px-1.5 py-0.5 rounded-sm">
                  untangle
                </span>
                , a quiet place to set a worry down when your mind gets loud. Write it out and look at it from a little distance. Often it’s smaller than it felt inside your head.
              </p>

              <p className="text-[13.5px] sm:text-[14px] font-serif leading-relaxed text-zinc-700">
                If you <span className="italic text-zinc-900">can</span> act on it, you don’t need a grand plan tonight, just one tiny, gentle step to quiet the alarm in your mind. And if it’s <span className="italic text-zinc-900">outside your hands</span> today, holding onto the weight won’t change tomorrow, it only steals your peace today. Letting go isn’t giving up, it’s choosing your peace.
              </p>

              <p className="text-[13.5px] sm:text-[14px] font-serif italic leading-relaxed text-zinc-800 pt-0.5">
                Be gentle with your mind today.
              </p>

              {/* Warm Sign-Off with Continuous Ink Heart */}
              <div className="pt-1.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-serif italic text-zinc-600">
                    With warmth,
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <span className="text-[15px] font-serif italic text-zinc-900 font-medium">
                      Tanya Singh
                    </span>
                    <svg
                      width="52"
                      height="20"
                      viewBox="0 0 68 26"
                      fill="none"
                      className="overflow-visible"
                    >
                      <path
                        d="M 34 21.5 C 24 16, 19.5 9, 24 4.8 C 27.8 1.5, 33 4.5, 34 9.5 C 35 4.5, 40.2 1.5, 44 4.8 C 48.5 9, 44 16, 34 21.5 Z"
                        fill="#ffe4e6"
                      />
                      <motion.path
                        d="M 2 15.5 C 14 15.5, 24 21, 34 21.5 C 24 16, 19.5 9, 24 4.8 C 27.8 1.5, 33 4.5, 34 9.5 C 35 4.5, 40.2 1.5, 44 4.8 C 48.5 9, 44 16, 34 21.5 C 44 21, 54 15.5, 66 15.5"
                        stroke="#be123c"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.0, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
