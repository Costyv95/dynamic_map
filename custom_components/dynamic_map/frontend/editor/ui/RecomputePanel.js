import { ApiManager } from '../../shared/ApiManager.js?v=3.2.1';

/**
 * Advanced panel: recompute a floor's geometry from DXF/SVG sources via
 * the sidecar, or delete a floor's files. Also fills the icon datalist.
 */
export async function loadAvailableFiles() {
    try {
        const data = await ApiManager.fetchAvailableFiles();
        if (data.success && data.files) {
            const svgSelect = document.getElementById('reconSvg');
            const dxfSelect = document.getElementById('reconDxf');
            svgSelect.innerHTML = '<option value="">-- Optional (Select SVG) --</option>';
            dxfSelect.innerHTML = '<option value="">-- Optional (Select DXF) --</option>';
            data.files.forEach(f => {
                if (f.endsWith('.svg')) svgSelect.innerHTML += `<option value="${f}">${f}</option>`;
                if (f.endsWith('.dxf')) dxfSelect.innerHTML += `<option value="${f}">${f}</option>`;
            });
        }
        if (data.success && data.icons) {
            const iconList = document.getElementById('iconList');
            if (iconList) iconList.innerHTML = data.icons.map(p => `<option value="${p}"></option>`).join('');
        }
    } catch (err) {
        console.warn('[editor] Failed to load available files:', err.message);
    }
}

export function bindRecomputePanel() {
    const panel = document.getElementById('recomputePanel');
    const setOpen = (open) => {
        panel.style.display = open ? 'block' : 'none';
        sessionStorage.setItem('recomputeOpen', open ? 'true' : 'false');
    };
    document.getElementById('toggleRecomputeBtn').addEventListener('click', () => setOpen(panel.style.display === 'none'));
    document.getElementById('closeRecomputeBtn').addEventListener('click', () => setOpen(false));
    if (sessionStorage.getItem('recomputeOpen') === 'true') panel.style.display = 'block';

    document.getElementById('deleteFloorBtn').addEventListener('click', async () => {
        const floorNum = document.getElementById('reconFloor').value;
        if (!confirm(`Are you sure you want to permanently delete Floor ${floorNum}?`)) return;
        const status = document.getElementById('recomputeStatus');
        status.textContent = 'Deleting floor files...';
        try {
            const data = await ApiManager.deleteFloor(floorNum);
            if (data.success) {
                status.textContent = '✅ Floor deleted! Refreshing...';
                sessionStorage.setItem('recomputeOpen', 'true');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                status.textContent = '❌ Error: ' + data.error;
            }
        } catch (e) {
            status.textContent = '❌ Failed to connect to HA API.';
        }
    });

    document.getElementById('recomputeBtn').addEventListener('click', async () => {
        const btn = document.getElementById('recomputeBtn');
        const status = document.getElementById('recomputeStatus');
        btn.disabled = true;
        status.textContent = 'Processing... (This takes a few seconds)';
        try {
            const data = await ApiManager.recomputeFloor(
                document.getElementById('reconFloor').value,
                document.getElementById('reconSvg').value,
                document.getElementById('reconDxf').value
            );
            if (data.success) {
                status.textContent = '✅ Success! Refreshing Map...';
                sessionStorage.setItem('recomputeOpen', 'true');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                status.textContent = '❌ Error: ' + data.error;
                btn.disabled = false;
            }
        } catch (err) {
            status.textContent = '❌ Failed to connect to HA API.';
            btn.disabled = false;
        }
    });
}
