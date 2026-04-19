from setuptools import find_packages, setup

package_name = 'brickbot_hmi_bridge'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/hmi.launch.py']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Elias Bitsch',
    maintainer_email='eliasbitsch@hotmail.com',
    description='HMI bridge: rosbridge, web_video_server, TCP linear jog service.',
    license='MIT',
    entry_points={
        'console_scripts': [
            'tcp_linear_jog = brickbot_hmi_bridge.tcp_linear_jog:main',
        ],
    },
)
