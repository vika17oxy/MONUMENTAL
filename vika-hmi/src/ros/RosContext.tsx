import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import ROSLIB from 'roslib';

export type JointMap = Record<string, number>;

export type Detection = {
  box: [number, number, number, number];   // x0,y0,x1,y1 in 640x480 px
  score: number;
  world: [number, number, number] | null;  // back-projected brick pose
};

export type BtNodeState = { name: string; type: string; status: string; depth: number; last: boolean };

type RosState = {
  ros: ROSLIB.Ros | null;
  connected: boolean;
  selectedRobot: 'robot_a' | 'robot_b';
  setSelectedRobot: (r: 'robot_a' | 'robot_b') => void;
  /** Latest joint positions keyed by joint name. Updates ~30Hz from /joint_states. */
  jointsRef: React.MutableRefObject<JointMap>;
  /** Trigger rerenders if a UI panel needs joint readouts (rare). */
  jointsTick: number;
  /** Helpers — publish to /hmi/* topics consumed by hmi_bridge.py. */
  sendCmd: (cmd: 'HOME' | 'STOP' | 'READY') => void;
  sendJointJog: (deltas: number[]) => void;
  /** Set absolute joint targets (rad) — used by the joint sliders. */
  sendJointSet: (positions: number[]) => void;
  /** Jog the linear rail by a delta (m). */
  sendRailJog: (delta: number) => void;
  /** Vacuum gripper on/off (attach/detach the bricks). */
  sendSuction: (on: boolean) => void;
  sendTcpJog: (dx: number, dy: number, dz: number) => void;
  /** AI brick detector (Grounding DINO). */
  detections: Detection[];
  detectImage: string | null;          // base64 JPEG of the annotated wrist cam
  detectError: string;                 // '' or e.g. 'perception add-on not installed'
  sendDetect: () => void;              // trigger a DINO snapshot
  sendGoto: (x: number, y: number, z: number) => void;  // drive TCP above a brick
  /** Selective vacuum: pads to attach, e.g. 'c' (one brick), 'lcr' (row), '' (release). */
  sendSuck: (pads: string) => void;
  /** Mission behaviour tree live state + control. */
  btNodes: BtNodeState[];
  btRunning: boolean;
  sendMission: (cmd: 'START' | 'STOP' | 'CEMENT' | 'AUTO') => void;
  /** Wall plan drawn in the site view — world [x,y] vertices for place targets. */
  sendWall: (pts: [number, number][]) => void;
  /** Active input mode: touch joysticks vs Xbox gamepad. */
  inputMode: 'touch' | 'gamepad';
  setInputMode: (m: 'touch' | 'gamepad') => void;
};

const Ctx = createContext<RosState | null>(null);

