# Stage 1 Guide: Generic Compositor & Component Registry

This document provides the complete, step-by-step implementation guide for Phase 1: refactoring the visual rendering core into a **Subclass-Free, Component-Based Registry Architecture**.

---

## 🏛️ 1. File Structure & Setup

First, we will delete the legacy subclass files:
```bash
rm custom_components/dynamic_map/frontend/shortcuts/SensorShortcut.js
rm custom_components/dynamic_map/frontend/shortcuts/VacuumShortcut.js
rm custom_components/dynamic_map/frontend/shortcuts/LightShortcut.js
```

Then, we create the new `components/` directory:
```bash
mkdir -p custom_components/dynamic_map/frontend/shortcuts/components
```

---

## 📐 2. Step-by-Step Code Implementations

### A. The Component Registry (`ComponentRegistry.js`)
Create the registry file at `custom_components/dynamic_map/frontend/shortcuts/ComponentRegistry.js`. This serves as the single source of truth for mapping JSON keys to ES6 primitives:

```javascript
import { renderCircle } from './components/renderCircle.js?v=2.74';
import { renderRect } from './components/renderRect.js?v=2.74';
import { renderPill } from './components/renderPill.js?v=2.74';
import { renderIcon } from './components/renderIcon.js?v=2.74';
import { renderImage } from './components/renderImage.js?v=2.74';
import { renderText } from './components/renderText.js?v=2.74';
import { renderGauge } from './components/renderGauge.js?v=2.74';
import { renderLinearBar } from './components/renderLinearBar.js?v=2.74';
import { renderBadge } from './components/renderBadge.js?v=2.74';
import { renderCurvedGauge } from './components/renderCurvedGauge.js?v=2.74';
import { renderLinePath } from './components/renderLinePath.js?v=2.74';
import { renderSelector } from './components/renderSelector.js?v=2.74';

export const ComponentRegistry = {
    circle: renderCircle,
    rect: renderRect,
    pill: renderPill,
    icon: renderIcon,
    image: renderImage,
    text: renderText,
    progress_ring: renderGauge,
    linear_bar: renderLinearBar,
    badge: renderBadge,
    curved_gauge: renderCurvedGauge,
    line_path: renderLinePath,
    room_selector: renderSelector
};
```

---

### B. Micro-Primitive Renderers (`components/`)

Here are the concrete implementations of key primitive files. Every file is self-contained and holds **zero hardcoded style constants**:

#### File: `renderCircle.js`
```javascript
export function renderCircle(svgNS, props) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', props.x || 0);
    circle.setAttribute('cy', props.y || 0);
    circle.setAttribute('r', props.radius || 12);
    circle.setAttribute('fill', props.color || '#475569');
    circle.setAttribute('stroke', props.stroke_color || 'none');
    circle.setAttribute('stroke-width', props.stroke_width || 0);
    circle.style.transition = 'fill 0.3s ease, r 0.3s ease';
    return circle;
}
```

#### File: `renderRect.js`
```javascript
export function renderRect(svgNS, props) {
    const width = props.width || 24;
    const height = props.height || 24;
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', (props.x || 0) - width / 2);
    rect.setAttribute('y', (props.y || 0) - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', props.rx || 0);
    rect.setAttribute('ry', props.ry || 0);
    rect.setAttribute('fill', props.color || '#475569');
    rect.setAttribute('stroke', props.stroke_color || 'none');
    rect.setAttribute('stroke-width', props.stroke_width || 0);
    rect.style.transition = 'fill 0.3s ease, width 0.3s ease, height 0.3s ease';
    return rect;
}
```

#### File: `renderPill.js`
```javascript
export function renderPill(svgNS, props) {
    // A pill is a highly-rounded rect
    const width = props.width || 50;
    const height = props.height || 24;
    const pill = document.createElementNS(svgNS, 'rect');
    pill.setAttribute('x', (props.x || 0) - width / 2);
    pill.setAttribute('y', (props.y || 0) - height / 2);
    pill.setAttribute('width', width);
    pill.setAttribute('height', height);
    pill.setAttribute('rx', height / 2);
    pill.setAttribute('ry', height / 2);
    pill.setAttribute('fill', props.color || '#475569');
    pill.setAttribute('stroke', props.stroke_color || 'none');
    pill.setAttribute('stroke-width', props.stroke_width || 0);
    pill.style.transition = 'fill 0.3s ease, width 0.3s ease';
    return pill;
}
```

