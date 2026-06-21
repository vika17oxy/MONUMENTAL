#!/usr/bin/env python3
"""VIKA brick detector — open-vocabulary (Grounding DINO), on-demand.

OPTIONAL perception add-on. The base sim/HMI/IK run without it; this node only
powers the AI brick DETECT feature. If torch/transformers are missing it stays
alive but reports "offline" so the HMI degrades gracefully instead of crashing.

Flow:  /hmi/detect (Empty)  ->  grab latest wrist-cam frame  ->  Grounding DINO
       (prompt "a brick.")  ->  boxes + back-projected world poses.
Out:   /detect/image/compressed  (JPEG with boxes drawn, for the HMI view)
       /detect/result            (std_msgs/String JSON: dets[], error)

Each detection: {box:[x0,y0,x1,y1] px, score, world:[x,y,z] or null}. The world
pose is the box-centre pixel ray intersected with the brick-top plane (z=BRICK_Z)
using the camera intrinsics + the live wrist-cam TF.
"""
import json
import threading
import time

import numpy as np
import cv2
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, DurabilityPolicy
from std_msgs.msg import String, Empty
from sensor_msgs.msg import Image, CameraInfo, CompressedImage
import tf2_ros

PROMPT = "a brick."
MODEL = "IDEA-Research/grounding-dino-tiny"
BRICK_Z = 0.38           # brick TOP surface height in world [m] (brick is 0.238 tall)
CAM_FRAME = "robot_a_arm_wrist_cam_link"
CAM_HFOV = 1.3           # wrist-cam horizontal FOV [rad] (matches the xacro)
CAM_W, CAM_H = 640, 480  # wrist-cam image size (matches the xacro)
BOX_THRESH = 0.28        # DINO box confidence (drops weak spurious detections)
MAX_AREA_FRAC = 0.55     # drop "whole scene" detections larger than this
MIN_SIDE_FRAC = 0.04     # drop tiny noise boxes
NMS_IOU = 0.4            # merge overlapping boxes

# Optional heavy deps — import guarded so the node runs (offline) without them.
try:
    import torch
    from PIL import Image as PILImage
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    HAVE_DINO = True
    IMPORT_ERR = ""
except Exception as e:                       # noqa: BLE001
    HAVE_DINO = False
    IMPORT_ERR = str(e)


def quat_to_R(x, y, z, w):
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w),     2 * (x * z + y * w)],
        [2 * (x * y + z * w),     1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w),     2 * (y * z + x * w),     1 - 2 * (x * x + y * y)],
    ])


