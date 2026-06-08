import { Panel } from '../components/ui/Panel';

export function MissionPanel() {
  return (
    <Panel
      id="03"
      title="Mission"
      subtitle="· behavior tree"
      right={<span className="flex items-center gap-1.5"><span className="dot dot-off" />IDLE</span>}
    >
      <div className="grid grid-cols-3 gap-1.5">
        <button className="btn btn-primary py-3">START</button>
        <button className="btn py-3">PAUSE</button>
        <button className="btn btn-danger py-3">ABORT</button>
      </div>

      <div className="mt-3 border border-white/10 p-2">
        <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/40">
          <span>Active Goal</span>
          <span className="readout readout-dim">—</span>
        </div>
        <div className="font-mono text-[11px] text-white/60">
          <div className="flex justify-between"><span>tree</span><span className="text-white/40">—</span></div>
          <div className="flex justify-between"><span>bricks placed</span><span className="text-white">0 / 0</span></div>
          <div className="flex justify-between"><span>elapsed</span><span className="text-white">00:00</span></div>
        </div>
      </div>

      <button className="btn btn-ghost mt-2 w-full py-1.5 text-[10px]">▶ View BT Trace</button>
    </Panel>
  );
}
