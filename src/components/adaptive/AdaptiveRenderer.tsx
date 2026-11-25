import { useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  ExternalLink,
  FileEdit,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
} from 'lucide-react';
import type {
  AdaptiveBlock,
  CardCollectionBlock,
  ChartBlock,
  ChecklistBlock,
  EditableDocumentBlock,
  FormBlock,
  InformationCardBlock,
  InteractiveLessonBlock,
  TableBlock,
  TaskStatus,
  TaskWorkspaceBlock,
} from '../../types/eon';
import { BrowserActivityView } from './BrowserActivityView';
import { SensitiveApprovalCard } from './SensitiveApprovalCard';

export interface AdaptiveActionHandlers {
  taskStatus?: TaskStatus;
  controlBusy?: boolean;
  onPauseTask?: () => void;
  onResumeTask?: () => void;
  onCancelTask?: () => void;
  onRetryTask?: () => void;
  onOpenSettings?: () => void;
  onRespondApproval?: (
    approvalId: string,
    decision: 'approve' | 'deny',
    inputs?: Record<string, string>
  ) => Promise<void>;
  onSubmitForm?: (formId: string, values: Record<string, unknown>) => Promise<void>;
  onSaveArtifact?: (artifactId: string, content: string) => Promise<void>;
  onStartPlan?: () => void;
  onFollowUp?: (text: string) => void;
  onTakeoverBrowser?: () => void;
  onReturnControlBrowser?: () => void;
}

