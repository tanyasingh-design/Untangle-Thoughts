import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  ArrowRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  MoreHorizontal,
  Hand,
  CheckCheck,
  Plus,
  Trash2,
  BookOpen,
  Split,
  Tag
} from 'lucide-react';
import { FramingSession, SubWorryBranch } from '../types/metacognitive';

interface WorkflowCanvasProps {
  session: FramingSession;
  onUpdateSession: (updates: Partial<FramingSession>) => void;
  onRestartNewSession: () => void;
  onSetGlobalPostponement: (timeString: string | null) => void;
}

const TOPIC_CHIPS = [
  'Work',
  'People',
  'Deadlines',
  'Health',
  'Money',
  'Uncertainty',
  'Family',
  'Self-Doubt'
];

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  session,
  onUpdateSession,
  onRestartNewSession,
  onSetGlobalPostponement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 100 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [postponeTime, setPostponeTime] = useState<string>('17:00');
  const [isPostponed, setIsPostponed] = useState<boolean>(!!session.postponementTimestamp);

  // New sub-worry quick input
  const [newSubWorryText, setNewSubWorryText] = useState('');

  // Active Sub-worries list (ensuring at least 1 default)
  const subWorries: SubWorryBranch[] = session.subWorries && session.subWorries.length > 0
    ? session.subWorries
    : [
        {
          id: 'sub-1',
          question: session.rawWorryText || 'Will the project milestone pass review?',
          tags: session.selectedChips || ['Work'],
          thoughtNature: 'transient_event',
          canAct: true,
          actionText: 'Review benchmark numbers with David',
          whenText: 'Today at 2:00 PM',
          completed: true,
        }
      ];

  const selectedChips = session.selectedChips || ['Work'];

  // Track zoom & pan refs for event listeners
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

  // Calculate dynamic vertical positions for branches
  const JOURNAL_X = 60;
  const JOURNAL_Y = 120;
  const JOURNAL_W = 340;

  const BRANCH_X_START = 480;
  const BRANCH_SPACING_Y = 240;

  // Zoom-to-pointer listener (isolated, no page zoom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZ = zoomRef.current;
      const currentP = panRef.current;

      const worldX = (mouseX - currentP.x) / currentZ;
      const worldY = (mouseY - currentP.y) / currentZ;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZ = Math.min(1.4, Math.max(0.35, currentZ * factor));

      const nextPanX = mouseX - worldX * nextZ;
      const nextPanY = mouseY - worldY * nextZ;

      setZoom(nextZ);
      setPan({ x: nextPanX, y: nextPanY });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Global window pointer drag tracking
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('.no-drag')
    ) {
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

  // Toggle reason chips
  const handleToggleChip = (chip: string) => {
    const updated = selectedChips.includes(chip)
      ? selectedChips.filter((c) => c !== chip)
      : [...selectedChips, chip];
    onUpdateSession({ selectedChips: updated });
  };

  // Add new sub-worry branch with the (+) button
  const handleAddSubWorry = (customText?: string) => {
    const text = customText || newSubWorryText.trim();
    if (!text) return;

    const newBranch: SubWorryBranch = {
      id: `sub-${Date.now()}`,
      question: text,
      tags: selectedChips.slice(0, 2),
      thoughtNature: undefined,
      canAct: undefined,
      actionText: '',
      whenText: '',
      completed: false,
    };

    const updated = [...subWorries, newBranch];
    onUpdateSession({ subWorries: updated });
    setNewSubWorryText('');
  };

  // Automatically split journal text into questions
  const handleDeconstructJournal = () => {
    const text = session.rawWorryText || '';
    if (!text.trim()) return;

    // Split by punctuation sentences or common conjunctions
    const sentences = text
      .split(/[.?!;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (sentences.length <= 1) {
      // Just make one clean question
      handleAddSubWorry(text.trim());
      return;
    }

    const newBranches: SubWorryBranch[] = sentences.slice(0, 4).map((s, idx) => ({
      id: `sub-${Date.now()}-${idx}`,
      question: s.endsWith('?') ? s : `${s}?`,
      tags: selectedChips.slice(0, 2),
      thoughtNature: undefined,
      canAct: undefined,
      actionText: '',
      whenText: '',
      completed: false,
    }));

    onUpdateSession({ subWorries: newBranches });
  };

  const handleUpdateBranch = (id: string, updates: Partial<SubWorryBranch>) => {
    const updated = subWorries.map((b) => (b.id === id ? { ...b, ...updates } : b));
    onUpdateSession({ subWorries: updated });
  };

  const handleDeleteBranch = (id: string) => {
    const updated = subWorries.filter((b) => b.id !== id);
    onUpdateSession({ subWorries: updated });
  };

  const handleLockPostponement = () => {
    const formatted = `Today at ${postponeTime}`;
    onUpdateSession({
      postponementTimestamp: formatted,
      isCompleted: true,
    });
    onSetGlobalPostponement(formatted);
    setIsPostponed(true);
  };

  const handleCopyPlan = () => {
    let md = `# ACTION & DECENTER BLUEPRINT\n`;
    md += `*Journal:*\n"${session.rawWorryText || 'None'}"\n\n`;
    md += `## DECONSTRUCTED SUB-WORRIES & ACTIONS:\n`;
    subWorries.forEach((b, i) => {
      md += `### ${i + 1}. ${b.question}\n`;
      md += `- Nature: ${b.thoughtNature === 'transient_event' ? 'Future Prediction' : 'Present Fact'}\n`;
      if (b.canAct) {
        md += `- Action: ${b.actionText || 'Take immediate step'}${b.whenText ? ` (${b.whenText})` : ''}\n`;
      } else {
        md += `- Status: Out of my control — letting it go today\n`;
      }
      md += `\n`;
    });
    if (session.postponementTimestamp) {
      md += `## PAUSE WORRY UNTIL: ${session.postponementTimestamp}\n`;
    }
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render S-curve cable with floating label directly on the line
  const renderCableWithFloatingLabel = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    color: string = '#18181b',
    active: boolean = true
  ) => {
    const dx = x2 - x1;
    const cp1x = x1 + Math.max(50, dx * 0.45);
    const cp2x = x2 - Math.max(50, dx * 0.45);
    const pathD = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

    // Midpoint of cubic Bezier at t = 0.5
    const midX = 0.125 * x1 + 0.375 * cp1x + 0.375 * cp2x + 0.125 * x2;
    const midY = 0.125 * y1 + 0.375 * y1 + 0.375 * y2 + 0.125 * y2;

    return (
      <g className="transition-all duration-300">
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ opacity: active ? 1 : 0.25 }}
        />
        {/* Pin sockets */}
        <circle cx={x1} cy={y1} r="4.5" fill="#ffffff" stroke={color} strokeWidth="2.5" />
        <circle cx={x2} cy={y2} r="4.5" fill="#ffffff" stroke={color} strokeWidth="2.5" />

        {/* Floating Label pill right on the line */}
        {active && label && (
          <foreignObject
            x={midX - 85}
            y={midY - 14}
            width="170"
            height="28"
            className="overflow-visible pointer-events-none"
          >
            <div className="flex items-center justify-center">
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-white border border-zinc-300 text-zinc-800 shadow-2xs whitespace-nowrap">
                {label}
              </span>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  // Blueprint coordinate (placed to the right of branches)
  const BLUEPRINT_X = BRANCH_X_START + 820;
  const BLUEPRINT_Y = Math.max(JOURNAL_Y, 80 + (subWorries.length * BRANCH_SPACING_Y) / 2 - 120);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className={`relative w-full h-full overflow-hidden select-none bg-canvas-grid ${
        dragMode || isDragging ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* Floating Canvas Controls (Bottom Right corner) */}
      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-xs border border-zinc-200 rounded-2xl shadow-sm">
        <button
          onClick={() => setDragMode(!dragMode)}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
            dragMode ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-700'
          }`}
          title="Toggle Hand Pan tool"
        >
          <Hand size={15} />
        </button>
        <div className="w-[1px] h-4 bg-zinc-200" />
        <button
          onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
          className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
          className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <span className="font-mono text-xs font-bold text-zinc-600 px-1 text-center w-8">
          {Math.round(zoom * 100)}%
        </span>
        <div className="w-[1px] h-4 bg-zinc-200" />
        <button
          onClick={() => {
            setZoom(0.85);
            setPan({ x: 60, y: 100 });
          }}
          className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
          title="Reset View"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* 2D Zoomable & Pannable Canvas Plane */}
      <div
        className="absolute origin-top-left transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '3200px',
          height: '1800px',
        }}
      >
        {/* SVG S-Curve Cables with Floating Question Labels on the Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="3200"
          height="1800"
          style={{ zIndex: 0 }}
        >
          {subWorries.map((branch, index) => {
            const branchY = JOURNAL_Y + index * BRANCH_SPACING_Y;

            // Cable 1: From Journal to Sub-worry Question Node
            const cable1 = renderCableWithFloatingLabel(
              JOURNAL_X + JOURNAL_W,
              JOURNAL_Y + 120,
              BRANCH_X_START,
              branchY + 80,
              `Question 0${index + 1}`,
              '#18181b',
              true
            );

            // Cable 2: From Sub-Worry Question to Thought Check Node
            const cable2 = renderCableWithFloatingLabel(
              BRANCH_X_START + 250,
              branchY + 80,
              BRANCH_X_START + 350,
              branchY + 80,
              'Fact or prediction?',
              '#18181b',
              true
            );

            // Cable 3: From Thought Check to Action Decision Node
            const cable3 = renderCableWithFloatingLabel(
              BRANCH_X_START + 350 + 210,
              branchY + 80,
              BRANCH_X_START + 640,
              branchY + 80,
              'Can you act today?',
              branch.canAct ? '#16a34a' : branch.canAct === false ? '#dc2626' : '#18181b',
              branch.thoughtNature !== undefined
            );

            // Cable 4: From Action Decision Node to Final Blueprint
            const cable4 = renderCableWithFloatingLabel(
              BRANCH_X_START + 640 + 220,
              branchY + 80,
              BLUEPRINT_X,
              BLUEPRINT_Y + 110,
              'Finalize',
              branch.canAct ? '#16a34a' : '#18181b',
              branch.completed || branch.canAct !== undefined
            );

            return (
              <g key={branch.id}>
                {cable1}
                {cable2}
                {cable3}
                {cable4}
              </g>
            );
          })}
        </svg>

        {/* 1. JOURNAL ENTRY NODE: Write out big worry + Topic Chips */}
        <div
          className="absolute no-drag"
          style={{ left: `${JOURNAL_X}px`, top: `${JOURNAL_Y}px`, width: `${JOURNAL_W}px` }}
        >
          {/* Tag Pill */}
          <div className="mb-2 flex items-center justify-between">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-zinc-900 text-white">
              Journal Space
            </span>
            <span className="text-[11px] font-medium text-zinc-500">
              Brain Dump
            </span>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-zinc-800" />
                <h3 className="text-xs font-bold text-zinc-950">Write About Your Worry</h3>
              </div>
            </div>

            {/* Free-form Journal Text Area */}
            <div className="mb-3">
              <textarea
                value={session.rawWorryText || ''}
                onChange={(e) => onUpdateSession({ rawWorryText: e.target.value })}
                placeholder="Pour out everything that is making you feel anxious or overwhelmed right now..."
                rows={5}
                className="w-full p-3 text-xs bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 transition-all resize-none leading-relaxed break-words"
              />
            </div>

            {/* Clickable Topic/Reason Chips */}
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Core Triggers (Click to tag):
              </span>
              <div className="flex flex-wrap gap-1">
                {TOPIC_CHIPS.map((chip) => {
                  const isSelected = selectedChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleToggleChip(chip)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deconstruct & Add actions */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleDeconstructJournal}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Split size={13} />
                <span>Divide into Sub-Questions</span>
              </button>

              {/* Add custom worry input with (+) button */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newSubWorryText}
                  onChange={(e) => setNewSubWorryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubWorry();
                  }}
                  placeholder="Add another sub-worry..."
                  className="flex-1 px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => handleAddSubWorry()}
                  className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Add sub-worry branch"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PROGRESSIVE MULTI-BRANCHES (One row per sub-worry) */}
        {subWorries.map((branch, index) => {
          const branchY = JOURNAL_Y + index * BRANCH_SPACING_Y;

          return (
            <React.Fragment key={branch.id}>
              {/* NODE 2A: The Sub-Worry Question Node */}
              <div
                className="absolute no-drag"
                style={{ left: `${BRANCH_X_START}px`, top: `${branchY}px`, width: '250px' }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Question 0{index + 1}
                  </span>
                  {subWorries.length > 1 && (
                    <button
                      onClick={() => handleDeleteBranch(branch.id)}
                      className="text-zinc-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                      title="Remove branch"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 shadow-sm relative">
                  <input
                    type="text"
                    value={branch.question}
                    onChange={(e) => handleUpdateBranch(branch.id, { question: e.target.value })}
                    className="w-full text-xs font-semibold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:outline-none pb-1"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {branch.tags?.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-zinc-100 text-zinc-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* NODE 2B: Fact vs. Prediction Check Node (Buttons in node, question on line) */}
              <div
                className="absolute no-drag"
                style={{ left: `${BRANCH_X_START + 350}px`, top: `${branchY}px`, width: '210px' }}
              >
                <div className="mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Thought Check
                  </span>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm space-y-1.5">
                  {/* Action/Answer Buttons */}
                  <button
                    type="button"
                    onClick={() => handleUpdateBranch(branch.id, { thoughtNature: 'transient_event' })}
                    className={`w-full p-2 text-left text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      branch.thoughtNature === 'transient_event'
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                        : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <span>⛅ Future prediction</span>
                    {branch.thoughtNature === 'transient_event' && <Check size={12} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateBranch(branch.id, { thoughtNature: 'literal_fact' })}
                    className={`w-full p-2 text-left text-[11px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      branch.thoughtNature === 'literal_fact'
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                        : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <span>📍 Happening right now</span>
                    {branch.thoughtNature === 'literal_fact' && <Check size={12} />}
                  </button>
                </div>
              </div>

              {/* NODE 2C: Action vs. Let Go Decision Node */}
              <div
                className={`absolute no-drag transition-opacity duration-300 ${
                  branch.thoughtNature !== undefined ? 'opacity-100' : 'opacity-30 pointer-events-none'
                }`}
                style={{ left: `${BRANCH_X_START + 640}px`, top: `${branchY}px`, width: '220px' }}
              >
                <div className="mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Action Decision
                  </span>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm space-y-2">
                  {/* Two Action Choice Buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateBranch(branch.id, { canAct: true })}
                      className={`p-1.5 text-center text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        branch.canAct === true
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      🟢 I can act
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBranch(branch.id, { canAct: false, actionText: '' })}
                      className={`p-1.5 text-center text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        branch.canAct === false
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      🔴 Let it go
                    </button>
                  </div>

                  {/* If Actionable: One simple input */}
                  {branch.canAct === true && (
                    <div className="space-y-1 pt-1 animate-fadeIn">
                      <input
                        type="text"
                        value={branch.actionText || ''}
                        onChange={(e) => handleUpdateBranch(branch.id, { actionText: e.target.value })}
                        placeholder="Action to take..."
                        className="w-full px-2 py-1 text-[11px] bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-800"
                      />
                      <input
                        type="text"
                        value={branch.whenText || ''}
                        onChange={(e) => handleUpdateBranch(branch.id, { whenText: e.target.value })}
                        placeholder="When? e.g. At 2 PM"
                        className="w-full px-2 py-0.5 text-[10px] bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none text-zinc-500"
                      />
                    </div>
                  )}

                  {branch.canAct === false && (
                    <p className="text-[10px] text-zinc-500 italic pt-1">
                      Out of your control. Permission to let this rest today.
                    </p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* 3. FINAL ACTION BLUEPRINT & POSTPONEMENT NODE */}
        <div
          className="absolute no-drag"
          style={{ left: `${BLUEPRINT_X}px`, top: `${BLUEPRINT_Y}px`, width: '330px' }}
        >
          <div className="mb-2">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-zinc-900 text-white">
              Action Blueprint
            </span>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                <CheckCheck size={16} />
                <span>Consolidated Plan</span>
              </div>
              <button
                onClick={handleCopyPlan}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Resolved list */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {subWorries.map((b, i) => (
                <div key={b.id} className="p-2 bg-zinc-50 rounded-xl text-xs space-y-0.5">
                  <div className="font-semibold text-zinc-800 text-[11px]">
                    0{i + 1}. {b.question}
                  </div>
                  {b.canAct ? (
                    <div className="text-[11px] text-emerald-800 font-medium pl-2">
                      👉 {b.actionText || 'Take next action'}{b.whenText ? ` (${b.whenText})` : ''}
                    </div>
                  ) : b.canAct === false ? (
                    <div className="text-[11px] text-zinc-500 italic pl-2">
                      🌿 Out of control — let go
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400 pl-2">
                      Pending review
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Worry Pause Commitment */}
            <div className="p-2.5 bg-zinc-100 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-900">
                <Clock size={13} />
                <span>Pause worrying until:</span>
              </div>
              {isPostponed ? (
                <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                  Paused until <strong>{session.postponementTimestamp}</strong>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={postponeTime}
                    onChange={(e) => setPostponeTime(e.target.value)}
                    className="px-2 py-1 text-xs border border-zinc-300 rounded-lg bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleLockPostponement}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-900 text-white hover:bg-black cursor-pointer"
                  >
                    Lock Time
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onRestartNewSession}
              className="w-full py-2 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>Start Fresh Framing</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
