import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import type { BackendStatus, TaskRecord, TaskStatus } from '../../types/eon';
import { EonPresence, type PresenceState } from '../presence/EonPresence';
import { AdaptiveRenderer } from '../adaptive/AdaptiveRenderer';
import {
  type AttachedContextFile,
  type ExecutionMode,
  UniversalInput,
} from '../input/UniversalInput';

interface WorkspaceHomeViewProps {
  activeTask: TaskRecord | null;
  backendStatus: BackendStatus | null;
  isSubmitting: boolean;
  controlBusy: boolean;
  submissionError: string | null;
  onCreateTask: (
    prompt: string,
    mode: ExecutionMode,
    attachments?: AttachedContextFile[]
  ) => Promise<void>;
  onFollowUpInput: (taskId: string, text: string) => Promise<void>;
  onPauseTask: (taskId: string) => Promise<void>;
  onResumeTask: (taskId: string) => Promise<void>;
  onCancelTask: (taskId: string) => Promise<void>;
  onRetryTask: (task: TaskRecord) => Promise<void>;
  onRespondApproval: (
    taskId: string,
    approvalId: string,
    decision: 'approve' | 'deny',
    inputs?: Record<string, string>
  ) => Promise<void>;
  onSubmitForm: (taskId: string, formId: string, values: Record<string, unknown>) => Promise<void>;
  onSaveArtifact: (taskId: string, artifactId: string, content: string) => Promise<void>;
  onTranscribeAudio: (blob: Blob) => Promise<string>;
  onTakeoverBrowser?: (task: TaskRecord) => Promise<void>;
  onReturnControlBrowser?: (task: TaskRecord) => Promise<void>;
  onOpenSettings: () => void;
  onClearTask: () => void;
}

const TASK_STATUS_META: Record<TaskStatus, { label: string; colorClass: string }> = {
  idle: { label: 'Ready', colorClass: 'text-[#98A1B5]' },
  planning: { label: 'Thinking…', colorClass: 'text-[#9BB4FF]' },
  running: { label: 'Working on it…', colorClass: 'text-[#9BB4FF]' },
  paused: { label: 'Paused', colorClass: 'text-amber-400' },
  awaiting_approval: { label: 'Waiting for your approval', colorClass: 'text-amber-400' },
  awaiting_input: { label: 'Needs a quick detail', colorClass: 'text-amber-400' },
  completed: { label: 'Done', colorClass: 'text-emerald-400' },
  failed: { label: 'Could not finish', colorClass: 'text-rose-400' },
  cancelled: { label: 'Stopped', colorClass: 'text-[#98A1B5]' },
};

const CONSUMER_STARTERS = [
  'Plan a 4-day trip to Lisbon with neighborhood picks',
  'Compare the best noise-cancelling headphones under $350',
  'Draft a warm, concise note declining a dinner invite',
  'Help me break down a messy goal into weekly steps',
];

function mapTaskToPresence(status: TaskStatus): PresenceState {
  if (status === 'planning') return 'thinking';
  if (status === 'running') return 'executing';
  if (status === 'awaiting_approval' || status === 'awaiting_input') return 'approval';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'error';
  return 'idle';
}

