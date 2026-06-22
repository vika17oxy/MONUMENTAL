/**
 * Voice / text command card. A mic (Web Speech API) or typed prompt is parsed to
 * a structured intent by a local Gemma model (Ollama), with a keyword fallback if
 * Ollama is unreachable. The intent is mapped to the existing /hmi/* commands —
 * e.g. "VIKA-5 in home position" → select robot_b + sendCmd('HOME').
 *
 * VIKA speaks the result back via Kokoro TTS (browser speechSynthesis fallback).
 *
 * Config (.env): VITE_OLLAMA_URL (default http://localhost:11434),
 *                VITE_OLLAMA_MODEL (default gemma4:12b),
 *                VITE_KOKORO_URL / VITE_KOKORO_VOICE (see input/tts.ts).
 */
import { useRef, useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useRos } from '../ros/RosContext';
import { speak, stopSpeaking } from '../input/tts';

type Action = 'HOME' | 'STOP' | 'READY' | 'BUILD' | 'CEMENT' | 'AUTO' | 'SELECT' | 'NONE';
type Robot = 'robot_a' | 'robot_b' | null;
type Intent = { robot: Robot; action: Action };

const ENV = (import.meta as any).env ?? {};
const OLLAMA_URL: string = ENV.VITE_OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL: string = ENV.VITE_OLLAMA_MODEL ?? 'gemma4:12b';

const SYS = `You parse spoken commands for a two-robot masonry cell into ONE JSON object.
Robots: robot_a = "VIKA-6" (brick-laying gripper robot); robot_b = "VIKA-5" (cement robot).
Output schema: {"robot": "robot_a"|"robot_b"|null, "action": "HOME"|"STOP"|"READY"|"BUILD"|"CEMENT"|"AUTO"|"SELECT"|"NONE"}.
Meanings: HOME=move to home/stow pose, READY=ready pose, STOP=stop, BUILD=start wall build (VIKA-6), CEMENT=start cementing (VIKA-5), AUTO=full auto build+cement, SELECT=only select that robot, NONE=unclear.
Set robot only if a specific robot is named. Reply with JSON only, no prose.`;

// display label (UI) vs spoken label (Kokoro reads "Vika five", not "V-I-K-A dash 5")
const label = (r: Robot, fallback: Robot) =>
  (r ?? fallback) === 'robot_b' ? 'VIKA-5' : 'VIKA-6';
const spokenName = (r: Robot, fallback: Robot) =>
  (r ?? fallback) === 'robot_b' ? 'Vika five' : 'Vika six';

/** VIKA's spoken reply (English — Kokoro sounds best in English) for an intent. */
function reply(action: Action, who: string): string {
  switch (action) {
    case 'HOME': return `${who} moving to the home position.`;
    case 'READY': return `${who} ready.`;
    case 'STOP': return `${who} stopped.`;
    case 'BUILD': return `Vika six starting the wall build.`;
    case 'CEMENT': return `Vika five starting cementing.`;
    case 'AUTO': return `Automatic mode. Vika six builds, Vika five cements.`;
    case 'SELECT': return `${who} selected.`;
    default: return 'Command not understood.';
  }
}

/** Offline parser — used when Ollama can't be reached (also covers CORS). */
function keywordParse(text: string): Intent {
  const s = text.toLowerCase();
  let robot: Robot = null;
  if (/\bvika[\s-]?5\b|\brobot[\s-]?b\b|cement|zement/.test(s)) robot = 'robot_b';
  else if (/\bvika[\s-]?6\b|\brobot[\s-]?a\b|greifer|gripper/.test(s)) robot = 'robot_a';
  let action: Action = 'NONE';
  if (/\b(home|heim|grundstellung|stow|park)\b/.test(s)) action = 'HOME';
  else if (/\b(stop|stopp|halt|anhalten)\b/.test(s)) action = 'STOP';
  else if (/\b(ready|bereit)\b/.test(s)) action = 'READY';
  else if (/\b(auto|automatik)\b/.test(s)) action = 'AUTO';
  else if (/\b(cement|zement|cementier)\b/.test(s)) action = 'CEMENT';
  else if (/\b(build|bau|bauen|mauer|wall|ziegel)\b/.test(s)) action = 'BUILD';
  else if (robot) action = 'SELECT';
  return { robot, action };
}

