"""Which Bluetooth proxies are offline, for a problem sensor per proxy.

HA-free, so the tests load it by path like position_math.py. A proxy is
offline when every entity of its device is unavailable (or gone), and it
counts only after OFFLINE_AFTER seconds, so an HA restart or a proxy
reboot doesn't raise an alert.
"""
OFFLINE_AFTER = 120


def device_down(states):
    """True when the device has entities and none of them is available."""
    states = list(states)
    return bool(states) and all(s in (None, "unavailable") for s in states)


class Debounce:
    """Down since when; offline only once it has been down long enough."""

    def __init__(self, after=OFFLINE_AFTER):
        self.after = after
        self.since = None

    def update(self, down, now):
        """Feed one observation; returns whether to report offline."""
        if not down:
            self.since = None
            return False
        if self.since is None:
            self.since = now
        return now - self.since >= self.after
