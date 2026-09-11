import { el, textInput, select } from './dom.js?v=3.2.1';

const OPS = ['==', '!=', '<', '<=', '>', '>=', 'between'].map(v => ({ value: v, label: v }));

/**
 * Nested AND/OR rule builder for a state's `conditions`. The first leaf
 * is mirrored onto the legacy top-level keys (state_entity/operator/
 * value) so older cards keep working.
 */
export function renderConditions(ctx, st, rebuild, commit) {
    let root;
    if (st.conditions.length === 1 && st.conditions[0].rules) root = st.conditions[0];
    else root = { type: 'AND', rules: st.conditions };

    const sync = () => {
        const hasNested = root.rules.some(r => r.rules);
        st.conditions = (root.type === 'AND' && !hasNested) ? root.rules : [root];
        const leaf = firstLeaf(root);
        st.state_entity = leaf ? (leaf.state_entity || '') : '';
        st.operator = leaf ? (leaf.operator || '==') : '==';
        st.value = leaf ? (leaf.value || '') : '';
    };
    const onLive = () => { sync(); ctx.state.requestDrawCallback(); };
    const onStructure = () => { sync(); rebuild(); };
    const onCommit = () => { sync(); commit(); };
    return el('div', {}, renderGroup(root, null, { onLive, onStructure, onCommit }));
}

function firstLeaf(g) {
    for (const r of (g.rules || [])) {
        if (r.rules) { const f = firstLeaf(r); if (f) return f; }
        else return r;
    }
    return null;
}

function renderGroup(group, parent, h) {
    const rules = group.rules || (group.rules = []);
    const opSwitch = el('div.dm-segmented', {}, ['AND', 'OR'].map(op => el('button.dm-seg', {
        type: 'button', class: `dm-seg ${(group.type || 'AND') === op ? 'active' : ''}`, onClick: () => { group.type = op; h.onStructure(); }
    }, op === 'AND' ? 'All of' : 'Any of')));
    const head = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, opSwitch,
        parent ? el('button.ghost', { type: 'button', title: 'Remove group', onClick: () => { parent.rules.splice(parent.rules.indexOf(group), 1); h.onStructure(); } }, '✕') : null);
    const rows = rules.length ? rules.map((rule, idx) => rule.rules ? renderGroup(rule, group, h) : renderLeaf(rule, rules, idx, h))
        : [el('div.dm-empty', {}, 'No rules: this state never matches.')];
    const controls = el('div.dm-row', {},
        el('button', { type: 'button', onClick: () => { rules.push({ state_entity: '', operator: '==', value: '' }); h.onStructure(); } }, '＋ Rule'),
        el('button', { type: 'button', onClick: () => { rules.push({ type: 'AND', rules: [{ state_entity: '', operator: '==', value: '' }] }); h.onStructure(); } }, '＋ Group'));
    return el('div.dm-card', {}, head, el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '6px', borderLeft: '2px solid var(--dm-border)' } }, rows), controls);
}

function renderLeaf(rule, rules, idx, h) {
    const entity = textInput({ value: rule.state_entity || rule.entity || '', placeholder: 'Entity', list: 'entityList',
        onInput: (v) => { rule.state_entity = v; rule.entity = v; h.onLive(); }, onChange: h.onCommit });
    const op = select(OPS, rule.operator || '==', (v) => { rule.operator = v; h.onStructure(); });
    const val = textInput({ value: rule.value || '', placeholder: rule.operator === 'between' ? 'min-max' : 'Value',
        onInput: (v) => { rule.value = v; h.onLive(); }, onChange: h.onCommit });
    op.style.flex = '0 0 96px';
    val.style.flex = '0 0 90px';
    return el('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } }, entity, op, val,
        el('button.ghost', { type: 'button', title: 'Remove rule', onClick: () => { rules.splice(idx, 1); h.onStructure(); } }, '✕'));
}
