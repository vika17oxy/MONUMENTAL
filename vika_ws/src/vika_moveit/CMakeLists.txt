cmake_minimum_required(VERSION 3.8)
project(vika_moveit)
find_package(ament_cmake REQUIRED)

install(DIRECTORY config launch DESTINATION share/${PROJECT_NAME})

install(PROGRAMS scripts/publish_scene.py scripts/build_wall.py scripts/goto_brick.py scripts/hmi_bridge.py
        DESTINATION lib/${PROJECT_NAME})

ament_package()
