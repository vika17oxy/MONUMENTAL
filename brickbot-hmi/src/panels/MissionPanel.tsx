export function MissionPanel() {
  return (
    <section className="rounded border border-neutral-800 p-3 bg-neutral-950">
      <h2 className="font-semibold mb-2">Mission</h2>
      <div className="flex gap-2">
        <button className="flex-1 rounded bg-green-700 hover:bg-green-600 py-2">Start</button>
        <button className="flex-1 rounded bg-yellow-700 hover:bg-yellow-600 py-2">Pause</button>
        <button className="flex-1 rounded bg-red-700 hover:bg-red-600 py-2">Abort</button>
      </div>
      <p className="text-xs text-neutral-400 mt-2">BT status: <span className="font-mono">idle</span></p>
    </section>
  );
}