async function ollamaParse(text: string): Promise<Intent> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL, stream: false, format: 'json', options: { temperature: 0 },
      prompt: `${SYS}\n\nInstruction: ${text}\nJSON:`,
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  const obj = JSON.parse(data.response);
  const robot: Robot = obj.robot === 'robot_a' || obj.robot === 'robot_b' ? obj.robot : null;
  const action: Action = ['HOME', 'STOP', 'READY', 'BUILD', 'CEMENT', 'AUTO', 'SELECT'].includes(obj.action)
    ? obj.action : 'NONE';
  return { robot, action };
}

const CHIPS = ['VIKA-5 home', 'VIKA-6 home', 'stop', 'auto build', 'cement'];

/** Monochrome microphone glyph (uses currentColor). */
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

/** Monochrome speaker glyph; `muted` draws the mute slash. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      {muted
        ? <line x1="17" y1="9" x2="22" y2="14" />
        : <path d="M16 8.5a5 5 0 0 1 0 7" />}
      {muted && <line x1="22" y1="9" x2="17" y2="14" />}
    </svg>
  );
}

export function PromptCard() {
  const { connected, selectedRobot, setSelectedRobot, sendCmd, sendMission } = useRos();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const recRef = useRef<any>(null);

  const say = (text: string) => { if (!muted) speak(text); };

  const exec = (intent: Intent) => {
    const fire = () => {
      switch (intent.action) {
        case 'HOME': case 'STOP': case 'READY': sendCmd(intent.action); break;
        case 'BUILD': sendMission('START'); break;
        case 'CEMENT': sendMission('CEMENT'); break;
        case 'AUTO': sendMission('AUTO'); break;
        case 'SELECT': break;
        default: setStatus('? nicht verstanden'); return;
      }
      const who = label(intent.robot, selectedRobot);
      setStatus(intent.action === 'SELECT' ? `→ ${who} gewählt ✓` : `→ ${who} · ${intent.action} ✓`);
      say(reply(intent.action, spokenName(intent.robot, selectedRobot)));
    };
    // changing the active robot publishes /hmi/active_robot via an effect, so delay
    // the command a beat to make sure the bridge has the new selection first.
    if (intent.robot && intent.robot !== selectedRobot) {
      setSelectedRobot(intent.robot);
      setTimeout(fire, 220);
    } else fire();
  };

  const run = async (t: string) => {
    const q = t.trim();
    if (!q || busy) return;
    setBusy(true); setStatus('denke nach…');
    let intent: Intent;
    try { intent = await ollamaParse(q); }
    catch { intent = keywordParse(q); }
    setBusy(false);
    if (intent.action === 'NONE' && !intent.robot) { setStatus('? nicht verstanden'); return; }
    exec(intent);
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus('mic nicht unterstützt'); return; }
    const rec = new SR();
    rec.lang = 'de-DE'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setText(t); run(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setStatus('mic fehler'); };
    recRef.current = rec; setListening(true); setStatus('höre zu…'); rec.start();
  };

  return (
    <Panel title="Command" subtitle="· voice / prompt"
      right={
        <span className="flex items-center gap-2">
          <button
            onClick={() => { const m = !muted; setMuted(m); if (m) stopSpeaking(); }}
            title={muted ? 'TTS aus (Kokoro)' : 'TTS an (Kokoro)'}
            className={`flex items-center ${muted ? 'text-white/30' : 'text-accent'}`}>
            <SpeakerIcon muted={muted} />
          </button>
          <span className="text-[9px] uppercase tracking-wider text-white/40">gemma</span>
        </span>
      }>
      <div className="flex gap-1.5">
        <input
          className="input flex-1 text-[12px]"
          placeholder='z.B. "VIKA-5 home" · "auto build"'
          value={text} disabled={!connected}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(text); }}
        />
        <button onClick={toggleMic} disabled={!connected} title="Mikrofon"
          className={`btn flex items-center justify-center px-3 ${listening ? 'btn-danger animate-pulse' : ''} disabled:opacity-30`}>
          <MicIcon />
        </button>
        <button onClick={() => run(text)} disabled={!connected || busy}
          className="btn btn-primary px-3 disabled:opacity-30">▶</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {CHIPS.map((s) => (
          <button key={s} onClick={() => { setText(s); run(s); }} disabled={!connected}
            className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:text-white disabled:opacity-30">
            {s}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-[14px] text-[10px] uppercase tracking-wider text-accent">{status}</div>
    </Panel>
  );
}
