#!/usr/bin/env python3
"""Publish pallet + bricks as MoveIt CollisionObjects so they appear in RViz.

Run after MoveIt is up:
  ros2 run vika_moveit publish_scene.py
"""
import rclpy
from rclpy.node import Node
from moveit_msgs.msg import PlanningScene, CollisionObject
from shape_msgs.msg import SolidPrimitive, Mesh, MeshTriangle
from geometry_msgs.msg import Pose, Point
import struct


def load_stl(path: str) -> Mesh:
    """Read a binary STL into a shape_msgs/Mesh (verts in mm — caller scales)."""
    with open(path, "rb") as f:
        f.read(80)
        n = struct.unpack("<I", f.read(4))[0]
        vmap, verts, tris = {}, [], []
        for _ in range(n):
            f.read(12)
            tri = []
            for _ in range(3):
                x, y, z = struct.unpack("<fff", f.read(12))
                # mm → m
                key = (round(x, 3), round(y, 3), round(z, 3))
                if key not in vmap:
                    vmap[key] = len(verts)
                    verts.append((x / 1000.0, y / 1000.0, z / 1000.0))
                tri.append(vmap[key])
            f.read(2)
            tris.append(tri)
    m = Mesh()
    for v in verts:
        p = Point(); p.x, p.y, p.z = v
        m.vertices.append(p)
    for t in tris:
        mt = MeshTriangle()
        mt.vertex_indices = t
        m.triangles.append(mt)
    return m


class ScenePublisher(Node):
    def __init__(self):
        super().__init__("vika_scene_publisher")
        self.pub = self.create_publisher(PlanningScene, "/planning_scene", 10)
        self.objects = self.build_objects()
        self.count = 0
        self.create_timer(1.0, self.tick)

    def tick(self):
        ps = PlanningScene()
        ps.is_diff = True
        ps.world.collision_objects = self.objects
        self.pub.publish(ps)
        self.count += 1
        if self.count == 1:
            self.get_logger().info(f"Published {len(self.objects)} collision objects (republish every 1s)")

    def build_objects(self):
        objs = []

        # === Pallet (simple box, lumped) ===
        pal = CollisionObject()
        pal.header.frame_id = "world"
        pal.id = "euro_pallet"
        prim = SolidPrimitive()
        prim.type = SolidPrimitive.BOX
        prim.dimensions = [1.2, 0.8, 0.144]
        pose = Pose()
        pose.position.x = 1.4
        pose.position.y = 0.0
        pose.position.z = 0.072
        pose.orientation.w = 1.0
        pal.primitives = [prim]
        pal.primitive_poses = [pose]
        pal.operation = CollisionObject.ADD
        objs.append(pal)

        # Bricks NOT published as collision objects — they stay visual-only
        # in Gazebo. build_wall.py creates phantom brick objects on attach.
        return objs


def main():
    rclpy.init()
    node = ScenePublisher()
    rclpy.spin(node)
    rclpy.shutdown()


if __name__ == "__main__":
    main()
