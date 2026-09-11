const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log('[HassApi]', ...args); };

/**
 * The editor runs in an iframe panel without its own `hass` object, so it
 * cannot use hass.callApi directly. It IS same-origin with the parent HA
 * frontend, though, so the most reliable token source is the parent app's
 * live `hass.auth` object — the frontend keeps that access token refreshed
 * for us, and we can force a refresh if it has expired.
 *
 * We fall back to the persisted `hassTokens` blob, checking BOTH localStorage
 * (written when the user ticks "Keep me logged in") and sessionStorage
 * (used otherwise), so a save still authenticates in either login mode.
 *
 * On the iOS/Android Companion apps none of the storage fallbacks can work:
 * those apps authenticate the frontend through the *external auth* bridge, so
 * no `hassTokens` blob is ever written. The only usable source there is the
 * parent app's live auth object, which we reach via `window.parent.
 * hassConnection` — a promise the HA frontend always publishes on its window,
 * independent of the DOM. That is why it is tried before the storage paths.
 */

/** Which source produced the last token — surfaced in the 401 message. */
let lastTokenSource = 'none';

/** Read a token out of an HA `auth` object, refreshing it if it has expired. */
async function tokenFromAuth(auth) {
    if (!auth || !auth.accessToken) return null;
    if (auth.expired && typeof auth.refreshAccessToken === 'function') {
        await auth.refreshAccessToken();
    }
    return auth.accessToken || null;
}

async function getAccessToken() {
    // 1. Live, auto-refreshed token from the parent HA app (best source).
    try {
        const ha = window.parent
            && window.parent.document
            && window.parent.document.querySelector('home-assistant');
        const token = await tokenFromAuth(ha && ha.hass && ha.hass.auth);
        if (token) { lastTokenSource = 'parent-hass'; return token; }
    } catch (e) { /* no parent hass (standalone/cross-origin) — try the next source */ }

    // 2. The parent frontend's connection promise. DOM-independent, and the ONLY
    //    source that works in the Companion apps (external auth writes no tokens).
    try {
        if (window.parent && window.parent.hassConnection) {
            const { auth } = await window.parent.hassConnection;
            const token = await tokenFromAuth(auth);
            if (token) { lastTokenSource = 'parent-hassConnection'; return token; }
        }
    } catch (e) { /* not exposed / cross-origin — fall through to storage */ }

    // 3. Persisted tokens — try both storages; refresh if expired via refresh_token.
    for (const store of [localStorage, sessionStorage]) {
        try {
            const tokens = JSON.parse(store.getItem('hassTokens'));
            if (!tokens || !tokens.access_token) continue;
            lastTokenSource = 'stored-tokens';
            const stillValid = !tokens.expires || tokens.expires - 30000 > Date.now();
            if (stillValid) return tokens.access_token;
            const refreshed = await refreshStoredToken(store, tokens);
            if (refreshed) return refreshed;
            return tokens.access_token; // last resort: send it and let the server decide
        } catch (e) { /* malformed entry — try the next store */ }
    }
    lastTokenSource = 'none';
    return null;
}

/** Exchange a stored refresh_token for a fresh access_token and persist it. */
async function refreshStoredToken(store, tokens) {
    if (!tokens.refresh_token) return null;
    try {
        const res = await fetch('/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refresh_token,
                client_id: `${location.protocol}//${location.host}/`,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.access_token) return null;
        const updated = {
            ...tokens,
            access_token: data.access_token,
            expires: Date.now() + (data.expires_in || 1800) * 1000,
        };
        store.setItem('hassTokens', JSON.stringify(updated));
        return data.access_token;
    } catch (e) {
        return null;
    }
}

async function authHeaders() {
    const token = await getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** Live hass object handed in by the custom panel; its fetchWithAuth carries the session. */
let panelHass = null;
export function setPanelHass(hass) { panelHass = hass || null; }
export function usesPanelHass() { return !!(panelHass && typeof panelHass.fetchWithAuth === 'function'); }

export async function apiFetch(path, options = {}) {
    const res = panelHass && typeof panelHass.fetchWithAuth === 'function'
        ? await panelHass.fetchWithAuth(path, options)
        : await fetch(path, {
            ...options,
            headers: { ...(options.headers || {}), ...(await authHeaders()) },
        });
    if (res.status === 401) {
        throw new Error(
            lastTokenSource === 'none'
                // No source produced a token at all — the editor never saw the
                // parent app's auth. Naming this separately matters: in the
                // Companion apps it is the ONLY possible shape of failure.
                ? 'Not authenticated: no Home Assistant token available to the editor '
                  + '(token source: none). Reopen the Map Editor from the HA sidebar; '
                  + 'in a browser, log in with "Keep me logged in".'
                // A token WAS sent and the server still rejected it.
                : `Not authenticated: Home Assistant rejected the token (source: ${lastTokenSource}). `
                  + 'Reload the editor; if it persists, log out and back in.'
        );
    }
    return res;
}

export async function apiJson(path, options = {}) {
    const res = await apiFetch(path, options);
    try {
        return await res.json();
    } catch (e) {
        return { success: false, error: `Invalid response from ${path} (HTTP ${res.status})` };
    }
}

export function postJson(path, body) {
    return apiJson(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
