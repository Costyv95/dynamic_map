import { el, field, section, segmented, numberInput, checkbox } from './dom.js?v=3.2.1';
import { shortcutFrame, writeFrame, BASE_SIZE } from '../../shared/ShortcutGeometry.js?v=3.2.1';
import { readProp, writeProp, previewState, overrideBadge } from './binding.js?v=3.2.1';
import { isOrientationObject } from '../../shared/OrientationProps.js?v=3.2.1';

/**
 * Size, rotation and the two layouts, in plain words: width/height in map
 * units (the plan's pixels), a lock for the aspect ratio, one switch for
 * which layout the edits go to, and a copy button when they diverge.
 */
export function renderSizePanel(ctx, sc) {
    const { state, canvas, app } = ctx;
    const st = previewState(sc, state);
    const opts = () => ({ mode: canvas.activeMode, state: st, imgW: canvas.imgW, imgH: canvas.imgH, hass: canvas._hass });
    const wmode = () => (canvas.linkOrientations === false ? canvas.activeMode : 'both');
    const frame = shortcutFrame(sc, opts());
    const isSensor = sc.type === 'sensor';
    const badge = (prop) => overrideBadge(ctx, sc, prop);

    const write = (patch, commit) => {
        writeFrame(sc, patch, { ...opts(), mode: wmode() });
        if (commit) state.saveState();
        state.requestDrawCallback();
    };
    const heightIn = numberInput({ value: round(frame.h), step: 1, min: 6, onInput: (v) => v && write({ h: v }, false), onChange: (v) => v && write({ h: v }, true) });
    const widthIn = numberInput({ value: round(frame.w), step: 1, min: 6, onInput: (v) => v && write({ w: v }, false), onChange: (v) => v && write({ w: v }, true) });
    if (isSensor) { widthIn.disabled = true; widthIn.title = 'A sensor pill sizes its width from the text.'; }
    const lock = checkbox('Keep proportions', frame.proportional, (on) => {
        writeProp(ctx, sc, 'proportional', on);
        if (on) write({ w: Math.max(frame.w, frame.h), h: Math.max(frame.w, frame.h) }, true);
        ctx.refresh();
    });
    const rotIn = numberInput({ value: Math.round(frame.rotation || 0), step: 15, min: -360, max: 360,
        onInput: (v) => write({ rotation: v || 0 }, false), onChange: (v) => write({ rotation: v || 0 }, true) });
    const rotSlider = el('input', { type: 'range', min: 0, max: 360, step: 5, value: ((frame.rotation || 0) + 360) % 360,
        onInput: () => { rotIn.value = rotSlider.value; write({ rotation: +rotSlider.value }, false); },
        onChange: () => write({ rotation: +rotSlider.value }, true) });

    const linked = canvas.linkOrientations !== false;
    const layoutSeg = segmented([
        { value: 'both', label: 'Both layouts', title: 'Moves, sizes and rotations apply to landscape and portrait together' },
        { value: 'horizontal', label: '🖥 Landscape', title: 'Edit only the landscape layout (wide screens)' },
        { value: 'vertical', label: '📱 Portrait', title: 'Edit only the portrait layout (phones)' }
    ], linked ? 'both' : canvas.activeMode, (v) => {
        if (v === 'both') app.setLinked(true);
        else { app.setLinked(false); app.setLayout(v); }
    });
    const diverged = layoutsDiffer(sc);
    const other = canvas.activeMode === 'horizontal' ? 'vertical' : 'horizontal';
    const copyBtn = el('button', { type: 'button', title: `Overwrite the ${other} layout with this one`,
        onClick: () => { copyLayout(sc, canvas.activeMode, other); state.saveState(); state.requestDrawCallback(); ctx.refresh(); }
    }, `Copy ${canvas.activeMode === 'horizontal' ? 'landscape → portrait' : 'portrait → landscape'}`);

    const upright = !readProp(sc, state, 'autoRotate', false);
    return section('Size & position', [
        el('div.dm-row', {},
            field('Width', widthIn, { badge: badge('scaleX') }),
            field('Height', heightIn, { badge: badge('scaleY') }),
            field('Rotation °', rotIn, { badge: badge('rotation') })),
        rotSlider,
        lock,
        field('Edits apply to', layoutSeg, {
            hint: linked
                ? 'The card picks landscape or portrait from the screen. Right now both layouts change together.'
                : `Only the ${canvas.activeMode === 'horizontal' ? 'landscape' : 'portrait'} layout changes. ${diverged ? 'The two layouts differ.' : 'The two layouts are still identical.'}`
        }),
        linked ? null : copyBtn,
        checkbox('Stays upright when the map turns', upright, (on) => { writeProp(ctx, sc, 'autoRotate', on ? undefined : true); ctx.refresh(); },
            { title: 'Off = the badge turns with the floorplan like furniture (decor default).' }),
        renderContentControls(ctx, sc)
    ], { key: 'sc-size' });
}

const round = (v) => Math.round(v * 10) / 10;

/** Do any of position / scale / rotation hold different landscape and portrait values? */
export function layoutsDiffer(sc) {
    const keys = ['position', 'scale', 'scaleX', 'scaleY', 'rotation'];
    return keys.some(k => {
        const v = sc[k];
        return isOrientationObject(v) && JSON.stringify(v.horizontal) !== JSON.stringify(v.vertical);
    });
}

/** Copy one layout's legs onto the other for every oriented key. */
export function copyLayout(sc, from, to) {
    ['position', 'scale', 'scaleX', 'scaleY', 'rotation'].forEach(k => {
        const v = sc[k];
        if (isOrientationObject(v) && v[from] !== undefined) v[to] = JSON.parse(JSON.stringify(v[from]));
    });
}

/** Advanced: inner content offset / scale / rotation relative to the shape. */
function renderContentControls(ctx, sc) {
    const { state } = ctx;
    const matchSize = readProp(sc, state, 'content_matchSize', true) !== false;
    const matchRot = readProp(sc, state, 'content_matchRotation', true) !== false;
    const num = (prop, ph) => numberInput({ value: readProp(sc, state, prop, undefined), step: prop.includes('scale') ? 0.05 : 1, placeholder: ph,
        onInput: (v) => writeProp(ctx, sc, prop, v, { commit: false }), onChange: (v) => writeProp(ctx, sc, prop, v) });
    const body = [
        el('div.dm-row', {}, field('Offset X', num('content_x', '0')), field('Offset Y', num('content_y', '0'))),
        checkbox('Content fills the shape', matchSize, (on) => { writeProp(ctx, sc, 'content_matchSize', on ? undefined : false); ctx.refresh(); }),
        matchSize ? null : el('div.dm-row', {}, field('Content scale X', num('content_scaleX', '1')), field('Content scale Y', num('content_scaleY', '1'))),
        checkbox('Content turns with the shape', matchRot, (on) => { writeProp(ctx, sc, 'content_matchRotation', on ? undefined : false); ctx.refresh(); }),
        matchRot ? null : field('Content rotation °', num('content_rotation', '0')),
        el('div.dm-hint', {}, `1 map unit = 1 pixel of the floor plan. A default badge is ${BASE_SIZE} units.`)
    ];
    return section('Inner icon / image (advanced)', body, { key: 'sc-content', open: false });
}
