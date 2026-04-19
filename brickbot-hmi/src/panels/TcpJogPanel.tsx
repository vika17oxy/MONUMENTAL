import { useState } from 'react';
import ROSLIB from 'roslib';
import { useRos } from '../ros/RosContext';

// Mandatory: move TCP linearly via IK (angabe.md section 3, line 85).
export function TcpJogPanel() {
  const { ros, selectedRobot } = useRos();
  const [step, setStep] = useState(0.01);

  const jog = (dx: number, dy: number, dz: number) => {
    if (!ros) return;
    const topic = new ROSLIB.Topic({
      ros,
      name: `/${selectedRobot}/servo_node/delta_twist_cmds`,
      messageType: 'geometry_msgs/TwistStamped',
    });
    topic.publish(new ROSLIB.Message({
      header: { stamp: { sec: 0, nanosec: 0 }, frame_id: `${selectedRobot}_arm_tool0` },
      twist: { linear: { x: dx * step, y: dy * step, z: dz * step }, angular: { x: 0, y: 0, z: 0 } },
    }));
  };

  const Btn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onMouseDown={onClick}
      className="rounded bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 py-2 font-mono"
    >{label}</button>
  );

  return (
    <section className="rounded border border-neutral-800 p-3 bg-neutral-950">
      <h2 className="font-semibold mb-2">TCP Linear Jog</h2>
      <div className="grid grid-cols-3 gap-1 text-sm">
        <div /> <Btn label="+Y" onClick={() => jog(0, 1, 0)} /> <div />
        <Btn label="-X" onClick={() => jog(-1, 0, 0)} />
        <Btn label="⏺"  onClick={() => jog(0, 0, 0)} />
        <Btn label="+X" onClick={() => jog(1, 0, 0)} />
        <div /> <Btn label="-Y" onClick={() => jog(0, -1, 0)} /> <div />
        <Btn label="-Z" onClick={() => jog(0, 0, -1)} />
        <div />
        <Btn label="+Z" onClick={() => jog(0, 0, 1)} />
      </div>
      <label className="flex items-center gap-2 mt-3 text-xs">
        Step
        <input type="range" min={0.001} max={0.05} step={0.001}
               value={step} onChange={(e) => setStep(parseFloat(e.target.value))}
               className="flex-1" />
        <span className="font-mono w-12 text-right">{(step * 1000).toFixed(0)} mm</span>
      </label>
    </section>
  );
}
