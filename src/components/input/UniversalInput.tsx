import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Mic, Plus, Square, X } from 'lucide-react';
import type { EndpointState } from '../../types/eon';
import { createBrowserSpeechSession, getVoiceCapabilities } from '../../services/voiceInput';

export type ExecutionMode = 'auto' | 'research' | 'browser' | 'draft';

export interface AttachedContextFile {
  name: string;
  type: string;
  size: number;
  textPreview?: string;
}

interface UniversalInputProps {
  onSubmit: (
    prompt: string,
    mode: ExecutionMode,
    attachments?: AttachedContextFile[]
  ) => Promise<void> | void;
  isSubmitting: boolean;
  disabled?: boolean;
  voiceEndpointState: EndpointState;
  onTranscribeAudio?: (blob: Blob) => Promise<string>;
  placeholder?: string;
  compact?: boolean;
  externalDraft?: string;
  onClearExternalDraft?: () => void;
  onTypingPulse?: () => void;
  onListeningChange?: (listening: boolean) => void;
}

export function UniversalInput({
  onSubmit,
  isSubmitting,
  disabled = false,
  voiceEndpointState,
  onTranscribeAudio,
  placeholder = 'Ask anything or tell EON what to do...',
  compact = false,
  externalDraft,
  onClearExternalDraft,
  onTypingPulse,
  onListeningChange,
}: UniversalInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<AttachedContextFile[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechSessionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const voiceCaps = getVoiceCapabilities();
  const backendVoiceAvailable = voiceEndpointState === 'available' && Boolean(onTranscribeAudio);
  const anyVoiceAvailable = backendVoiceAvailable || voiceCaps.browserSpeechSupported;

  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  useEffect(() => {
    if (externalDraft) {
      setValue(externalDraft);
      textareaRef.current?.focus();
      onClearExternalDraft?.();
    }
  }, [externalDraft, onClearExternalDraft]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      speechSessionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting || disabled) return;
    setVoiceError(null);
    await onSubmit(trimmed, 'auto', attachments.length ? attachments : undefined);
    setValue('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: AttachedContextFile[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      let textPreview: string | undefined;
      if (
        file.type.startsWith('text/') ||
        /\.(md|json|csv|txt|ts|tsx|js|py)$/i.test(file.name)
      ) {
        try {
          const text = await file.text();
          textPreview = text.slice(0, 4000);
        } catch {
          // Ignore unreadable text
        }
      }
      next.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        textPreview,
      });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 4));
  };

  const toggleVoice = async () => {
    setVoiceError(null);

    if (isListening) {
      speechSessionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!anyVoiceAvailable) {
      setVoiceError('Voice input is not supported on this device or browser.');
      return;
    }

    if (backendVoiceAvailable && voiceCaps.mediaRecorderSupported && onTranscribeAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (blob.size === 0) return;
          setIsTranscribing(true);
          try {
            const transcript = await onTranscribeAudio(blob);
            setValue((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
          } catch (err) {
            setVoiceError(err instanceof Error ? err.message : 'Could not transcribe audio.');
          } finally {
            setIsTranscribing(false);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsListening(true);
        return;
      } catch {
        setVoiceError('Allow microphone access to speak to EON.');
        return;
      }
    }

    const session = createBrowserSpeechSession({
      onTranscript: (text) => {
        setValue(text);
        onTypingPulse?.();
      },
      onError: (msg) => {
        setVoiceError(msg);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (!session) {
      setVoiceError('Voice recognition is not supported in this browser.');
      return;
    }

    speechSessionRef.current = session;
    try {
      session.start();
      setIsListening(true);
    } catch {
      setVoiceError('Could not start voice capture.');
      setIsListening(false);
    }
  };

  const hasText = Boolean(value.trim());

  return (
    <div className="w-full">
      <div
        className={`eon-instrument rounded-[26px] transition-all ${
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5 sm:px-5 sm:py-4'
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-2.5">
            {attachments.map((file, idx) => (
              <span
                key={`${file.name}-${idx}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1 text-xs text-[#E2E6F0]"
              >
                <span className="max-w-[160px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label={`Remove ${file.name}`}
                  className="text-[#7C8599] hover:text-white"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleAttachFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            aria-label="Attach file"
            title="Attach file"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8E96A8] hover:bg-white/[0.06] hover:text-[#F3F5FA] transition-colors"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>

          <label htmlFor="eon-universal-input" className="sr-only">
            Ask EON
          </label>
          <textarea
            id="eon-universal-input"
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onTypingPulse?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening...'
                : isTranscribing
                ? 'Transcribing...'
                : placeholder
            }
            disabled={isSubmitting || disabled}
            className="min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] sm:text-base leading-snug text-[#F3F5FA] placeholder:text-[#666E80] focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void toggleVoice()}
              disabled={isSubmitting || isTranscribing}
              aria-label={isListening ? 'Stop listening' : 'Speak'}
              title={anyVoiceAvailable ? (isListening ? 'Stop listening' : 'Speak') : 'Voice unavailable'}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                isListening
                  ? 'bg-[#5B7CFA]/25 text-[#9BB4FF]'
                  : anyVoiceAvailable
                  ? 'text-[#8E96A8] hover:bg-white/[0.06] hover:text-[#F3F5FA]'
                  : 'text-[#414756] cursor-not-allowed'
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : isListening ? (
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              ) : (
                <Mic className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!hasText || isSubmitting || disabled}
              aria-label="Send"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-[0.95] ${
                hasText && !isSubmitting
                  ? 'bg-[#F3F5FA] text-[#050608] hover:bg-white'
                  : 'bg-white/[0.06] text-[#5F677A] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {voiceError && (
        <p role="status" className="mt-2 px-3 text-xs text-amber-400">
          {voiceError}
        </p>
      )}
    </div>
  );
}
