import { el, field, section, textInput, select, checkbox, colorInput } from './dom.js?v=3.2.1';
import { confirmDialog, toast } from './Dialog.js?v=3.2.1';
import { readProp, writeProp, overrideBadge, previewState, layerOf } from './binding.js?v=3.2.1';
import { applyTypePreset, SHORTCUT_TYPES } from './Presets.js?v=3.2.1';
import { renderSizePanel } from './SizePanel.js?v=3.2.1';
import { renderActionsPanel } from './ActionsPanel.js?v=3.2.1';
import { renderStatesPanel } from './StatesPanel.js?v=3.2.1';
import { renderVacuumPanel } from './VacuumPanel.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';
import { openRawJson } from './RawJsonDialog.js?v=3.2.1';

/** The inspector for a selected object or decor item. */
export function renderShortcutPanel(ctx, sc) {
    const { state } = ctx;
    if (!sc.config) sc.config = {};
    const decor = layerOf(sc) === 'decor';
    const st = previewState(sc, state);
    const parts = [
        st ? el('div.dm-badge', { style: { alignSelf: 'flex-start' } }, `Editing state: ${st.name || 'state'}`,
            el('button', { type: 'button', onClick: () => { state.togglePreviewState(state.previewStateIdx); ctx.refresh(); } }, '× stop')) : null,
        renderIdentity(ctx, sc, decor),
        renderLook(ctx, sc),
        renderSizePanel(ctx, sc),
        sc.type === 'sensor' && !decor ? renderSensorFields(ctx, sc) : null,
        sc.type === 'vacuum' && !decor ? renderVacuumPanel(ctx, sc) : null,
        !decor ? renderActionsPanel(ctx, sc) : null,
        !decor ? renderStatesPanel(ctx, sc) : null,
        renderFooter(ctx, sc)
    ];
    return parts;
}

function renderIdentity(ctx, sc, decor) {
    const { state, app } = ctx;
    const commit = () => { state.saveState(); state.requestDrawCallback(); };
    const entity = textInput({ value: sc.entity_id || '', placeholder: 'e.g. light.desk_lamp', list: 'entityList',
        onInput: (v) => { retargetEntity(sc, v); state.requestDrawCallback(); }, onChange: () => { commit(); ctx.refresh(); } });
    app.attachAutocomplete(entity);
    const parents = [{ value: 'home', label: 'Home (global)' }, { value: `floor_${state.activeFloor}`, label: `This floor (Floor ${state.activeFloor})` },
        ...state.rooms.map(r => ({ value: r.id, label: `Room: ${r.name || 'Unnamed'}` }))];
    return section(decor ? 'Decor item' : 'Object', [
        field('Name', textInput({ value: sc.name || '', placeholder: 'e.g. Desk lamp', onInput: (v) => { sc.name = v; state.requestDrawCallback(); }, onChange: () => { commit(); ctx.syncLists(); } })),
        decor ? null : field('Entity', entity, { hint: 'The Home Assistant entity this badge shows and controls.' }),
        decor ? null : field('Type', select(SHORTCUT_TYPES, sc.type || 'generic', (v) => { applyTypePreset(sc, v); commit(); ctx.refresh(); }),
            { hint: 'Picking a type fills in sensible states and actions once; you can change them below.' }),
        decor ? null : field('Belongs to', select(parents, sc.parent || 'home', (v) => { sc.parent = v; commit(); })),
        decor ? null : field('Availability entity (optional)', textInput({ value: sc.config.availability_entity || '', placeholder: 'e.g. button.desk_lamp_identify', list: 'entityList',
            onChange: (v) => writeProp(ctx, sc, 'availability_entity', v || undefined) }),
            { hint: 'Greys the badge out when this entity is unavailable.' })
    ], { key: 'sc-identity' });
}

/** Changing the entity also re-points states/actions that followed the old one. */
function retargetEntity(sc, newId) {
    const old = sc.entity_id;
    sc.entity_id = newId;
    (sc.config.states || []).forEach(st => { if (!st.state_entity || st.state_entity === old) st.state_entity = newId; });
    (sc.config.actions || []).forEach(a => { if (!a.action_entity || a.action_entity === old) a.action_entity = newId; });
}

