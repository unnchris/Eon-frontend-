import { useEffect, useState } from 'react';
import { Loader2, Lock, X } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  reasonMessage?: string | null;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (displayName: string, email: string, password: string) => Promise<void>;
  onGuestAccess: () => Promise<void>;
}

export function AuthModal({
  open,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onLogin,
  onRegister,
  onGuestAccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password.length < 12) {
      setError('Please choose a password with at least 12 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(displayName, email, password);
      }
      setPassword('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'login'
          ? 'Could not sign in with those credentials.'
          : 'Could not create your account.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="eon-auth-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-white/[0.10] bg-[#0B0D12] p-6 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04]">
              <Lock className="h-4 w-4 text-[#9BB4FF]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="eon-auth-title" className="font-display text-lg font-semibold text-[#F3F5FA]">
                {mode === 'login' ? 'Sign in to EON' : 'Create your EON account'}
              </h2>
              <p className="text-xs text-[#8E96A8]">
                {reasonMessage || 'Your personal workspace stays private to you.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close sign in"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#7C8599] hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
              mode === 'login' ? 'bg-white/[0.12] text-[#F3F5FA]' : 'text-[#8E96A8] hover:text-white'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
              mode === 'register' ? 'bg-white/[0.12] text-[#F3F5FA]' : 'text-[#8E96A8] hover:text-white'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-display-name" className="mb-1.5 block text-xs font-medium text-[#98A1B5]">
                Your name
              </label>
              <input
                id="auth-display-name"
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="h-12 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 text-sm text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-[#98A1B5]">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 text-sm text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-xs font-medium text-[#98A1B5]">
                Password
              </label>
              {mode === 'register' && (
                <span className="text-[11px] text-[#7C8599]">12+ characters</span>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === 'register' ? 12 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Choose a strong password' : 'Enter your password'}
              className="h-12 w-full rounded-xl border border-white/[0.10] bg-[#050608] px-3.5 text-sm text-[#F3F5FA] placeholder:text-[#5F677A] focus:border-[#5B7CFA] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#F3F5FA] px-5 py-3 text-sm font-semibold text-[#050608] hover:bg-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11px] uppercase tracking-wider text-[#6C7385]">or</span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setError(null);
            setSubmitting(true);
            void onGuestAccess()
              .then(() => {
                setPassword('');
                onClose();
              })
              .catch((err) => {
                setError(
                  err instanceof Error ? err.message : 'Unable to start a guest session right now.'
                );
              })
              .finally(() => setSubmitting(false));
          }}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-xs font-medium text-[#D7DBE4] hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
        >
          Continue without an account
        </button>
      </div>
    </div>
  );
}
