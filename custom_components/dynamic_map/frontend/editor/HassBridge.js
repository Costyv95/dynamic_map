/**
 * Live `hass` for the editor preview. In the custom panel the host hands
 * it in (`setHass`); in the legacy iframe we read the parent app's live
 * object, which the HA frontend keeps refreshed.
 */
export class HassBridge {
    constructor(onHass, { pollMs = 2000 } = {}) {
        this.onHass = onHass;
        this.pollMs = pollMs;
        this.hass = null;
        this.timer = null;
    }

    /** Called by a panel host (or tests) with the live hass object. */
    setHass(hass) {
        if (!hass) return;
        const changed = hass !== this.hass || hass.states !== this._states;
        this.hass = hass;
        this._states = hass.states;
        if (changed) this.onHass(hass);
    }

    /** Try the parent HA app; returns null outside an HA iframe. */
    static parentHass() {
        try {
            const ha = window.parent && window.parent !== window
                && window.parent.document && window.parent.document.querySelector('home-assistant');
            return ha && ha.hass ? ha.hass : null;
        } catch (e) {
            return null;
        }
    }

    /** Poll the parent app until stopped (iframe mode only). */
    startPolling() {
        const tick = () => this.setHass(HassBridge.parentHass());
        tick();
        this.timer = setInterval(tick, this.pollMs);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }
}
