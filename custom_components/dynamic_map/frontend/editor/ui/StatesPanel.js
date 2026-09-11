import { el, section, textInput, checkbox, colorInput } from './dom.js?v=3.2.1';
import { renderConditions } from './ConditionsBuilder.js?v=3.2.1';

/**
 * States: conditions that change how the badge looks. Preview a state to
 * see it on the map and edit its overrides in the Look / Size panels.
 */
export function renderStatesPanel(ctx, sc) {
    const { state } = ctx;
    const cfg = sc.config;
    if (!cfg.states) cfg.states = [];
    const commit = () => { state.saveState(); state.requestDrawCallback(); };
    const cards = cfg.states.map((st, idx) => renderState(ctx, sc, st, idx, commit));
    return section('States', [
        el('div.dm-hint', {}, 'The first state whose conditions match wins; the default state is the fallback. Use 👁 Preview to see and edit a state on the map.'),
        cards.length ? cards : el('div.dm-empty', {}, 'No states: the badge always shows its default look.'),
        el('button', { type: 'button', onClick: () => {
            cfg.states.push({ id: `st_${Date.now()}`, name: 'New state', state_entity: sc.entity_id || '', operator: '==', value: '',
                color: localStorage.getItem('lastStateColor') || '#ffffff', icon: '', _expanded: true });
            commit(); ctx.refresh();
        } }, '＋ Add state')
    ], { key: 'sc-states' });
}

function renderState(ctx, sc, st, idx, commit) {
    const { state } = ctx;
    const cfg = sc.config;
    if (!st.conditions) {
        st.conditions = (st.state_entity || st.operator || st.value)
            ? [{ state_entity: st.state_entity || '', operator: st.operator || '==', value: st.value || '' }] : [];
    }
    const previewing = state.previewStateIdx === idx;
    const title = st.is_default ? (st.name || 'Default') : (st.name || st.state_entity || st.conditions[0]?.state_entity || 'New state');
    const rebuild = () => { commit(); ctx.refresh(); };
    const set = (prop, v) => { if (v === '' || v === undefined) delete st[prop]; else st[prop] = v; };

    const body = el('div', { hidden: st._expanded !== true, style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        textInput({ value: st.name || '', placeholder: 'State name', onChange: (v) => { set('name', v); rebuild(); } }),
        checkbox('Default state (fallback when nothing else matches)', !!st.is_default, (on) => {
            st.is_default = on;
            if (on) { cfg.states.forEach((o, i) => { if (i !== idx) o.is_default = false; }); st.conditions = []; st.state_entity = ''; st.operator = '=='; st.value = ''; }
            rebuild();
        }),
        st.is_default ? null : renderConditions(ctx, st, rebuild, commit),
        el('div.dm-row', {},
            colorInput(st.color || '', (v) => { st.color = v; localStorage.setItem('lastStateColor', v); state.requestDrawCallback(); }, (v) => { set('color', v); commit(); }),
            textInput({ value: st.icon || '', placeholder: 'Icon / emoji', list: 'iconList', onChange: (v) => { set('icon', v); commit(); } })),
        textInput({ value: st.image || '', placeholder: 'Image URL for this state (optional)', list: 'iconList', onChange: (v) => { set('image', v); commit(); } }),
        textInput({ value: st.description || '', placeholder: 'Appearance in this state, for texture generation', onChange: (v) => { set('description', v); commit(); } }),
        checkbox('Turns with the map in this state', !!st.autoRotate, (on) => { set('autoRotate', on || undefined); commit(); }));

    const head = el('div.dm-card-head', { onClick: (e) => {
        if (e.target.closest('button')) return;
        st._expanded = !(st._expanded === true);
        body.hidden = !st._expanded;
    } },
    el('span', { class: `dm-chevron ${st._expanded ? '' : 'collapsed'}` }, '▾'),
    el('strong', { style: { color: previewing ? 'var(--dm-accent)' : '' } }, title),
    el('button', { type: 'button', class: previewing ? 'primary' : '', title: 'Show this state on the map and edit its overrides', onClick: () => {
        state.togglePreviewState(idx);
        ctx.refresh();
    } }, previewing ? '👁 Previewing' : '👁 Preview'),
    el('button.danger', { type: 'button', title: 'Remove', onClick: () => {
        cfg.states.splice(idx, 1);
        if (state.previewStateIdx >= cfg.states.length) state.previewStateIdx = -1;
        rebuild();
    } }, '✕'));
    return el(`div.dm-card${previewing ? '.dm-preview' : ''}`, {}, head, body);
}
