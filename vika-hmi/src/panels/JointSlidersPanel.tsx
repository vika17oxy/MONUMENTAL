import { useEffect, useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';

// Joint ranges (rad) from arm_6dof.xacro <limit lower/upper>.
const LIMITS: [number, number][] = [
  [-3.14, 3.14],
  [-2.70, 2.70],
  [-2.70, 2.70],
  [-6.10, 6.10],
  [-2.27, 2.27],
  [-6.10, 6.10],
];
const deg = (r: number) => (r * 180) / Math.PI;
// VIKA 5 (robot_b, cement) is a 5-axis arm: J4 is locked. So it shows 5 sliders;
// J4 is held at 0 and still sent (the controller drives all 6 joints).
const LOCKED: Record<string, number[]> = { robot_b: [3] }; // 0-based J4

export function JointSlidersPanel() {
  const { connected, selectedRobot, jointsRef, jointsTick, sendJointSet, sendCmd, sendSuction } = useRos();
  const [suction, setSuction] = useState(false);
  const [vals, setVals] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const dragging = useRef(false);
  const lastSend = useRef(0);
  const locked = LOCKED[selectedRobot] ?? [];

  // Initialise / re-sync sliders from the live robot pose (unless the user is
  // dragging). Runs as joint_states tick in.
  useEffect(() => {
    if (dragging.current) return;
    const m = jointsRef.current;
    const cur = LIMITS.map((_, i) =>
      locked.includes(i) ? 0 : (m[`${selectedRobot}_arm_j${i + 1}`] ?? 0));
    if (cur.some((v, i) => Math.abs(v - vals[i]) > 1e-3)) setVals(cur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jointsTick, selectedRobot]);

  const send = (next: number[]) => {
    const now = performance.now();
    if (now - lastSend.current < 120) return; // throttle the JTC goal stream
    lastSend.current = now;
    sendJointSet(next);
  };

  const onChange = (i: number, v: number) => {
    const next = vals.slice();
    next[i] = v;
    setVals(next);
    send(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
        <span>{6 - locked.length} joints · {selectedRobot === 'robot_b' ? 'V.I.K.A-5' : 'V.I.K.A-6'}</span>
        <span>
          ROS <span className={`readout ml-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {LIMITS.map(([lo, hi], i) => locked.includes(i) ? null : (
          <div key={i}>
            <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/55">
              <span>J{i + 1}</span>
              <span className="readout">{deg(vals[i]).toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={lo}
              max={hi}
              step={0.01}
              value={vals[i]}
              disabled={!connected}
              onMouseDown={() => (dragging.current = true)}
              onMouseUp={() => { dragging.current = false; sendJointSet(vals); }}
              onChange={(e) => onChange(i, parseFloat(e.target.value))}
              className="w-full accent-accent disabled:opacity-30"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3">
        <button
          onClick={() => sendCmd('HOME')}
          disabled={!connected}
          className="btn py-2 disabled:opacity-30"
        >
          HOME
        </button>
        {/* Vacuum gripper toggle — only VIKA 6 (robot_a) has the suction gripper. */}
        {selectedRobot === 'robot_a' ? (
          <button
            onClick={() => { const n = !suction; setSuction(n); sendSuction(n); }}
            disabled={!connected}
            className={`btn py-2 disabled:opacity-30 ${suction ? 'btn-primary' : ''}`}
          >
            {suction ? '● VACUUM ON' : '○ VACUUM'}
          </button>
        ) : (
          <div className="flex items-center justify-center text-[10px] uppercase tracking-wider text-white/25">
            cement tool
          </div>
        )}
      </div>
    </div>
  );
}
