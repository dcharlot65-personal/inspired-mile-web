/**
 * Master Thespian Voice — Kokoro TTS for in-browser speech synthesis.
 * Runs entirely client-side via WASM. No data leaves the device.
 */

let tts: any = null;
let loading = false;

// Use a British male voice for the Master Thespian character
const THESPIAN_VOICE = 'bm_george';
const THESPIAN_SPEED = 0.95;

export type VoiceProgressCallback = (progress: { text: string; progress: number }) => void;

export async function loadVoice(onProgress?: VoiceProgressCallback): Promise<boolean> {
  if (tts) return true;
  if (loading) return false;

  loading = true;

  try {
    const { KokoroTTS } = await import('kokoro-js');
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (data: any) => {
        if (onProgress && data.status === 'progress') {
          onProgress({
            text: `Loading voice model: ${Math.round((data.progress || 0))}%`,
            progress: data.progress || 0,
          });
        }
      },
    });
    loading = false;
    return true;
  } catch (err) {
    console.error('Failed to load Kokoro TTS:', err);
    loading = false;
    return false;
  }
}

export function isVoiceLoaded(): boolean {
  return tts !== null;
}

export function isVoiceLoading(): boolean {
  return loading;
}

let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string, voice?: string): Promise<void> {
  // Stop any currently playing audio
  stopSpeaking();

  if (!tts) {
    // Fallback to browser speech synthesis
    return speakFallback(text);
  }

  try {
    const audio = await tts.generate(text, {
      voice: voice || THESPIAN_VOICE,
      speed: THESPIAN_SPEED,
    });

    const wavBuffer = audio.toWav();
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    currentAudio = new Audio(url);
    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
    await currentAudio.play();
  } catch (err) {
    console.error('TTS generation failed, using fallback:', err);
    return speakFallback(text);
  }
}

export async function speakStreaming(text: string, voice?: string): Promise<void> {
  stopSpeaking();

  if (!tts || !tts.stream) {
    return speak(text, voice);
  }

  try {
    const stream = tts.stream(text, {
      voice: voice || THESPIAN_VOICE,
      speed: THESPIAN_SPEED,
    });

    for await (const chunk of stream) {
      const wavBuffer = chunk.audio.toWav();
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve) => {
        currentAudio = new Audio(url);
        currentAudio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          resolve();
        };
        currentAudio.play();
      });
    }
  } catch (err) {
    console.error('Streaming TTS failed:', err);
    return speak(text, voice);
  }
}

function speakFallback(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 0.8;
  // Try to pick a British English voice
  const voices = window.speechSynthesis.getVoices();
  const britishVoice = voices.find(
    (v) => v.lang.startsWith('en-GB') || v.name.toLowerCase().includes('british'),
  );
  if (britishVoice) utterance.voice = britishVoice;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return true;
  return false;
}
