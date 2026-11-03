import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Target, 
  RotateCcw,
  CheckCircle2, 
  Hand,
  MousePointer,
  Sparkles,
  Layout,
  Layers
} from 'lucide-react';
import { FramingSession } from '../types/metacognitive';
import { Step1WhatHappened } from './nodes/Step1WhatHappened';
import { Step2ThoughtCheck } from './nodes/Step2ThoughtCheck';
import { Step3ActionSplit } from './nodes/Step3ActionSplit';
import { Step4ActionPlan } from './nodes/Step4ActionPlan';

interface MindMapCanvasProps {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  isAnalyzing: boolean;
  onTriggerAiUnpack: () => void;
  onRestartNewSession: () => void;
  onSetGlobalPostponement: (timeString: string | null) => void;
  activeNodeId: number;
  onSetActiveNode: (nodeId: number) => void;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  session,
  onUpdateSession,
  isAnalyzing,
  onTriggerAiUnpack,
  onRestartNewSession,
  onSetGlobalPostponement,
  activeNodeId,
  onSetActiveNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // View presentation mode: 'canvas' (free pan/zoom) vs 'focus' (clean stationary step cards)
  const [viewStyle, setViewStyle] = useState<'canvas' | 'focus'>('canvas');

  // Pan & Zoom state (stored in ref for smooth wheel callbacks without stale closures)
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 100, y: 80 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<boolean>(false); // Hand tool toggle

  // Refs to avoid stale closures in event listeners
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const isSpacePressedRef = useRef(false);

  // Max unlocked step
  const maxUnlockedStep = Math.max(session.currentStep || 1, ...(session.completedSteps || [1]));

  // Node positions on the canvas plane
  const nodeLayout = {
    1: { x: 80, y: 80, width: 500 },
    2: { x: 680, y: 80, width: 500 },
    3: { x: 1280, y: 80, width: 580 },
    4: { x: 1960, y: 80, width: 580 },
  };

  // Center on a specific node smoothly without jumping
  const centerNode = useCallback((stepNumber: number, targetZoom?: number) => {
    onSetActiveNode(stepNumber);
    const target = nodeLayout[stepNumber as 1 | 2 | 3 | 4];
    if (target && containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const z = targetZoom ?? zoomRef.current;
      const targetX = cw / 2 - (target.x + target.width / 2) * z;
      const targetY = ch / 2 - 220 * z;
      setPan({ x: targetX, y: Math.max(30, targetY) });
      if (targetZoom) setZoom(targetZoom);
    }
  }, [onSetActiveNode]);

  // Reset view to fit all currently unlocked nodes
  const fitUnlockedView = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const lastNode = nodeLayout[Math.min(maxUnlockedStep, 4) as 1 | 2 | 3 | 4];
    const totalWidth = lastNode.x + lastNode.width - 80 + 100;
    const neededZoom = Math.min(1.0, Math.max(0.45, (cw - 120) / totalWidth));

