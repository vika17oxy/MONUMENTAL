from setuptools import find_packages, setup

package_name = 'vika_perception'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/perception.launch.py']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Elias Bitsch',
    maintainer_email='eliasbitsch@hotmail.com',
    description='YOLOv8 brick detector subscribing to wrist RGBD camera.',
    license='MIT',
    entry_points={
        'console_scripts': [
            'cnn_brick_detector = vika_perception.cnn_brick_detector:main',
        ],
    },
)
