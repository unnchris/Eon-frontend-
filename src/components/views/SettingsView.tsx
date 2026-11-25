import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mic,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { BackendStatus, ConnectionConfig, EndpointState } from '../../types/eon';
import { getVoiceCapabilities } from '../../services/voiceInput';

interface SettingsViewProps {
  config: ConnectionConfig;
  backendStatus: BackendStatus | null;
  probing: boolean;
  user: import('../../types/eon').EonUser | null;
  onOpenAuth: () => void;
  onLogout: () => Promise<void>;
  onSaveConfig: (next: ConnectionConfig) => Promise<void>;
  onProbe: () => Promise<void>;
}

const STATE_DISPLAY: Record<EndpointState, { label: string; className: string }> = {
  available: { label: 'Available', className: 'text-emerald-400' },
  missing: { label: 'Not exposed', className: 'text-[#8E96A8]' },
  unauthorized: { label: 'Access needed', className: 'text-amber-400' },
  unreachable: { label: 'Unavailable', className: 'text-rose-400' },
  unknown: { label: 'Unknown', className: 'text-[#6C7385]' },
};

export function SettingsView({
  config,
  backendStatus,
  probing,
  user,
  onOpenAuth,
  onLogout,
  onSaveConfig,
  onProbe,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<ConnectionConfig>(config);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const voiceCaps = getVoiceCapabilities();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveConfig({
        ...draft,
        baseUrl: draft.baseUrl.trim(),
        apiPrefix: draft.apiPrefix.trim(),
        authToken: draft.authToken.trim(),
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 pb-24 sm:px-6 sm:py-8">
      <div className="border-b border-white/[0.08] pb-5">
        <h1 className="font-display text-2xl font-semibold text-[#F3F5FA]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#98A1B5]">
          Manage your account, voice preferences, and how EON protects your private details.
        </p>
      </div>

      {/* Consumer Account Card */}
      <section className="mt-6 eon-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5B7CFA]/20 font-display text-base font-semibold text-[#9BB4FF]">
                  {user.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[#F3F5FA]">
                    {user.display_name}
                  </h2>
                  <p className="text-xs text-[#98A1B5]">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogoutClick()}
                className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.09] disabled:opacity-50"
              >
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <div>
                <h2 className="font-display text-base font-semibold text-[#F3F5FA]">
                  Sign in to your account
                </h2>
                <p className="mt-1 text-sm text-[#98A1B5]">
                  Sign in or create an account so EON can run requests and save your work.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex min-h-[42px] items-center rounded-full bg-[#F3F5FA] px-5 py-2 text-xs font-semibold text-[#050608] hover:bg-white"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </section>

      {/* Consumer Connection Status Card */}
      <section className="mt-5 eon-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {backendStatus?.connected ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            )}
            <div>
              <h2 className="font-display text-base font-semibold text-[#F3F5FA]">
                {backendStatus === null
                  ? 'Checking connection…'
                  : backendStatus.connected
                  ? 'EON is connected'
                  : 'Connection paused'}
              </h2>
              <p className="mt-1 text-sm text-[#98A1B5]">
                {backendStatus?.connected
                  ? 'Ready to answer questions, research, and run tasks.'
                  : backendStatus?.tunnelAuthBlocked
                  ? 'Your server requires public access or sign-in before this device can connect.'
                  : 'EON could not reach your assistant service right now.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={probing}
            onClick={() => void onProbe()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.09] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Check Again</span>
          </button>
        </div>
      </section>

      {/* Consumer Preferences & Privacy */}
      <section className="mt-5 eon-panel rounded-2xl divide-y divide-white/[0.06]">
        <div className="flex items-start gap-3.5 p-5 sm:p-6">
          <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[#9BB4FF]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-medium text-[#F3F5FA]">Voice input</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#98A1B5]">
              {voiceCaps.browserSpeechSupported || backendStatus?.capabilities.voice === 'available'
                ? 'Voice dictation is ready. Tap the microphone in the input bar anytime to speak.'
                : 'Speech recognition is unavailable in this browser. You can still type requests normally.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 p-5 sm:p-6">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-medium text-[#F3F5FA]">Approval before sensitive steps</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#98A1B5]">
              EON always asks your permission before making payments, changing account settings, or submitting verification codes.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 p-5 sm:p-6">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#98A1B5]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-medium text-[#F3F5FA]">Private credentials stay private</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#98A1B5]">
              Passwords and one-time codes are cleared immediately after confirmation and are never saved in your history.
            </p>
          </div>
        </div>
      </section>

      {/* Collapsible Server Setup (tucked neatly out of consumer sight unless needed) */}
      <section className="mt-5 eon-panel rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          className="flex min-h-[54px] w-full items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors sm:px-6"
        >
          <div>
            <span className="text-sm font-medium text-[#F3F5FA]">Server connection</span>
            <p className="text-xs text-[#7C8599]">Adjust the assistant server address or inspect service status</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-[#7C8599] transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {showAdvanced && (
          <div className="border-t border-white/[0.07] p-5 sm:p-6 space-y-6">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="eon-base-url" className="block text-xs font-medium text-[#98A1B5] mb-1.5">
                    Server URL
                  </label>
                  <input
                    id="eon-base-url"
                    type="url"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((p) => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://your-server.example.com"
                    className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 font-mono text-xs text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="eon-api-prefix" className="block text-xs font-medium text-[#98A1B5] mb-1.5">
                    Path Prefix
                  </label>
                  <input
                    id="eon-api-prefix"
                    type="text"
                    value={draft.apiPrefix}
                    onChange={(e) => setDraft((p) => ({ ...p, apiPrefix: e.target.value }))}
                    placeholder="/api/v1"
                    className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 font-mono text-xs text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="eon-auth-token" className="block text-xs font-medium text-[#98A1B5] mb-1.5">
                    Access Token (optional)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="eon-auth-token"
                      type={showToken ? 'text' : 'password'}
                      autoComplete="off"
                      value={draft.authToken}
                      onChange={(e) => setDraft((p) => ({ ...p, authToken: e.target.value }))}
                      placeholder="Optional bearer token"
                      className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 pr-11 font-mono text-xs text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                      className="absolute right-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#7C8599] hover:text-[#F3F5FA]"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="eon-stream-mode" className="block text-xs font-medium text-[#98A1B5] mb-1.5">
                    Live Updates
                  </label>
                  <select
                    id="eon-stream-mode"
                    value={draft.streamMode}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        streamMode: e.target.value as ConnectionConfig['streamMode'],
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 text-sm text-[#F3F5FA] focus:border-[#5B7CFA] focus:outline-none"
                  >
                    <option value="auto">Automatic</option>
                    <option value="sse">Streaming</option>
                    <option value="poll">Periodic check</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#F3F5FA] px-5 py-2 text-xs font-semibold text-[#050608] hover:bg-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save & Reconnect'}
                </button>
                {savedNotice && <span className="text-xs text-emerald-400">Saved</span>}
              </div>
            </form>

            {backendStatus && (
              <div className="border-t border-white/[0.06] pt-4">
                <h3 className="text-xs font-medium text-[#98A1B5] mb-2.5">Service diagnostics</h3>
                {backendStatus.error && (
                  <p className="mb-3 text-xs text-amber-300">{backendStatus.error}</p>
                )}
                <ul className="divide-y divide-white/[0.05] text-xs">
                  {backendStatus.endpoints.map((ep) => {
                    const st = STATE_DISPLAY[ep.state];
                    return (
                      <li key={`${ep.name}-${ep.path}`} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-[#D2D8E6]">{ep.name}</span>
                        <span className={st.className}>{st.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
