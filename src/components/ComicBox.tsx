import React, { useRef, useState, useLayoutEffect, useId } from 'react';

export interface ComicBoxProps {
  children: React.ReactNode;
  className?: string;
  fill?: 'ice' | 'white' | 'dark' | 'orange' | 'yellow';
  strokeColor?: string;
  strokeWidth?: number;
  onClick?: (e: React.MouseEvent) => void;
  seed?: number;
}

/**
 * ComicBox:
 * Faithfully mirrors the hand-drawn comic flowchart design language from the reference:
 * - Pale ice-cyan (#dcf2f8) fill paper ground (exact match to "ARE YOU BROKE?")
 * - Inked marker / dip-pen borders with organic jitter
 * - Distinct corner overshoots where the 4 line strokes cross beyond corners
 * - Signature bottom-right vertical overshoot tail
 * - SVG feTurbulence / feDisplacementMap micro-rough ink edge
 * - Secondary faint sketch trace for cartoon authenticity
 * - Zero artificial CSS drop-shadows or sterile rounded borders
 */
export const ComicBox: React.FC<ComicBoxProps> = ({
  children,
  className = '',
  fill = 'white',
  strokeColor = '#0c0b0b',
  strokeWidth = 3.6,
  onClick,
  seed = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 380, height: 180 });
  const reactId = useId();
  const filterId = `ink-bleed-${reactId.replace(/:/g, '')}`;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (width > 0 && height > 0) {
        setSize((prev) => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
      }
    };

    updateSize();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width = 0;
        let height = 0;
        if (entry.borderBoxSize && entry.borderBoxSize[0]) {
          width = Math.round(entry.borderBoxSize[0].inlineSize);
          height = Math.round(entry.borderBoxSize[0].blockSize);
        } else {
          width = el.offsetWidth;
          height = el.offsetHeight;
        }
        if (width > 0 && height > 0) {
          setSize({ width, height });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const pad = 20; // Room for overshoots without clipping
  const w = Math.max(80, size.width);
  const h = Math.max(60, size.height);
  const svgWidth = w + pad * 2;
  const svgHeight = h + pad * 2;

  // Predictable pseudo-random jitter based on seed
  const s = seed * 19 + 7;
  const j = (offset: number) => {
    const val = Math.sin(s + offset) * 1.8;
    return Number(val.toFixed(2));
  };

  // Corner overshoots: Notice in "ARE YOU BROKE?" the strokes extend 8-16px past corners
  // with a very prominent bottom-right downward tail
  const oTL = 10 + j(1);
  const oTR = 11 + j(2);
  const oBL = 9 + j(3);
  const oBR = 14 + j(4); // Distinct bottom-right overshoot tail

  // Top Line (left to right with overshoots)
  const xT1 = pad - oTL;
  const yT1 = pad + j(5);
  const xT2 = pad + w + oTR;
  const yT2 = pad + j(6);
  const cpT1x = pad + w * 0.33;
  const cpT1y = pad + j(7) * 1.6;
  const cpT2x = pad + w * 0.67;
  const cpT2y = pad + j(8) * 1.4;
  const pathTop = `M ${xT1} ${yT1} C ${cpT1x} ${cpT1y}, ${cpT2x} ${cpT2y}, ${xT2} ${yT2}`;

  // Bottom Line (left to right with overshoots)
  const xB1 = pad - oBL;
  const yB1 = pad + h + j(9);
  const xB2 = pad + w + oBR + 2;
  const yB2 = pad + h + j(10);
  const cpB1x = pad + w * 0.33;
  const cpB1y = pad + h + j(11) * 1.5;
  const cpB2x = pad + w * 0.67;
  const cpB2y = pad + h + j(12) * 1.5;
  const pathBottom = `M ${xB1} ${yB1} C ${cpB1x} ${cpB1y}, ${cpB2x} ${cpB2y}, ${xB2} ${yB2}`;

  // Left Line (top to bottom with overshoots)
  const xL1 = pad + j(13);
  const yL1 = pad - oTL;
  const xL2 = pad + j(14);
  const yL2 = pad + h + oBL;
  const cpL1x = pad + j(15) * 1.5;
  const cpL1y = pad + h * 0.33;
  const cpL2x = pad + j(16) * 1.4;
  const cpL2y = pad + h * 0.67;
  const pathLeft = `M ${xL1} ${yL1} C ${cpL1x} ${cpL1y}, ${cpL2x} ${cpL2y}, ${xL2} ${yL2}`;

  // Right Line (top to bottom with overshoots, especially downward tail at bottom right)
  const xR1 = pad + w + j(17);
  const yR1 = pad - oTR;
  const xR2 = pad + w + j(18);
  const yR2 = pad + h + oBR + 6; // Extra tail!
  const cpR1x = pad + w + j(19) * 1.4;
  const cpR1y = pad + h * 0.33;
  const cpR2x = pad + w + j(20) * 1.5;
  const cpR2y = pad + h * 0.67;
  const pathRight = `M ${xR1} ${yR1} C ${cpR1x} ${cpR1y}, ${cpR2x} ${cpR2y}, ${xR2} ${yR2}`;

  // Secondary faint sketchy trace
  const sketchTop = `M ${pad - 4} ${pad - 1.5} Q ${pad + w * 0.5} ${pad + 1.5}, ${pad + w + 5} ${pad - 1}`;
  const sketchRight = `M ${pad + w + 1.5} ${pad - 4} Q ${pad + w - 1.5} ${pad + h * 0.5}, ${pad + w + 2} ${pad + h + 6}`;

  // Fill color palette
  const fillHex = {
    ice: '#dcf2f8',     // Reference Screenshot pale ice-cyan
    white: '#ffffff',   // Paper white
    dark: '#18181b',    // Solid inked dark
    orange: '#ea582c',  // Ground orange
    yellow: '#fdf6d8',  // Aged newsprint pale yellow
  }[fill];

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`relative px-7 py-6 pointer-events-auto select-auto transition-transform ${
        fill === 'dark' ? 'text-white' : 'text-black'
      } ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Hand-Drawn Inked Frame SVG */}
      <svg
        className="absolute pointer-events-none overflow-visible"
        style={{
          left: `-${pad}px`,
          top: `-${pad}px`,
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
          zIndex: 0,
        }}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        fill="none"
      >
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* Paper Fill Polygon */}
        <polygon
          points={`
            ${pad + 1},${pad + 1} 
            ${pad + w - 1},${pad + 1} 
            ${pad + w - 1},${pad + h - 1} 
            ${pad + 1},${pad + h - 1}
          `}
          fill={fillHex}
        />

        {/* Inked Lines with Bleed & Corner Overshoots */}
        <g filter={`url(#${filterId})`}>
          <path
            d={pathTop}
            stroke={fill === 'dark' ? '#ffffff' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={pathBottom}
            stroke={fill === 'dark' ? '#ffffff' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={pathLeft}
            stroke={fill === 'dark' ? '#ffffff' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={pathRight}
            stroke={fill === 'dark' ? '#ffffff' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </g>

        {/* Secondary subtle sketchy trace for comic felt-pen texture */}
        <path
          d={sketchTop}
          stroke={fill === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d={sketchRight}
          stroke={fill === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Box Content */}
      <div className="relative z-10 w-full max-w-full break-words pointer-events-auto select-auto">
        {children}
      </div>
    </div>
  );
};
