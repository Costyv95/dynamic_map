import { ApiManager } from '../shared/ApiManager.js?v=3.2.1';
import { fillEntityDatalist } from './ui/EntityAutocomplete.js?v=3.2.1';

/** Start-up discovery for the editor: floors, the HA registry and the entity list. `app` is the EditorApp. */
export async function discoverFloors(app) {
    let floors = [];
    try {
        const data = await ApiManager.fetchFloors();
        if (data.success && Array.isArray(data.floors)) floors = data.floors;
        if (data.names) app.floorNames = data.names;
        const brand = app.root.querySelector('.dm-brand');
        if (data.version && brand) brand.title = `Dynamic Map v${data.version}`;
    } catch (err) {
        console.warn('[editor] Floor discovery failed:', err.message);
    }
    if (!floors.length) {
        // Authenticated API unavailable (companion-app webview without a
        // web session): probe the public data files instead.
        const t = Date.now();
        const probes = await Promise.all([...Array(12)].map((_, i) =>
            fetch(`/dynamic_map_data/rooms_floor${i + 1}.json?t=${t}`, { method: 'HEAD' })
                .then(r => (r.ok ? i + 1 : null)).catch(() => null)));
        floors = probes.filter(Boolean);
    }
    if (!floors.length) floors = [1];
    app.setFloors(floors);
    const remembered = parseInt(localStorage.getItem('dm_editor_last_floor'));
    return app.switchFloor(floors.includes(remembered) ? remembered : floors[floors.length - 1]);
}

export async function loadRegistry(app) {
    try {
        const data = await ApiManager.fetchRegistry();
        if (!data.success) return;
        app.state.haAreas = data.areas;
        app.state.haFloors = data.floors;
    } catch (err) {
        console.warn('[editor] Failed to load HA registry:', err.message);
    }
}

export async function loadEntities(app) {
    try {
        const data = await ApiManager.fetchEntities();
        if (!(data.success && data.entities)) return;
        app.state.allEntities = data.entities;
        fillEntityDatalist(data.entities, app.root);
    } catch (err) {
        console.warn('[editor] Failed to load entities for autocomplete:', err.message);
    }
}
