export function SensorPanel() {
  const camUrl = 'http://localhost:8080/stream?topic=/robot_b/wrist_camera/image_raw';
  return (
    <section className="rounded border border-neutral-800 p-3 bg-neutral-950">
      <h2 className="font-semibold mb-2">Sensors</h2>
      <div className="aspect-video bg-black rounded overflow-hidden">
        <img src={camUrl} alt="wrist camera" className="w-full h-full object-cover opacity-80"
             onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
      <div className="mt-2 text-xs text-neutral-400 grid grid-cols-2 gap-y-0.5">
        <span>Lidar</span><span className="font-mono text-right">—</span>
        <span>F/T</span><span className="font-mono text-right">—</span>
        <span>IMU</span><span className="font-mono text-right">—</span>
      </div>
    </section>
  );
}
