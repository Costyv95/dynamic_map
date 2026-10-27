import { suggestedProxies } from '../ProxySuggest.js?v=3.2.1';

/**
 * Proxies layer: a tap on the map places the proxy picked in the panel
 * (state.placingProxy); dragging a placed marker moves it; tapping a
 * marker selects it. A faded suggestion (an unplaced proxy in its room)
 * becomes placed when dragged or tapped. Positions are map percent, like calibration spots.
 */
export class ProxyTool {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.state = state;
        this.drag = null;   // {id, moved}
    }

    pct(pt) { return this.canvas.toPercent(pt.x, pt.y); }

    onDown(e, hit) {
        const state = this.state;
        if (state.placingProxy || hit.kind !== 'handle' || hit.handle !== 'proxy') return false;
        state.selectedProxyId = hit.proxyId;
        const hint = !state.proxies.some(p => p.id === hit.proxyId)
            && suggestedProxies(state.knownProxies, state.proxies, state.rooms).find(p => p.id === hit.proxyId);
        if (hint) state.proxies.push({ id: hint.id, name: hint.name, position: hint.position });  // placed on release
        this.drag = { id: hit.proxyId, moved: false, suggested: !!hint };
        state.updateUICallback();
        state.requestDrawCallback();
        return true;
    }

    onMove(e, pt) {
        const p = this.drag && this.state.proxies.find(x => x.id === this.drag.id);
        if (!p) return false;
        const [x, y] = this.pct(pt);
        p.position = [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
        this.drag.moved = true;
        this.state.requestDrawCallback();
        return true;
    }

    onUp() {
        const drag = this.drag;
        this.drag = null;
        if (!drag) return false;
        const p = this.state.proxies.find(x => x.id === drag.id);
        if ((drag.moved || drag.suggested) && p) this.state.placeProxy(p, p.position);   // a tap accepts a suggestion
        return true;
    }

    /** A tap that no marker took: place the armed proxy there, or clear the selection. */
    onClick(pt) {
        const state = this.state;
        if (state.placingProxy) {
            state.placeProxy(state.placingProxy, this.pct(pt));
            return;
        }
        if (state.selectedProxyId !== null) {
            state.selectedProxyId = null;
            state.updateUICallback();
            state.requestDrawCallback();
        }
    }
}
