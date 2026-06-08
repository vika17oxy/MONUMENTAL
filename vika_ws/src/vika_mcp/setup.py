from setuptools import find_packages, setup

package_name = 'vika_mcp'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools', 'mcp'],
    zip_safe=True,
    maintainer='Elias Bitsch',
    maintainer_email='eliasbitsch@hotmail.com',
    description='MCP server bridging Claude to the Gazebo world and ROS2 mission stack.',
    license='MIT',
    entry_points={
        'console_scripts': [
            'server = vika_mcp.server:main',
        ],
    },
)
