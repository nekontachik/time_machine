"""Make the deepeval/ dir importable so tests can `import payoff_metric` etc.,
regardless of the directory pytest is launched from."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
