export class MapBuilder {
    static buildFloorSwitcher(mapContext) {
        if (!mapContext.config.floors || mapContext.config.floors.length <= 1) return null;

        const switcher = document.createElement('div');
        switcher.className = 'floor-switcher';
        switcher.style.display = 'flex';
        switcher.style.flexDirection = 'column';
        switcher.style.background = 'rgba(255, 255, 255, 0.9)';
        switcher.style.borderRadius = '8px';
        switcher.style.overflow = 'hidden';
        switcher.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        switcher.style.border = '1px solid #e2e8f0';

        mapContext.config.floors.forEach(f => {
            const btn = document.createElement('div');
            btn.textContent = `Floor ${f}`;
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = 'bold';
            btn.style.fontFamily = 'sans-serif';
            btn.style.borderBottom = '1px solid #e2e8f0';
            btn.style.color = '#1e293b';
            btn.style.background = (f == mapContext.activeFloor) ? '#0ea5e9' : 'transparent';
            if (f == mapContext.activeFloor) btn.style.color = 'white';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mapContext.activeFloor !== f) {
                    mapContext.activeFloor = f;
                    mapContext.loadData();
                }
            });
            switcher.appendChild(btn);
        });
        switcher.lastChild.style.borderBottom = 'none';

        return switcher;
    }

    static buildRotationSwitcher(mapContext) {
        const switcher = document.createElement('button');
        switcher.className = 'rotation-switcher';
        switcher.style.background = 'rgba(255, 255, 255, 0.9)';
        switcher.style.border = '1px solid #e2e8f0';
        switcher.style.borderRadius = '8px';
        switcher.style.width = '42px';
        switcher.style.padding = '0';
        switcher.style.cursor = 'pointer';
        switcher.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        switcher.style.display = 'flex';
        switcher.style.alignItems = 'center';
        switcher.style.justifyContent = 'center';
        switcher.style.color = '#1e293b';

        const updateIcon = () => {
            if (mapContext.rotationMode === 'auto') {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="16" font-size="10" font-family="sans-serif" text-anchor="middle" stroke="none" fill="currentColor">A</text></svg>`;
                switcher.title = 'Rotation Mode: Auto';
            } else if (mapContext.rotationMode === 'horizontal') {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`;
                switcher.title = 'Rotation Mode: Horizontal';
            } else {
                switcher.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>`;
                switcher.title = 'Rotation Mode: Vertical';
            }
        };

        updateIcon();

        switcher.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mapContext.rotationMode === 'auto') mapContext.rotationMode = 'horizontal';
            else if (mapContext.rotationMode === 'horizontal') mapContext.rotationMode = 'vertical';
            else mapContext.rotationMode = 'auto';
            
            updateIcon();
            mapContext.calculateAutoCrop();
        });

        return switcher;
    }
}
