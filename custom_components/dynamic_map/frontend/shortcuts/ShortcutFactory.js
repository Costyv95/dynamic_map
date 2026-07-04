import { MapShortcut } from './MapShortcut.js?v=3.0.3-74e8aea-dev-015324';

export class ShortcutFactory {
    static create(scData, svgNS, imgW, imgH, mapContext) {
        // Parse legacy configurations into structured state objects on the fly
        if (!scData.config) {
            scData.config = {
                shape: scData.shape || 'circle',
                color: scData.color || '#0ea5e9',
                transparent: scData.transparent || false,
                room_mapping: scData.room_mapping || {}
            };
        }
        
        // Instantiate the single, unified MapShortcut compositor
        return new MapShortcut(scData, svgNS, imgW, imgH, mapContext);
    }
}
