from slowapi import Limiter
from slowapi.util import get_remote_address

# Eigen module i.p.v. in main.py, anders zou elke router main.py moeten
# importeren voor de limiter -- dat geeft een circulaire import (main.py
# importeert op zijn beurt de routers)
limiter = Limiter(key_func=get_remote_address)
