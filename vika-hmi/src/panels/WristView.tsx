import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useRos } from '../ros/RosContext';

const IMG_W = 640;
const IMG_H = 480;
// Known längs-row brick X positions -> which suction pad sits over each.
const KNOWN_X: Record<'l' | 'c' | 'r', number> = { l: -0.215, c: -0.6, r: -0.985 };
const ROW_Y = 0.29;       // the pick row sits at this fixed world Y
const BRICK_TOP = 0.38;   // brick top surface (z) — GO descends to just above
// Poll single snapshots instead of an MJPEG stream: an MJPEG <img> holds a
// never-ending HTTP connection that makes the browser/PWA show "loading…"
// forever. Short snapshot requests avoid that and still give a live preview.
// Per-robot: robot_a = gripper wrist cam, robot_b = cement-tool wrist cam.
const snapUrl = (robot: string) =>
  `http://${location.hostname}:8080/snapshot?topic=/${robot}/wrist_cam/image`;

function padFor(world: [number, number, number]): 'l' | 'c' | 'r' {
  let best: 'l' | 'c' | 'r' = 'c', bd = Infinity;
  (['l', 'c', 'r'] as const).forEach((p) => {
    const d = Math.abs(world[0] - KNOWN_X[p]);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
}

/** Small Xbox-button glyph badge shown on the action buttons. */
function PadGlyph({ c, l }: { c: string; l: string }) {
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-black"
      style={{ background: c }}>{l}</span>
  );
}

/** Wrist-camera AI brick view (V.I.K.A-6). Live MJPEG stream + Grounding DINO
 *  boxes. Select a single brick (Tab/click) or the whole ROW; GO centres the
 *  gripper over the row; SUCK grabs only the selected brick(s). */
export function WristView() {
  const { connected, selectedRobot, detections, detectImage, detectError, sendDetect, sendGoto, sendSuck, inputMode } = useRos();
  const pad = inputMode === 'gamepad';
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<'single' | 'row'>('single');
  const [frame, setFrame] = useState('');
  // Live ON by default: snapshot polling (not MJPEG) doesn't hold a connection,
  // so it's safe and the wrist cam shows immediately for the selected robot.
  const [live, setLive] = useState(true);
  const isA = selectedRobot === 'robot_a';
  const snap = snapUrl(selectedRobot);       // wrist cam of the SELECTED robot

  // Live preview = snapshot polling (~4 fps). Off by default: a continuous feed
  // keeps a localhost request open and makes the browser show "loading…" forever.
  // Works for both robots now (VIKA-6 gripper cam + VIKA-5 cement cam).
  useEffect(() => {
    if (!live || !connected) { setFrame(''); return; }
    let on = true;
    // no requests while the tab is backgrounded → nothing lingers in the bg
    const tick = () => { if (on && document.visibilityState === 'visible') setFrame(`${snap}&t=${Date.now()}`); };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => { on = false; clearInterval(iv); };
  }, [live, connected, snap]);

  useEffect(() => { if (sel >= detections.length) setSel(0); }, [detections, sel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || detections.length === 0) return;
      e.preventDefault();
      setMode('single');
      setSel((s) => (s + (e.shiftKey ? -1 : 1) + detections.length) % detections.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detections.length]);

  const worlds = useMemo(
    () => detections.map((d) => d.world).filter(Boolean) as [number, number, number][],
    [detections]);
  const centroid = worlds.length
    ? [worlds.reduce((s, w) => s + w[0], 0) / worlds.length,
       worlds.reduce((s, w) => s + w[1], 0) / worlds.length,
       worlds[0][2]] as [number, number, number]
    : null;

  // DINO annotated still is robot_a only; live snapshot works for both robots.
  const bg = live ? frame : (isA && detectImage ? `data:image/jpeg;base64,${detectImage}` : '');
  const selected = detections[sel];
  // Centre the gripper over the row: X from the (robust) detection centroid, but
  // Y/Z from the known fixture so the pads land ON the bricks (no suck offset).
  const go = () => { if (centroid) sendGoto(centroid[0], ROW_Y, BRICK_TOP); };
  const suck = () => {
    if (mode === 'row') {
      const pads = worlds.map(padFor);
      sendSuck(Array.from(new Set(pads)).join(''));
    } else if (selected?.world) {
      sendSuck(padFor(selected.world));
    }
  };
  const release = () => sendSuck('');
  const isOn = (i: number) => mode === 'row' || i === sel;

  return (
    <Panel title={isA ? 'Wrist Cam · VIKA-6' : 'Wrist Cam · VIKA-5'} subtitle={isA ? '· live · AI' : '· live · cement'}>
      <div className="relative w-full overflow-hidden border border-white/15 bg-black" style={{ aspectRatio: '4 / 3' }}>
        {bg ? (
          <img src={bg} alt="wrist" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-[11px] uppercase tracking-wider text-white/30">
            {isA ? 'press DETECT or ▶ LIVE' : '▶ LIVE for V.I.K.A-5 cement cam'}
          </div>
        )}
        {(
          <button onClick={() => setLive((v) => !v)}
            className={`absolute left-1.5 top-1.5 flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
              live ? 'bg-red-500/20 text-red-400' : 'bg-black/55 text-white/45'}`}>
            <span className={`dot ${live ? 'dot-live' : 'dot-off'}`} /> {live ? 'live' : '▶ live'}
          </button>
        )}
        {isA && detections.map((d, i) => {
          const [x0, y0, x1, y1] = d.box;
          const st = {
            left: `${(x0 / IMG_W) * 100}%`, top: `${(y0 / IMG_H) * 100}%`,
            width: `${((x1 - x0) / IMG_W) * 100}%`, height: `${((y1 - y0) / IMG_H) * 100}%`,
          };
          const on = isOn(i);
          return (
            <div key={i} onClick={() => { setMode('single'); setSel(i); }} style={st}
              className={`absolute cursor-pointer border-2 ${on
                ? 'border-green-400'
                : 'border-accent/70 hover:border-accent'}`}>
              <span className={`absolute left-0 top-0 -translate-y-full px-1 text-[9px] font-bold ${on ? 'bg-green-400 text-black' : 'bg-accent/85 text-black'}`}>
                {d.world ? padFor(d.world).toUpperCase() : `#${i}`} {(d.score * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      {!isA ? (
        <div className="mt-2 text-[10px] uppercase tracking-wider text-white/40">
          VIKA-5 cement cam · cement-following coming soon
        </div>
      ) : detectError ? (
        <div className="mt-2 text-[10px] uppercase tracking-wider text-red-400">△ {detectError}</div>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
          <span>{detections.length} brick{detections.length !== 1 ? 's' : ''}</span>
          <span className="ml-auto readout">
            {mode === 'row' ? `ROW (${worlds.length})` : selected?.world
              ? `pad ${padFor(selected.world).toUpperCase()} · x${selected.world[0].toFixed(2)}`
              : '—'}
          </span>
        </div>
      )}

      {/* selection mode */}
      <div className="mt-2 flex border border-white/15">
        {(['single', 'row'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} disabled={!isA}
            className={`flex-1 px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors disabled:opacity-30 ${
              mode === m ? 'bg-accent text-black font-bold' : 'text-white/55 hover:text-white'}`}>
            {m === 'single' ? 'Single' : 'Row (3)'}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button onClick={sendDetect} disabled={!connected || !isA}
          className="btn btn-primary relative py-2 disabled:opacity-30">◎ DETECT{pad && <PadGlyph c="#6cc24a" l="A" />}</button>
        <button onClick={go} disabled={!connected || !isA || !centroid}
          className="btn py-2 disabled:opacity-30">GO →</button>
        <button onClick={suck} disabled={!connected || !isA || detections.length === 0}
          className="btn relative py-2 disabled:opacity-30">● SUCK{pad && <PadGlyph c="#2a7fff" l="X" />}</button>
        <button onClick={release} disabled={!connected || !isA}
          className="btn py-2 disabled:opacity-30">○ RELEASE</button>
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-white/30">
        Tab/click = pick brick · Row = all 3 · GO centres · SUCK grabs selection
      </div>
    </Panel>
  );
}
