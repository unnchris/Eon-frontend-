import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { TopBar, type AppView } from './components/layout/TopBar';
import { MobileNav } from './components/layout/MobileNav';
import { WorkspaceHomeView } from './components/views/WorkspaceHomeView';
import { ActivityView } from './components/views/ActivityView';
import { HistoryView } from './components/views/HistoryView';
import { SettingsView } from './components/views/SettingsView';
import { AuthModal } from './components/auth/AuthModal';
import type { AttachedContextFile, ExecutionMode } from './components/input/UniversalInput';
import type { BackendStatus, ConnectionConfig, EonUser, TaskRecord } from './types/eon';
import {
  ApiEndpointError,
  controlActionPlan,
  controlBrowserTask,
  createTask,
  deleteTask,
  fetchCurrentUser,
  getTask,
  listTasks,
  loadAuthSession,
  loadConnectionConfig,
  loginAccount,
  logoutAccount,
  probeBackend,
  registerAccount,
  retryBackendTask,
  saveConnectionConfig,
  saveLocalSessionTask,
  startBrowserExecution,
  startGuestSession,
  submitFollowUp,
  toggleBrowserTakeover,
  transcribeAudioWithBackend,
} from './services/eonApi';

function isTerminalStatus(status: TaskRecord['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig>(() => loadConnectionConfig());
  const [user, setUser] = useState<EonUser | null>(() => loadAuthSession()?.user || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<AppView>('home');
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [probing, setProbing] = useState(false);

  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [historySource, setHistorySource] = useState<'backend' | 'local_session'>('backend');
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  const refreshBackendProbe = useCallback(async (targetConfig: ConnectionConfig) => {
    setProbing(true);
    try {
      const status = await probeBackend(targetConfig);
      setBackendStatus(status);
      return status;
    } finally {
      setProbing(false);
    }
  }, []);

  const refreshTasks = useCallback(
    async (targetConfig: ConnectionConfig = config) => {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const result = await listTasks(targetConfig, { limit: 50 });
        setTasks(result.tasks);
        setHistorySource(result.source);
      } catch (err) {
        setTasksError(err instanceof Error ? err.message : 'Unable to fetch tasks.');
      } finally {
        setTasksLoading(false);
      }
    },
    [config]
  );

  // Initial probe, user verification & automatic guest session bootstrap
  useEffect(() => {
    void refreshBackendProbe(config);
    void (async () => {
      let current = await fetchCurrentUser(config);
      let activeCfg = loadConnectionConfig();

      if (!current && typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('eon_explicit_logout')) {
        try {
          const guestSession = await startGuestSession(activeCfg);
          current = guestSession.user;
          activeCfg = { ...activeCfg, authToken: guestSession.accessToken };
          setConfig(activeCfg);
        } catch {
          // Will prompt or retry when user submits if backend is temporarily unreachable
        }
      }

      setUser(current);
      if (activeCfg.authToken !== config.authToken) {
        setConfig(activeCfg);
      }
      await refreshTasks(activeCfg);
    })();
  }, [config, refreshBackendProbe, refreshTasks]);

  // Live polling for active browser tasks
  useEffect(() => {
    if (
      !activeTask?.id ||
      activeTask.sourceType !== 'browser_task' ||
      isTerminalStatus(activeTask.status)
    ) {
      return;
    }

    const interval = setInterval(() => {
      void getTask(config, activeTask)
        .then((updated) => {
          setActiveTask(updated);
          setTasks((prev) =>
            prev.some((t) => t.id === updated.id)
              ? prev.map((t) => (t.id === updated.id ? updated : t))
              : [updated, ...prev]
          );
        })
        .catch(() => {
          // Transient poll errors ignored; next interval retries
        });
    }, 2200);

    return () => clearInterval(interval);
  }, [activeTask, config]);

  const promptAuth = useCallback((reason: string, retryAction?: () => Promise<void>) => {
    if (retryAction) {
      pendingActionRef.current = retryAction;
    }
    setAuthReason(reason);
    setAuthModalOpen(true);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('eon_explicit_logout');
    const session = await loginAccount(config, { email, password });
    setUser(session.user);
    const nextConfig = { ...config, authToken: session.accessToken };
    setConfig(nextConfig);
    setSubmissionError(null);
    await refreshBackendProbe(nextConfig);
    await refreshTasks(nextConfig);

    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending) {
      await pending();
    }
  };

  const handleRegister = async (displayName: string, email: string, password: string) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('eon_explicit_logout');
    const session = await registerAccount(config, { displayName, email, password });
    setUser(session.user);
    const nextConfig = { ...config, authToken: session.accessToken };
    setConfig(nextConfig);
    setSubmissionError(null);
    await refreshBackendProbe(nextConfig);
    await refreshTasks(nextConfig);

    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending) {
      await pending();
    }
  };

  const handleLogout = async () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('eon_explicit_logout', '1');
    await logoutAccount(config);
    setUser(null);
    const nextConfig = { ...config, authToken: '' };
    setConfig(nextConfig);
    setActiveTask(null);
    await refreshBackendProbe(nextConfig);
    await refreshTasks(nextConfig);
  };

  const handleGuestAccess = async () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('eon_explicit_logout');
    const session = await startGuestSession(config);
    setUser(session.user);
    const nextConfig = { ...config, authToken: session.accessToken };
    setConfig(nextConfig);
    setSubmissionError(null);
    await refreshBackendProbe(nextConfig);
    await refreshTasks(nextConfig);

    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending) {
      await pending();
    }
  };

  const ensureActiveSession = useCallback(
    async (baseCfg: ConnectionConfig): Promise<ConnectionConfig> => {
      if (baseCfg.authToken || loadAuthSession()?.accessToken) {
        return loadConnectionConfig();
      }
      const session = await startGuestSession(baseCfg);
      setUser(session.user);
      const nextConfig = { ...baseCfg, authToken: session.accessToken };
      setConfig(nextConfig);
      return nextConfig;
    },
    []
  );

  const handleCreateTask = async (
    prompt: string,
    mode: ExecutionMode,
    attachments?: AttachedContextFile[]
  ) => {
    const execute = async (forceConfig?: ConnectionConfig) => {
      setIsSubmitting(true);
      setSubmissionError(null);
      try {
        const activeConfig = forceConfig || (await ensureActiveSession(loadConnectionConfig()));
        const created = await createTask(activeConfig, prompt, {
          mode: mode === 'auto' ? undefined : mode,
          attachments,
        });
        setActiveTask(created);
        setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
        setActiveView('home');
      } catch (err) {
        if (err instanceof ApiEndpointError && err.state === 'unauthorized' && !err.tunnelAuthBlocked) {
          setUser(null);
          promptAuth('Sign in or continue as guest to run requests.', () => execute());
          return;
        }
        setSubmissionError(
          err instanceof Error ? err.message : 'Unable to send your request right now.'
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    await execute();
  };

  const handleStartBrowserTask = async (objective: string) => {
    setControlBusy(true);
    setSubmissionError(null);
    try {
      const activeConfig = await ensureActiveSession(loadConnectionConfig());
      const created = await startBrowserExecution(activeConfig, objective);
      setActiveTask(created);
      setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    } catch (err) {
      setSubmissionError(
        err instanceof Error ? err.message : 'Unable to start web task right now.'
      );
    } finally {
      setControlBusy(false);
    }
  };

  const handleFollowUpInput = async (taskId: string, text: string) => {
    const targetTask = activeTask?.id === taskId ? activeTask : tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    setControlBusy(true);
    setSubmissionError(null);
    try {
      const updated = await submitFollowUp(config, targetTask, text);
      setActiveTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      if (err instanceof ApiEndpointError && err.state === 'unauthorized' && !err.tunnelAuthBlocked) {
        setUser(null);
        promptAuth('Your session expired. Sign in again to continue.');
        return;
      }
      setSubmissionError(
        err instanceof Error ? err.message : 'Unable to send follow-up.'
      );
    } finally {
      setControlBusy(false);
    }
  };

  const handlePauseTask = async (taskId: string) => {
    const target = activeTask?.id === taskId ? activeTask : tasks.find((t) => t.id === taskId);
    if (!target) return;
    setControlBusy(true);
    try {
      if (target.browserTaskId) {
        const updated = await controlBrowserTask(
          config,
          target.browserTaskId,
          'pause',
          target.browserSessionId
        );
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleResumeTask = async (taskId: string) => {
    const target = activeTask?.id === taskId ? activeTask : tasks.find((t) => t.id === taskId);
    if (!target) return;
    setControlBusy(true);
    try {
      if (target.actionPlanId) {
        const updated = await controlActionPlan(config, target.actionPlanId, 'start');
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else if (target.browserTaskId) {
        const updated = await controlBrowserTask(
          config,
          target.browserTaskId,
          'resume',
          target.browserSessionId
        );
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    const target = activeTask?.id === taskId ? activeTask : tasks.find((t) => t.id === taskId);
    if (!target) return;
    setControlBusy(true);
    try {
      if (target.actionPlanId) {
        const updated = await controlActionPlan(config, target.actionPlanId, 'cancel');
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else if (target.browserTaskId) {
        const updated = await controlBrowserTask(
          config,
          target.browserTaskId,
          'cancel',
          target.browserSessionId
        );
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleRetryTask = async (task: TaskRecord) => {
    setControlBusy(true);
    try {
      const updated = await retryBackendTask(config, task);
      setActiveTask(updated);
      setTasks((prev) => [updated, ...prev.filter((t) => t.id !== updated.id)]);
    } finally {
      setControlBusy(false);
    }
  };

  const handleTakeoverBrowser = async (task: TaskRecord) => {
    if (!task.browserSessionId || !task.browserTaskId) return;
    setControlBusy(true);
    try {
      const updated = await toggleBrowserTakeover(
        config,
        task.browserSessionId,
        task.browserTaskId,
        'takeover'
      );
      if (updated) {
        setActiveTask((prev) => (prev?.id === task.id ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleReturnControlBrowser = async (task: TaskRecord) => {
    if (!task.browserSessionId || !task.browserTaskId) return;
    setControlBusy(true);
    try {
      const updated = await toggleBrowserTakeover(
        config,
        task.browserSessionId,
        task.browserTaskId,
        'return-control'
      );
      if (updated) {
        setActiveTask((prev) => (prev?.id === task.id ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleRespondApproval = async (
    taskId: string,
    _approvalId: string,
    decision: 'approve' | 'deny'
  ) => {
    const target = activeTask?.id === taskId ? activeTask : tasks.find((t) => t.id === taskId);
    if (!target) return;

    setControlBusy(true);
    try {
      if (target.browserTaskId) {
        const action = decision === 'approve' ? 'continue-after-intervention' : 'cancel';
        const updated = await controlBrowserTask(
          config,
          target.browserTaskId,
          action,
          target.browserSessionId
        );
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else if (target.actionPlanId) {
        const action = decision === 'approve' ? 'confirm' : 'cancel';
        const updated = await controlActionPlan(config, target.actionPlanId, action);
        setActiveTask((prev) => (prev?.id === taskId ? updated : prev));
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        // UI composition confirmation_interface: continue conversation with explicit confirmation
        const followText =
          decision === 'approve'
            ? 'Confirmed. Please proceed.'
            : 'Cancelled. Do not proceed with that action.';
        const updated = await submitFollowUp(config, target, followText);
        const cleared: TaskRecord = {
          ...updated,
          status: 'completed',
          pendingApproval: null,
        };
        saveLocalSessionTask(cleared);
        setActiveTask((prev) => (prev?.id === taskId ? cleared : prev));
        setTasks((prev) => prev.map((t) => (t.id === cleared.id ? cleared : t)));
      }
    } finally {
      setControlBusy(false);
    }
  };

  const handleSubmitForm = async (
    taskId: string,
    _formId: string,
    values: Record<string, unknown>
  ) => {
    const summary = Object.entries(values)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ');
    await handleFollowUpInput(taskId, summary);
  };

  const handleSaveArtifact = async (
    taskId: string,
    artifactId: string,
    content: string
  ) => {
    setActiveTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      const updated: TaskRecord = {
        ...prev,
        updatedAt: new Date().toISOString(),
        blocks: prev.blocks.map((b) =>
          b.type === 'editable_document' && (b.artifactId === artifactId || b.id === artifactId)
            ? { ...b, content, lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            : b
        ),
      };
      saveLocalSessionTask(updated);
      return updated;
    });
  };

  const handleSelectTask = async (task: TaskRecord) => {
    setActiveTask(task);
    setActiveView('home');
    setSubmissionError(null);
    if (task.sourceType === 'browser_task' || task.sourceType === 'event') {
      try {
        const fresh = await getTask(config, task);
        setActiveTask(fresh);
      } catch {
        // Keep cached summary
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId) || {
      id: taskId,
      prompt: '',
      title: '',
      status: 'completed' as const,
      createdAt: '',
      updatedAt: '',
      steps: [],
      blocks: [],
    };
    await deleteTask(config, target);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (activeTask?.id === taskId) {
      setActiveTask(null);
    }
  };

  const handleSaveConfig = async (nextConfig: ConnectionConfig) => {
    saveConnectionConfig(nextConfig);
    setConfig(nextConfig);
    await refreshBackendProbe(nextConfig);
    const current = await fetchCurrentUser(nextConfig);
    setUser(current);
    await refreshTasks(nextConfig);
  };

  const handleNewTask = () => {
    setActiveTask(null);
    setSubmissionError(null);
    setActiveView('home');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#050608] text-[#F3F5FA] flex flex-col">
        <TopBar
          activeView={activeView}
          onNavigate={setActiveView}
          onNewTask={handleNewTask}
          hasActiveTask={Boolean(activeTask)}
          user={user}
          onOpenAuth={() => promptAuth('Sign in to access your private EON workspace.')}
        />

        <main className="flex-1">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeView === 'home' && (
              <WorkspaceHomeView
                activeTask={activeTask}
                backendStatus={backendStatus}
                isSubmitting={isSubmitting}
                controlBusy={controlBusy}
                submissionError={submissionError}
                onCreateTask={handleCreateTask}
                onFollowUpInput={handleFollowUpInput}
                onPauseTask={handlePauseTask}
                onResumeTask={handleResumeTask}
                onCancelTask={handleCancelTask}
                onRetryTask={handleRetryTask}
                onRespondApproval={handleRespondApproval}
                onSubmitForm={handleSubmitForm}
                onSaveArtifact={handleSaveArtifact}
                onTranscribeAudio={(blob) => transcribeAudioWithBackend(config, blob)}
                onTakeoverBrowser={handleTakeoverBrowser}
                onReturnControlBrowser={handleReturnControlBrowser}
                onOpenSettings={() => setActiveView('settings')}
                onClearTask={handleNewTask}
              />
            )}

            {activeView === 'activity' && (
              <ActivityView
                activeTask={activeTask}
                tasks={tasks}
                loading={tasksLoading}
                error={tasksError}
                backendStatus={backendStatus}
                controlBusy={controlBusy}
                onRefresh={() => void refreshTasks()}
                onSelectTask={(t) => void handleSelectTask(t)}
                onPauseTask={handlePauseTask}
                onResumeTask={handleResumeTask}
                onCancelTask={handleCancelTask}
                onTakeoverBrowser={handleTakeoverBrowser}
                onReturnControlBrowser={handleReturnControlBrowser}
                onStartBrowserTask={handleStartBrowserTask}
                onRespondApproval={handleRespondApproval}
                onOpenSettings={() => setActiveView('settings')}
              />
            )}

            {activeView === 'history' && (
              <HistoryView
                tasks={tasks}
                historySource={historySource}
                loading={tasksLoading}
                error={tasksError}
                onRefresh={() => void refreshTasks()}
                onSelectTask={(t) => void handleSelectTask(t)}
                onDeleteTask={handleDeleteTask}
                onOpenSettings={() => setActiveView('settings')}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                config={config}
                backendStatus={backendStatus}
                probing={probing}
                user={user}
                onOpenAuth={() => promptAuth('Sign in or create an account to use EON.')}
                onLogout={handleLogout}
                onSaveConfig={handleSaveConfig}
                onProbe={async () => {
                  await refreshBackendProbe(config);
                }}
              />
            )}
          </motion.div>
        </main>

        <MobileNav activeView={activeView} onNavigate={setActiveView} />

        <AuthModal
          open={authModalOpen}
          reasonMessage={authReason}
          onClose={() => {
            pendingActionRef.current = null;
            setAuthModalOpen(false);
          }}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGuestAccess={handleGuestAccess}
        />
      </div>
    </MotionConfig>
  );
}
