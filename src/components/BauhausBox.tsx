import React from 'react';

interface BauhausBoxProps {
  children: React.ReactNode;
  variant?: 'white' | 'lavender' | 'tangerine' | 'blue';
  accentHeader?: {
    title?: string;
    color?: 'tangerine' | 'blue' | 'black' | 'lavender';
  };
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * BauhausBox:
 * Crisp geometric Bauhaus card with solid 2.5px black border and sharp blackout shadow.
 * Replaces organic wobbles with structural, architectural clarity.
 */
export const BauhausBox: React.FC<BauhausBoxProps> = ({
  children,
  variant = 'white',
  accentHeader,
  className = '',
  onClick,
}) => {
  const bgStyles = {
    white: 'bg-white text-black',
    lavender: 'bg-[#f7f3f5] text-black',
    tangerine: 'bg-[#d64933] text-white',
    blue: 'bg-[#92dce5] text-black',
  }[variant];

  const headerColors = {
    tangerine: 'bg-[#d64933] text-white border-b-2 border-black',
    blue: 'bg-[#92dce5] text-black border-b-2 border-black',
    black: 'bg-black text-white border-b-2 border-black',
    lavender: 'bg-[#eee5e9] text-black border-b-2 border-black',
  };

  return (
    <div
      onClick={onClick}
      className={`border-[2.5px] border-black shadow-[3.5px_3.5px_0px_#000] ${bgStyles} ${className} relative transition-all duration-150`}
    >
      {accentHeader && (
        <div className={`px-4 py-1.5 flex items-center justify-between text-xs font-bauhaus uppercase tracking-widest ${headerColors[accentHeader.color || 'black']}`}>
          <span>{accentHeader.title}</span>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-current" />
            <span className="w-1.5 h-1.5 bg-current" />
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
