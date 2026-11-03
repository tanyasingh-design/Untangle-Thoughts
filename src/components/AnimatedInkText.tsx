import React, { useState, useEffect, useRef } from 'react';

interface AnimatedInkTextProps {
  text: string;
  speed?: number; // ms per character
  delay?: number; // ms initial delay
  className?: string;
  as?: 'span' | 'p' | 'h3' | 'div' | 'h4';
  showCursor?: boolean;
  onComplete?: () => void;
}

/**
 * AnimatedInkText:
 * Simulates calm hand-drawn ink writing.
 * - Guarantees the complete string is written character by character without cutting off
 * - Fires onComplete strictly after all characters are rendered
 * - Does not flicker or blink on parent re-renders
 */
export const AnimatedInkText: React.FC<AnimatedInkTextProps> = ({
  text,
  speed = 36,
  delay = 120,
  className = '',
  as: Component = 'span',
  showCursor = true,
  onComplete,
}) => {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  // Keep onComplete callback fresh without triggering effect restart
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setDisplayedLength(0);
    setIsTyping(true);

    let current = 0;
    let timer: NodeJS.Timeout | null = null;
    let interval: NodeJS.Timeout | null = null;

    timer = setTimeout(() => {
      interval = setInterval(() => {
        current += 1;
        setDisplayedLength(current);

        if (current >= text.length) {
          if (interval) clearInterval(interval);
          setIsTyping(false);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }
      }, speed);
    }, delay);

    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, delay]);

  const displayedText = text.slice(0, displayedLength);

  return (
    <Component className={className}>
      <span>{displayedText}</span>
      {isTyping && showCursor && (
        <span 
          aria-hidden="true" 
          className="inline-block w-[2.5px] h-[1.1em] bg-stone-900 ml-1 align-baseline animate-pulse transition-opacity" 
        />
      )}
    </Component>
  );
};
