import { useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Panel } from '../components/ui/Panel';
import { RobotTabs } from './RobotTabs';
import { JointSlidersPanel } from './JointSlidersPanel';
import { RailPanel } from './RailPanel';
import { useRos } from '../ros/RosContext';

/** Prominent live LINK status badge. */
function LinkBadge() {
  const { connected } = useRos();
  return (
    <div
      className={`flex items-center justify-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-[0.3em] ${
        connected
          ? 'border-green-500/40 bg-green-500/10 text-green-400'
          : 'border-red-500/40 bg-red-500/10 text-red-400 animate-pulse'
      }`}
    >
      <span className={`dot ${connected ? 'dot-live' : 'dot-off'}`} />
      {connected ? 'LINK · LIVE' : 'LINK · OFFLINE'}
    </div>
  );
}

/** Bare Cartesian TCP jog (IK via move_group / hmi_bridge). robot_a only. */
function IkContent() {
  const { connected, selectedRobot, sendTcpJog, sendCmd, sendSuction } = useRos();
  const [step, setStep] = useState(0.05);
  const [suction, setSuction] = useState(false);
  const last = useRef(0);
  const hold = useRef<number | null>(null);
  const isA = selectedRobot === 'robot_a';
  const ik = true;   // both VIKA-6 (gripper) and VIKA-5 (cement) have move_group IK
  const jog = (dx: number, dy: number, dz: number) => {
    const now = performance.now();
    if (!connected || !ik || now - last.current < 150) return;
    last.current = now;
    sendTcpJog(dx * step, dy * step, dz * step);
  };
  // Press-and-hold: fire once immediately, then auto-repeat while held so you
  // get continuous motion without spamming. Release/leave stops it.
  const stop = () => { if (hold.current !== null) { clearInterval(hold.current); hold.current = null; } };
  const start = (dx: number, dy: number, dz: number) => {
    if (!connected || !ik) return;
    jog(dx, dy, dz);
    stop();
    hold.current = window.setInterval(() => jog(dx, dy, dz), 220);
  };
  useEffect(() => stop, []);
  const B = ({ l, d }: { l: string; d: [number, number, number] }) => (
    <button
      onPointerDown={() => start(...d)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      disabled={!connected || !ik}
      className="btn py-3 disabled:opacity-30 select-none touch-none">{l}</button>
  );
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
        tcp · world frame · MoveIt · {isA ? 'VIKA-6 gripper' : 'VIKA-5 cement'}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div /><B l="+Y" d={[0, 1, 0]} /><div />
        <B l="−X" d={[-1, 0, 0]} />
        <button onClick={() => sendCmd('READY')} disabled={!connected} className="btn btn-primary py-3 text-[11px] disabled:opacity-30">READY</button>
        <B l="+X" d={[1, 0, 0]} />
        <div /><B l="−Y" d={[0, -1, 0]} /><div />
        <B l="−Z" d={[0, 0, -1]} /><div /><B l="+Z" d={[0, 0, 1]} />
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-white/50">
        Step <span className="readout ml-1">{(step * 1000).toFixed(0)} mm</span>
      </div>
      <input type="range" min={0.01} max={0.15} step={0.005} value={step}
        onChange={(e) => setStep(parseFloat(e.target.value))} className="w-full accent-accent" />
      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3">
        <button onClick={() => sendCmd('HOME')} disabled={!connected}
          className={`btn py-2 disabled:opacity-30 ${isA ? '' : 'col-span-2'}`}>HOME</button>
        {isA && (
          <button onClick={() => { const n = !suction; setSuction(n); sendSuction(n); }}
            disabled={!connected} className={`btn py-2 disabled:opacity-30 ${suction ? 'btn-primary' : ''}`}>
            {suction ? '● VACUUM ON' : '○ VACUUM'}
          </button>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'joint', label: 'Joint', el: <JointSlidersPanel /> },
  { id: 'ik', label: 'IK', el: <IkContent /> },
  { id: 'rail', label: 'Rail', el: <RailPanel /> },
];

export function ControlPanel() {
  return (
    <Panel id="01" title="Control" subtitle="· manual">
      <LinkBadge />
      <div className="mt-3 mb-3">
        <RobotTabs />
      </div>
      <Tabs.Root defaultValue="joint">
        <Tabs.List className="mb-3 flex border border-white/15">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="flex-1 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white data-[state=active]:bg-accent data-[state=active]:text-black data-[state=active]:font-bold"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {TABS.map((t) => (
          <Tabs.Content key={t.id} value={t.id} className="outline-none">
            {t.el}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Panel>
  );
}
