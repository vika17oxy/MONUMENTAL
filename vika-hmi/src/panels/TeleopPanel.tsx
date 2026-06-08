import ROSLIB from 'roslib';
import { useRos } from '../ros/RosContext';
import { Panel } from '../components/ui/Panel';

export function TeleopPanel() {
  const { ros, selectedRobot } = useRos();
  const drive = (lin: number, ang: number) => {
    if (!ros) return;
    const t = new ROSLIB.Topic({
      ros, name: `/${selectedRobot}/cmd_vel`, messageType: 'geometry_msgs/Twist',
    });
    t.publish(new ROSLIB.Message({
      linear: { x: lin, y: 0, z: 0 }, angular: { x: 0, y: 0, z: ang },
    }));
  };

  const DirBtn = ({ label, onDown }: { label: string; onDown: () => void }) => (
    <button
      className="btn py-3"
      onMouseDown={onDown}
      onMouseUp={() => drive(0, 0)}
      onMouseLeave={() => drive(0, 0)}
    >
      {label}
    </button>
  );

  return (
    <Panel id="02" title="Teleop" subtitle="· mobile base">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
        <span>LIN <span className="readout ml-1">0.30 m/s</span></span>
        <span>ANG <span className="readout ml-1">0.80 rad/s</span></span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div /><DirBtn label="▲" onDown={() => drive(0.3, 0)} /><div />
        <DirBtn label="◀" onDown={() => drive(0, 0.8)} />
        <button className="btn btn-primary py-3" onClick={() => drive(0, 0)}>STOP</button>
        <DirBtn label="▶" onDown={() => drive(0, -0.8)} />
        <div /><DirBtn label="▼" onDown={() => drive(-0.3, 0)} /><div />
      </div>
    </Panel>
  );
}
