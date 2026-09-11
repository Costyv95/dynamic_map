/**
 * Tiny DOM helpers for the editor panels. No framework: every panel builds
 * plain elements, so the same code runs in the iframe and in the HA panel.
 */

/** el('button.primary#save', { onClick, title }, 'Save') */
export function el(spec, attrs = {}, ...children) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const node = document.createElement(m[1] || 'div');
    (m[2] || '').match(/[.#][\w-]+/g)?.forEach(t => {
        if (t[0] === '.') node.classList.add(t.slice(1)); else node.id = t.slice(1);
    });
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'class') node.className = v;
        else if (k in node && k !== 'list' && k !== 'form') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
    }
    append(node, children);
    return node;
}

export function append(node, children) {
    (Array.isArray(children) ? children : [children]).flat(Infinity).forEach(c => {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/** Labelled control row. `hint` renders a small helper line under it. */
export function field(label, control, { hint, inline = false, badge } = {}) {
    const lab = el('label.dm-field-label', {}, label, badge || null);
    if (inline) return el('div.dm-field.dm-field-inline', {}, control, lab);
    return el('div.dm-field', {}, lab, control, hint ? el('div.dm-hint', {}, hint) : null);
}

/** Collapsible section with a header; `open` is remembered per key in localStorage. */
export function section(title, children, { key, open = true, actions } = {}) {
    const stored = key ? localStorage.getItem(`dm_sec_${key}`) : null;
    const isOpen = stored === null ? open : stored === 'true';
    const body = el('div.dm-section-body', { hidden: !isOpen }, children);
    const chevron = el('span.dm-chevron', {}, '▾');
    const head = el('div.dm-section-head', {
        onClick: (e) => {
            if (e.target.closest('.dm-section-actions')) return;
            body.hidden = !body.hidden;
            chevron.classList.toggle('collapsed', body.hidden);
            if (key) localStorage.setItem(`dm_sec_${key}`, String(!body.hidden));
        }
    }, chevron, el('span.dm-section-title', {}, title), actions ? el('span.dm-section-actions', {}, actions) : null);
    chevron.classList.toggle('collapsed', !isOpen);
    return el('section.dm-section', {}, head, body);
}

/** Segmented control: options [{value, label, title}], returns the element with .set(value). */
export function segmented(options, value, onChange, { className = '' } = {}) {
    const root = el(`div.dm-segmented${className ? '.' + className : ''}`, { role: 'group' });
    // "🏠 Rooms" renders as icon + text spans so narrow screens can keep the icon only.
    const parts = (label) => {
        const m = /^(\S+)\s+(.+)$/.exec(String(label));
        return m && /[^\w]/.test(m[1]) ? [el('span.dm-seg-ico', {}, m[1]), el('span.dm-seg-txt', {}, m[2])] : [label];
    };
    const buttons = options.map(o => el('button.dm-seg', {
        type: 'button', title: o.title || o.label, dataset: { value: o.value },
        onClick: () => { root.set(o.value); onChange(o.value); }
    }, parts(o.label)));
    append(root, buttons);
    root.set = (v) => buttons.forEach(b => b.classList.toggle('active', b.dataset.value === String(v)));
    root.set(value);
    return root;
}

export function iconButton(icon, title, onClick, extraClass = '') {
    return el(`button.dm-icon-btn${extraClass ? '.' + extraClass : ''}`, { type: 'button', title, 'aria-label': title, onClick }, icon);
}

/** Number input bound to get/set; `onInput` fires live, `onChange` on commit. */
export function numberInput({ value, step = 1, min, max, placeholder, onInput, onChange, width }) {
    const input = el('input', { type: 'number', step, placeholder: placeholder || '' });
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (width) input.style.width = width;
    input.value = value === undefined || value === null || Number.isNaN(value) ? '' : value;
    if (onInput) input.addEventListener('input', () => onInput(parse(input.value)));
    if (onChange) input.addEventListener('change', () => onChange(parse(input.value)));
    return input;
}

const parse = (v) => (v === '' ? undefined : parseFloat(v));

export function textInput({ value, placeholder, list, onInput, onChange, mono = false }) {
    const input = el('input', { type: 'text', placeholder: placeholder || '', autocomplete: 'off' });
    if (list) input.setAttribute('list', list);
    if (mono) input.classList.add('dm-mono');
    input.value = value ?? '';
    if (onInput) input.addEventListener('input', () => onInput(input.value));
    if (onChange) input.addEventListener('change', () => onChange(input.value));
    return input;
}

export function select(options, value, onChange) {
    const s = el('select', { onChange: () => onChange(s.value) },
        options.map(o => el('option', { value: o.value }, o.label)));
    s.value = value ?? '';
    return s;
}

export function checkbox(label, checked, onChange, { title } = {}) {
    const input = el('input', { type: 'checkbox', onChange: () => onChange(input.checked) });
    input.checked = !!checked;
    return el('label.dm-check', { title: title || '' }, input, el('span', {}, label));
}

/** Colour swatch + hex text kept in sync. */
export function colorInput(value, onInput, onChange, { placeholder = '#0ea5e9' } = {}) {
    const swatch = el('input.dm-swatch', { type: 'color' });
    const text = el('input.dm-mono', { type: 'text', placeholder });
    const set = (v) => { swatch.value = v || placeholder; text.value = v || ''; };
    set(value);
    swatch.addEventListener('input', () => { text.value = swatch.value; onInput(swatch.value); });
    swatch.addEventListener('change', () => onChange(swatch.value));
    text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value.trim())) { swatch.value = text.value.trim(); onInput(swatch.value); } });
    text.addEventListener('change', () => {
        let v = text.value.trim();
        if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) { set(v); onChange(v); } else if (v === '') onChange(undefined); else set(swatch.value);
    });
    const wrap = el('div.dm-color', {}, swatch, text);
    wrap.set = set;
    return wrap;
}