    setZoom(neededZoom);
    setPan({ x: 50, y: 80 });
  }, [maxUnlockedStep]);

  // Keyboard Spacebar listener for temporary Hand Pan tool (like Figma/Photoshop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        isSpacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Gold-standard Zoom-to-Pointer and Trackpad Pan listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Strictly prevent browser page zoom or page scrolling
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Check if this is a pinch-to-zoom gesture or Ctrl + wheel
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom / Ctrl-wheel: Zoom centered on the cursor
        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;

        // Calculate world coordinates under cursor before zoom
        const worldX = (mouseX - currentPan.x) / currentZoom;
        const worldY = (mouseY - currentPan.y) / currentZoom;

        const factor = Math.exp(-e.deltaY * 0.005);
        const nextZoom = Math.min(1.6, Math.max(0.4, currentZoom * factor));

        // Calculate new pan so world coordinates remain at cursor
        const nextPanX = mouseX - worldX * nextZoom;
        const nextPanY = mouseY - worldY * nextZoom;

        setZoom(nextZoom);
        setPan({ x: nextPanX, y: nextPanY });
      } else {
        // Two-finger trackpad drag or regular scroll wheel:
        // If Shift is pressed or deltaX is present, treat as 2D Pan.
        // Also if standard mouse wheel, provide gentle smooth cursor zoom.
        if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 50) {
          // Standard mouse wheel: smooth zoom to pointer
          const currentZoom = zoomRef.current;
          const currentPan = panRef.current;
          const worldX = (mouseX - currentPan.x) / currentZoom;
          const worldY = (mouseY - currentPan.y) / currentZoom;

          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          const nextZoom = Math.min(1.6, Math.max(0.4, currentZoom * factor));

          const nextPanX = mouseX - worldX * nextZoom;
          const nextPanY = mouseY - worldY * nextZoom;

          setZoom(nextZoom);
          setPan({ x: nextPanX, y: nextPanY });
        } else {
          // Subtle trackpad pan
          setPan((prev) => ({
            x: prev.x - e.deltaX * 1.2,
            y: prev.y - e.deltaY * 1.2,
          }));
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Global window pointer drag tracking to prevent pointer locking/stuck drag
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;

    // Do not initiate canvas drag if interacting with form controls or buttons
    const isControl = target.closest('input') ||
      target.closest('textarea') ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('.interactive-card');

    if (isControl && !isSpacePressedRef.current && !dragMode) {
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.startPanX + dx,
        y: dragStartRef.current.startPanY + dy,
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Center node initially once on mount
  useEffect(() => {
    centerNode(activeNodeId);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-canvas-grid">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 p-1.5 bg-white/95 backdrop-blur-xs border border-zinc-300 rounded-2xl shadow-sm">
        {/* View Mode Toggle: Interactive Canvas vs Stationary Focus Card */}
        <div className="flex items-center p-0.5 bg-zinc-100 rounded-xl border border-zinc-200 text-xs">
          <button
            onClick={() => setViewStyle('canvas')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              viewStyle === 'canvas'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-black'
            }`}
            title="Interactive Connected Mind Map"
          >
            <Layers size={13} />
            <span>Mind Map</span>
          </button>
          <button
            onClick={() => setViewStyle('focus')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              viewStyle === 'focus'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-black'
            }`}
            title="Clean, stationary step-by-step card"
          >
            <Layout size={13} />
            <span>Focus Card</span>
          </button>
        </div>

        {viewStyle === 'canvas' && (
          <>
            <div className="w-[1px] h-4 bg-zinc-200" />

            {/* Hand tool toggle */}
            <button
              onClick={() => setDragMode(!dragMode)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                dragMode ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-700'
              }`}
              title={dragMode ? 'Hand pan active (drag anywhere)' : 'Click to toggle Hand pan mode'}
            >
              <Hand size={15} />
            </button>

            {/* Zoom Controls */}
            <button
              onClick={() => {
                const nextZ = Math.min(1.6, zoomRef.current + 0.15);
                setZoom(nextZ);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>

            <button
              onClick={() => {
                const nextZ = Math.max(0.4, zoomRef.current - 0.15);
                setZoom(nextZ);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>

            <span className="font-mono text-xs font-bold text-zinc-600 px-1 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>

            {/* Reset / Center Active Step */}
            <button
              onClick={() => centerNode(activeNodeId, 0.95)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold blackout-button cursor-pointer"
              title="Center Active Step in Screen"
            >
              <Target size={13} />
              <span>Center Step {activeNodeId}</span>
            </button>
          </>
        )}
      </div>

      {/* Top Left: Step Navigation Pills */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-xs border border-zinc-300 rounded-2xl shadow-sm">
        <span className="text-[11px] font-bold text-zinc-400 uppercase px-1">
          Steps:
        </span>
        {[
          { id: 1, label: '1. What happened' },
          { id: 2, label: '2. Check thought' },
          { id: 3, label: '3. What you can do' },
          { id: 4, label: '4. Action plan' },
        ].map((s) => {
          const isUnlocked = s.id <= maxUnlockedStep;
          const isCurrent = s.id === activeNodeId;
          const isDone = session.completedSteps?.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => {
                if (isUnlocked) {
                  onSetActiveNode(s.id);
                  if (viewStyle === 'canvas') centerNode(s.id);
                }
              }}
              disabled={!isUnlocked}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                isCurrent
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : isUnlocked
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                  : 'opacity-40 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isDone && <CheckCircle2 size={12} className={isCurrent ? 'text-white' : 'text-zinc-600'} />}
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW MODE 1: STATIONARY FOCUS CARD (Zero panning/zooming hurdles) */}
      {viewStyle === 'focus' ? (
        <div className="flex-1 w-full h-full overflow-y-auto flex items-center justify-center p-6">
          <div className="max-w-xl w-full my-auto animate-fadeIn">
            {activeNodeId === 1 && (
              <Step1WhatHappened
                session={session}
                onUpdateSession={onUpdateSession}
                onCompleteStep={() => {
                  const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 1]));
                  onUpdateSession({
                    currentStep: 2,
                    completedSteps: nextCompleted,
                  });
                  onSetActiveNode(2);
                }}
                isAnalyzing={isAnalyzing}
                onTriggerAiUnpack={onTriggerAiUnpack}
              />
            )}
            {activeNodeId === 2 && (
              <Step2ThoughtCheck
                session={session}
                onUpdateSession={onUpdateSession}
                onCompleteStep={() => {
                  const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 2]));
                  onUpdateSession({
                    currentStep: 3,
                    completedSteps: nextCompleted,
                  });
                  onSetActiveNode(3);
                }}
                onGoBack={() => onSetActiveNode(1)}
              />
            )}
            {activeNodeId === 3 && (
              <Step3ActionSplit
                session={session}
                onUpdateSession={onUpdateSession}
                onCompleteStep={() => {
                  const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 3]));
                  onUpdateSession({
                    currentStep: 4,
                    completedSteps: nextCompleted,
                  });
                  onSetActiveNode(4);
                }}
                onGoBack={() => onSetActiveNode(2)}
              />
            )}
            {activeNodeId === 4 && (
              <Step4ActionPlan
                session={session}
                onUpdateSession={onUpdateSession}
                onGoBack={() => onSetActiveNode(3)}
                onRestartNewSession={onRestartNewSession}
                onSetGlobalPostponement={onSetGlobalPostponement}
              />
            )}
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: INTERACTIVE CONNECTED MIND MAP (Smooth Zoom-to-Pointer & Pan) */
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          className={`flex-1 w-full h-full overflow-hidden select-none relative ${
            dragMode || isDragging ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          }`}
        >
          {/* Canvas plane */}
          <div
            className="absolute origin-top-left transition-transform duration-75 ease-out will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: '2800px',
              height: '1400px',
            }}
          >
            {/* SVG Connecting Branches */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width="2800"
              height="1400"
              style={{ zIndex: 0 }}
            >
              {/* Branch 1 to 2 */}
              {maxUnlockedStep >= 2 && (
                <g className="animate-fadeIn">
                  <path
                    d={`M ${nodeLayout[1].x + nodeLayout[1].width} 240 C ${
                      nodeLayout[1].x + nodeLayout[1].width + 60
                    } 240, ${nodeLayout[2].x - 60} 240, ${nodeLayout[2].x} 240`}
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />
                  <circle cx={nodeLayout[2].x} cy={240} r="5" fill="#18181b" />
                </g>
              )}

              {/* Branch 2 to 3 */}
              {maxUnlockedStep >= 3 && (
                <g className="animate-fadeIn">
                  <path
                    d={`M ${nodeLayout[2].x + nodeLayout[2].width} 240 C ${
                      nodeLayout[2].x + nodeLayout[2].width + 60
                    } 240, ${nodeLayout[3].x - 60} 240, ${nodeLayout[3].x} 240`}
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />
                  <circle cx={nodeLayout[3].x} cy={240} r="5" fill="#18181b" />
                </g>
              )}

              {/* Branch 3 to 4 */}
              {maxUnlockedStep >= 4 && (
                <g className="animate-fadeIn">
                  <path
                    d={`M ${nodeLayout[3].x + nodeLayout[3].width} 240 C ${
                      nodeLayout[3].x + nodeLayout[3].width + 60
                    } 240, ${nodeLayout[4].x - 60} 240, ${nodeLayout[4].x} 240`}
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />
                  <circle cx={nodeLayout[4].x} cy={240} r="5" fill="#18181b" />
                </g>
              )}
            </svg>

            {/* STEP 1 */}
            <div
              onClick={() => onSetActiveNode(1)}
              className={`absolute transition-all duration-200 ${
                activeNodeId === 1 ? 'z-10 ring-2 ring-zinc-900 rounded-2xl' : 'z-5 opacity-90 hover:opacity-100'
              }`}
              style={{
                left: `${nodeLayout[1].x}px`,
                top: `${nodeLayout[1].y}px`,
              }}
            >
              <div className="interactive-card select-text">
                <Step1WhatHappened
                  session={session}
                  onUpdateSession={onUpdateSession}
                  onCompleteStep={() => {
                    const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 1]));
                    onUpdateSession({
                      currentStep: 2,
                      completedSteps: nextCompleted,
                    });
                    centerNode(2);
                  }}
                  isAnalyzing={isAnalyzing}
                  onTriggerAiUnpack={onTriggerAiUnpack}
                />
              </div>
            </div>

            {/* STEP 2 */}
            {maxUnlockedStep >= 2 && (
              <div
                onClick={() => onSetActiveNode(2)}
                className={`absolute transition-all duration-200 animate-fadeIn ${
                  activeNodeId === 2 ? 'z-10 ring-2 ring-zinc-900 rounded-2xl' : 'z-5 opacity-90 hover:opacity-100'
                }`}
                style={{
                  left: `${nodeLayout[2].x}px`,
                  top: `${nodeLayout[2].y}px`,
                }}
              >
                <div className="interactive-card select-text">
                  <Step2ThoughtCheck
                    session={session}
                    onUpdateSession={onUpdateSession}
                    onCompleteStep={() => {
                      const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 2]));
                      onUpdateSession({
                        currentStep: 3,
                        completedSteps: nextCompleted,
                      });
                      centerNode(3);
                    }}
                    onGoBack={() => centerNode(1)}
                  />
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {maxUnlockedStep >= 3 && (
              <div
                onClick={() => onSetActiveNode(3)}
                className={`absolute transition-all duration-200 animate-fadeIn ${
                  activeNodeId === 3 ? 'z-10 ring-2 ring-zinc-900 rounded-2xl' : 'z-5 opacity-90 hover:opacity-100'
                }`}
                style={{
                  left: `${nodeLayout[3].x}px`,
                  top: `${nodeLayout[3].y}px`,
                }}
              >
                <div className="interactive-card select-text">
                  <Step3ActionSplit
                    session={session}
                    onUpdateSession={onUpdateSession}
                    onCompleteStep={() => {
                      const nextCompleted = Array.from(new Set([...(session.completedSteps || []), 3]));
                      onUpdateSession({
                        currentStep: 4,
                        completedSteps: nextCompleted,
                      });
                      centerNode(4);
                    }}
                    onGoBack={() => centerNode(2)}
                  />
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {maxUnlockedStep >= 4 && (
              <div
                onClick={() => onSetActiveNode(4)}
                className={`absolute transition-all duration-200 animate-fadeIn ${
                  activeNodeId === 4 ? 'z-10 ring-2 ring-zinc-900 rounded-2xl' : 'z-5 opacity-90 hover:opacity-100'
                }`}
                style={{
                  left: `${nodeLayout[4].x}px`,
                  top: `${nodeLayout[4].y}px`,
                }}
              >
                <div className="interactive-card select-text">
                  <Step4ActionPlan
                    session={session}
                    onUpdateSession={onUpdateSession}
                    onGoBack={() => centerNode(3)}
                    onRestartNewSession={onRestartNewSession}
                    onSetGlobalPostponement={onSetGlobalPostponement}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
