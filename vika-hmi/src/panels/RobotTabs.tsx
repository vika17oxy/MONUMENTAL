import { useRos } from '../ros/RosContext';

// VIKA 5 = cement nozzle (robot_b, Viktoriia); VIKA 6 = brick gripper (robot_a, Elias).
const ROBOTS: { id: 'robot_a' | 'robot_b'; label: string; tool: string }[] = [
  { id: 'robot_b', label: 'V.I.K.A-5', tool: 'cement' },
  { id: 'robot_a', label: 'V.I.K.A-6', tool: 'bricks' },
];

export function RobotTabs() {
  const { selectedRobot, setSelectedRobot } = useRos();
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ROBOTS.map((r) => {
        const active = selectedRobot === r.id;
        return (
          <button
            key={r.id}
            onClick={() => setSelectedRobot(r.id)}
            className={`flex flex-col items-start border px-3 py-2 transition-colors ${
              active
                ? 'border-accent bg-accent/10'
                : 'border-white/15 text-white/55 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={`text-sm font-bold tracking-wider ${active ? 'text-accent' : ''}`}>
              {r.label}
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">{r.tool}</span>
          </button>
        );
      })}
    </div>
  );
}
