import { useMemo, useState } from 'react';
import { Clock, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { TaskRecord, TaskStatus } from '../../types/eon';

interface HistoryViewProps {
  tasks: TaskRecord[];
  historySource?: 'backend' | 'local_session';
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectTask: (task: TaskRecord) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenSettings: () => void;
}

type HistoryFilter = 'all' | 'active' | 'completed' | 'failed';

const STATUS_LABELS: Record<TaskStatus, string> = {
  idle: 'Ready',
  planning: 'Planning',
  running: 'Running',
  paused: 'Paused',
  awaiting_approval: 'Awaiting Approval',
  awaiting_input: 'Awaiting Input',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryView({
  tasks,
  historySource = 'backend',
  loading,
  error,
  onRefresh,
  onSelectTask,
  onDeleteTask,
  onOpenSettings,
}: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter === 'active') {
        const isActive =
          task.status === 'running' ||
          task.status === 'planning' ||
          task.status === 'paused' ||
          task.status === 'awaiting_approval' ||
          task.status === 'awaiting_input';
        if (!isActive) return false;
      } else if (filter === 'completed' && task.status !== 'completed') {
        return false;
      } else if (
        filter === 'failed' &&
        task.status !== 'failed' &&
        task.status !== 'cancelled'
      ) {
        return false;
      }

      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        task.prompt.toLowerCase().includes(q) ||
        task.id.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, filter]);

  const handleConfirmDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      await onDeleteTask(taskId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-5 pb-24 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#F3F5FA]">
            History
          </h1>
          <p className="mt-1 text-sm text-[#98A1B5]">
            {historySource === 'local_session'
              ? 'Your recent requests and results from this device.'
              : 'Revisit past requests, research notes, and saved work.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.09] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and search toolbar */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666E80]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past requests..."
            aria-label="Search history"
            className="h-11 w-full rounded-full border border-white/[0.09] bg-white/[0.03] pl-10 pr-4 text-sm text-[#F3F5FA] placeholder:text-[#666E80] focus:border-[#5B7CFA] focus:outline-none"
          />
        </div>

        <div
          role="group"
          aria-label="Filter history"
          className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 self-start sm:self-auto"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Done' },
              { id: 'failed', label: 'Stopped' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                filter === tab.id
                  ? 'bg-white/[0.10] text-[#F3F5FA]'
                  : 'text-[#8E96A8] hover:text-[#F3F5FA]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 eon-panel rounded-2xl p-5"
        >
          <div>
            <p className="text-sm font-medium text-[#F3F5FA]">Couldn&apos;t load past requests</p>
            <p className="mt-1 text-xs text-[#98A1B5]">Check your connection in Settings and try again.</p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.09]"
          >
            Settings
          </button>
        </div>
      )}

      {/* List states */}
      <div className="mt-6">
        {loading && tasks.length === 0 ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="eon-panel rounded-2xl p-10 text-center">
            <Clock className="mx-auto h-6 w-6 text-[#5F677A]" aria-hidden="true" />
            <h2 className="mt-3 font-display text-base font-semibold text-[#F3F5FA]">
              {tasks.length === 0 ? 'Nothing in your history yet' : 'No matching items'}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#98A1B5]">
              {tasks.length === 0
                ? 'Anything you ask EON to figure out or finish will show up here for easy access later.'
                : 'Try a different search word or filter.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06] eon-panel rounded-2xl">
            {filteredTasks.map((task) => {
              const isConfirming = confirmDeleteId === task.id;
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-[#151820] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTask(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-[#F4F5F7]">
                      {task.title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8E95A5]">
                      <span>{STATUS_LABELS[task.status] || task.status}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatRelativeDate(task.updatedAt)}</span>
                      {task.blocks.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{task.blocks.length} outputs</span>
                        </>
                      )}
                    </p>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          disabled={deletingId === task.id}
                          onClick={() => void handleConfirmDelete(task.id)}
                          className="min-h-[36px] rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                        >
                          {deletingId === task.id ? 'Removing...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#9CA3B3] hover:text-[#F4F5F7]"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#6C7385] hover:bg-white/[0.05] hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
