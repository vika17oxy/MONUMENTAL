import ROSLIB from 'roslib';
import { useRos } from '../ros/RosContext';

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
  return (
    <section className="rounded border border-neutral-800 p-3 bg-neutral-950">
      <h2 className="font-semibold mb-2">Teleop (Base)</h2>
      <div className="grid grid-cols-3 gap-1 text-sm">
        <div /><button className="btn" onMouseDown={() => drive(0.3, 0)} onMouseUp={() => drive(0, 0)}>▲</button><div />
        <button className="btn" onMouseDown={() => drive(0, 0.8)} onMouseUp={() => drive(0, 0)}>◀</button>
        <button className="btn" onClick={() => drive(0, 0)}>■</button>
        <button className="btn" onMouseDown={() => drive(0, -0.8)} onMouseUp={() => drive(0, 0)}>▶</button>
        <div /><button className="btn" onMouseDown={() => drive(-0.3, 0)} onMouseUp={() => drive(0, 0)}>▼</button><div />
      </div>
      <style>{`.btn{background:#1f1f1f;padding:.5rem 0;border-radius:.25rem}.btn:hover{background:#2a2a2a}`}</style>
    </section>
  );
}
