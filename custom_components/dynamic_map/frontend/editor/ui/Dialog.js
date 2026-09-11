import { el, clear } from './dom.js?v=3.2.1';

/**
 * Modal dialogs and toasts that work inside the Companion app webview
 * (where window.prompt/confirm are unreliable). One overlay element is
 * reused; `open()` returns a promise resolved with the chosen button.
 */
let host = null;

function ensureHost() {
    if (host && host.isConnected) return host;
    host = el('div.dm-dialog-host', { hidden: true });
    document.body.appendChild(host);
    return host;
}

/**
 * open({ title, body, buttons: [{label, value, primary, danger}], width })
 * Resolves with the button value ('cancel' on backdrop/Escape).
 */
export function openDialog({ title, body, buttons, width = 460 }) {
    const root = ensureHost();
    clear(root);
    root.hidden = false;
    return new Promise((resolve) => {
        const close = (v) => { root.hidden = true; clear(root); document.removeEventListener('keydown', onKey); resolve(v); };
        const onKey = (e) => { if (e.key === 'Escape') close('cancel'); };
        document.addEventListener('keydown', onKey);
        const btns = (buttons || [{ label: 'OK', value: 'ok', primary: true }]).map(b =>
            el(`button${b.primary ? '.primary' : ''}${b.danger ? '.danger' : ''}`, { type: 'button', onClick: () => close(b.value) }, b.label));
        const card = el('div.dm-dialog', { style: { width: `min(${width}px, 94vw)` }, role: 'dialog', 'aria-modal': 'true' },
            el('div.dm-dialog-head', {}, el('h3', {}, title), el('button.dm-icon-btn', { type: 'button', title: 'Close', onClick: () => close('cancel') }, '✕')),
            el('div.dm-dialog-body', {}, body),
            el('div.dm-dialog-foot', {}, btns));
        root.appendChild(el('div.dm-backdrop', { onClick: () => close('cancel') }));
        root.appendChild(card);
        const first = card.querySelector('input, select, textarea, button.primary');
        if (first) setTimeout(() => first.focus(), 0);
    });
}

export async function confirmDialog(title, message, { okLabel = 'OK', danger = false } = {}) {
    const v = await openDialog({
        title, body: el('p', {}, message),
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: okLabel, value: 'ok', primary: !danger, danger }]
    });
    return v === 'ok';
}

export async function promptDialog(title, message, { value = '', placeholder = '', type = 'text' } = {}) {
    const input = el('input', { type, placeholder });
    input.value = value;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.closest('.dm-dialog').querySelector('button.primary').click(); });
    const v = await openDialog({
        title, body: [message ? el('p', {}, message) : null, input],
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }]
    });
    return v === 'ok' ? input.value : null;
}

export function alertDialog(title, message) {
    return openDialog({ title, body: el('p', {}, message) });
}

let toastEl = null;
let toastTimer = null;

/** Short status message at the bottom of the screen. kind: 'ok' | 'error' | 'info' */
export function toast(message, kind = 'info', ms = 2600) {
    if (!toastEl || !toastEl.isConnected) {
        toastEl = el('div.dm-toast');
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.className = `dm-toast dm-toast-${kind} dm-visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('dm-visible'), ms);
}
