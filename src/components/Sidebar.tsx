import React, { useState } from 'react';
import { 
  Plus, 
  History, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  HeartPulse
} from 'lucide-react';
import { FramingSession } from '../types/metacognitive';

interface SidebarProps {
  sessions: FramingSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenPanicOverlay: () => void;
  onOpenMctGuide: () => void;
  onOpenMctExperiment: () => void;
  activePostponementTimer: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onOpenPanicOverlay,
  onOpenMctGuide,
  onOpenMctExperiment,
  activePostponementTimer,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-16' : 'w-72 lg:w-80'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] flex items-center justify-center font-bold text-sm tracking-wider shadow-xs">
              D
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)] leading-none">
                DECENTER
              </h1>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 font-medium">
                Thought &amp; Worry Framing
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] flex items-center justify-center font-bold text-sm">
            D
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Framing Action */}
      <div className="p-3 border-b border-[var(--border-subtle)]">
        <button
          onClick={onNewSession}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--accent-black)] text-[var(--accent-white)] font-semibold text-xs blackout-button cursor-pointer ${
            collapsed ? 'px-0' : ''
          }`}
          title="Start fresh with a new question"
        >
          <Plus size={15} strokeWidth={2.5} />
          {!collapsed && <span>Start Fresh Session</span>}
        </button>
      </div>

      {/* Scheduled Worry Reminder Badge */}
      {activePostponementTimer && !collapsed && (
        <div className="mx-3 mt-3 p-3 bg-zinc-100 border border-zinc-300 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-zinc-900 font-bold">
            <Clock size={13} />
            <span>Worry Paused</span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
            Scheduled for: <strong className="text-zinc-950">{activePostponementTimer}</strong>. You can relax right now.
          </p>
        </div>
      )}

      {/* Sessions History List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!collapsed && (
          <div className="flex items-center justify-between mb-2 px-1 text-xs text-[var(--text-tertiary)] font-medium">
            <span className="flex items-center gap-1.5">
              <History size={13} />
              Previous Sessions
            </span>
            <span className="text-[11px] font-mono font-bold">{sessions.length}</span>
          </div>
        )}

        <div className="space-y-1">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-primary)] shadow-xs'
                    : 'hover:bg-[var(--bg-surface)] border border-transparent text-[var(--text-secondary)]'
                }`}
                title={session.title}
              >
                {collapsed ? (
                  <div className="flex justify-center items-center py-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        session.isCompleted ? 'bg-[var(--accent-black)]' : 'border border-[var(--border-strong)]'
                      }`}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold truncate max-w-[170px] text-[var(--text-primary)]">
                        {session.title || 'Framing Session'}
                      </span>
                      {session.isCompleted ? (
                        <CheckCircle2 size={13} className="text-zinc-900 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                          Step {session.currentStep}/4
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                      <span>{session.context}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(session.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Friendly Bottom Shortcuts */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-1.5 bg-[var(--bg-panel)]">
        {/* Quick Calm SOS */}
        <button
          onClick={onOpenPanicOverlay}
          className={`w-full flex items-center justify-start gap-2 p-2.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Need a quick calm reset right now"
        >
          <HeartPulse size={15} className="shrink-0 text-red-600" />
          {!collapsed && <span>Quick Calm (Reset)</span>}
        </button>

        {/* 30-Second Thought Control Test */}
        <button
          onClick={onOpenMctExperiment}
          className={`w-full flex items-center justify-start gap-2 p-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Interactive 30-second thought control test"
        >
          <Sparkles size={15} className="shrink-0 text-[var(--text-primary)]" />
          {!collapsed && <span>Thought Control Test</span>}
        </button>

        {/* How this works guide */}
        <button
          onClick={onOpenMctGuide}
          className={`w-full flex items-center justify-start gap-2 p-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Simple explanation of how this works"
        >
          <BookOpen size={15} className="shrink-0" />
          {!collapsed && <span>How This Works</span>}
        </button>
      </div>
    </aside>
  );
};
