import { useState } from 'react';
import { Check, Eye, EyeOff, Lock, ShieldAlert, X } from 'lucide-react';
import type { ApprovalRequest } from '../../types/eon';

interface SensitiveApprovalCardProps {
  approval: ApprovalRequest;
  onRespond: (
    approvalId: string,
    decision: 'approve' | 'deny',
    inputs?: Record<string, string>
  ) => Promise<void>;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<ApprovalRequest['category'], string> = {
  password: 'Credential verification',
  otp: 'One-time verification code',
  payment: 'Payment authorization',
  account_change: 'Account modification',
  external_action: 'External action confirmation',
  sensitive: 'Sensitive action approval',
};

const RISK_STYLES: Record<'low' | 'medium' | 'high', { label: string; textClass: string }> = {
  low: { label: 'Low sensitivity', textClass: 'text-[#9CA3B3]' },
  medium: { label: 'Elevated sensitivity', textClass: 'text-amber-400' },
  high: { label: 'High sensitivity', textClass: 'text-rose-400' },
};

export function SensitiveApprovalCard({
  approval,
  onRespond,
  disabled = false,
}: SensitiveApprovalCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isResolved = approval.status === 'approved' || approval.status === 'denied';
  const risk = RISK_STYLES[approval.riskLevel || 'medium'];

  const handleAction = async (decision: 'approve' | 'deny') => {
    setValidationError(null);

    if (decision === 'approve' && approval.fields) {
      for (const field of approval.fields) {
        if (field.required && !(values[field.name] || '').trim()) {
          setValidationError(`${field.label} is required to proceed.`);
          return;
        }
      }
    }

    setSubmitting(decision);
    const payload = decision === 'approve' && approval.fields ? { ...values } : undefined;
    try {
      await onRespond(approval.id, decision, payload);
      // Immediately clear sensitive inputs from memory
      setValues({});
      setRevealed({});
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section
      aria-label="User approval required"
      className="eon-panel rounded-2xl border-amber-400/30 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-amber-400 font-medium">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{CATEGORY_LABELS[approval.category]}</span>
        </div>
        <div className="flex items-center gap-2 text-[#8E95A5]">
          <span className={risk.textClass}>{risk.label}</span>
          {approval.domain && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[#9CA3B3]">{approval.domain}</span>
            </>
          )}
        </div>
      </div>

      <h3 className="mt-3 font-display text-lg font-semibold text-[#F4F5F7]">
        {approval.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#9CA3B3]">
        {approval.description}
      </p>

      {(approval.target || approval.amount) && (
        <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
          {approval.target && (
            <div>
              <dt className="text-xs text-[#6C7385]">Target</dt>
              <dd className="mt-0.5 text-sm font-medium text-[#F4F5F7] break-all">
                {approval.target}
              </dd>
            </div>
          )}
          {approval.amount && (
            <div>
              <dt className="text-xs text-[#6C7385]">Amount</dt>
              <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-[#F4F5F7]">
                {approval.amount}
              </dd>
            </div>
          )}
        </dl>
      )}

      {!isResolved && approval.fields && approval.fields.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
          {approval.fields.map((field) => {
            const isMasked = field.type === 'password' || field.type === 'otp' || field.sensitive;
            const isVisible = Boolean(revealed[field.name]);
            return (
              <div key={field.name}>
                <label
                  htmlFor={`approval-${approval.id}-${field.name}`}
                  className="block text-xs font-medium text-[#9CA3B3] mb-1.5"
                >
                  {field.label}
                  {field.required && <span className="text-amber-400 ml-1">*</span>}
                </label>
                <div className="relative flex items-center">
                  <input
                    id={`approval-${approval.id}-${field.name}`}
                    type={isMasked && !isVisible ? 'password' : 'text'}
                    inputMode={field.type === 'otp' ? 'numeric' : 'text'}
                    autoComplete={field.type === 'otp' ? 'one-time-code' : 'off'}
                    spellCheck={false}
                    value={values[field.name] || ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder || (field.type === 'otp' ? 'Enter verification code' : '')}
                    disabled={disabled || submitting !== null}
                    className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#090A0D] px-3.5 pr-11 text-sm text-[#F4F5F7] placeholder:text-[#6C7385] focus:border-[#6E7BF2] focus:outline-none"
                  />
                  {isMasked && (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((prev) => ({ ...prev, [field.name]: !prev[field.name] }))
                      }
                      aria-label={isVisible ? `Hide ${field.label}` : `Show ${field.label}`}
                      className="absolute right-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#8E95A5] hover:text-[#F4F5F7]"
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="flex items-center gap-1.5 text-xs text-[#6C7385]">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Sensitive values are transmitted directly to the active session and excluded from logs and history.</span>
          </p>
        </div>
      )}

      {validationError && (
        <p role="alert" className="mt-3 text-xs text-rose-400">
          {validationError}
        </p>
      )}

      {isResolved ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3 text-xs font-medium text-[#9CA3B3]">
          {approval.status === 'approved' ? 'Approved by user' : 'Denied by user'}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            disabled={disabled || submitting !== null}
            onClick={() => void handleAction('approve')}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#6E7BF2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#7F8BF5] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>{submitting === 'approve' ? 'Authorizing...' : 'Approve & Continue'}</span>
          </button>

          <button
            type="button"
            disabled={disabled || submitting !== null}
            onClick={() => void handleAction('deny')}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-[#171A21] px-5 py-2.5 text-sm font-medium text-[#F4F5F7] hover:bg-[#1D212A] transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{submitting === 'deny' ? 'Denying...' : 'Deny Action'}</span>
          </button>
        </div>
      )}
    </section>
  );
}
