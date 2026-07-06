const ROTATION_ICONS = {
    auto: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="16" font-size="10" font-family="sans-serif" text-anchor="middle" stroke="none" fill="currentColor">A</text></svg>`,
    horizontal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`,
    vertical: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/></svg>`,
};

const NEXT_ROTATION_MODE = { auto: 'horizontal', horizontal: 'vertical', vertical: 'auto' };

export class MapBuilder {
    static buildFloorSwitcher(mapContext) {
        if (!mapContext.config.floors || mapContext.config.floors.length <= 1) return null;

        const switcher = document.createElement('div');
        switcher.className = 'floor-switcher dm-chip-group';

        mapContext.config.floors.forEach(f => {
            const btn = document.createElement('div');
            btn.className = 'dm-chip' + (f == mapContext.activeFloor ? ' active' : '');
            btn.textContent = mapContext.floorLabel ? mapContext.floorLabel(f) : `Floor ${f}`;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mapContext.activeFloor !== f) {
                    mapContext.activeFloor = f;
                    mapContext.loadData();
                }
            });
            switcher.appendChild(btn);
        });

        return switcher;
    }

    static buildRotationSwitcher(mapContext) {
        const switcher = document.createElement('button');
        switcher.className = 'rotation-switcher dm-icon-btn';

        const updateIcon = () => {
            const mode = ROTATION_ICONS[mapContext.rotationMode] ? mapContext.rotationMode : 'auto';
            switcher.innerHTML = ROTATION_ICONS[mode];
            switcher.title = `Rotation Mode: ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
        };

        updateIcon();

        switcher.addEventListener('click', (e) => {
            e.stopPropagation();
            mapContext.rotationMode = NEXT_ROTATION_MODE[mapContext.rotationMode] || 'auto';
            updateIcon();
            mapContext.calculateAutoCrop();
        });

        return switcher;
    }
}
