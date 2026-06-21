import { useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';

// Rail travel from base_rail.xacro (prismatic limit ±5.5 m).
const TRAVEL = 5.5;

export function RailPanel() {
  const { connected, selectedRobot, jointsRef, jointsTick, sendRailJog } = useRos();
  const [step, setStep] = useState(0.25);
  const lastJog = useRef(0);

  // live rail position (re-reads on tick)
  void jointsTick;
  const pos = jointsRef.current[`${selectedRobot}_rail_joint`] ?? 0;

  const jog = (dir: number) => {
    const now = performance.now();
    if (!connected || now - lastJog.current < 250) return;
    lastJog.current = now;
    sendRailJog(dir * step);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
        <span>linear rail · along Y</span>
        <span>POS <span className="readout ml-1">{pos.toFixed(2)} m</span></span>
      </div>

      {/* position bar */}
      <div className="relative mb-3 h-2 w-full rounded bg-white/10">
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-accent"
          style={{ left: `${((pos + TRAVEL) / (2 * TRAVEL)) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => jog(-1)} disabled={!connected}
          className="btn py-4 text-lg disabled:opacity-30">◀ −Y</button>
        <button onClick={() => jog(1)} disabled={!connected}
          className="btn py-4 text-lg disabled:opacity-30">+Y ▶</button>
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/50">
          <span>Step</span>
          <span className="readout">{(step * 100).toFixed(0)} cm</span>
        </div>
        <input type="range" min={0.05} max={1.0} step={0.05} value={step}
          onChange={(e) => setStep(parseFloat(e.target.value))}
          className="w-full accent-accent" />
      </div>
    </div>
  );
}
