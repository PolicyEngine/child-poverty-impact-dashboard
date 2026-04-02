"""
Child Poverty Impact Dashboard - Backend API
"""

import sys
import os

# Add parent directory to path so cpid_calc can be imported
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