class DinoDetector(Node):
    def __init__(self):
        super().__init__("dino_detector")
        self.lock = threading.Lock()
        self.frame = None
        # Wrist-cam intrinsics, empirically CALIBRATED against the 3 known bricks
        # (gz's effective FOV differs from the xacro value and camera_info doesn't
        # flow over the bridge). Back-projects the bricks to <1 cm. A real
        # /camera_info message overrides this if one ever arrives.
        self.K = np.array([[266.6, 0.0, 320.0], [0.0, 266.6, 169.8], [0.0, 0.0, 1.0]])
        self.tf_buf = tf2_ros.Buffer()
        tf2_ros.TransformListener(self.tf_buf, self)

        self.create_subscription(Image, "/robot_a/wrist_cam/image", self._on_img, 5)
        self.create_subscription(CameraInfo, "/robot_a/wrist_cam/camera_info", self._on_info, 5)
        self.create_subscription(Empty, "/hmi/detect", self._on_detect, 5)
        # latched so the HMI (and late subscribers) always get the last detection
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.pub_img = self.create_publisher(CompressedImage, "/detect/image/compressed", latched)
        self.pub_res = self.create_publisher(String, "/detect/result", latched)

        self.model = self.proc = None
        self.device = "cpu"
        if HAVE_DINO:
            self._load_model()
        else:
            self.get_logger().warn(
                "perception add-on NOT installed (no torch/transformers) -> DETECT "
                "offline. Install with docker/install_perception.sh. " + IMPORT_ERR)
        self.get_logger().info("dino_detector ready" + ("" if HAVE_DINO else " (OFFLINE)"))

    def _load_model(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.get_logger().info(f"loading {MODEL} on {self.device} ...")
        self.proc = AutoProcessor.from_pretrained(MODEL)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(MODEL).to(self.device)
        self.get_logger().info(f"model loaded on {self.device}")

    # ---------- inputs ----------
    def _on_img(self, m):
        a = np.frombuffer(m.data, np.uint8).reshape(m.height, m.width, 3)
        with self.lock:
            self.frame = a.copy()

    def _on_info(self, m):
        self.K = np.array(m.k).reshape(3, 3)

    # ---------- detection ----------
    def _on_detect(self, _):
        if not HAVE_DINO:
            self._publish_result([], error="perception add-on not installed")
            return
        with self.lock:
            img = None if self.frame is None else self.frame.copy()
        if img is None:
            self._publish_result([], error="no camera frame")
            return
        t0 = time.time()
        try:
            boxes, scores = self._run_dino(img)
        except Exception as e:                # noqa: BLE001
            self.get_logger().error(f"DINO inference failed: {e}")
            self._publish_result([], error=f"inference error: {e}")
            return
        dets = []
        for (x0, y0, x1, y1), sc in zip(boxes, scores):
            world = self._pixel_to_world((x0 + x1) / 2, (y0 + y1) / 2)
            dets.append({
                "box": [float(x0), float(y0), float(x1), float(y1)],
                "score": float(sc),
                "world": None if world is None else [round(float(w), 3) for w in world],
            })
        dets.sort(key=lambda d: d["box"][0])   # stable left->right Tab order
        self._publish_image(img)               # raw frame; the HMI overlays boxes
        self._publish_result(dets)
        self.get_logger().info(
            f"detected {len(dets)} brick(s) in {time.time() - t0:.2f}s on {self.device}")

    def _run_dino(self, img_rgb):
        pil = PILImage.fromarray(img_rgb)
        inputs = self.proc(images=pil, text=PROMPT, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        # arg name changed across transformers versions (box_threshold -> threshold)
        try:
            res = self.proc.post_process_grounded_object_detection(
                outputs, inputs.input_ids, threshold=BOX_THRESH, text_threshold=BOX_THRESH,
                target_sizes=[pil.size[::-1]])[0]
        except TypeError:
            res = self.proc.post_process_grounded_object_detection(
                outputs, inputs.input_ids, box_threshold=BOX_THRESH, text_threshold=BOX_THRESH,
                target_sizes=[pil.size[::-1]])[0]
        boxes = res["boxes"].cpu().numpy().tolist()
        scores = res["scores"].cpu().numpy().tolist()
        return self._filter(boxes, scores, pil.size[0], pil.size[1])

    @staticmethod
    def _filter(boxes, scores, W, H):
        """Drop whole-scene + tiny boxes, then NMS to keep one box per brick."""
        img_area = W * H
        bs, ss = [], []
        for (x0, y0, x1, y1), s in zip(boxes, scores):
            w, h = max(1.0, x1 - x0), max(1.0, y1 - y0)
            if w * h > MAX_AREA_FRAC * img_area:
                continue
            if w < MIN_SIDE_FRAC * W and h < MIN_SIDE_FRAC * H:
                continue
            bs.append([x0, y0, x1, y1])
            ss.append(float(s))
        if not bs:
            return [], []
        rects = [[int(x0), int(y0), int(x1 - x0), int(y1 - y0)] for x0, y0, x1, y1 in bs]
        idxs = cv2.dnn.NMSBoxes(rects, ss, BOX_THRESH, NMS_IOU)
        idxs = np.array(idxs).flatten().tolist()
        return [bs[i] for i in idxs], [ss[i] for i in idxs]

    def _pixel_to_world(self, u, v):
        """Back-project a pixel onto the brick-top plane (z=BRICK_Z) in world."""
        if self.K is None:
            return None
        try:
            tf = self.tf_buf.lookup_transform("world", CAM_FRAME, rclpy.time.Time())
        except Exception:                      # noqa: BLE001
            return None
        fx, fy, cx, cy = self.K[0, 0], self.K[1, 1], self.K[0, 2], self.K[1, 2]
        a, b = (u - cx) / fx, (v - cy) / fy    # optical-frame ray (z=1 forward)
        d_link = np.array([1.0, -a, -b])       # gz camera: +X link = optical +Z
        q, t = tf.transform.rotation, tf.transform.translation
        ray = quat_to_R(q.x, q.y, q.z, q.w) @ d_link
        origin = np.array([t.x, t.y, t.z])
        if abs(ray[2]) < 1e-6:
            return None
        s = (BRICK_Z - origin[2]) / ray[2]
        if s < 0:
            return None
        return origin + s * ray

    # ---------- outputs ----------
    def _publish_image(self, img_rgb):
        """Publish the raw snapshot as JPEG; the HMI draws the boxes itself."""
        bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        ok, buf = cv2.imencode(".jpg", bgr)
        if ok:
            m = CompressedImage()
            m.format = "jpeg"
            m.data = buf.tobytes()
            self.pub_img.publish(m)

    def _publish_result(self, dets, error=""):
        self.pub_res.publish(String(data=json.dumps({"dets": dets, "error": error})))


def main():
    rclpy.init()
    n = DinoDetector()
    try:
        rclpy.spin(n)
    except KeyboardInterrupt:
        pass
    rclpy.shutdown()


if __name__ == "__main__":
    main()
