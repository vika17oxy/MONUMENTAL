"""Sphinx configuration for VIKA documentation."""
import os
import sys

project = 'VIKA'
author = 'Elias Bitsch & Viktoriia Ovdiienko'
copyright = '2026, VIKA team'
release = '0.1.0'

sys.path.insert(0, os.path.abspath('../../vika_ws/src/vika_mcp'))
sys.path.insert(0, os.path.abspath('../../vika_ws/src/vika_hmi_bridge'))

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
latex_documents = [('index', 'VIKA.tex', 'VIKA Documentation',
                    author, 'manual')]
