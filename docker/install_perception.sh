#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VIKA — OPTIONAL perception add-on installer (Grounding DINO brick detector).
#
# The base sim, HMI, IK control, joysticks and the wrist camera all work
# WITHOUT this. Only the AI brick DETECT feature needs it. Install it either:
#
#   • permanently into the image (recommended):
#       docker compose build --build-arg WITH_PERCEPTION=1 ros
#   • or once into the running container (lost on `docker compose down`):
#       docker exec vika_ros bash /ws/../docker/install_perception.sh
#       (from the repo: docker exec vika_ros bash -c "$(cat docker/install_perception.sh)")
#
# It installs a CUDA-12.x torch that matches the host driver, transformers, and
# pre-caches the model so the first DETECT is fast and works offline.
# ─────────────────────────────────────────────────────────────────────────────
set -e
PIP="pip install --break-system-packages --no-cache-dir"

echo "==> [1/3] GPU torch (CUDA 12.4 — matches a 12.4+ driver; the ultralytics"
echo "          default is cu130 which is too new for a 12.7 driver -> CPU only)"
$PIP --force-reinstall torch torchvision --index-url https://download.pytorch.org/whl/cu124

echo "==> [2/3] transformers (open-vocabulary Grounding DINO)"
$PIP transformers

echo "==> [3/3] pre-cache grounding-dino-tiny into ${HF_HOME:-~/.cache/huggingface}"
python3 - <<'PY'
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
mid = "IDEA-Research/grounding-dino-tiny"
AutoProcessor.from_pretrained(mid)
AutoModelForZeroShotObjectDetection.from_pretrained(mid)
print("    grounding-dino-tiny cached OK")
PY

python3 - <<'PY'
import torch
print(f"==> done. torch {torch.__version__}  cuda_available={torch.cuda.is_available()}")
PY