export function RosProvider({ url, children }: { url: string; children: ReactNode }) {
  const [ros, setRos] = useState<ROSLIB.Ros | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<'robot_a' | 'robot_b'>('robot_a');
  const jointsRef = useRef<JointMap>({});
  const [jointsTick, setJointsTick] = useState(0);
  const cmdPubRef = useRef<ROSLIB.Topic | null>(null);
  const jogPubRef = useRef<ROSLIB.Topic | null>(null);
  const tcpPubRef = useRef<ROSLIB.Topic | null>(null);
  const activeRobotPubRef = useRef<ROSLIB.Topic | null>(null);
  const jointSetPubRef = useRef<ROSLIB.Topic | null>(null);
  const railJogPubRef = useRef<ROSLIB.Topic | null>(null);
  const suctionPubRef = useRef<ROSLIB.Topic | null>(null);
  const detectPubRef = useRef<ROSLIB.Topic | null>(null);
  const gotoPubRef = useRef<ROSLIB.Topic | null>(null);
  const suckPubRef = useRef<ROSLIB.Topic | null>(null);
  const missionPubRef = useRef<ROSLIB.Topic | null>(null);
  const wallPubRef = useRef<ROSLIB.Topic | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detectImage, setDetectImage] = useState<string | null>(null);
  const [detectError, setDetectError] = useState('');
  const [btNodes, setBtNodes] = useState<BtNodeState[]>([]);
  const [btRunning, setBtRunning] = useState(false);
  const [inputMode, setInputMode] = useState<'touch' | 'gamepad'>('touch');

  useEffect(() => {
    const r = new ROSLIB.Ros({ url });
    r.on('connection', () => setConnected(true));
    r.on('close', () => setConnected(false));
    r.on('error', () => setConnected(false));
    setRos(r);

    cmdPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/cmd', messageType: 'std_msgs/String',
    });
    jogPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/joint_jog', messageType: 'std_msgs/Float64MultiArray',
    });
    tcpPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/tcp_jog', messageType: 'geometry_msgs/Vector3',
    });
    activeRobotPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/active_robot', messageType: 'std_msgs/String',
    });
    jointSetPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/joint_set', messageType: 'std_msgs/Float64MultiArray',
    });
    railJogPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/rail_jog', messageType: 'std_msgs/Float64',
    });
    suctionPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/suction', messageType: 'std_msgs/Bool',
    });
    detectPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/detect', messageType: 'std_msgs/Empty',
    });
    gotoPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/goto', messageType: 'geometry_msgs/Point',
    });
    suckPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/suck', messageType: 'std_msgs/String',
    });
    missionPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/mission', messageType: 'std_msgs/String',
    });
    wallPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/wall', messageType: 'std_msgs/String',
    });
    const btTopic = new ROSLIB.Topic({
      ros: r, name: '/bt/state', messageType: 'std_msgs/String',
    });
    btTopic.subscribe((msg: any) => {
      try {
        const d = JSON.parse(msg.data);
        setBtNodes(d.nodes ?? []);
        setBtRunning(!!d.running);
      } catch { /* ignore */ }
    });

    // AI detector outputs (latched on the node side, so we get the last result).
    const resTopic = new ROSLIB.Topic({
      ros: r, name: '/detect/result', messageType: 'std_msgs/String',
    });
    resTopic.subscribe((msg: any) => {
      try {
        const d = JSON.parse(msg.data);
        setDetections(d.dets ?? []);
        setDetectError(d.error ?? '');
      } catch { /* ignore */ }
    });
    const imgTopic = new ROSLIB.Topic({
      ros: r, name: '/detect/image/compressed', messageType: 'sensor_msgs/CompressedImage',
    });
    imgTopic.subscribe((msg: any) => {
      // rosbridge delivers the byte array as base64 already
      if (msg.data) setDetectImage(msg.data as string);
    });

    // Close cleanly even on a hard tab close / navigation (where React cleanup
    // may not run) so no rosbridge connection is left dangling.
    const onHide = () => { try { r.close(); } catch { /* noop */ } };
    window.addEventListener('pagehide', onHide);

    return () => {
      window.removeEventListener('pagehide', onHide);
      try { resTopic.unsubscribe(); imgTopic.unsubscribe(); btTopic.unsubscribe(); } catch { /* noop */ }
      r.close();
    };
  }, [url]);

  // Subscribe to the SELECTED robot's joint_states (namespaced), and tell the
  // bridge which robot is active. Re-runs whenever the selection changes.
  useEffect(() => {
    if (!ros) return;
    activeRobotPubRef.current?.publish(new ROSLIB.Message({ data: selectedRobot }));
    const jsTopic = new ROSLIB.Topic({
      ros,
      name: `/${selectedRobot}/joint_states`,
      messageType: 'sensor_msgs/JointState',
      throttle_rate: 30,
    });
    let lastTick = 0;
    jsTopic.subscribe((msg: any) => {
      const names: string[] = msg.name ?? [];
      const pos: number[] = msg.position ?? [];
      const map = jointsRef.current;
      for (let i = 0; i < names.length; i++) map[names[i]] = pos[i];
      const now = performance.now();
      if (now - lastTick > 100) {
        lastTick = now;
        setJointsTick((t) => t + 1);
      }
    });
    return () => jsTopic.unsubscribe();
  }, [ros, selectedRobot]);

  const sendCmd = (cmd: 'HOME' | 'STOP' | 'READY') => {
    cmdPubRef.current?.publish(new ROSLIB.Message({ data: cmd }));
  };
  const sendJointJog = (deltas: number[]) => {
    if (deltas.length !== 6) return;
    jogPubRef.current?.publish(new ROSLIB.Message({ data: deltas, layout: { dim: [], data_offset: 0 } }));
  };
  const sendJointSet = (positions: number[]) => {
    if (positions.length !== 6) return;
    jointSetPubRef.current?.publish(new ROSLIB.Message({ data: positions, layout: { dim: [], data_offset: 0 } }));
  };
  const sendRailJog = (delta: number) => {
    railJogPubRef.current?.publish(new ROSLIB.Message({ data: delta }));
  };
  const sendSuction = (on: boolean) => {
    suctionPubRef.current?.publish(new ROSLIB.Message({ data: on }));
  };
  const sendTcpJog = (dx: number, dy: number, dz: number) => {
    tcpPubRef.current?.publish(new ROSLIB.Message({ x: dx, y: dy, z: dz }));
  };
  const sendDetect = () => {
    detectPubRef.current?.publish(new ROSLIB.Message({}));
  };
  const sendGoto = (x: number, y: number, z: number) => {
    gotoPubRef.current?.publish(new ROSLIB.Message({ x, y, z }));
  };
  const sendSuck = (pads: string) => {
    suckPubRef.current?.publish(new ROSLIB.Message({ data: pads }));
  };
  const sendMission = (cmd: 'START' | 'STOP' | 'CEMENT' | 'AUTO') => {
    missionPubRef.current?.publish(new ROSLIB.Message({ data: cmd }));
  };
  const sendWall = (pts: [number, number][]) => {
    wallPubRef.current?.publish(new ROSLIB.Message({ data: JSON.stringify(pts) }));
  };

  return (
    <Ctx.Provider value={{
      ros, connected, selectedRobot, setSelectedRobot,
      jointsRef, jointsTick,
      sendCmd, sendJointJog, sendJointSet, sendRailJog, sendTcpJog, sendSuction,
      detections, detectImage, detectError, sendDetect, sendGoto, sendSuck,
      btNodes, btRunning, sendMission, sendWall, inputMode, setInputMode,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRos(): RosState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRos must be inside RosProvider');
  return v;
}
