import { useEffect, useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';

// Xbox "standard mapping": axes[0,1]=left stick, [2,3]=right, buttons
// 0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 12..15=D-pad.
const DEAD = 0.18;
const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : v);

/** Maps a Bluetooth Xbox controller (browser Gamepad API) onto the robot:
 *  left stick → TCP X/Y, LT/RT → Z down/up, LB/RB → rail, A/B/X/Y → actions. */
export function GamepadControl() {
  const api = useRos();
  const apiRef = useRef(api);
  apiRef.current = api;
  const suckOn = useRef(false);
  const prev = useRef<boolean[]>([]);
  const lastJog = useRef(0);
  const [padOn, setPadOn] = useState(false);   // a gamepad is connected (shows the legend, incl. iPad)
  const padRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const STEP = 0.12;        // TCP jog metres per tick at full deflection (fast)
    const RAIL_STEP = 0.18;   // rail jog metres per tick while LB/RB held (fast)
    const RATE_MS = 50;       // ~20 Hz continuous jog (snappier)
    const loop = () => {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gps).find((g) => g && g.connected) || null;
      // track connection (drives the legend, incl. on iPad) — set state only on change
      if (!!gp !== padRef.current) { padRef.current = !!gp; setPadOn(!!gp); }
      const { connected, sendTcpJog, sendRailJog, sendCmd, sendDetect, sendSuck,
              inputMode, setInputMode } = apiRef.current;
      const now = performance.now();
      if (gp && connected) {
        const ax = gp.axes, bt = gp.buttons;
        const lx = dz(ax[0] ?? 0), ly = dz(ax[1] ?? 0);
        const lt = bt[6]?.value ?? 0, rt = bt[7]?.value ?? 0;
        const zz = (rt > DEAD ? rt : 0) - (lt > DEAD ? lt : 0);
        const rail = (bt[5]?.pressed ? 1 : 0) - (bt[4]?.pressed ? 1 : 0);
        if ((lx || ly || zz || rail || bt.some((b) => b?.pressed)) && inputMode !== 'gamepad') setInputMode('gamepad');
        if (now - lastJog.current > RATE_MS) {
          lastJog.current = now;
          if (lx || ly || zz) sendTcpJog(lx * STEP, -ly * STEP, zz * STEP);  // IK for both robots
          if (rail) sendRailJog(rail * RAIL_STEP);                           // LB/RB → rail
        }
        const press = (i: number) => !!bt[i]?.pressed && !prev.current[i];
        if (press(0)) sendDetect();                                   // A → DETECT
        if (press(1)) sendCmd('READY');                               // B → READY
        if (press(2)) { suckOn.current = !suckOn.current; sendSuck(suckOn.current ? 'lcr' : ''); }  // X → SUCK
        if (press(3)) sendCmd('HOME');                                // Y → HOME
        prev.current = bt.map((b) => !!b.pressed);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // legend shows whenever a controller is CONNECTED (also on iPad), not only after use
  if (!padOn) return null;
  const G = ({ c, l }: { c: string; l: string }) => (
    <span className="inline-flex items-center gap-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-black" style={{ background: c }}>{l}</span>
    </span>
  );
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-5 rounded-lg border border-green-500/50 bg-black/80 px-6 py-3.5 text-[14px] uppercase tracking-wider text-white/80 shadow-[0_8px_28px_rgba(0,0,0,0.6)] backdrop-blur">
      <span className="text-[15px] font-bold text-green-400">▣ gamepad connected</span>
      <span className="flex items-center gap-2"><G c="#6cc24a" l="A" /> detect</span>
      <span className="flex items-center gap-2"><G c="#e0341e" l="B" /> ready</span>
      <span className="flex items-center gap-2"><G c="#2a7fff" l="X" /> {suckOn.current ? 'release' : 'suck'}</span>
      <span className="flex items-center gap-2"><G c="#f5c518" l="Y" /> home</span>
      <span className="text-[13px] text-white/45">· LS move · LT/RT z · LB/RB rail</span>
    </div>
  );
}