function renderLook(ctx, sc) {
    const { state } = ctx;
    const badge = (prop) => overrideBadge(ctx, sc, prop);
    const tilingVal = readProp(sc, state, 'image_tiling', undefined);
    const genBtn = el('button', { type: 'button', onClick: () => generateTexture(ctx, sc, genBtn) }, '✨ Generate texture from description');
    return section('Look', [
        el('div.dm-row', {},
            field('Shape', select([{ value: 'circle', label: 'Circle' }, { value: 'rect', label: 'Rectangle' }], readProp(sc, state, 'shape', sc.shape || 'circle'),
                (v) => { writeProp(ctx, sc, 'shape', v); if (sc.shape !== undefined) sc.shape = v; ctx.refresh(); }), { badge: badge('shape') }),
            field('Colour', colorInput(readProp(sc, state, 'color', ''),
                (v) => { writeProp(ctx, sc, 'color', v, { commit: false }); localStorage.setItem('lastShortcutColor', v); },
                (v) => { writeProp(ctx, sc, 'color', v); ctx.refresh(); }), { badge: badge('color') })),
        el('div.dm-row', {},
            field('Icon', textInput({ value: readProp(sc, state, 'icon', ''), placeholder: '💡, mdi:lamp or empty', list: 'iconList',
                onInput: (v) => writeProp(ctx, sc, 'icon', v, { commit: false }), onChange: (v) => { writeProp(ctx, sc, 'icon', v); ctx.refresh(); } }), { badge: badge('icon') }),
            field('Image', textInput({ value: readProp(sc, state, 'image', ''), placeholder: '/local/img.png (beats the icon)', list: 'iconList',
                onInput: (v) => writeProp(ctx, sc, 'image', v, { commit: false }), onChange: (v) => { writeProp(ctx, sc, 'image', v); ctx.refresh(); } }), { badge: badge('image') })),
        field('Tile image', select([{ value: 'off', label: 'Stretch to fit' }, { value: 'axis', label: 'Repeat along the shape' }, { value: 'both', label: 'Repeat in both directions' }],
            tilingVal === 'both' ? 'both' : (tilingVal ? 'axis' : 'off'),
            (v) => writeProp(ctx, sc, 'image_tiling', v === 'off' ? undefined : (v === 'both' ? 'both' : true))), { badge: badge('image_tiling') }),
        el('div.dm-row', {},
            checkbox('Background shape', !readProp(sc, state, 'transparent', false), (on) => writeProp(ctx, sc, 'transparent', on ? undefined : true)),
            checkbox('Border and depth', readProp(sc, state, 'border', true) !== false, (on) => writeProp(ctx, sc, 'border', on ? undefined : false),
                { title: 'Off = flat ink like the floorplan (walls). On = white outline, gloss and shadow (badges).' })),
        field('Description for texture generation', textInput({ value: sc.description || '', placeholder: 'e.g. a pink flamingo-shaped table lamp',
            onInput: (v) => { sc.description = v; }, onChange: () => state.saveState() })),
        genBtn
    ], { key: 'sc-look' });
}

async function generateTexture(ctx, sc, btn) {
    const description = (sc.description || '').trim() || (sc.name || '').trim();
    if (!description) { toast('Fill in a description (or at least the name) first.', 'error'); return; }
    const st = previewState(sc, ctx.state);
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '⏳ Generating… this can take a minute';
    try {
        const result = await ApiManager.generateTexture(description, {
            stateDescription: st?.description || undefined,
            tileable: !!(st?.image_tiling ?? sc.config?.image_tiling),
            style: sc.config?.decor ? 'decor' : undefined
        });
        if (st) st.image = result.path; else sc.config.image = result.path;
        ctx.state.saveState();
        ctx.state.requestDrawCallback();
        ctx.refresh();
        toast('Texture generated.', 'ok');
    } catch (e) {
        toast(`Texture generation failed: ${e.message}`, 'error', 5000);
    } finally {
        btn.disabled = false;
        btn.textContent = label;
    }
}

function renderSensorFields(ctx, sc) {
    const { state } = ctx;
    const badge = (prop) => overrideBadge(ctx, sc, prop);
    return section('Sensor readings', [
        field('Temperature entity', textInput({ value: readProp(sc, state, 'temperature_entity', ''), placeholder: 'sensor.room_temperature', list: 'entityList',
            onChange: (v) => writeProp(ctx, sc, 'temperature_entity', v || undefined) }), { badge: badge('temperature_entity') }),
        field('Humidity entity', textInput({ value: readProp(sc, state, 'humidity_entity', ''), placeholder: 'sensor.room_humidity', list: 'entityList',
            onChange: (v) => writeProp(ctx, sc, 'humidity_entity', v || undefined) }), { badge: badge('humidity_entity'), hint: 'Tap the pill on the dashboard to switch between the two readings.' }),
        field('Value template', textInput({ value: readProp(sc, state, 'value_template', ''), placeholder: "{states('sensor.entity')}°C", mono: true,
            onChange: (v) => writeProp(ctx, sc, 'value_template', v || undefined) }), { badge: badge('value_template') })
    ], { key: 'sc-sensor' });
}

function renderFooter(ctx, sc) {
    const { state } = ctx;
    return el('div.dm-row', {},
        el('button', { type: 'button', title: 'Duplicate next to the original', onClick: () => { state.duplicateSelectedShortcut(); ctx.select(); } }, '⧉ Duplicate'),
        el('button', { type: 'button', onClick: () => openRawJson(ctx, sc) }, '{ } JSON'),
        el('button.danger', { type: 'button', onClick: async () => {
            if (!(await confirmDialog('Delete object', `Delete "${sc.name || 'this object'}"? Undo is available afterwards.`, { okLabel: 'Delete', danger: true }))) return;
            state.shortcuts.splice(state.selectedShortcutIdx, 1);
            state.selectedShortcutIdx = -1;
            state.saveState();
            ctx.select();
        } }, '🗑 Delete'));
}
