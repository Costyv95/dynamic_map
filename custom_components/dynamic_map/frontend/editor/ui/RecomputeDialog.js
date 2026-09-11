import { el, field, select, numberInput } from './dom.js?v=3.2.1';
import { openDialog, confirmDialog, toast } from './Dialog.js?v=3.2.1';
import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';

/** Fill the icon datalist from the data dir (custom icons). */
export async function loadIconList(root = document) {
    try {
        const data = await ApiManager.fetchAvailableFiles();
        const iconList = root.querySelector('#iconList');
        if (data.success && data.icons && iconList) iconList.innerHTML = data.icons.map(p => `<option value="${p}"></option>`).join('');
        return data.success ? (data.files || []) : [];
    } catch (err) {
        console.warn('[editor] Failed to load available files:', err.message);
        return [];
    }
}

/** Advanced: rebuild a floor from DXF/SVG via the sidecar, or delete a floor. */
export async function openRecomputeDialog(app) {
    const files = await loadIconList();
    const opt = (ext) => [{ value: '', label: '— none —' }, ...files.filter(f => f.endsWith(ext)).map(f => ({ value: f, label: f }))];
    const floorIn = numberInput({ value: app.state.activeFloor, min: 1, max: 20 });
    const svgSel = select(opt('.svg'), '', () => {});
    const dxfSel = select(opt('.dxf'), '', () => {});
    const v = await openDialog({ title: 'Recompute or delete a floor', body: [
        el('p.dm-hint', {}, 'Upload the source files to /config/dynamic_map_data/ first. Recompute needs the DXF/SVG sidecar (sidecar_url in configuration.yaml).'),
        field('Floor number', floorIn),
        el('div.dm-row', {}, field('SVG source', svgSel), field('DXF source', dxfSel))
    ], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete floor', value: 'delete', danger: true }, { label: 'Recompute', value: 'ok', primary: true }] });
    const floor = floorIn.value;
    if (v === 'delete') {
        if (!(await confirmDialog('Delete floor', `Permanently delete all files of floor ${floor}?`, { okLabel: 'Delete', danger: true }))) return;
        try {
            const data = await ApiManager.deleteFloor(floor);
            if (!data.success) throw new Error(data.error || 'failed');
            toast('Floor deleted. Reloading…', 'ok');
            setTimeout(() => window.location.reload(), 1200);
        } catch (e) { toast(`Delete failed: ${e.message}`, 'error', 5000); }
        return;
    }
    if (v !== 'ok') return;
    toast('Recomputing… this takes a few seconds', 'info', 8000);
    try {
        const data = await ApiManager.recomputeFloor(floor, svgSel.value, dxfSel.value);
        if (!data.success) throw new Error(data.error || 'failed');
        toast('Recomputed. Reloading…', 'ok');
        setTimeout(() => window.location.reload(), 1200);
    } catch (e) { toast(`Recompute failed: ${e.message}`, 'error', 5000); }
}
