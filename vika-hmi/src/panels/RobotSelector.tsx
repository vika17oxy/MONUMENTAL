import { useRos } from '../ros/RosContext';

export function RobotSelector() {
  const { selectedRobot, setSelectedRobot, connected } = useRos();
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em]">
      <div className="flex items-center gap-2 border border-white/15 px-2 py-1">
        <span className={`dot ${connected ? 'dot-live' : 'dot-off'}`} />
        <span className={connected ? 'text-white' : 'text-white/50'}>
          {connected ? 'LINK · LIVE' : 'LINK · OFFLINE'}
        </span>
      </div>
      <div className="flex items-center gap-2 border border-white/15 px-2 py-1">
        <span className="text-white/40">UNIT</span>
        <select
          value={selectedRobot}
          onChange={(e) => setSelectedRobot(e.target.value as 'robot_a' | 'robot_b')}
          className="bg-black text-white outline-none"
        >
          <option value="robot_a">V.I.K.A-5</option>
          <option value="robot_b">V.I.K.A-6</option>
        </select>
      </div>
    </div>
  );
}
