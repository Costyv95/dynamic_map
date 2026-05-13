import { GenericShortcut } from './GenericShortcut.js';
import { VacuumShortcut } from './VacuumShortcut.js';
import { LightShortcut } from './LightShortcut.js';

export class ShortcutFactory {
    static create(scData, svgNS, imgW, imgH, mapContext) {
        // Legacy fallback
        if (!scData.config) {
            scData.config = {
                shape: scData.shape || 'circle',
                color: scData.color || '#0ea5e9',
                transparent: scData.transparent || false,
                room_mapping: scData.room_mapping || {}
            };
        }
        switch (scData.type) {
            case 'vacuum': return new VacuumShortcut(scData, svgNS, imgW, imgH, mapContext);
            case 'light': return new LightShortcut(scData, svgNS, imgW, imgH, mapContext);
            default: return new GenericShortcut(scData, svgNS, imgW, imgH, mapContext);
        }
    }
}
