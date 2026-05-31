# Stage 4 Guide: Dual-Orientation Viewport Layouts

This document details the complete technical specifications and step-by-step implementation for Phase 4: implementing dual-layout coordinates (`position: { horizontal: [], vertical: [] }`), orientation preview toggles in the visual Map Editor header, and auto-routing drag coordinates.

---

## 🏛️ 1. Viewport Calculations

* **Portrait vs. Landscape Aspect Ratios**: `CanvasEngine.js` will dynamically evaluate the bounding client rect of the canvas container. If the width is less than the height, the active canvas mode is set to `vertical`; otherwise, it is `horizontal`.
* **Coordinate Mapper**: Coordinates are resolved dynamically from the orientation maps inside both card rendering (`custom-svg-map.js`) and editor preview modes.

---

## 📐 2. Code Implementations

### A. Dynamic Coordinate Resolver (`CanvasEngine.js` & `MapShortcut.js`)

In both editor dragging and Lovelace card drawing:
```javascript
function getActivePosition(sc, activeMode) {
    if (sc.position && typeof sc.position === 'object' && !Array.isArray(sc.position)) {
        return sc.position[activeMode] || sc.position.horizontal || [50, 50];
    }
    // Fallback for single flat position array
    return sc.position || [50, 50];
}
```

---

### B. Drag-and-Drop Auto-Routing (`EditorInteractionManager.js`)

Update the dragging listener inside `EditorInteractionManager.js` to write coordinates exclusively to the active orientation key in the JSON, leaving the other layout completely untouched:

```javascript
function handleShortcutDragEnd(sc, newPctX, newPctY, activeMode) {
    if (sc.position && typeof sc.position === 'object' && !Array.isArray(sc.position)) {
        // Write exclusively to the active preview orientation mode
        sc.position[activeMode] = [newPctX, newPctY];
    } else {
        // Upgrade older flat coords to orientation map on first drag event
        const oldPos = sc.position || [50, 50];
        sc.position = {
            horizontal: [...oldPos],
            vertical: [...oldPos]
        };
        sc.position[activeMode] = [newPctX, newPctY];
    }
    
    // Save to file system immediately
    stateManager.saveCurrentConfiguration();
}
```

---

### C. Manual Orientation Preview Switcher (`editor.html`)

We will add a beautiful visual toggle button in the header of the editor panel (`editor.html`):

```html
<!-- Orientation Preview Switcher inside visual editor header toolbar -->
<div class="orientation-switcher" style="display: flex; gap: 5px; background: var(--bg-accent); padding: 4px; border-radius: 6px;">
    <button id="toggleHorizontalBtn" style="padding: 6px 12px; font-size: 11px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: var(--accent); color: white;">
        🌅 Landscape
    </button>
    <button id="toggleVerticalBtn" style="padding: 6px 12px; font-size: 11px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; background: var(--btn-hover); color: var(--text);">
        📱 Portrait
    </button>
</div>
```

Bind listeners inside `editor.js` to resize the canvas container and force aspect-ratio auto-crop recomputation when clicked:

```javascript
const container = document.getElementById('canvas-container');

document.getElementById('toggleHorizontalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    container.style.width = '100%';
    container.style.height = '70vh'; // Normal landscape crop
    
    document.getElementById('toggleHorizontalBtn').style.background = 'var(--accent)';
    document.getElementById('toggleHorizontalBtn').style.color = 'white';
    document.getElementById('toggleVerticalBtn').style.background = 'var(--btn-hover)';
    document.getElementById('toggleVerticalBtn').style.color = 'var(--text)';
    
    canvasEngine.activeMode = 'horizontal';
    canvasEngine.resizeCanvas(stateManager.state);
});

document.getElementById('toggleVerticalBtn').addEventListener('click', (e) => {
    e.preventDefault();
    container.style.width = '375px'; // Force vertical phone aspect ratio
    container.style.height = '667px';
    container.style.margin = '0 auto';
    
    document.getElementById('toggleVerticalBtn').style.background = 'var(--accent)';
    document.getElementById('toggleVerticalBtn').style.color = 'white';
    document.getElementById('toggleHorizontalBtn').style.background = 'var(--btn-hover)';
    document.getElementById('toggleHorizontalBtn').style.color = 'var(--text)';
    
    canvasEngine.activeMode = 'vertical';
    canvasEngine.resizeCanvas(stateManager.state);
});
```

---

## 🔬 3. Stage 4 Verification Checklist
- [ ] Open the editor, verify the **🌅 Landscape** and **📱 Portrait** switcher buttons are visible in the header.
- [ ] Click **📱 Portrait**; assert the canvas container resizes immediately to phone bounds and shortcuts adapt positions.
- [ ] Drag a shortcut to new vertical coordinates. Click **🌅 Landscape**; verify the shortcut returns to its horizontal coordinate.
- [ ] Verify both horizontal and vertical coordinate arrays save correctly in `shortcuts_floorX.json`.
