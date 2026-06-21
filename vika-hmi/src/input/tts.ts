/**
 * Text-to-speech for VIKA's spoken replies — Kokoro only (no browser fallback;
 * the native speechSynthesis voice sounds too robotic).
 *
 * Kokoro (kokoro-fastapi) exposes an OpenAI-compatible POST /v1/audio/speech that
 * returns audio we play in an <Audio> element. If Kokoro is unreachable VIKA stays
 * silent and speak() resolves to false so the caller can surface it.
 *
 * Config (.env):
 *   VITE_KOKORO_URL    default http://localhost:8880/v1/audio/speech
 *   VITE_KOKORO_VOICE  default af_heart
 *   VITE_KOKORO_MODEL  default kokoro
 */
const ENV = (import.meta as any).env ?? {};
const KOKORO_URL: string = ENV.VITE_KOKORO_URL ?? 'http://localhost:8880/v1/audio/speech';
const KOKORO_VOICE: string = ENV.VITE_KOKORO_VOICE ?? 'af_heart';
const KOKORO_MODEL: string = ENV.VITE_KOKORO_MODEL ?? 'kokoro';

let current: HTMLAudioElement | null = null;

/** Speak `text` via Kokoro. Returns true if playback started, false on failure. */
export async function speak(text: string): Promise<boolean> {
  const t = text.trim();
  if (!t) return false;
  try {
    const res = await fetch(KOKORO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: KOKORO_MODEL, voice: KOKORO_VOICE, input: t, response_format: 'mp3' }),
    });
    if (!res.ok) throw new Error(`kokoro ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    current?.pause();
    const a = new Audio(url);
    current = a;
    a.onended = () => URL.revokeObjectURL(url);
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  current?.pause();
  current = null;
}
