import { GenericShortcut } from './GenericShortcut.js';

export class LightShortcut extends GenericShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        super(scData, svgNS, imgW, imgH, mapContext);
        this.defaultColor = '#475569';
        this.defaultIcon = '💡';
    }
}
