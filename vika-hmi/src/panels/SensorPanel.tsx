import { Panel } from '../components/ui/Panel';

export function SensorPanel() {
  const camUrl = 'http://localhost:8080/stream?topic=/robot_b/wrist_camera/image_raw';
  return (
    <Panel
      id="04"
      title="Sensors"
      subtitle="· wrist cam"
      right={<span className="flex items-center gap-1.5"><span className="dot dot-off" />NO SIGNAL</span>}
    >
      <div className="relative aspect-video border border-white/15 bg-black overflow-hidden">
        <img
          src={camUrl}
          alt="wrist camera"
          className="h-full w-full object-cover opacity-80"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        {/* Crosshair overlay */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
          <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
          <div className="absolute left-2 top-2 text-[9px] uppercase tracking-widest text-white/60">REC · 30 FPS</div>
          <div className="absolute right-2 top-2 text-[9px] uppercase tracking-widest text-white/60">1280 × 720</div>
          <div className="absolute bottom-2 left-2 text-[9px] uppercase tracking-widest text-white/40">/wrist_camera/image_raw</div>
        </div>
        {/* Corner brackets inside frame */}
        <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-white" />
        <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-white" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white" />
        <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider">
        {[
          { k: 'Lidar', v: '—', unit: 'pts/s' },
          { k: 'F/T',   v: '—', unit: 'N' },
          { k: 'IMU',   v: '—', unit: 'g' },
        ].map((s) => (
          <div key={s.k} className="border border-white/10 p-2">
            <div className="text-white/40">{s.k}</div>
            <div className="readout text-base">{s.v}</div>
            <div className="text-[9px] text-white/30">{s.unit}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
