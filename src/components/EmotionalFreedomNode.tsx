import React, { useEffect, useRef, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { AnimatedInkText } from './AnimatedInkText';
import { ComicBox } from './ComicBox';

interface EmotionalFreedomNodeProps {
  onAdvanceToBreathing: () => void;
  onFocus?: () => void;
}

const DEFAULT_FREEDOM_AFFIRMATION = 
  "I GIVE MYSELF PERMISSION TO RELEASE WHAT IS OUTSIDE MY CONTROL TODAY. MY PEACE OF MIND IS WORTH PROTECTING.";

/**
 * EmotionalFreedomNode:
 * Hand-drawn comic node in ice-cyan fill (#dcf2f8) matching the reference screenshots.
 * - Auto-advances to Grounding Breath once typing finishes
 * - Inked Done button with sharp hand-drawn styling
 */
export const EmotionalFreedomNode: React.FC<EmotionalFreedomNodeProps> = ({
  onAdvanceToBreathing,
  onFocus,
}) => {
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSpeechComplete = useCallback(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      onAdvanceToBreathing();
    }, 2200);
  }, [onAdvanceToBreathing]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  const handleManualAdvance = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    onAdvanceToBreathing();
  };

  return (
    <div 
      onClick={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="cursor-default select-auto w-[480px]"
    >
      <ComicBox fill="white" seed={6}>
        <div className="relative text-left" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2">
            <span className="font-comic text-xl font-bold text-black uppercase block leading-snug tracking-wide">
              I know how hard it is to sit with this feeling. Since this is outside your direct control today, overthinking will only steal peace from your present:
            </span>
          </div>

          {/* Hand-drawn quotation box */}
          <div className="py-3 px-4 my-3 bg-white/60 border-2 border-black">
            <blockquote className="font-comic text-2xl md:text-3xl font-bold text-black leading-snug tracking-wide uppercase">
              “<AnimatedInkText
                key={DEFAULT_FREEDOM_AFFIRMATION}
                text={DEFAULT_FREEDOM_AFFIRMATION}
                speed={36}
                delay={200}
                onComplete={handleSpeechComplete}
              />”
            </blockquote>
          </div>

          {/* Action button */}
          <div className="flex items-center justify-end pt-3 border-t-2 border-black mt-2">
            <button
              type="button"
              onClick={handleManualAdvance}
              className="px-5 py-2.5 bg-black text-white text-base font-comic font-bold tracking-wide hover:bg-[#1f1f1f] transition-all cursor-pointer flex items-center gap-2 active:scale-95 whitespace-nowrap shrink-0 border-2 border-black"
            >
              <span className="whitespace-nowrap uppercase">Done ✓ Take Grounding Breath</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </ComicBox>
    </div>
  );
};