export function WorkspaceHomeView({
  activeTask,
  backendStatus,
  isSubmitting,
  controlBusy,
  submissionError,
  onCreateTask,
  onFollowUpInput,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onRetryTask,
  onRespondApproval,
  onSubmitForm,
  onSaveArtifact,
  onTranscribeAudio,
  onTakeoverBrowser,
  onReturnControlBrowser,
  onOpenSettings,
  onClearTask,
}: WorkspaceHomeViewProps) {
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [typingPulse, setTypingPulse] = useState(0);
  const [isListening, setIsListening] = useState(false);

  if (!activeTask) {
    const homePresenceState: PresenceState = isSubmitting
      ? 'thinking'
      : isListening
      ? 'listening'
      : 'idle';

    return (
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-4xl flex-col items-center justify-center px-4 pb-24 pt-2 sm:px-6 sm:pb-12">
        {/* Living EON Presence */}
        <div className="h-[220px] w-full max-w-[340px] sm:h-[260px] sm:max-w-[400px]">
          <EonPresence
            state={homePresenceState}
            pulseCount={typingPulse}
            className="h-full w-full"
          />
        </div>

        {/* Human Invitation */}
        <div className="-mt-4 text-center sm:-mt-6">
          <h1 className="eon-display-ink font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Let&apos;s get something done.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#98A1B5] sm:text-[15px]">
            Ask a question, hand off research, or turn an idea into something finished.
          </p>
        </div>

        {/* Tactile Consumer Input */}
        <div className="mt-7 w-full max-w-2xl sm:mt-8">
          <UniversalInput
            onSubmit={onCreateTask}
            isSubmitting={isSubmitting}
            voiceEndpointState={backendStatus?.capabilities.voice || 'unknown'}
            onTranscribeAudio={onTranscribeAudio}
            onTypingPulse={() => setTypingPulse((n) => n + 1)}
            onListeningChange={setIsListening}
          />

          {submissionError && (
            <div
              role="alert"
              className="eon-panel mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-rose-500/25 px-4 py-3.5 text-left"
            >
              <div className="flex items-start gap-2.5 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#F3F5FA]">
                    {submissionError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex min-h-[38px] items-center rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.10]"
              >
                Settings
              </button>
            </div>
          )}
        </div>

        {/* Gentle, everyday consumer prompt ideas */}
        <div className="mt-7 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2">
          {CONSUMER_STARTERS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isSubmitting}
              onClick={() => void onCreateTask(prompt, 'auto')}
              className="min-h-[38px] rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-[#98A1B5] transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-[#F3F5FA] disabled:opacity-50 text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Active Task / Results View
  const statusMeta = TASK_STATUS_META[activeTask.status] || TASK_STATUS_META.running;
  const presenceState = mapTaskToPresence(activeTask.status);
  const isLive = activeTask.status === 'running' || activeTask.status === 'planning';
  const canPause = isLive;
  const canResume = activeTask.status === 'paused';
  const canCancel =
    isLive ||
    activeTask.status === 'paused' ||
    activeTask.status === 'awaiting_approval' ||
    activeTask.status === 'awaiting_input';
  const isTerminal =
    activeTask.status === 'completed' ||
    activeTask.status === 'failed' ||
    activeTask.status === 'cancelled';

  const handleFollowUp = async (text: string) => {
    setFollowUpSubmitting(true);
    try {
      await onFollowUpInput(activeTask.id, text);
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const hasSteps = activeTask.steps.length > 0;
  const completedSteps = activeTask.steps.filter((s) => s.status === 'completed').length;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-3 pb-24 sm:px-6 sm:pb-12 lg:px-8">
      {/* Compact Living Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="h-14 w-14 shrink-0 sm:h-16 sm:w-16">
            <EonPresence compact state={presenceState} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#7C8599]">
              <span className={`inline-flex items-center gap-1.5 font-medium ${statusMeta.colorClass}`}>
                {isLive && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                <span>{statusMeta.label}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {new Date(activeTask.updatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <h1 className="mt-1 font-display text-xl font-semibold text-[#F3F5FA] sm:text-2xl">
              {activeTask.title}
            </h1>
            {activeTask.prompt && activeTask.prompt !== activeTask.title && (
              <p className="mt-1 text-sm text-[#98A1B5]">{activeTask.prompt}</p>
            )}
          </div>
        </div>

        {/* Simple Human Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canPause && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => void onPauseTask(activeTask.id)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.09] disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pause</span>
            </button>
          )}
          {canResume && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => void onResumeTask(activeTask.id)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#F3F5FA] px-4 py-2 text-xs font-semibold text-[#050608] hover:bg-white disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Continue</span>
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => void onCancelTask(activeTask.id)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Stop</span>
            </button>
          )}
          {activeTask.status === 'failed' && (
            <button
              type="button"
              disabled={controlBusy}
              onClick={() => void onRetryTask(activeTask)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#F3F5FA] px-4 py-2 text-xs font-semibold text-[#050608] hover:bg-white disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          )}
          {isTerminal && (
            <button
              type="button"
              onClick={onClearTask}
              className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#98A1B5] hover:text-white"
            >
              Start Fresh
            </button>
          )}
        </div>
      </div>

      {/* Main Results & Optional Progress Steps */}
      <div
        className={`mt-6 grid grid-cols-1 gap-8 items-start ${
          hasSteps ? 'lg:grid-cols-12' : ''
        }`}
      >
        <div className={`${hasSteps ? 'lg:col-span-8' : 'mx-auto w-full max-w-3xl'} space-y-6`}>
          {activeTask.error &&
            !activeTask.blocks.some((b) => b.type === 'error_recovery') && (
              <div
                role="alert"
                className="eon-panel rounded-2xl border-rose-500/25 p-5"
              >
                <p className="text-sm font-medium text-rose-300">{activeTask.error.message}</p>
              </div>
            )}

          {activeTask.blocks.length === 0 && isLive ? (
            <div className="py-8">
              <div className="flex items-center gap-3 text-sm text-[#98A1B5]">
                <Loader2 className="h-4 w-4 animate-spin text-[#9BB4FF]" aria-hidden="true" />
                <span>Working on your request…</span>
              </div>
            </div>
          ) : (
            <AdaptiveRenderer
              blocks={activeTask.blocks}
              handlers={{
                taskStatus: activeTask.status,
                controlBusy,
                onPauseTask: () => void onPauseTask(activeTask.id),
                onResumeTask: () => void onResumeTask(activeTask.id),
                onCancelTask: () => void onCancelTask(activeTask.id),
                onRetryTask: () => void onRetryTask(activeTask),
                onOpenSettings,
                onStartPlan: () => void onResumeTask(activeTask.id),
                onFollowUp: (text) => void handleFollowUp(text),
                onTakeoverBrowser: onTakeoverBrowser ? () => void onTakeoverBrowser(activeTask) : undefined,
                onReturnControlBrowser: onReturnControlBrowser ? () => void onReturnControlBrowser(activeTask) : undefined,
                onRespondApproval: (approvalId, decision, inputs) =>
                  onRespondApproval(activeTask.id, approvalId, decision, inputs),
                onSubmitForm: (formId, values) =>
                  onSubmitForm(activeTask.id, formId, values),
                onSaveArtifact: (artifactId, content) =>
                  onSaveArtifact(activeTask.id, artifactId, content),
              }}
            />
          )}

          {activeTask.suggestedActions && activeTask.suggestedActions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeTask.suggestedActions
                .filter((a) => a.kind !== 'dismiss')
                .map((action) => (
                  <button
                    key={action.action_id}
                    type="button"
                    disabled={followUpSubmitting || controlBusy}
                    onClick={() => void handleFollowUp(action.label)}
                    className="min-h-[38px] rounded-full border border-white/[0.10] bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-[#D2D8E6] hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
            </div>
          )}

          {activeTask.id && (
            <div className="pt-2">
              <UniversalInput
                compact
                onSubmit={(text) => handleFollowUp(text)}
                isSubmitting={followUpSubmitting}
                voiceEndpointState={backendStatus?.capabilities.voice || 'unknown'}
                onTranscribeAudio={onTranscribeAudio}
                placeholder={
                  isTerminal
                    ? 'Ask a follow-up or adjust the result…'
                    : 'Add a note or steer what EON does next…'
                }
              />
            </div>
          )}
        </div>

        {hasSteps && (
          <aside className="lg:col-span-4 lg:sticky lg:top-20 lg:border-l lg:border-white/[0.07] lg:pl-7">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h2 className="font-display text-xs font-semibold tracking-wider uppercase text-[#8E96A8]">
                Progress
              </h2>
              <span className="font-mono text-xs tabular-nums text-[#7C8599]">
                {completedSteps}/{activeTask.steps.length}
              </span>
            </div>

            <ol className="mt-4 space-y-3.5">
              {activeTask.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-3 text-xs">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : step.status === 'active' ? (
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[#9BB4FF]" aria-hidden="true" />
                  ) : step.status === 'failed' ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#414756]" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        step.status === 'active'
                          ? 'font-medium text-[#F3F5FA]'
                          : step.status === 'completed'
                          ? 'text-[#98A1B5]'
                          : 'text-[#666E80]'
                      }
                    >
                      {step.title}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
