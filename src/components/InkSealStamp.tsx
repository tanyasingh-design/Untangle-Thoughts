import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, Sparkles } from 'lucide-react';

interface InkSealStampProps {
  date?: string;
  onReplay?: () => void;
  className?: string;
}

/**
 * InkSealStamp:
 * An authentic hand-drawn Japanese/artisan ink seal (Hanko / Ex Libris) with:
 * - Dynamic SVG path animation (stroke-dasharray / stroke-dashoffset transition)
 * - Concentric sketchy wobbly rings that draw themselves in real-time
 * - Organic hand-drawn ink checkmark that sketches itself onto the paper
 * - Tactile ink-stamp impact animation (scale drop with slight rotation shudder)
 * - Monochromatic ink splatter micro-droplets
 */
export const InkSealStamp: React.FC<InkSealStampProps> = ({
  date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  onReplay,
  className = '',
}) => {
  const [animKey, setAnimKey] = useState(1);
  const [isStamped, setIsStamped] = useState(false);

  useEffect(() => {
    // Trigger stamp impact after paths draw
    setIsStamped(false);
    const timer = setTimeout(() => {
      setIsStamped(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [animKey]);

  const handleReplay = () => {
    setAnimKey((k) => k + 1);
    if (onReplay) onReplay();
  };

  // Generate organic wobbly circular path
  const createWobblyCircle = (cx: number, cy: number, r: number, jitter: number) => {
    const points: string[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const j = Math.sin(i * 3.7 + animKey) * jitter;
      const x = cx + (r + j) * Math.cos(angle);
      const y = cy + (r + j) * Math.sin(angle);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  const outerCirclePath = createWobblyCircle(120, 120, 96, 2.4);
  const innerCirclePath = createWobblyCircle(120, 120, 84, 1.6);
  const dashedRingPath = createWobblyCircle(120, 120, 74, 1.2);

  // Hand-drawn checkmark stroke
  const checkmarkPath = "M 92 122 L 112 142 L 152 98";

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Stamp Container with tactile impact physics */}
      <div 
        key={animKey}
        className={`relative transition-all duration-300 ease-out flex flex-col items-center ${
          isStamped ? 'animate-stamp-impact' : 'scale-95 opacity-80'
        }`}
      >
        <svg
          viewBox="0 0 240 240"
          className="w-56 h-56 overflow-visible"
          style={{
            filter: 'drop-shadow(3px 4px 0px rgba(0,0,0,0.85))',
          }}
        >
          <defs>
            {/* Curved text path for top arch */}
            <path
              id={`seal-arch-top-${animKey}`}
              d="M 38 120 A 82 82 0 0 1 202 120"
              fill="none"
            />
            {/* Curved text path for bottom arch */}
            <path
              id={`seal-arch-bottom-${animKey}`}
              d="M 202 120 A 82 82 0 0 1 38 120"
              fill="none"
            />
          </defs>

          {/* Outer wobbly ink ring (draws in with SVG path animation) */}
          <path
            d={outerCirclePath}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="3.2"
            strokeLinecap="round"
            className="animate-seal-draw"
            style={{
              strokeDasharray: 700,
              strokeDashoffset: 700,
              animation: 'sealDraw 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          />

          {/* Secondary concentric ink stroke */}
          <path
            d={innerCirclePath}
            fill="none"
            stroke="#000000"
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{
              strokeDasharray: 600,
              strokeDashoffset: 600,
              animation: 'sealDraw 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.08s forwards',
            }}
          />

          {/* Dashed internal decorative ring */}
          <path
            d={dashedRingPath}
            fill="none"
            stroke="#000000"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            className="opacity-70"
            style={{
              animation: 'sealDraw 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards',
            }}
          />

          {/* Arching stamp top text */}
          <text className="font-lacquer font-bold text-[10px] tracking-[0.22em] fill-black uppercase select-none">
            <textPath 
              href={`#seal-arch-top-${animKey}`} 
              startOffset="50%" 
              textAnchor="middle"
            >
              ★ METAMIND COGNITIVE RELEASE ★
            </textPath>
          </text>

          {/* Arching stamp bottom text */}
          <text className="font-lacquer font-bold text-[9px] tracking-[0.2em] fill-stone-600 uppercase select-none">
            <textPath 
              href={`#seal-arch-bottom-${animKey}`} 
              startOffset="50%" 
              textAnchor="middle"
            >
              RELEASED & ANCHORED IN PRESENT
            </textPath>
          </text>

          {/* Center Seal Box */}
          <g transform="translate(68, 76)">
            {/* Center border frame */}
            <rect
              x="0"
              y="0"
              width="104"
              height="88"
              fill="#faf8f5"
              stroke="#000000"
              strokeWidth="2.4"
              className="animate-seal-draw"
              style={{
                strokeDasharray: 400,
                strokeDashoffset: 400,
                animation: 'sealDraw 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
              }}
            />

            {/* Inner dashed sub-border */}
            <rect
              x="4"
              y="4"
              width="96"
              height="80"
              fill="none"
              stroke="#000000"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="opacity-60"
            />

            {/* Center animated ink checkmark */}
            <path
              d="M 32 46 L 46 60 L 74 26"
              fill="none"
              stroke="#000000"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: 'sealDraw 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards',
              }}
            />

            {/* Stamp Core Text */}
            <text
              x="52"
              y="74"
              textAnchor="middle"
              className="font-lacquer font-bold text-[11px] tracking-wider fill-black select-none"
            >
              WORRY RELEASED
            </text>
          </g>

          {/* Micro Ink Splatter Droplets (Hand-Drawn Authenticity) */}
          <circle cx="28" cy="46" r="1.4" fill="#000000" className="opacity-60" />
          <circle cx="214" cy="168" r="1.2" fill="#000000" className="opacity-50" />
          <circle cx="198" cy="52" r="1.5" fill="#000000" className="opacity-60" />
          <circle cx="44" cy="186" r="1.3" fill="#000000" className="opacity-50" />
          <path d="M 24 122 Q 22 120 20 124" stroke="#000000" strokeWidth="1" fill="none" className="opacity-40" />
        </svg>

        {/* Date Stamp Tag */}
        <div className="text-center mt-1">
          <span className="font-lacquer text-xs font-bold tracking-widest text-stone-500 uppercase">
            SEALED ON {date}
          </span>
        </div>
      </div>

      {/* Interactive Replay Stamp Button */}
      <div className="mt-3">
        <button
          type="button"
          onClick={handleReplay}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold font-lacquer text-stone-500 hover:text-black border border-stone-300 hover:border-black bg-white hover:bg-stone-50 transition-all shadow-[1px_1px_0px_#000] cursor-pointer"
          title="Replay ink stamp transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Re-stamp Seal</span>
        </button>
      </div>
    </div>
  );
};
