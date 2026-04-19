# BrickBot

Two cooperating mobile brick-laying robots on tracked bases.
FHTW MRE2 Robotermodellierung, SS2026.

**Authors:** Elias Bitsch, Viktoriia Ovdiienko

## Stack

- ROS 2 **Jazzy** (Docker, host networking)
- **Gazebo Harmonic** (native in WSL2 Ubuntu 24.04)
- **MoveIt 2** + ros2_control + BehaviorTree.CPP
- Web HMI: **Vite + React 19 + TypeScript + shadcn/ui + three.js**
- LLM control: **MCP server** (Python)
- Perception: **YOLOv8** brick pose detection
- Docs: **Sphinx → LaTeX → PDF**

## Layout

```
brickbot_ws/          colcon workspace (ROS 2 packages)
brickbot-hmi/         Vite web HMI
brickbot_docs/        Sphinx documentation
docker/               Docker image + compose
start.sh              Single-entry launch script
plan.md               Project plan (source of truth)
angabe.md             Course brief
```

## Prerequisites

- Windows 11 with **WSL2 Ubuntu 24.04** running
- **Docker Desktop** (or Docker Engine inside WSL2)
- **Node 22+** and **pnpm 10+** on Windows (for HMI dev server)
- **Gazebo Harmonic** installed natively in WSL2:

```bash
# inside WSL2
sudo apt update && sudo apt install -y gz-harmonic
```

## First-time setup

```bash
# 1. Build ROS image
docker compose -f docker/docker-compose.yml build

# 2. Install HMI deps (on Windows)
cd brickbot-hmi && pnpm install && cd ..
```

## Run

```bash
./start.sh
```

Opens:
- HMI: http://localhost:5173
- rosbridge: ws://localhost:9090
- Gazebo native window

## Status

Scaffold only. See `plan.md` for the full phase roadmap.
