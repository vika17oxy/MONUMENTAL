cmake_minimum_required(VERSION 3.8)
project(brickbot_mission)

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(action_msgs REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  action/BuildWall.action
  action/PickBrick.action
  action/PlaceBrick.action
  action/ApplyCement.action
  DEPENDENCIES geometry_msgs action_msgs
)

install(DIRECTORY bt_trees launch DESTINATION share/${PROJECT_NAME})

ament_export_dependencies(rosidl_default_runtime)
ament_package()
