import { useRos } from '../ros/RosContext';

export function RobotSelector() {
  const { selectedRobot, setSelectedRobot, connected } = useRos();
  return (
    <div className="flex items-center gap-2 ml-auto text-sm">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-neutral-400">{connected ? 'connected' : 'offline'}</span>
      <select
        value={selectedRobot}
        onChange={(e) => setSelectedRobot(e.target.value as 'robot_a' | 'robot_b')}
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
      >
        <option value="robot_a">Robot A</option>
        <option value="robot_b">Robot B</option>
      </select>
    </div>
  );
}
