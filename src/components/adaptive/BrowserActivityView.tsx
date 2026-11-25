import { ExternalLink, Globe, Pause, Play, Square } from 'lucide-react';
import type { BrowserSessionState, TaskStatus } from '../../types/eon';

interface BrowserActivityViewProps {
  session: BrowserSessionState;
  taskStatus?: TaskStatus;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onTakeover?: () => void;
  onReturnControl?: () => void;
  controlBusy?: boolean;
}

const STATUS_LABELS: Record<BrowserSessionState['status'], { label: string; tone: string }> = {
  idle: { label: 'Idle', tone: 'text-[#8E95A5]' },
  navigating: { label: 'Navigating', tone: 'text-[#7F8BF5]' },
  interacting: { label: 'Interacting', tone: 'text-[#7F8BF5]' },
  waiting: { label: 'Waiting for you', tone: 'text-amber-400' },
  paused: { label: 'Paused', tone: 'text-amber-400' },
  completed: { label: 'Session finished', tone: 'text-emerald-400' },
  error: { label: 'Session error', tone: 'text-rose-400' },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function BrowserActivityView({
  session,
  taskStatus,
  onPause,
  onResume,
  onCancel,
  onTakeover,
  onReturnControl,
  controlBusy = false,
}: BrowserActivityViewProps) {
  const statusInfo = STATUS_LABELS[session.status] || STATUS_LABELS.idle;
  const frameSrc = session.frameBase64
    ? session.frameBase64.startsWith('data:')
      ? session.frameBase64
      : `data:image/png;base64,${session.frameBase64}`
    : session.screenshotUrl || null;

  const canPause = taskStatus === 'running' || taskStatus === 'planning';
  const canResume = taskStatus === 'paused';
  const canCancel =
    taskStatus === 'running' ||
    taskStatus === 'planning' ||
    taskStatus === 'paused' ||
    taskStatus === 'awaiting_approval' ||
    taskStatus === 'awaiting_input';

  return (
    <section
      aria-label="Browser execution activity"
      className="eon-panel overflow-hidden rounded-2xl"
    >
      {/* Browser chrome header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#141720] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <Globe className="h-4 w-4 shrink-0 text-[#8E96A8]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-medium ${statusInfo.tone}`}>{statusInfo.label}</span>
              {session.pageTitle && (
                <>
                  <span aria-hidden="true" className="text-[#6C7385]">·</span>
                  <span className="truncate text-[#9CA3B3]">{session.pageTitle}</span>
                </>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-[#6C7385]">
              {session.currentUrl || 'Ready'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {session.currentUrl && (
            <a
              href={session.currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open current URL in new tab"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#111318] text-[#9CA3B3] hover:text-[#F4F5F7] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {session.sessionId && session.interventionRequired && onReturnControl && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={onReturnControl}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#6E7BF2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
            >
              <span>Hand back to EON</span>
            </button>
          )}
          {session.sessionId && !session.interventionRequired && canPause && onTakeover && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={onTakeover}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.10] bg-[#111318] px-3 py-1.5 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A] disabled:opacity-50"
            >
              <span>Take over</span>
            </button>
          )}
          {canPause && onPause && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={onPause}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.10] bg-[#111318] px-3 py-1.5 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A] disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pause</span>
            </button>
          )}
          {canResume && onResume && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={onResume}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#6E7BF2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Resume</span>
            </button>
          )}
          {canCancel && onCancel && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={onCancel}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.10] bg-[#111318] px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Current action bar */}
      {session.currentAction && (
        <div className="border-b border-white/[0.06] bg-[#0D0F14] px-4 py-2.5 text-xs text-[#9CA3B3]">
          <span className="text-[#6C7385] mr-2">Current step:</span>
          <span className="text-[#F4F5F7]">{session.currentAction}</span>
        </div>
      )}

      {/* Viewport preview + Activity stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 border-b border-white/[0.06] lg:border-b-0 lg:border-r bg-[#090A0D] p-4">
          {frameSrc ? (
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black">
              <img
                src={frameSrc}
                alt={session.pageTitle ? `Browser preview of ${session.pageTitle}` : 'Live browser execution frame'}
                referrerPolicy="no-referrer"
                className="w-full max-h-[360px] object-contain"
              />
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] p-6 text-center">
              <Globe className="h-6 w-6 text-[#4E5566]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-[#9CA3B3]">
                No visual browser frame exposed
              </p>
              <p className="mt-1 max-w-sm text-xs text-[#6C7385]">
                The backend has not attached a live screenshot or viewport stream for this step. Action logs remain visible alongside.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 p-4">
          <h4 className="text-xs font-medium text-[#8E95A5]">Execution Log</h4>
          {session.logs.length === 0 ? (
            <p className="mt-3 text-xs text-[#6C7385]">No browser events recorded yet.</p>
          ) : (
            <ol className="mt-3 max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
              {session.logs.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 border-b border-white/[0.04] pb-2.5 last:border-b-0 last:pb-0 text-xs"
                >
                  <span className="font-mono tabular-nums text-[#6C7385] shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#F4F5F7] leading-snug">{entry.action}</p>
                    {(entry.target || entry.url) && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[#6C7385]">
                        {entry.target || entry.url}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
