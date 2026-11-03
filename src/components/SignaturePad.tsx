import React, { useRef, useEffect, useState } from 'react';
import { RotateCcw, PenTool, Type, Check } from 'lucide-react';

interface SignaturePadProps {
  signatureDataUrl?: string;
  name: string;
  mode?: 'draw' | 'type';
  onChangeSignature: (dataUrl: string) => void;
  onChangeName: (name: string) => void;
  onChangeMode: (mode: 'draw' | 'type') => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  signatureDataUrl,
  name,
  mode = 'draw',
  onChangeSignature,
  onChangeName,
  onChangeMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(signatureDataUrl));

  // Initialize canvas with existing dataUrl if present
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = signatureDataUrl;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  }, [signatureDataUrl, mode]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000'; // Clean black ink signature

    isDrawingRef.current = true;
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const canvas = canvasRef.current;
    if (canvas) {
      onChangeSignature(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChangeSignature('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-lacquer text-black uppercase tracking-wider">
          Sign Off Commitment
        </label>
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-none border-2 border-black">
          <button
            type="button"
            onClick={() => onChangeMode('draw')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-none flex items-center gap-1 transition-all ${
              mode === 'draw'
                ? 'bg-black text-white font-semibold'
                : 'text-stone-600 hover:text-black'
            }`}
          >
            <PenTool className="w-2.5 h-2.5" />
            <span>Draw</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('type')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-none flex items-center gap-1 transition-all ${
              mode === 'type'
                ? 'bg-black text-white font-semibold'
                : 'text-stone-600 hover:text-black'
            }`}
          >
            <Type className="w-2.5 h-2.5" />
            <span>Type</span>
          </button>
        </div>
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <div className="bg-white border-2 border-black rounded-none overflow-hidden">
            <canvas
              ref={canvasRef}
              width={270}
              height={90}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              className="w-full h-[90px] touch-none cursor-crosshair bg-white"
            />
            {/* Signature guideline line */}
            <div className="absolute bottom-5 left-3 right-3 border-b border-stone-200 pointer-events-none" />
            <div className="absolute bottom-1 right-2 pointer-events-none text-xs text-stone-400 font-lacquer font-bold">
              sign above line
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 text-xs font-bold">
            <span className="text-stone-500 font-lacquer">
              {hasDrawn ? (
                <span className="text-black flex items-center gap-1 font-lacquer font-bold">
                  <Check className="w-3.5 h-3.5 text-black" /> Signed in ink
                </span>
              ) : (
                'Draw signature with finger or mouse'
              )}
            </span>
            <button
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1 text-stone-700 hover:text-black transition-colors py-0.5 px-1.5 rounded-none hover:bg-stone-100 font-lacquer text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Type your full name or initials..."
            className="w-full bg-white border-2 border-black rounded-none px-3 py-2 text-sm font-bold font-lacquer text-black focus:outline-none focus:bg-stone-50 placeholder:text-stone-400"
          />
          <p className="text-xs font-bold text-stone-600 mt-1 font-lacquer">
            Typed commitment acts as your digital sign-off
          </p>
        </div>
      )}
    </div>
  );
};