#### File: `renderText.js`
```javascript
export function renderText(svgNS, props, hass) {
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', props.x || 0);
    text.setAttribute('y', props.y || 0);
    text.setAttribute('text-anchor', props.align || 'middle');
    text.setAttribute('dominant-baseline', props.baseline || 'central');
    text.setAttribute('fill', props.color || '#ffffff');
    text.setAttribute('font-size', props.font_size || 12);
    text.setAttribute('font-weight', props.font_weight || 'normal');
    
    // Evaluate Jinja string
    let displayValue = props.value || '';
    if (displayValue.includes('states(') && hass) {
        // Extract entity ID between single quotes
        const match = displayValue.match(/states\(['"]([^'"]+)['"]\)/);
        if (match && match[1] && hass.states[match[1]]) {
            const stateObj = hass.states[match[1]];
            const suffix = displayValue.split('}}')[1] || '';
            displayValue = stateObj.state + suffix;
        }
    }
    
    text.textContent = displayValue;
    return text;
}
```

---

### C. The Orchestrator (`MapShortcut.js`)

Refactor `MapShortcut.js` to act strictly as a layout orchestrator:

```javascript
import { ComponentRegistry } from './ComponentRegistry.js?v=2.74';
import { evaluateCondition } from './ConditionEvaluator.js?v=2.74';

export class MapShortcut {
    constructor(scData, svgNS, imgW, imgH, mapContext) {
        this.sc = scData;
        this.svgNS = svgNS;
        this.imgW = imgW;
        this.imgH = imgH;
        this.mapContext = mapContext;
        
        this.group = document.createElementNS(svgNS, 'g');
        this.group.classList.add('shortcut-group');
        this.group.setAttribute('id', scData.id);
        
        // Base coordinate resolutions
        this.updateCoordinates();
        this.setupInteractions();
    }
    
    updateCoordinates() {
        const activeMode = this.mapContext.activeMode || 'horizontal';
        let pos = this.sc.position;
        if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
            pos = pos[activeMode] || pos.horizontal || [50, 50];
        }
        
        this.px = (pos[0] / 100) * this.imgW;
        this.py = (pos[1] / 100) * this.imgH;
        this.group.setAttribute('transform', `translate(${this.px}, ${this.py})`);
    }
    
    updateState(hass) {
        this.updateCoordinates(); // Ensure coords are synced with active mode
        
        // Resolve state rules
        let activeLayout = this.sc.config.default_layout || [];
        if (this.sc.config.states && this.sc.config.states.length > 0) {
            for (const st of this.sc.config.states) {
                if (evaluateCondition(st.conditions, hass)) {
                    activeLayout = st.layout_override || activeLayout;
                    break;
                }
            }
        }
        
        // Draw/Diff Components
        this.renderComponents(activeLayout, hass);
    }
    
    renderComponents(layout, hass) {
        // Simple DOM Diff: Clear and append
        // (For Phase 1, clear. For Phase 2, in-place DOM attribute updates for animations)
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        
        layout.forEach(comp => {
            const renderer = ComponentRegistry[comp.type];
            if (renderer) {
                const el = renderer(this.svgNS, comp, hass);
                
                // If absolute scale mode is active, apply zoom counter-scale transform
                if (this.sc.scale_mode === 'absolute') {
                    const inverseScale = 1 / (this.mapContext.currentZoomScale || 1);
                    el.setAttribute('transform', `scale(${inverseScale})`);
                }
                
                this.group.appendChild(el);
            }
        });
    }
    
    setupInteractions() {
        // Standard delegated event listeners...
    }
    
    render() {
        return this.group;
    }
}
```

---

## 🔬 3. Stage 1 Verification Checklist
- [ ] Staging and run tests inside Vitest to verify that deleting old subclasses does not break baseline compiler.
- [ ] Confirm that `MapShortcut` correctly reads primitive layouts from `ComponentRegistry` and creates elements dynamically.