interface AdaptiveRendererProps {
  blocks: AdaptiveBlock[];
  handlers: AdaptiveActionHandlers;
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '0s';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171A21] px-3 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-[#F4F5F7] transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ProseText({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-[1.65] text-[#D7DBE4]">
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const codeBody = lines.slice(1, lines[lines.length - 1]?.startsWith('```') ? -1 : undefined).join('\n');
          return (
            <pre
              key={idx}
              className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#090A0D] p-4 font-mono text-xs leading-relaxed text-[#E2E6F0]"
            >
              <code>{codeBody}</code>
            </pre>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-display text-base font-semibold text-[#F4F5F7] pt-1">
              {trimmed.slice(4)}
            </h4>
          );
        }

        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h3 key={idx} className="font-display text-lg font-semibold text-[#F4F5F7] pt-1">
              {trimmed.replace(/^#{1,2}\s+/, '')}
            </h3>
          );
        }

        const lines = trimmed.split('\n');
        if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
          return (
            <ul key={idx} className="space-y-1.5 pl-5 list-disc marker:text-[#6E7BF2]">
              {lines.map((l, i) => (
                <li key={i}>{l.trim().replace(/^[-*]\s+/, '')}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function EditableDocumentCard({
  block,
  onSave,
}: {
  block: EditableDocumentBlock;
  onSave?: (artifactId: string, content: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(block.content);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | undefined>(block.lastSavedAt);
  const [saveError, setSaveError] = useState<string | null>(null);

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  const handleSave = async () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(block.artifactId || block.id, draft);
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save artifact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#8E95A5]">
            <span>Artifact</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{wordCount} words</span>
            {savedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>Saved {savedAt}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold text-[#F4F5F7]">
            {block.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={draft} />
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `${block.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'artifact'}.${
                  block.format === 'markdown' ? 'md' : 'txt'
                }`,
                draft
              )
            }
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171A21] px-3 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-[#F4F5F7] transition-colors"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export</span>
          </button>

          {!block.readOnly && (
            isEditing ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#6E7BF2] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{onSave ? 'Save' : 'Done'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.10] bg-[#171A21] px-3.5 py-1.5 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A] transition-colors"
              >
                <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Edit</span>
              </button>
            )
          )}
        </div>
      </div>

      {saveError && (
        <p role="alert" className="mt-3 text-xs text-rose-400">
          {saveError}
        </p>
      )}

      <div className="mt-4">
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            aria-label={`Edit ${block.title}`}
            className="w-full rounded-xl border border-white/[0.10] bg-[#090A0D] p-4 font-mono text-xs leading-relaxed text-[#F4F5F7] focus:border-[#6E7BF2] focus:outline-none"
          />
        ) : block.format === 'code' ? (
          <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#090A0D] p-4 font-mono text-xs leading-relaxed text-[#E2E6F0]">
            <code>{draft}</code>
          </pre>
        ) : (
          <ProseText content={draft} />
        )}
      </div>
    </section>
  );
}

function ChecklistCard({ block }: { block: ChecklistBlock }) {
  const [items, setItems] = useState(block.items);
  const completedCount = items.filter((i) => i.checked).length;

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3.5">
        <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{block.title}</h3>
        <span className="font-mono text-xs tabular-nums text-[#8E95A5]">
          {completedCount}/{items.length}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="flex min-h-[44px] w-full items-start gap-3 py-2.5 text-left transition-colors hover:text-white"
            >
              {item.checked ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6E7BF2]" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#6C7385]" aria-hidden="true" />
              )}
              <div>
                <span
                  className={`text-sm ${
                    item.checked ? 'text-[#8E95A5] line-through' : 'text-[#F4F5F7]'
                  }`}
                >
                  {item.label}
                </span>
                {item.note && <p className="mt-0.5 text-xs text-[#6C7385]">{item.note}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InteractiveFormCard({
  block,
  onSubmit,
}: {
  block: FormBlock;
  onSubmit?: (formId: string, values: Record<string, unknown>) => Promise<void>;
}) {
  const initial: Record<string, unknown> = {};
  for (const field of block.fields) {
    initial[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
  }

  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(block.submitted));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(block.id, values);
      setSubmitted(true);
      // Clear any sensitive fields from memory immediately
      const scrubbed = { ...values };
      for (const f of block.fields) {
        if (f.type === 'password' || f.type === 'otp' || f.sensitive) {
          scrubbed[f.name] = '';
        }
      }
      setValues(scrubbed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit form.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{block.title}</h3>
      {block.description && (
        <p className="mt-1 text-sm text-[#9CA3B3]">{block.description}</p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
        {block.fields.map((field) => {
          const val = values[field.name];
          const inputId = `form-${block.id}-${field.name}`;

          if (field.type === 'checkbox') {
            return (
              <label key={field.name} htmlFor={inputId} className="flex min-h-[44px] items-center gap-3 text-sm text-[#F4F5F7]">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={Boolean(val)}
                  disabled={submitted || submitting}
                  onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-[#090A0D] accent-[#6E7BF2]"
                />
                <span>{field.label}</span>
              </label>
            );
          }

          return (
            <div key={field.name}>
              <label htmlFor={inputId} className="block text-xs font-medium text-[#9CA3B3] mb-1.5">
                {field.label}
                {field.required && <span className="text-amber-400 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={inputId}
                  rows={3}
                  required={field.required}
                  disabled={submitted || submitting}
                  placeholder={field.placeholder}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="w-full rounded-xl border border-white/[0.10] bg-[#090A0D] px-3.5 py-2.5 text-sm text-[#F4F5F7] placeholder:text-[#6C7385] focus:border-[#6E7BF2] focus:outline-none"
                />
              ) : field.type === 'select' ? (
                <select
                  id={inputId}
                  required={field.required}
                  disabled={submitted || submitting}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#090A0D] px-3.5 text-sm text-[#F4F5F7] focus:border-[#6E7BF2] focus:outline-none"
                >
                  <option value="">Select an option</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={inputId}
                  type={field.type === 'otp' || field.sensitive ? 'password' : field.type}
                  inputMode={field.type === 'otp' || field.type === 'number' ? 'numeric' : undefined}
                  autoComplete={field.type === 'password' || field.type === 'otp' ? 'off' : undefined}
                  required={field.required}
                  disabled={submitted || submitting}
                  placeholder={field.placeholder}
                  value={String(val ?? '')}
                  onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/[0.10] bg-[#090A0D] px-3.5 text-sm text-[#F4F5F7] placeholder:text-[#6C7385] focus:border-[#6E7BF2] focus:outline-none"
                />
              )}
            </div>
          );
        })}

        {error && (
          <p role="alert" className="text-xs text-rose-400">
            {error}
          </p>
        )}

        <div className="pt-1">
          {submitted ? (
            <p className="text-xs font-medium text-emerald-400">Input submitted to EON</p>
          ) : (
            <button
              type="submit"
              disabled={submitting || !onSubmit}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#6E7BF2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : block.submitLabel || 'Submit'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function DataTableCard({ block }: { block: TableBlock }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const sortedRows = [...block.rows].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortAsc ? va - vb : vb - va;
    }
    return sortAsc
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const exportCsv = () => {
    const header = block.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const body = sortedRows
      .map((row) =>
        block.columns
          .map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    downloadTextFile(
      `${block.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'table'}.csv`,
      `${header}\n${body}`,
      'text/csv'
    );
  };

  return (
    <section className="overflow-hidden eon-panel rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{block.title}</h3>
          <p className="mt-0.5 text-xs tabular-nums text-[#8E95A5]">
            {block.rows.length} rows
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171A21] px-3 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-[#F4F5F7]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-[#14171E] text-xs font-medium text-[#8E95A5]">
              {block.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (sortKey === col.key) setSortAsc(!sortAsc);
                      else {
                        setSortKey(col.key);
                        setSortAsc(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 hover:text-[#F4F5F7]"
                  >
                    <span>{col.label}</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {sortedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-[#171A21]/70 transition-colors">
                {block.columns.map((col) => {
                  const val = row[col.key];
                  const isNumeric = typeof val === 'number' || col.align === 'right';
                  return (
                    <td
                      key={col.key}
                      className={`px-5 py-3 text-[#D7DBE4] ${
                        isNumeric ? 'text-right font-mono text-xs tabular-nums' : ''
                      }`}
                    >
                      {val === null || val === undefined ? '—' : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InformationCardView({ block }: { block: InformationCardBlock }) {
  const toneBorder: Record<InformationCardBlock['tone'], string> = {
    neutral: 'border-white/[0.08]',
    informative: 'border-[#5B7CFA]/30',
    positive: 'border-emerald-500/30',
    caution: 'border-amber-500/30',
  };

  return (
    <section className={`eon-panel rounded-2xl p-5 sm:p-6 ${toneBorder[block.tone] || toneBorder.neutral}`}>
      {block.eyebrow && (
        <p className="text-xs font-medium tracking-wide text-[#9BB4FF] mb-1.5">{block.eyebrow}</p>
      )}
      <h3 className="font-display text-lg font-semibold text-[#F4F5F7]">{block.title}</h3>
      <div className="mt-3">
        <ProseText content={block.body} />
      </div>
    </section>
  );
}

function CardCollectionView({ block }: { block: CardCollectionBlock }) {
  return (
    <div
      className={
        block.layout === 'list'
          ? 'space-y-3'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2'
      }
    >
      {block.cards.map((card) => (
        <section key={card.card_id} className="eon-panel rounded-2xl p-5">
          <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{card.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#D7DBE4]">{card.body}</p>
          {card.detail && (
            <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-xs text-[#8E95A5]">
              {card.detail}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function InteractiveLessonView({
  block,
  onFollowUp,
}: {
  block: InteractiveLessonBlock;
  onFollowUp?: (text: string) => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const step = block.steps[stepIdx] || block.steps[0];
  if (!step) return null;

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <p className="text-xs text-[#8E95A5]">
            Interactive Guide · Step {stepIdx + 1} of {block.steps.length}
            {block.estimatedMinutes ? ` · ~${block.estimatedMinutes} min` : ''}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-[#F4F5F7]">{block.title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {block.steps.map((s, idx) => (
            <button
              key={s.step_id}
              type="button"
              onClick={() => {
                setStepIdx(idx);
                setAnswer('');
              }}
              aria-label={`Go to step ${idx + 1}: ${s.title}`}
              className={`h-2 rounded-full transition-all ${
                idx === stepIdx ? 'w-6 bg-[#5B7CFA]' : 'w-2 bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      {block.objective && (
        <p className="mt-3 text-xs text-[#8E95A5]">{block.objective}</p>
      )}

      <div className="mt-4">
        <h4 className="font-display text-base font-semibold text-[#F4F5F7]">{step.title}</h4>
        <div className="mt-2">
          <ProseText content={step.content} />
        </div>

        {step.prompt && (
          <p className="mt-4 text-sm font-medium text-[#9BB4FF]">{step.prompt}</p>
        )}

        {step.response_mode === 'single_choice' && step.choices && step.choices.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {step.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  setAnswer(choice);
                  onFollowUp?.(`For "${step.title}", I choose: ${choice}`);
                }}
                className={`min-h-[40px] rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                  answer === choice
                    ? 'border-[#5B7CFA] bg-[#5B7CFA]/20 text-white'
                    : 'border-white/[0.10] bg-white/[0.04] text-[#D7DBE4] hover:bg-white/[0.08]'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {step.response_mode === 'free_text' && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer..."
              className="h-11 flex-1 rounded-xl border border-white/[0.10] bg-[#090A0D] px-3.5 text-sm text-[#F3F5FA] placeholder:text-[#666E80] focus:border-[#5B7CFA] focus:outline-none"
            />
            <button
              type="button"
              disabled={!answer.trim() || !onFollowUp}
              onClick={() => {
                if (!answer.trim()) return;
                onFollowUp?.(`My response to "${step.title}": ${answer.trim()}`);
                setAnswer('');
              }}
              className="min-h-[44px] rounded-xl bg-[#F3F5FA] px-4 py-2 text-xs font-semibold text-[#050608] hover:bg-white disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <button
          type="button"
          disabled={stepIdx === 0}
          onClick={() => {
            setStepIdx((i) => Math.max(0, i - 1));
            setAnswer('');
          }}
          className="min-h-[38px] rounded-full border border-white/[0.10] px-4 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-white disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={stepIdx >= block.steps.length - 1}
          onClick={() => {
            setStepIdx((i) => Math.min(block.steps.length - 1, i + 1));
            setAnswer('');
          }}
          className="min-h-[38px] rounded-full bg-white/[0.08] px-4 py-1.5 text-xs font-medium text-[#F3F5FA] hover:bg-white/[0.14] disabled:opacity-40"
        >
          Next step
        </button>
      </div>
    </section>
  );
}

function ChartView({ block }: { block: ChartBlock }) {
  const firstSeries = block.series[0];
  if (!firstSeries || block.labels.length === 0) return null;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(1, ...allValues);

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
        <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{block.title}</h3>
        {block.unit && (
          <span className="font-mono text-xs text-[#8E95A5]">{block.unit}</span>
        )}
      </div>

      {block.series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#9CA3B3]">
          {block.series.map((ser, idx) => (
            <span key={ser.name} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  idx === 0 ? 'bg-[#5B7CFA]' : idx === 1 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {ser.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {block.labels.map((label, i) => {
          const val = firstSeries.values[i] ?? 0;
          const pct = Math.max(2, Math.round((val / maxVal) * 100));
          return (
            <div key={`${label}-${i}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#D7DBE4]">{label}</span>
                <span className="font-mono tabular-nums text-[#9CA3B3]">
                  {val}
                  {block.unit ? ` ${block.unit}` : ''}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#5B7CFA] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskWorkspaceView({ block }: { block: TaskWorkspaceBlock }) {
  const [tasks, setTasks] = useState(block.tasks);

  const cycleStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.task_id !== taskId) return t;
        const next = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
        return { ...t, status: next };
      })
    );
  };

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <section className="eon-panel rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
        <div>
          <h3 className="font-display text-base font-semibold text-[#F4F5F7]">{block.title}</h3>
          {block.summary && <p className="mt-1 text-xs text-[#8E95A5]">{block.summary}</p>}
        </div>
        <span className="font-mono text-xs tabular-nums text-[#8E95A5]">
          {doneCount}/{tasks.length}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-white/[0.05]">
        {tasks.map((t) => (
          <li key={t.task_id}>
            <button
              type="button"
              onClick={() => cycleStatus(t.task_id)}
              className="flex min-h-[48px] w-full items-start gap-3 py-3 text-left hover:text-white transition-colors"
            >
              {t.status === 'done' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : t.status === 'in_progress' ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9BB4FF]" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#6C7385]" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    t.status === 'done' ? 'text-[#8E95A5] line-through' : 'text-[#F4F5F7]'
                  }`}
                >
                  {t.title}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-[#8E95A5]">{t.description}</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdaptiveRenderer({ blocks, handlers }: AdaptiveRendererProps) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        switch (block.type) {
          case 'information_card':
            return <InformationCardView key={block.id} block={block} />;

          case 'card_collection':
            return <CardCollectionView key={block.id} block={block} />;

          case 'interactive_lesson':
            return (
              <InteractiveLessonView
                key={block.id}
                block={block}
                onFollowUp={handlers.onFollowUp}
              />
            );

          case 'chart':
            return <ChartView key={block.id} block={block} />;

          case 'task_workspace':
            return <TaskWorkspaceView key={block.id} block={block} />;

          case 'text':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                {block.title && (
                  <h3 className="mb-3 font-display text-lg font-semibold text-[#F4F5F7]">
                    {block.title}
                  </h3>
                )}
                <ProseText content={block.content} />
              </section>
            );

          case 'task_plan':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <p className="text-xs text-[#8E95A5]">Execution Plan</p>
                    <h3 className="mt-1 font-display text-lg font-semibold text-[#F4F5F7]">
                      {block.title}
                    </h3>
                  </div>
                  {block.requiresConfirmation && handlers.onStartPlan && (
                    <button
                      type="button"
                      disabled={handlers.controlBusy}
                      onClick={handlers.onStartPlan}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#6E7BF2] px-4 py-2 text-xs font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Run Plan</span>
                    </button>
                  )}
                </div>
                {block.summary && (
                  <p className="mt-3 text-sm text-[#9CA3B3] leading-relaxed">{block.summary}</p>
                )}
                <ol className="mt-4 space-y-3">
                  {block.steps.map((step, idx) => (
                    <li
                      key={step.id}
                      className="flex items-start gap-3.5 border-b border-white/[0.05] pb-3 last:border-b-0 last:pb-0"
                    >
                      <span className="mt-0.5 font-mono text-xs tabular-nums text-[#6C7385] w-5 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[#F4F5F7]">{step.title}</span>
                          {step.tool && (
                            <span className="text-xs font-mono text-[#6C7385]">
                              · {step.tool}
                            </span>
                          )}
                        </div>
                        {step.detail && (
                          <p className="mt-0.5 text-xs text-[#8E95A5]">{step.detail}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );

          case 'task_progress': {
            const pct =
              block.totalCount > 0
                ? Math.round((block.completedCount / block.totalCount) * 100)
                : 0;
            const status = handlers.taskStatus;
            const canPause = status === 'running' || status === 'planning';
            const canResume = status === 'paused';
            const canCancel =
              status === 'running' ||
              status === 'planning' ||
              status === 'paused' ||
              status === 'awaiting_approval' ||
              status === 'awaiting_input';

            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#8E95A5]">
                      <span>Progress</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {block.completedCount}/{block.totalCount} steps ({pct}%)
                      </span>
                      {block.elapsedMs !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDuration(block.elapsedMs)}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-[#F4F5F7]">
                      {block.currentStep || block.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {canPause && handlers.onPauseTask && (
                      <button
                        type="button"
                        disabled={handlers.controlBusy}
                        onClick={handlers.onPauseTask}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.10] bg-[#171A21] px-3.5 py-2 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A] disabled:opacity-50"
                      >
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pause</span>
                      </button>
                    )}
                    {canResume && handlers.onResumeTask && (
                      <button
                        type="button"
                        disabled={handlers.controlBusy}
                        onClick={handlers.onResumeTask}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#6E7BF2] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#7F8BF5] disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Resume</span>
                      </button>
                    )}
                    {canCancel && handlers.onCancelTask && (
                      <button
                        type="button"
                        disabled={handlers.controlBusy}
                        onClick={handlers.onCancelTask}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.10] bg-[#171A21] px-3.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#6E7BF2] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <ol className="mt-4 space-y-2.5">
                  {block.steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-3 text-sm">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                      ) : step.status === 'active' ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#7F8BF5]" aria-hidden="true" />
                      ) : step.status === 'failed' ? (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#4E5566]" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={
                              step.status === 'completed'
                                ? 'text-[#9CA3B3]'
                                : step.status === 'active'
                                ? 'font-medium text-[#F4F5F7]'
                                : 'text-[#6C7385]'
                            }
                          >
                            {step.title}
                          </span>
                          {step.durationMs !== undefined && (
                            <span className="font-mono text-xs tabular-nums text-[#6C7385]">
                              {formatDuration(step.durationMs)}
                            </span>
                          )}
                        </div>
                        {step.detail && (
                          <p className="mt-0.5 text-xs text-[#6C7385]">{step.detail}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          }

          case 'research_results':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <p className="text-xs text-[#8E95A5]">
                      Research Synthesis · <span className="tabular-nums">{block.sources.length} sources</span>
                    </p>
                    <h3 className="mt-1 font-display text-lg font-semibold text-[#F4F5F7]">
                      {block.title}
                    </h3>
                  </div>
                  <CopyButton
                    text={`${block.title}\n\n${block.summary}\n\n${block.keyFindings
                      .map((f) => `## ${f.heading}\n${f.detail}`)
                      .join('\n\n')}`}
                  />
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-[#D7DBE4]">
                  {block.summary}
                </p>

                {block.keyFindings.length > 0 && (
                  <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-5">
                    <h4 className="text-xs font-medium text-[#8E95A5]">Key Findings</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {block.keyFindings.map((finding, idx) => (
                        <div
                          key={idx}
                          className="border-b border-white/[0.05] pb-3 md:border-b-0"
                        >
                          <h5 className="text-sm font-semibold text-[#F4F5F7]">
                            {finding.heading}
                          </h5>
                          <p className="mt-1 text-sm leading-relaxed text-[#9CA3B3]">
                            {finding.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {block.sources.length > 0 && (
                  <div className="mt-6 border-t border-white/[0.06] pt-5">
                    <h4 className="text-xs font-medium text-[#8E95A5]">Verified Sources</h4>
                    <ul className="mt-3 divide-y divide-white/[0.05]">
                      {block.sources.map((src, idx) => (
                        <li key={src.id || idx} className="py-2.5 first:pt-0 last:pb-0">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#F4F5F7] group-hover:text-[#7F8BF5] transition-colors">
                                {src.title}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-xs text-[#6C7385]">
                                {src.domain || src.url}
                                {src.publishedAt ? ` · ${src.publishedAt}` : ''}
                              </p>
                              {src.snippet && (
                                <p className="mt-1 text-xs text-[#9CA3B3] line-clamp-2">
                                  {src.snippet}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-[#6C7385] group-hover:text-[#7F8BF5]" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );

          case 'search_results':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="border-b border-white/[0.06] pb-3.5">
                  <p className="text-xs text-[#8E95A5]">
                    Search Results{block.query ? ` · ${block.query}` : ''}
                  </p>
                </div>
                <ul className="mt-3 divide-y divide-white/[0.05]">
                  {block.results.map((item, idx) => (
                    <li key={item.id || idx} className="py-3 first:pt-1 last:pb-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#F4F5F7] group-hover:text-[#7F8BF5] transition-colors">
                            {item.title}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#6C7385]" aria-hidden="true" />
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-[#6C7385]">
                          {item.domain || item.url}
                        </p>
                        {item.snippet && (
                          <p className="mt-1.5 text-sm leading-relaxed text-[#9CA3B3]">
                            {item.snippet}
                          </p>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );

          case 'website_preview':
            return (
              <section
                key={block.id}
                className="overflow-hidden eon-panel rounded-2xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#171A21] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-[#F4F5F7]">
                      {block.title}
                    </h3>
                    <p className="truncate font-mono text-xs text-[#6C7385]">{block.url}</p>
                  </div>
                  <a
                    href={block.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.10] bg-[#111318] px-3 py-1.5 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A]"
                  >
                    <span>Open Site</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
                {block.screenshotUrl ? (
                  <img
                    src={block.screenshotUrl}
                    alt={`Preview of ${block.title}`}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[360px] object-cover bg-[#090A0D]"
                  />
                ) : block.embeddable ? (
                  <iframe
                    src={block.url}
                    title={block.title}
                    sandbox="allow-scripts allow-same-origin"
                    className="h-[360px] w-full bg-white"
                  />
                ) : (
                  <div className="p-5 text-sm text-[#9CA3B3]">
                    {block.description || 'External website reference attached. Open directly to view live content.'}
                  </div>
                )}
              </section>
            );

          case 'browser_activity':
            return (
              <BrowserActivityView
                key={block.id}
                session={block.session}
                taskStatus={handlers.taskStatus}
                onPause={handlers.onPauseTask}
                onResume={handlers.onResumeTask}
                onCancel={handlers.onCancelTask}
                onTakeover={handlers.onTakeoverBrowser}
                onReturnControl={handlers.onReturnControlBrowser}
                controlBusy={handlers.controlBusy}
              />
            );

          case 'editable_document':
            return (
              <EditableDocumentCard
                key={block.id}
                block={block}
                onSave={handlers.onSaveArtifact}
              />
            );

          case 'generated_content':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
                  <div>
                    {block.contentType && (
                      <p className="text-xs text-[#8E95A5]">{block.contentType}</p>
                    )}
                    <h3 className="mt-0.5 font-display text-base font-semibold text-[#F4F5F7]">
                      {block.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={block.content} />
                    <button
                      type="button"
                      onClick={() =>
                        downloadTextFile(
                          `${block.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'output'}.txt`,
                          block.content
                        )
                      }
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171A21] px-3 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-[#F4F5F7]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <ProseText content={block.content} />
                </div>
              </section>
            );

          case 'checklist':
            return <ChecklistCard key={block.id} block={block} />;

          case 'form':
            return (
              <InteractiveFormCard
                key={block.id}
                block={block}
                onSubmit={handlers.onSubmitForm}
              />
            );

          case 'comparison':
            return (
              <section
                key={block.id}
                className="overflow-hidden eon-panel rounded-2xl"
              >
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <h3 className="font-display text-base font-semibold text-[#F4F5F7]">
                    {block.title}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-[#14171E] text-xs font-medium text-[#8E95A5]">
                        <th className="px-5 py-3">Criterion</th>
                        {block.columns.map((col, idx) => (
                          <th key={idx} className="px-5 py-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {block.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-5 py-3 font-medium text-[#F4F5F7]">
                            {row.criterion}
                          </td>
                          {row.values.map((val, cIdx) => (
                            <td key={cIdx} className="px-5 py-3 text-[#9CA3B3]">
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.recommendation && (
                  <div className="border-t border-white/[0.06] bg-[#14171E] px-5 py-3.5 text-sm text-[#D7DBE4]">
                    <span className="font-medium text-[#F4F5F7]">Recommendation: </span>
                    {block.recommendation}
                  </div>
                )}
              </section>
            );

          case 'table':
            return <DataTableCard key={block.id} block={block} />;

          case 'report':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <p className="text-xs text-[#8E95A5]">Executive Report</p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-[#F4F5F7]">
                      {block.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const md = [
                        `# ${block.title}`,
                        block.executiveSummary,
                        ...block.sections.map((s) => `## ${s.heading}\n\n${s.body}`),
                      ].join('\n\n');
                      downloadTextFile(
                        `${block.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'report'}.md`,
                        md,
                        'text/markdown'
                      );
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171A21] px-3 py-1.5 text-xs font-medium text-[#9CA3B3] hover:text-[#F4F5F7]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Export Report</span>
                  </button>
                </div>

                <p className="mt-4 text-[15px] leading-relaxed text-[#D7DBE4]">
                  {block.executiveSummary}
                </p>

                {block.metrics && block.metrics.length > 0 && (
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-white/[0.06] py-4 sm:grid-cols-4">
                    {block.metrics.map((m, idx) => (
                      <div key={idx}>
                        <dt className="text-xs text-[#8E95A5]">{m.label}</dt>
                        <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-[#F4F5F7]">
                          {m.value}
                        </dd>
                        {m.note && <p className="mt-0.5 text-xs text-[#6C7385]">{m.note}</p>}
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-5 space-y-5">
                  {block.sections.map((sec, idx) => (
                    <div key={idx}>
                      <h4 className="font-display text-base font-semibold text-[#F4F5F7]">
                        {sec.heading}
                      </h4>
                      <div className="mt-2">
                        <ProseText content={sec.body} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          case 'approval_request':
            return handlers.onRespondApproval ? (
              <SensitiveApprovalCard
                key={block.id}
                approval={block.approval}
                onRespond={handlers.onRespondApproval}
                disabled={handlers.controlBusy}
              />
            ) : null;

          case 'completed_summary':
            return (
              <section
                key={block.id}
                className="eon-panel rounded-2xl border-emerald-500/25 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-400">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Task Completed</span>
                  </div>
                  {block.elapsedMs !== undefined && (
                    <span className="font-mono tabular-nums text-[#8E95A5]">
                      Completed in {formatDuration(block.elapsedMs)}
                    </span>
                  )}
                </div>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-[#F4F5F7]">
                  {block.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#D7DBE4]">
                  {block.outcome}
                </p>
                {block.deliverables && block.deliverables.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3.5 text-sm text-[#9CA3B3]">
                    {block.deliverables.map((d, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );

          case 'error_recovery':
            return (
              <section
                key={block.id}
                role="alert"
                className="eon-panel rounded-2xl border-rose-500/30 p-5 sm:p-6"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Execution Interrupted</span>
                  {block.code && (
                    <span className="font-mono text-[#8E95A5]">· {block.code}</span>
                  )}
                </div>
                <h3 className="mt-2.5 font-display text-base font-semibold text-[#F4F5F7]">
                  {block.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[#9CA3B3]">{block.message}</p>
                {block.endpoint && (
                  <p className="mt-2 font-mono text-xs text-[#6C7385] break-all">
                    Endpoint: {block.endpoint}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {block.recoverable !== false && handlers.onRetryTask && (
                    <button
                      type="button"
                      onClick={handlers.onRetryTask}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#6E7BF2] px-4 py-2 text-xs font-medium text-white hover:bg-[#7F8BF5]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Retry</span>
                    </button>
                  )}
                  {handlers.onOpenSettings && (
                    <button
                      type="button"
                      onClick={handlers.onOpenSettings}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/[0.10] bg-[#171A21] px-4 py-2 text-xs font-medium text-[#F4F5F7] hover:bg-[#1D212A]"
                    >
                      <span>Check Backend Connection</span>
                    </button>
                  )}
                </div>
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
