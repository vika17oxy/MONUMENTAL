"""Sphinx configuration for BrickBot documentation."""
import os
import sys

project = 'BrickBot'
author = 'Elias Bitsch & Viktoriia Ovdiienko'
copyright = '2026, BrickBot team'
release = '0.1.0'

sys.path.insert(0, os.path.abspath('../../brickbot_ws/src/brickbot_mcp'))
sys.path.insert(0, os.path.abspath('../../brickbot_ws/src/brickbot_perception'))
sys.path.insert(0, os.path.abspath('../../brickbot_ws/src/brickbot_hmi_bridge'))

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.napoleon',
    'sphinx.ext.viewcode',
    'sphinx.ext.intersphinx',
    'myst_parser',
]

templates_path = ['_templates']
exclude_patterns = []
language = 'en'

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']

latex_elements = {
    'papersize': 'a4paper',
    'pointsize': '11pt',
}
latex_documents = [('index', 'BrickBot.tex', 'BrickBot Documentation',
                    author, 'manual')]
