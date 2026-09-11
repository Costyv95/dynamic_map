import { el } from './dom.js?v=3.2.1';
import { openDialog, toast } from './Dialog.js?v=3.2.1';

/**
 * Raw JSON for one object. Accepts a whole shortcut or just its config
 * block; top-level keys pasted inside a config block are lifted out.
 */
const TOP_KEYS = ['type', 'entity_id', 'name', 'scale', 'scaleX', 'scaleY', 'shape', 'rotation', 'position'];

export function applyRawJson(sc, parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.config && typeof parsed.config === 'object') {
        sc.config = parsed.config;
        TOP_KEYS.forEach(k => { if (parsed[k] !== undefined) sc[k] = parsed[k]; });
        return;
    }
    sc.config = parsed;
    ['type', 'entity_id', 'name', 'shape'].forEach(k => {
        if (parsed[k] !== undefined) { sc[k] = parsed[k]; delete sc.config[k]; }
    });
}

export async function openRawJson(ctx, sc) {
    const ta = el('textarea', { spellcheck: false, style: { minHeight: '50vh', fontFamily: 'ui-monospace, monospace', fontSize: '12px' } });
    ta.value = JSON.stringify({ ...sc, config: sc.config }, (k, v) => (k.startsWith('_') ? undefined : v), 2);
    const v = await openDialog({ title: `${sc.name || 'Object'} as JSON`, body: ta, width: 760,
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Apply', value: 'ok', primary: true }] });
    if (v !== 'ok') return;
    try {
        applyRawJson(sc, JSON.parse(ta.value));
        ctx.state.saveState();
        ctx.state.requestDrawCallback();
        ctx.refresh();
        toast('JSON applied.', 'ok');
    } catch (e) {
        toast(`Invalid JSON: ${e.message}`, 'error', 5000);
    }
}
