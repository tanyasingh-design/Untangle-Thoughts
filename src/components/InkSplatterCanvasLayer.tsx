import React, { useMemo } from 'react';

/**
 * InkSplatterCanvasLayer:
 * Renders subtle, organic ink-splatter and pen-flick canvas textures across
 * the sketchbook workspace. Enhances the authentic hand-drawn journal aesthetic
 * with micro-droplets, impact splatter clusters, and ink flecks.
 */
export const InkSplatterCanvasLayer: React.FC = () => {
  // Pre-calculated deterministic ink splatter points across the 2400x5200 paper canvas
  const splatters = useMemo(() => [
    // Top Margin & Title Area
    { id: 'sp-1', x: 280, y: 140, scale: 1.1, rotation: 18, type: 'burst', opacity: 0.18, color: '#000000' },
    { id: 'sp-2', x: 860, y: 95, scale: 0.8, rotation: -35, type: 'spray', opacity: 0.16, color: '#000000' },
    { id: 'sp-3', x: 1040, y: 220, scale: 1.3, rotation: 42, type: 'impact', opacity: 0.22, color: '#000000' },
    { id: 'sp-4', x: 190, y: 320, scale: 0.7, rotation: 65, type: 'flecks', opacity: 0.15, color: '#000000' },
    { id: 'sp-5', x: 890, y: 310, scale: 0.9, rotation: -12, type: 'spray', opacity: 0.14, color: '#d64933' }, // subtle burnt tangerine ink speck

    // Stem: Context & Situation Transitions
    { id: 'sp-6', x: 390, y: 480, scale: 1.0, rotation: 140, type: 'impact', opacity: 0.19, color: '#000000' },
    { id: 'sp-7', x: 840, y: 560, scale: 0.75, rotation: -20, type: 'flecks', opacity: 0.16, color: '#000000' },
    { id: 'sp-8', x: 310, y: 720, scale: 1.2, rotation: 80, type: 'burst', opacity: 0.17, color: '#000000' },
    { id: 'sp-9', x: 910, y: 790, scale: 0.85, rotation: -45, type: 'spray', opacity: 0.2, color: '#000000' },
    { id: 'sp-10', x: 420, y: 920, scale: 0.65, rotation: 15, type: 'flecks', opacity: 0.18, color: '#000000' },
    { id: 'sp-11', x: 860, y: 1010, scale: 1.15, rotation: 110, type: 'impact', opacity: 0.22, color: '#000000' },

    // Perspective Check & Agency Forks
    { id: 'sp-12', x: 340, y: 1180, scale: 0.9, rotation: -70, type: 'spray', opacity: 0.16, color: '#000000' },
    { id: 'sp-13', x: 890, y: 1260, scale: 1.05, rotation: 25, type: 'burst', opacity: 0.18, color: '#000000' },
    { id: 'sp-14', x: 260, y: 1420, scale: 0.8, rotation: 160, type: 'flecks', opacity: 0.17, color: '#000000' },
    { id: 'sp-15', x: 850, y: 1480, scale: 0.95, rotation: -15, type: 'spray', opacity: 0.15, color: '#d64933' },
    { id: 'sp-16', x: 400, y: 1640, scale: 1.25, rotation: 50, type: 'impact', opacity: 0.21, color: '#000000' },
    { id: 'sp-17', x: 880, y: 1720, scale: 0.85, rotation: -85, type: 'burst', opacity: 0.16, color: '#000000' },

    // Left NO Branch: Somatic / Grounding / Acceptance
    { id: 'sp-18', x: 120, y: 1960, scale: 1.1, rotation: 30, type: 'spray', opacity: 0.19, color: '#000000' },
    { id: 'sp-19', x: 530, y: 2080, scale: 0.7, rotation: -110, type: 'flecks', opacity: 0.15, color: '#000000' },
    { id: 'sp-20', x: 90, y: 2280, scale: 1.3, rotation: 75, type: 'impact', opacity: 0.22, color: '#000000' },
    { id: 'sp-21', x: 510, y: 2460, scale: 0.85, rotation: -25, type: 'burst', opacity: 0.17, color: '#000000' },
    { id: 'sp-22', x: 140, y: 2700, scale: 1.0, rotation: 135, type: 'spray', opacity: 0.18, color: '#000000' },
    { id: 'sp-23', x: 540, y: 2920, scale: 0.75, rotation: -60, type: 'flecks', opacity: 0.16, color: '#000000' },

    // Right YES Branch: Action Ladder (What, How, When, Scheduled)
    { id: 'sp-24', x: 670, y: 1940, scale: 0.95, rotation: 40, type: 'burst', opacity: 0.18, color: '#000000' },
    { id: 'sp-25', x: 1080, y: 2060, scale: 1.2, rotation: -70, type: 'impact', opacity: 0.2, color: '#000000' },
    { id: 'sp-26', x: 650, y: 2290, scale: 0.8, rotation: 120, type: 'spray', opacity: 0.16, color: '#000000' },
    { id: 'sp-27', x: 1090, y: 2470, scale: 1.05, rotation: -15, type: 'burst', opacity: 0.18, color: '#000000' },
    { id: 'sp-28', x: 680, y: 2710, scale: 0.7, rotation: 85, type: 'flecks', opacity: 0.15, color: '#000000' },
    { id: 'sp-29', x: 1110, y: 2950, scale: 1.25, rotation: -95, type: 'impact', opacity: 0.22, color: '#000000' },

    // Scheduled & Closure Terminal Zone
    { id: 'sp-30', x: 420, y: 3280, scale: 0.9, rotation: 15, type: 'spray', opacity: 0.18, color: '#000000' },
    { id: 'sp-31', x: 880, y: 3410, scale: 1.1, rotation: -40, type: 'burst', opacity: 0.21, color: '#000000' },
    { id: 'sp-32', x: 380, y: 3620, scale: 1.35, rotation: 105, type: 'impact', opacity: 0.23, color: '#000000' },
    { id: 'sp-33', x: 870, y: 3790, scale: 0.85, rotation: -15, type: 'flecks', opacity: 0.16, color: '#d64933' },
    { id: 'sp-34', x: 440, y: 4050, scale: 1.0, rotation: 65, type: 'burst', opacity: 0.19, color: '#000000' },
    { id: 'sp-35', x: 820, y: 4200, scale: 0.95, rotation: -120, type: 'spray', opacity: 0.17, color: '#000000' },

    // Wide Margins (Sketchbook Page Edges)
    { id: 'sp-36', x: 80, y: 650, scale: 1.4, rotation: 45, type: 'impact', opacity: 0.15, color: '#000000' },
    { id: 'sp-37', x: 1320, y: 820, scale: 1.2, rotation: -80, type: 'burst', opacity: 0.16, color: '#000000' },
    { id: 'sp-38', x: 1450, y: 1500, scale: 0.9, rotation: 115, type: 'spray', opacity: 0.14, color: '#000000' },
    { id: 'sp-39', x: 1280, y: 2200, scale: 1.3, rotation: -30, type: 'impact', opacity: 0.17, color: '#000000' },
    { id: 'sp-40', x: 1420, y: 3100, scale: 1.1, rotation: 70, type: 'burst', opacity: 0.15, color: '#000000' },
    { id: 'sp-41', x: 1350, y: 3950, scale: 0.8, rotation: -105, type: 'flecks', opacity: 0.16, color: '#000000' },
  ], []);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 select-none"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        {/* Reusable Ink Splatter Definitions */}

        {/* 1. Impact Splatter: Main irregular blot + satellite flying droplets */}
        <g id="splatter-impact">
          {/* Main irregular ink drop */}
          <path
            d="M 0 -7 C 3.5 -6.5, 6.8 -4, 7.2 -0.5 C 7.6 3.2, 5 6.8, 1.2 7.4 C -2.8 8, -6.5 5.5, -7.1 1.8 C -7.8 -2.1, -4.2 -7.5, 0 -7 Z"
            fill="currentColor"
          />
          {/* Edge bleed micro-lobes */}
          <circle cx="5.5" cy="5.5" r="2.2" fill="currentColor" />
          <circle cx="-5.8" cy="-3.8" r="1.8" fill="currentColor" />
          <circle cx="6.8" cy="-2.4" r="1.5" fill="currentColor" />
          {/* Flying satellite droplets from velocity impact */}
          <circle cx="12" cy="-9" r="1.6" fill="currentColor" />
          <circle cx="17" cy="-14" r="1.1" fill="currentColor" />
          <circle cx="21" cy="-19" r="0.7" fill="currentColor" />
          <circle cx="-11" cy="9" r="1.4" fill="currentColor" />
          <circle cx="-16" cy="14" r="0.9" fill="currentColor" />
          <circle cx="8" cy="14" r="1.2" fill="currentColor" />
        </g>

        {/* 2. Burst Splatter: Star-like flicked droplets radiating outwards */}
        <g id="splatter-burst">
          <ellipse cx="0" cy="0" rx="4.8" ry="4.2" fill="currentColor" />
          <circle cx="-2.5" cy="-2.8" r="1.8" fill="currentColor" />
          <circle cx="3.2" cy="2.5" r="1.6" fill="currentColor" />
          {/* Radiating micro-dots */}
          <circle cx="0" cy="-10" r="1.3" fill="currentColor" />
          <circle cx="-8" cy="-6" r="1.2" fill="currentColor" />
          <circle cx="-11" cy="4" r="1.5" fill="currentColor" />
          <circle cx="-5" cy="9" r="1.0" fill="currentColor" />
          <circle cx="5" cy="8" r="1.4" fill="currentColor" />
          <circle cx="10" cy="2" r="1.1" fill="currentColor" />
          <circle cx="8" cy="-7" r="0.9" fill="currentColor" />
          {/* Distant tiny flecks */}
          <circle cx="14" cy="-11" r="0.7" fill="currentColor" />
          <circle cx="-15" cy="-9" r="0.8" fill="currentColor" />
          <circle cx="-7" cy="15" r="0.6" fill="currentColor" />
        </g>

        {/* 3. Spray / Pen-Flick: Directional spray along an arc */}
        <g id="splatter-spray">
          <circle cx="-6" cy="1" r="2.8" fill="currentColor" />
          <circle cx="-2" cy="0" r="2.1" fill="currentColor" />
          <circle cx="4" cy="-1" r="1.7" fill="currentColor" />
          <circle cx="10" cy="-3" r="1.4" fill="currentColor" />
          <circle cx="16" cy="-5" r="1.1" fill="currentColor" />
          <circle cx="22" cy="-8" r="0.9" fill="currentColor" />
          <circle cx="27" cy="-11" r="0.7" fill="currentColor" />
          {/* Lateral tiny scatter */}
          <circle cx="2" cy="4" r="0.9" fill="currentColor" />
          <circle cx="8" cy="3" r="0.8" fill="currentColor" />
          <circle cx="13" cy="-8" r="0.7" fill="currentColor" />
          <circle cx="18" cy="1" r="0.6" fill="currentColor" />
        </g>

        {/* 4. Flecks: Subtle cluster of delicate micro-ink specks */}
        <g id="splatter-flecks">
          <circle cx="0" cy="0" r="1.8" fill="currentColor" />
          <circle cx="4.5" cy="-3" r="1.2" fill="currentColor" />
          <circle cx="-5" cy="2.5" r="1.4" fill="currentColor" />
          <circle cx="2" cy="5" r="0.9" fill="currentColor" />
          <circle cx="-3" cy="-4.5" r="1.0" fill="currentColor" />
          <circle cx="8" cy="2" r="0.7" fill="currentColor" />
        </g>
      </defs>

      {/* Render all splatters */}
      {splatters.map((s) => {
        const href =
          s.type === 'impact'
            ? '#splatter-impact'
            : s.type === 'burst'
            ? '#splatter-burst'
            : s.type === 'spray'
            ? '#splatter-spray'
            : '#splatter-flecks';

        return (
          <use
            key={s.id}
            href={href}
            x={s.x}
            y={s.y}
            transform={`rotate(${s.rotation} ${s.x} ${s.y}) scale(${s.scale})`}
            transform-origin={`${s.x} ${s.y}`}
            style={{
              color: s.color,
              opacity: s.opacity,
            }}
          />
        );
      })}
    </svg>
  );
};
