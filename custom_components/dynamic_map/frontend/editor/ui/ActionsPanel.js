import { el, field, section, textInput, select, checkbox, numberInput } from './dom.js?v=3.2.1';
import { openMenuLayoutEditor } from './MenuLayoutEditor.js?v=3.2.1';

const TYPES = [
    ['TOGGLE', 'Toggle'], ['TOGGLE_ON', 'Turn on'], ['TOGGLE_OFF', 'Turn off'], ['CALL_SERVICE', 'Call a service'],
    ['SLIDER', 'Slider (brightness)'], ['VALUE_SLIDER', 'Value slider (live readout)'], ['INFO_DISPLAY', 'Info display (read-only)'],
    ['PROGRESS_BAR', 'Progress bar'], ['ROOM_SELECTOR', 'Select rooms on the map'], ['SENSOR_OVERLAY', 'Sensor dials'],
    ['COLOR_PICKER', 'Colour honeycomb (light)'], ['VACUUM_ROOMS', 'Vacuum rooms']
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const isMenu = (a) => a.trigger === 'long_press' || a.trigger === 'overlay';

/** Actions: what a tap does, and what the long-press menu shows. */
export function renderActionsPanel(ctx, sc) {
    const { state } = ctx;
    const cfg = sc.config;
    if (!cfg.actions) cfg.actions = [];
    const commit = () => { state.saveState(); state.requestDrawCallback(); };
    const cards = cfg.actions.map((act, idx) => renderAction(ctx, sc, act, idx, commit));
    const hasMenu = cfg.actions.some(isMenu);
    return section('Actions', [
        el('div.dm-hint', {}, 'Tap actions run on a tap; long-press actions appear in a menu.'),
        cards.length ? cards : el('div.dm-empty', {}, 'No actions. Tapping does nothing yet.'),
        el('div.dm-row', {},
            el('button', { type: 'button', onClick: () => {
                cfg.actions.push({ id: `act_${Date.now()}`, name: '', trigger: 'tap', type: 'TOGGLE', action_entity: sc.entity_id || '', _expanded: true });
                commit(); ctx.refresh();
            } }, '＋ Add action'),
            hasMenu ? el('button', { type: 'button', title: 'Arrange the long-press menu visually', onClick: () => openMenuLayoutEditor(ctx, sc) }, '📐 Menu layout') : null)
    ], { key: 'sc-actions' });
}

function renderAction(ctx, sc, act, idx, commit) {
    const cfg = sc.config;
    const title = act.name || `${isMenu(act) ? 'Long press' : 'Tap'} · ${TYPE_LABEL[act.type] || act.type || 'action'}`;
    const body = el('div', { hidden: act._expanded !== true, style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    const rebuild = () => { commit(); ctx.refresh(); };
    const set = (prop, v) => { if (v === '' || v === undefined) delete act[prop]; else act[prop] = v; };
    const fill = () => {
        body.replaceChildren(
            textInput({ value: act.name || '', placeholder: 'Menu label (optional)', onChange: (v) => { set('name', v); rebuild(); } }),
            el('div.dm-row', {},
                select([{ value: 'tap', label: 'On tap' }, { value: 'long_press', label: 'In long-press menu' }], isMenu(act) ? 'long_press' : 'tap', (v) => { act.trigger = v; rebuild(); }),
                select(TYPES.map(([value, label]) => ({ value, label })), act.type || 'TOGGLE', (v) => { act.type = v; rebuild(); })),
            el('div.dm-row', {},
                textInput({ value: act.action_entity || '', placeholder: 'Entity (defaults to the object entity)', list: 'entityList', onChange: (v) => { set('action_entity', v); commit(); } }),
                textInput({ value: act.icon || '', placeholder: 'Icon', list: 'iconList', onChange: (v) => { set('icon', v); commit(); } })),
            ...typeFields(act, set, commit)
        );
    };
    fill();
    const head = el('div.dm-card-head', { onClick: (e) => {
        if (e.target.closest('button')) return;
        act._expanded = !(act._expanded === true);
        body.hidden = !act._expanded;
    } },
    el('span.dm-chevron', { class: `dm-chevron ${act._expanded ? '' : 'collapsed'}` }, '▾'),
    el('strong', {}, title),
    el('button', { type: 'button', title: 'Move up', disabled: idx === 0, onClick: () => { swap(cfg.actions, idx, idx - 1); rebuild(); } }, '▲'),
    el('button', { type: 'button', title: 'Move down', disabled: idx === cfg.actions.length - 1, onClick: () => { swap(cfg.actions, idx, idx + 1); rebuild(); } }, '▼'),
    el('button.danger', { type: 'button', title: 'Remove', onClick: () => { cfg.actions.splice(idx, 1); rebuild(); } }, '✕'));
    return el('div.dm-card', {}, head, body);
}

function typeFields(act, set, commit) {
    const out = [];
    const t = act.type;
    if (t === 'CALL_SERVICE' || t === 'PROGRESS_BAR') {
        out.push(el('div.dm-row', {},
            textInput({ value: act.service || '', placeholder: t === 'PROGRESS_BAR' ? 'Tap service (optional)' : 'Service, e.g. light.turn_on', list: 'serviceList', mono: true, onChange: (v) => { set('service', v); commit(); } }),
            textInput({ value: act.payload || '', placeholder: 'Payload JSON, e.g. {"repeat": 2}', mono: true, onChange: (v) => { set('payload', v); commit(); } })));
    }
    if (t === 'SLIDER') out.push(checkbox('Symmetric scale (1/5x … 5x)', !!act.symmetric_scale, (on) => { set('symmetric_scale', on || undefined); commit(); }));
    if (t === 'PROGRESS_BAR') {
        out.push(el('div.dm-row', {},
            field('Min', numberInput({ value: act.min, placeholder: '0', onChange: (v) => { set('min', v); commit(); } })),
            field('Max', textInput({ value: act.max !== undefined ? String(act.max) : '', placeholder: '100 or an entity', onChange: (v) => { set('max', v === '' ? undefined : (isNaN(parseFloat(v)) ? v : parseFloat(v))); commit(); } })),
            checkbox('Full = bad', !!act.invert, (on) => { set('invert', on || undefined); commit(); })));
    }
    if (t === 'INFO_DISPLAY' || t === 'VALUE_SLIDER' || t === 'PROGRESS_BAR') {
        out.push(el('div.dm-row', {},
            t !== 'VALUE_SLIDER' ? textInput({ value: act.attribute || '', placeholder: 'Attribute (blank = state)', onChange: (v) => { set('attribute', v); commit(); } }) : null,
            textInput({ value: act.unit !== undefined ? act.unit : '', placeholder: 'Unit', onChange: (v) => { set('unit', v); commit(); } }),
            numberInput({ value: act.decimals, placeholder: 'Decimals', onChange: (v) => { set('decimals', v === undefined ? undefined : Math.round(v)); commit(); } })));
    }
    if (isMenu(act)) out.push(textInput({ value: act.width || '', placeholder: 'Width in the menu, e.g. 150px', onChange: (v) => { set('width', v); commit(); } }));
    return out;
}

function swap(arr, i, j) {
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
}
