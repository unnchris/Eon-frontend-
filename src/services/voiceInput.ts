export interface VoiceCapabilities {
  browserSpeechSupported: boolean;
  mediaRecorderSupported: boolean;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function getVoiceCapabilities(): VoiceCapabilities {
  if (typeof window === 'undefined') {
    return { browserSpeechSupported: false, mediaRecorderSupported: false };
  }
  const win = window as unknown as Record<string, unknown>;
  const browserSpeechSupported = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  const mediaRecorderSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined';
  return { browserSpeechSupported, mediaRecorderSupported };
}

export function createBrowserSpeechSession(callbacks: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): { start: () => void; stop: () => void } | null {
  const win = window as unknown as Record<string, new () => SpeechRecognitionInstance>;
  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    let hasFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      transcript += result[0]?.transcript || '';
      if (result.isFinal) hasFinal = true;
    }
    callbacks.onTranscript(transcript.trim(), hasFinal);
  };

  recognition.onerror = (event) => {
    const code = event.error;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      callbacks.onError('Microphone access was denied. Enable microphone permission to use voice input.');
    } else if (code !== 'aborted') {
      callbacks.onError(`Voice recognition error: ${code}`);
    }
  };

  recognition.onend = () => {
    callbacks.onEnd();
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}
