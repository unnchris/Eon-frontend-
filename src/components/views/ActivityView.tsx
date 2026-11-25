import { useState } from 'react';
import { Activity, ArrowUp, ArrowUpRight, Globe, Loader2, RefreshCw } from 'lucide-react';
import type { BackendStatus, TaskRecord } from '../../types/eon';
import { BrowserActivityView } from '../adaptive/BrowserActivityView';
import { SensitiveApprovalCard } from '../adaptive/SensitiveApprovalCard';

interface ActivityViewProps {
  activeTask: TaskRecord | null;
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;
  backendStatus: BackendStatus | null;
  controlBusy: boolean;
  onRefresh: () => void;
  onSelectTask: (task: TaskRecord) => void;
  onPauseTask: (taskId: string) => Promise<void>;
  onResumeTask: (taskId: string) => Promise<void>;
  onCancelTask: (taskId: string) => Promise<void>;
  onTakeoverBrowser?: (task: TaskRecord) => Promise<void>;
  onReturnControlBrowser?: (task: TaskRecord) => Promise<void>;
  onStartBrowserTask?: (objective: string) => Promise<void>;
  onRespondApproval: (
    taskId: string,
    approvalId: string,
    decision: 'approve' | 'deny',
    inputs?: Record<string, string>
  ) => Promise<void>;
  onOpenSettings: () => void;
}

export function ActivityView({
  activeTask,
  tasks,
  loading,
  error,
  backendStatus,
  controlBusy,
  onRefresh,
  onSelectTask,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onTakeoverBrowser,
  onReturnControlBrowser,
  onStartBrowserTask,
  onRespondApproval,
  onOpenSettings,
}: ActivityViewProps) {
  const [webObjective, setWebObjective] = useState('');
  const [startingWeb, setStartingWeb] = useState(false);
  const activeTasks = tasks.filter(
    (t) =>
      t.status === 'running' ||
      t.status === 'planning' ||
      t.status === 'paused' ||
      t.status === 'awaiting_approval' ||
      t.status === 'awaiting_input'
  );

  const browserTask =
    (activeTask?.browserSession && activeTask) ||
    tasks.find((t) => Boolean(t.browserSession)) ||
    null;

  const approvalTask =
    (activeTask?.pendingApproval && activeTask.pendingApproval.status === 'pending' && activeTask) ||
    tasks.find((t) => t.pendingApproval && t.pendingApproval.status === 'pending') ||
    null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-5 pb-24 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#F3F5FA]">
            Activity
          </h1>
          <p className="mt-1 text-sm text-[#98A1B5]">
            Follow ongoing tasks, live web steps, and items waiting for your approval.
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

      {error && (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 eon-panel rounded-2xl p-5"
        >
          <div>
            <p className="text-sm font-medium text-[#F3F5FA]">Couldn&apos;t refresh live activity</p>
            <p className="mt-1 text-xs text-[#98A1B5]">Check your connection in Settings to resume syncing.</p>
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

      {approvalTask?.pendingApproval && (
        <div className="mt-6">
          <SensitiveApprovalCard
            approval={approvalTask.pendingApproval}
            disabled={controlBusy}
            onRespond={(approvalId, decision, inputs) =>
              onRespondApproval(approvalTask.id, approvalId, decision, inputs)
            }
          />
        </div>
      )}

      {browserTask?.browserSession ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium text-[#98A1B5]">
              Web Session · {browserTask.title}
            </h2>
            <button
              type="button"
              onClick={() => onSelectTask(browserTask)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#9BB4FF] hover:text-white"
            >
              <span>Open</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <BrowserActivityView
            session={browserTask.browserSession}
            taskStatus={browserTask.status}
            controlBusy={controlBusy}
            onPause={() => void onPauseTask(browserTask.id)}
            onResume={() => void onResumeTask(browserTask.id)}
            onCancel={() => void onCancelTask(browserTask.id)}
            onTakeover={onTakeoverBrowser ? () => void onTakeoverBrowser(browserTask) : undefined}
            onReturnControl={onReturnControlBrowser ? () => void onReturnControlBrowser(browserTask) : undefined}
          />
        </div>
      ) : (
        <div className="mt-6 eon-panel rounded-2xl p-6 sm:p-8 text-center">
          <Globe className="mx-auto h-6 w-6 text-[#5F677A]" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-semibold text-[#F3F5FA]">
            Nothing browsing right now
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#98A1B5]">
            {backendStatus && !backendStatus.connected
              ? 'When EON is connected and browsing the web for you, live progress appears here.'
              : 'Ask EON to check a website or complete a web task, and watch every step here.'}
          </p>
          {onStartBrowserTask && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = webObjective.trim();
                if (!trimmed || startingWeb) return;
                setStartingWeb(true);
                void onStartBrowserTask(trimmed)
                  .then(() => setWebObjective(''))
                  .finally(() => setStartingWeb(false));
              }}
              className="mx-auto mt-5 flex max-w-lg items-center gap-2 rounded-full border border-white/[0.10] bg-[#050608] p-1.5"
            >
              <input
                type="text"
                value={webObjective}
                onChange={(e) => setWebObjective(e.target.value)}
                placeholder="Start a web task (e.g. Check example.com)"
                aria-label="Start a web task"
                className="h-10 flex-1 bg-transparent px-3.5 text-sm text-[#F3F5FA] placeholder:text-[#666E80] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!webObjective.trim() || startingWeb}
                aria-label="Run web task"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F5FA] text-[#050608] hover:bg-white disabled:opacity-40"
              >
                {startingWeb ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Active Queue */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-[#98A1B5]">
            In Progress ({activeTasks.length})
          </h2>
        </div>

        {loading && activeTasks.length === 0 ? (
          <div className="mt-3 space-y-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-16 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
              />
            ))}
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-[#98A1B5]">
            <Activity className="h-4 w-4 text-[#5F677A] shrink-0" aria-hidden="true" />
            <span>You&apos;re all caught up — nothing is running right now.</span>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] eon-panel rounded-2xl">
            {activeTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="flex min-h-[64px] w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-[#171A21] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#F4F5F7]">
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E95A5]">
                      <span className="capitalize">{task.status.replace('_', ' ')}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">
                        {task.steps.filter((s) => s.status === 'completed').length}/{task.steps.length} steps
                      </span>
                    </p>
                  </div>
                  {task.status === 'running' && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#7F8BF5]" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
