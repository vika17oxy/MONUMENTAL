"""Export the assembled VIKA robot at home pose as GLB + 3MF.

Reads the STLs from vika_description and applies the cumulative URDF
transforms (joint origins from base_only.urdf.xacro) so all parts sit in
their correct relative poses.

Output:
  MONUMENTAL/presentation/vika_robot.glb   (best for PowerPoint Insert > 3D Models)
  MONUMENTAL/presentation/vika_robot.3mf

Drag the .glb directly into PowerPoint and rotate it like any 3D shape.
"""
import os
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESH_DIR = os.path.join(ROOT, "vika_ws", "src", "vika_description",
                        "meshes", "arm", "ROD-STL")
OUT_DIR = os.path.join(ROOT, "presentation")
os.makedirs(OUT_DIR, exist_ok=True)


def rpy(r, p, y):
    """URDF rpy -> 4x4 matrix (R = Rz·Ry·Rx)."""
    return trimesh.transformations.euler_matrix(r, p, y, axes="sxyz")


def trans(x, y, z):
    T = np.eye(4)
    T[:3, 3] = [x, y, z]
    return T


def joint(x, y, z, r=0, p=0, yw=0):
    return trans(x, y, z) @ rpy(r, p, yw)


# Joint origins copied verbatim from base_only.urdf.xacro (home pose, q=0)
T_base = np.eye(4)
T_j1 = T_base @ joint(0, 0, 0.175, 0, 0, 1.5152)
T_j2 = T_j1 @ joint(0.1038, -0.4023, 0.2912, 1.5708, 0, -1.5708)
T_j3 = T_j2 @ joint(0, 1.300, 0, 0, 0, -0.2221)
T_j4 = T_j3 @ joint(0.1600, 0.2369, 0.0003, 1.5708, 0.9923, 1.5708)
T_j5 = T_j4 @ joint(-0.0860, 0, 1.3050, 1.5708, -1.3556, -1.5708)
T_j6 = T_j5 @ joint(0.1600, 0, -0.0850, -1.5708, 1.3440, -1.5708)
# Gripper: authored with grasping Z pointing INTO flange → 180° roll flip
T_grp = T_j6 @ joint(0, 0, 0.020, -3.1416, 0, -0.7298)
# Nozzle: authored with working Z pointing OUT → no flip
T_noz = T_j6 @ joint(0, 0, 0.020, 0, 0, -0.7298)

BASE_PARTS = [
    ("base.stl",    T_base, [180, 180, 190]),   # steel grey
    ("link1.stl",   T_j1,   [40, 40, 45]),      # gloss black
    ("link2.stl",   T_j2,   [40, 40, 45]),
    ("link3.stl",   T_j3,   [40, 40, 45]),
    ("link4.stl",   T_j4,   [40, 40, 45]),
    ("link5.stl",   T_j5,   [40, 40, 45]),
    ("link6.stl",   T_j6,   [40, 40, 45]),
]

# Two export variants: vika (gripper) and vika_5 (nozzle)
VARIANTS = [
    ("vika_robot",   ("gripper.stl", T_grp, [60, 60, 65])),
    ("vika_5_robot", ("nozzle.stl",  T_noz, [60, 60, 65])),
]


def build_scene(ee_part):
    scene = trimesh.Scene()
    for fname, T, color in BASE_PARTS + [ee_part]:
        path = os.path.join(MESH_DIR, fname)
        m = trimesh.load(path, force="mesh")
        m.apply_scale(0.001)              # mm -> m
        m.apply_transform(T)
        m.visual.face_colors = color + [255]
        scene.add_geometry(m, node_name=fname.replace(".stl", ""))
        print(f"  + {fname:14s} verts={len(m.vertices):>6d}")

    ground = trimesh.creation.box(extents=[3.0, 3.0, 0.01])
    ground.apply_translation([0, 0, -0.005])
    ground.visual.face_colors = [60, 65, 72, 255]
    scene.add_geometry(ground, node_name="ground")
    return scene


for variant_name, ee_part in VARIANTS:
    print(f"\n=== {variant_name} ===")
    scene = build_scene(ee_part)

    glb_path = os.path.join(OUT_DIR, f"{variant_name}.glb")
    mf_path = os.path.join(OUT_DIR, f"{variant_name}.3mf")

    scene.export(glb_path)
    print(f"GLB   -> {glb_path}  ({os.path.getsize(glb_path)/1024:.0f} KB)")

    try:
        combined = trimesh.util.concatenate([g for g in scene.geometry.values()])
        combined.export(mf_path)
        print(f"3MF   -> {mf_path}  ({os.path.getsize(mf_path)/1024:.0f} KB)")
    except Exception as e:
        print(f"3MF export skipped: {e}")
