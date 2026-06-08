import { useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';
import { Panel } from '../components/ui/Panel';

export function TcpJogPanel() {
  const { connected, sendCmd, sendTcpJog } = useRos();
  const [step, setStep] = useState(0.01);
  const [busy, setBusy] = useState(false);
  const lastJog = useRef(0);

  const jog = (dx: number, dy: number, dz: number) => {
    // Client-side throttle: MoveIt segfaults on overlapping IK goals.
    // The bridge also drops while busy, this is just so the UI matches.
    const now = performance.now();
    if (busy || now - lastJog.current < 600) return;
    lastJog.current = now;
    setBusy(true);
    setTimeout(() => setBusy(false), 1500);
    sendTcpJog(dx * step, dy * step, dz * step);
  };

  const Btn = ({ label, onClick, variant = 'default' }: { label: string; onClick: () => void; variant?: 'default' | 'center' }) => (
    <button
      onClick={onClick}
      disabled={!connected || (variant !== 'center' && busy)}
      className={`btn py-3 disabled:opacity-30 ${variant === 'center' ? 'btn-primary' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <Panel id="01" title="TCP Jog" subtitle="· linear">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
        <span>Frame <span className="readout ml-1">tcp</span></span>
        <span>
          ROS <span className={`readout ml-1 ${connected ? (busy ? 'text-amber-400' : 'text-green-400') : 'text-red-400'}`}>
            {connected ? (busy ? 'PLANNING' : 'LIVE') : 'OFFLINE'}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div />
        <Btn label="+Y" onClick={() => jog(0, 1, 0)} />
        <div />

        <Btn label="−X" onClick={() => jog(-1, 0, 0)} />
        <Btn label="HOME" onClick={() => sendCmd('HOME')} variant="center" />
        <Btn label="+X" onClick={() => jog(1, 0, 0)} />

        <div />
        <Btn label="−Y" onClick={() => jog(0, -1, 0)} />
        <div />

        <Btn label="−Z" onClick={() => jog(0, 0, -1)} />
        <div />
        <Btn label="+Z" onClick={() => jog(0, 0, 1)} />
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/50">
          <span>Step Size</span>
          <span className="readout">{(step * 1000).toFixed(0)} mm</span>
        </div>
        <input
          type="range"
          min={0.001}
          max={0.05}
          step={0.001}
          value={step}
          onChange={(e) => setStep(parseFloat(e.target.value))}
          className="w-full accent-white"
        />
        <div className="mt-1 flex justify-between text-[9px] text-white/30">
          <span>1</span><span>10</span><span>25</span><span>50 mm</span>
        </div>
      </div>
    </Panel>
  );
}
