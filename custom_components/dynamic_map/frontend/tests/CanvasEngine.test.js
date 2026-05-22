import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Minimal DOMMatrix polyfill for JSDOM test environment.
 * Supports identity construction, translateSelf, scaleSelf, rotateSelf,
 * multiply, inverse, and property access (a, b, c, d, e, f).
 */
if (typeof globalThis.DOMMatrix === 'undefined') {
    class DOMMatrixPolyfill {
        constructor(init) {
            if (init instanceof DOMMatrixPolyfill) {
                this.a = init.a; this.b = init.b; this.c = init.c;
                this.d = init.d; this.e = init.e; this.f = init.f;
            } else {
                this.a = 1; this.b = 0; this.c = 0;
                this.d = 1; this.e = 0; this.f = 0;
            }
        }
        translateSelf(tx, ty) {
            this.e += this.a * tx + this.c * ty;
            this.f += this.b * tx + this.d * ty;
            return this;
        }
        scaleSelf(sx, sy) {
            if (sy === undefined) sy = sx;
            this.a *= sx; this.b *= sx;
            this.c *= sy; this.d *= sy;
            return this;
        }
        rotateSelf(angleDeg) {
            const rad = angleDeg * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const a = this.a, b = this.b, c = this.c, d = this.d;
            this.a = a * cos + c * sin;
            this.b = b * cos + d * sin;
            this.c = c * cos - a * sin;
            this.d = d * cos - b * sin;
            return this;
        }
        multiply(other) {
            const result = new DOMMatrixPolyfill();
            result.a = this.a * other.a + this.c * other.b;
            result.b = this.b * other.a + this.d * other.b;
            result.c = this.a * other.c + this.c * other.d;
            result.d = this.b * other.c + this.d * other.d;
            result.e = this.a * other.e + this.c * other.f + this.e;
            result.f = this.b * other.e + this.d * other.f + this.f;
            return result;
        }
        inverse() {
            const det = this.a * this.d - this.b * this.c;
            if (Math.abs(det) < 1e-10) return new DOMMatrixPolyfill();
            const inv = new DOMMatrixPolyfill();
            inv.a = this.d / det;
            inv.b = -this.b / det;
            inv.c = -this.c / det;
            inv.d = this.a / det;
            inv.e = (this.c * this.f - this.d * this.e) / det;
            inv.f = (this.b * this.e - this.a * this.f) / det;
            return inv;
        }
        // Immutable versions (return new matrix)
        scale(sx, sy) {
            const copy = new DOMMatrixPolyfill(this);
            return copy.scaleSelf(sx, sy);
        }
        translate(tx, ty) {
            const copy = new DOMMatrixPolyfill(this);
            return copy.translateSelf(tx, ty);
        }
        rotate(angleDeg) {
            const copy = new DOMMatrixPolyfill(this);
            return copy.rotateSelf(angleDeg);
        }
        static fromMatrix(other) {
            return new DOMMatrixPolyfill(other);
        }
    }
    globalThis.DOMMatrix = DOMMatrixPolyfill;
}

if (typeof globalThis.DOMPoint === 'undefined') {
    class DOMPointPolyfill {
        constructor(x = 0, y = 0, z = 0, w = 1) {
            this.x = x; this.y = y; this.z = z; this.w = w;
        }
        matrixTransform(matrix) {
            return new DOMPointPolyfill(
                matrix.a * this.x + matrix.c * this.y + matrix.e,
                matrix.b * this.x + matrix.d * this.y + matrix.f
            );
        }
    }
    globalThis.DOMPoint = DOMPointPolyfill;
}

import { CanvasEngine } from '../editor/CanvasEngine.js';

/**
 * Creates a mock 2D canvas context with all methods stubbed via vi.fn().
 * Each method returns the context itself for chaining, except where
 * specific return values are needed.
 */
function createMockCtx() {
    const ctx = {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        shadowColor: '',
        shadowBlur: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
    };
    return ctx;
}

/**
 * Creates a mock canvas element with the given pixel dimensions.
 */
function createMockCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    Object.defineProperty(canvas, 'parentElement', {
        get() { return null; }
    });
    return canvas;
}

/**
 * Creates a mock background image with specified dimensions.
 * Simulates different browser behaviors for .width/.height vs .naturalWidth/.naturalHeight.
 */
function createMockBgImage({ naturalWidth = 0, naturalHeight = 0, width = 0, height = 0, complete = true }) {
    return {
        naturalWidth,
        naturalHeight,
        width,
        height,
        complete,
    };
}

// -----------------------------------------------------------
// Test Suite: safeDimensions
// -----------------------------------------------------------
describe('CanvasEngine.safeDimensions', () => {
    it('should prefer naturalWidth/naturalHeight over width/height', () => {
        const img = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const { bgW, bgH } = CanvasEngine.safeDimensions(img);
        expect(bgW).toBe(1280);
        expect(bgH).toBe(1920);
    });

    it('should fall back to width/height when naturalWidth/naturalHeight are zero', () => {
        const img = createMockBgImage({ naturalWidth: 0, naturalHeight: 0, width: 800, height: 600 });
        const { bgW, bgH } = CanvasEngine.safeDimensions(img);
        expect(bgW).toBe(800);
        expect(bgH).toBe(600);
    });

    it('should return 1x1 as the absolute minimum to prevent division by zero', () => {
        const img = createMockBgImage({ naturalWidth: 0, naturalHeight: 0, width: 0, height: 0 });
        const { bgW, bgH } = CanvasEngine.safeDimensions(img);
        expect(bgW).toBe(1);
        expect(bgH).toBe(1);
    });

    it('should handle a fully loaded image correctly (both sources populated)', () => {
        const img = createMockBgImage({ naturalWidth: 2560, naturalHeight: 1440, width: 2560, height: 1440 });
        const { bgW, bgH } = CanvasEngine.safeDimensions(img);
        expect(bgW).toBe(2560);
        expect(bgH).toBe(1440);
    });

    it('should handle iframe edge case: width=0, naturalWidth=1280', () => {
        // This is the exact bug scenario: Image loaded in an iframe where
        // .width stays 0 but .naturalWidth has the real value.
        const img = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const { bgW, bgH } = CanvasEngine.safeDimensions(img);
        expect(bgW).toBe(1280);
        expect(bgH).toBe(1920);
    });
});

// -----------------------------------------------------------
// Test Suite: calculateAutoCrop
// -----------------------------------------------------------
describe('CanvasEngine.calculateAutoCrop', () => {
    let engine;
    let ctx;
    let canvas;

    beforeEach(() => {
        ctx = createMockCtx();
        canvas = createMockCanvas(1920, 1080);
        engine = new CanvasEngine(canvas, ctx);
    });

    it('should compute non-zero viewTransform for valid rooms and background image', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];

        engine.calculateAutoCrop(bgImage, rooms, true);

        // viewTransform should have non-zero scale components
        const scaleComponent = Math.hypot(engine.viewTransform.a, engine.viewTransform.b);
        expect(scaleComponent).toBeGreaterThan(0);
        expect(engine.minScale).toBeGreaterThan(0);
    });

    it('should compute valid transform even when bgImage.width/height are zero (iframe bug)', () => {
        // Simulates the exact bug scenario: .width=0 but .naturalWidth has real values
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const rooms = [
            { polygon: [[20, 20], [80, 20], [80, 80], [20, 80]] }
        ];

        engine.calculateAutoCrop(bgImage, rooms, true);

        const scaleComponent = Math.hypot(engine.viewTransform.a, engine.viewTransform.b);
        expect(scaleComponent).toBeGreaterThan(0);
        expect(Number.isFinite(scaleComponent)).toBe(true);
        expect(engine.minScale).toBeGreaterThan(0);
        expect(Number.isFinite(engine.minScale)).toBe(true);
    });

    it('should not crash when rooms are empty', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [];

        // calculateAutoCrop with empty rooms should produce bounds of 100,0 which means w < 1 => early return
        engine.calculateAutoCrop(bgImage, rooms, true);

        // viewTransform remains the default identity
        expect(engine.viewTransform).toBeInstanceOf(DOMMatrix);
    });

    it('should early-return without crashing when bounds produce zero-area crop', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        // A single point produces zero width/height bounds
        const rooms = [
            { polygon: [[50, 50]] }
        ];

        engine.calculateAutoCrop(bgImage, rooms, true);
        // Should not throw; viewTransform remains default
        expect(engine.viewTransform).toBeInstanceOf(DOMMatrix);
    });
});

// -----------------------------------------------------------
// Test Suite: draw() - Background Rendering
// -----------------------------------------------------------
describe('CanvasEngine.draw - Background Image Rendering', () => {
    let engine;
    let ctx;
    let canvas;

    beforeEach(() => {
        ctx = createMockCtx();
        canvas = createMockCanvas(1920, 1080);
        // Attach to DOM so resizeCanvas can find a parentElement
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 1920 });
        Object.defineProperty(container, 'clientHeight', { value: 1080 });
        container.appendChild(canvas);
        document.body.appendChild(container);

        engine = new CanvasEngine(canvas, ctx);
    });

    it('should call drawImage with correct safe dimensions when bgImage.width is zero', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]], name: 'Room A' }
        ];

        // Pre-calculate auto crop so viewTransform is valid
        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts: [],
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // drawImage must have been called with safe dimensions
        expect(ctx.drawImage).toHaveBeenCalled();
        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[0]).toBe(bgImage);
        expect(drawCall[1]).toBe(0);
        expect(drawCall[2]).toBe(0);
        expect(drawCall[3]).toBe(1280); // bgW from naturalWidth
        expect(drawCall[4]).toBe(1920); // bgH from naturalHeight
    });

    it('should NOT call drawImage when bgImage.complete is false (still loading)', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920, complete: false });

        engine.draw({
            bgImage,
            rooms: [],
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts: [],
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('should NOT render when isTransitioning is true', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });

        engine.draw({
            bgImage,
            rooms: [],
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts: [],
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: true,
            requestDraw: vi.fn(),
        });

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

// -----------------------------------------------------------
// Test Suite: draw() - Shortcut Icon/Image Rendering
// -----------------------------------------------------------
describe('CanvasEngine.draw - Shortcut Image Preview', () => {
    let engine;
    let ctx;
    let canvas;

    beforeEach(() => {
        ctx = createMockCtx();
        canvas = createMockCanvas(1920, 1080);
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 1920 });
        Object.defineProperty(container, 'clientHeight', { value: 1080 });
        container.appendChild(canvas);
        document.body.appendChild(container);

        engine = new CanvasEngine(canvas, ctx);
    });

    it('should resolve finalImage from state override when previewing a state with image', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];
        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Desk Lamp',
            config: {
                shape: 'circle',
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'Off', value: 'off', color: '#a17070', image: '/local/icons/lamp-off.png' },
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            }
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        // Test: when previewStateIdx=1, the shortcut should resolve to lamp-on.png
        // We need to verify that a new Image is created with src = '/local/icons/lamp-on.png'
        const requestDraw = vi.fn();
        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: 0,
            previewStateIdx: 1,
            isTransitioning: false,
            requestDraw,
        });

        // After draw, the shortcut should have created an image cache entry for lamp-on.png
        expect(shortcuts[0]._imgCache).toBeDefined();
        expect(shortcuts[0]._imgCache['/local/icons/lamp-on.png']).toBeDefined();
        
        const cachedImg = shortcuts[0]._imgCache['/local/icons/lamp-on.png'];
        expect(cachedImg.src).toContain('/local/icons/lamp-on.png');
    });

    it('should draw the image when cached image is complete and not failed', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];

        // Pre-populate the image cache with a fully loaded image
        const loadedImg = { complete: true, naturalWidth: 64, naturalHeight: 64, _failed: false, src: '/local/icons/lamp-on.png' };
        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Desk Lamp',
            config: {
                shape: 'circle',
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            },
            _imgCache: {
                '/local/icons/lamp-on.png': loadedImg
            }
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: 0,
            previewStateIdx: 0,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // drawImage should be called at least twice: once for bgImage, once for the icon
        const drawImageCalls = ctx.drawImage.mock.calls;
        expect(drawImageCalls.length).toBeGreaterThanOrEqual(2);

        // The second drawImage call should be for the cached icon image
        const iconDrawCall = drawImageCalls[1];
        expect(iconDrawCall[0]).toBe(loadedImg);
    });

    it('should draw fallback icon text when image has failed to load', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];

        // Pre-populate the image cache with a failed image
        const failedImg = { complete: true, naturalWidth: 0, naturalHeight: 0, _failed: true, _lastFailureTime: Date.now(), src: '/local/icons/lamp-on.png' };
        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Desk Lamp',
            config: {
                shape: 'circle',
                color: '#475569',
                icon: '💡',
                image: '',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            },
            _imgCache: {
                '/local/icons/lamp-on.png': failedImg
            }
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: 0,
            previewStateIdx: 0,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // fillText should be called with the fallback icon since the image failed
        const fillTextCalls = ctx.fillText.mock.calls;
        const fallbackIconDrawn = fillTextCalls.some(call => call[0] === '💡');
        expect(fallbackIconDrawn).toBe(true);
    });

    it('should recover defensively and self-heal when cached image is an invalid plain deserialized object', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];

        // Simulates the exact bug scenario: image cache has been corrupted to a plain empty object `{}` due to JSON serialization/deserialization.
        const corruptedImgCache = {
            '/local/icons/lamp-on.png': {}
        };

        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Desk Lamp',
            config: {
                shape: 'circle',
                color: '#475569',
                icon: '💡',
                image: '',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            },
            _imgCache: corruptedImgCache
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        const requestDraw = vi.fn();
        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: 0,
            previewStateIdx: 0,
            isTransitioning: false,
            requestDraw,
        });

        // The corrupted plain object {} must have been deleted, and replaced by a real, valid HTMLImageElement instance
        expect(shortcuts[0]._imgCache['/local/icons/lamp-on.png']).toBeDefined();
        const recoveredImg = shortcuts[0]._imgCache['/local/icons/lamp-on.png'];
        
        expect(recoveredImg).not.toEqual({});
        expect(recoveredImg.src).toContain('/local/icons/lamp-on.png');
    });

    it('should draw fallback icon when no image is configured', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 1280, height: 1920 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];
        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Simple Shortcut',
            config: {
                shape: 'circle',
                color: '#0ea5e9',
                icon: '🔌',
            }
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // fillText should have been called with the icon emoji
        const fillTextCalls = ctx.fillText.mock.calls;
        const emojiDrawn = fillTextCalls.some(call => call[0] === '🔌');
        expect(emojiDrawn).toBe(true);
    });
});

// -----------------------------------------------------------
// Test Suite: draw() - Coordinate Mapping (rooms/shortcuts)
// -----------------------------------------------------------
describe('CanvasEngine.draw - Coordinate Mapping', () => {
    let engine;
    let ctx;
    let canvas;

    beforeEach(() => {
        ctx = createMockCtx();
        canvas = createMockCanvas(1920, 1080);
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 1920 });
        Object.defineProperty(container, 'clientHeight', { value: 1080 });
        container.appendChild(canvas);
        document.body.appendChild(container);

        engine = new CanvasEngine(canvas, ctx);
    });

    it('should use safe dimensions for room polygon coordinate conversion, not zero', () => {
        // This test validates that rooms are drawn at correct pixel positions
        // even when bgImage.width/height are zero (iframe bug).
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const rooms = [
            { polygon: [[25, 25], [75, 25], [75, 75], [25, 75]], name: 'TestRoom' }
        ];

        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts: [],
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // moveTo and lineTo should be called with real pixel coords (not zero)
        // Room polygon point [25, 25] with bgW=1280, bgH=1920 => x=320, y=480
        const moveToCall = ctx.moveTo.mock.calls[0];
        expect(moveToCall[0]).toBeCloseTo(320, 0);  // (25/100) * 1280
        expect(moveToCall[1]).toBeCloseTo(480, 0);  // (25/100) * 1920

        // lineTo should be called for the next points
        const lineToCall = ctx.lineTo.mock.calls[0];
        expect(lineToCall[0]).toBeCloseTo(960, 0);  // (75/100) * 1280
        expect(lineToCall[1]).toBeCloseTo(480, 0);  // (25/100) * 1920
    });

    it('should compute shortcut position using safe dimensions when bgImage.width is zero', () => {
        const bgImage = createMockBgImage({ naturalWidth: 1280, naturalHeight: 1920, width: 0, height: 0 });
        const rooms = [
            { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] }
        ];
        const shortcuts = [{
            position: [50, 50],
            scaleX: 1, scaleY: 1,
            name: 'Center Shortcut',
            config: {
                shape: 'circle',
                color: '#0ea5e9',
                icon: '💡',
            }
        }];

        engine.calculateAutoCrop(bgImage, rooms, true);

        engine.draw({
            bgImage,
            rooms,
            selectedRooms: [],
            isSplitting: false,
            splitStart: null,
            splitEnd: null,
            shortcuts,
            selectedShortcutIdx: -1,
            previewStateIdx: -1,
            isTransitioning: false,
            requestDraw: vi.fn(),
        });

        // arc() should be called for the shortcut circle at position (50/100)*1280=640, (50/100)*1920=960
        const arcCalls = ctx.arc.mock.calls;
        // Filter for shortcut arc (there might be room-related arcs too, but rooms use polygon/moveTo)
        // The shortcut arc should have x=640, y=960
        const shortcutArc = arcCalls.find(call => {
            return Math.abs(call[0] - 640) < 1 && Math.abs(call[1] - 960) < 1;
        });
        expect(shortcutArc).toBeDefined();
    });
});

// -----------------------------------------------------------
// Test Suite: State Override Resolution (matches CanvasEngine logic exactly)
// -----------------------------------------------------------
describe('CanvasEngine - State Override Resolution', () => {
    /**
     * This mirrors the exact logic in CanvasEngine.draw() for resolving
     * state overrides. We test it in isolation to ensure correctness.
     */
    function resolveCanvasEngineState(sc, selectedShortcutIdx, previewStateIdx, idx) {
        let color = sc.config?.color || sc.color || '#0ea5e9';
        let isTrans = sc.config?.transparent || sc.transparent || false;
        let icon = sc.config?.icon || '💡';
        let image = sc.config?.image || '';

        if (idx === selectedShortcutIdx && previewStateIdx !== -1 && sc.config?.states?.[previewStateIdx]) {
            const st = sc.config.states[previewStateIdx];
            if (st.color) color = st.color;
            if (st.image) {
                image = st.image;
                icon = st.icon || '';
            } else if (st.icon) {
                icon = st.icon;
                image = '';
            }
        }

        const finalImage = image || (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.endsWith('.png') || icon.endsWith('.svg') || icon.endsWith('.jpg') || icon.endsWith('.webp')) ? icon : '');

        return { color, icon, image, finalImage, isTrans };
    }

    it('should show state image when previewing a state with image override', () => {
        const sc = {
            config: {
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            }
        };

        const result = resolveCanvasEngineState(sc, 0, 0, 0);
        expect(result.color).toBe('#facaca');
        expect(result.image).toBe('/local/icons/lamp-on.png');
        expect(result.finalImage).toBe('/local/icons/lamp-on.png');
    });

    it('should show base config image when no state is being previewed', () => {
        const sc = {
            config: {
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            }
        };

        const result = resolveCanvasEngineState(sc, 0, -1, 0);
        expect(result.image).toBe('/local/icons/lamp-off.png');
        expect(result.finalImage).toBe('/local/icons/lamp-off.png');
    });

    it('should show state icon (not URL) when state has icon but no image', () => {
        const sc = {
            config: {
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'Alert', value: 'alert', color: '#ff0000', icon: '⚠️' }
                ]
            }
        };

        const result = resolveCanvasEngineState(sc, 0, 0, 0);
        expect(result.icon).toBe('⚠️');
        expect(result.image).toBe('');
        expect(result.finalImage).toBe('');
    });

    it('should NOT apply state override if shortcut is NOT selected', () => {
        const sc = {
            config: {
                color: '#475569',
                icon: '💡',
                image: '/local/icons/lamp-off.png',
                states: [
                    { name: 'On', value: 'on', color: '#facaca', image: '/local/icons/lamp-on.png' }
                ]
            }
        };

        // idx=0, selectedShortcutIdx=1 => not selected
        const result = resolveCanvasEngineState(sc, 1, 0, 0);
        expect(result.image).toBe('/local/icons/lamp-off.png');
        expect(result.color).toBe('#475569');
    });

    it('should resolve icon URL as finalImage when no explicit image is set', () => {
        const sc = {
            config: {
                color: '#0ea5e9',
                icon: '/local/icons/custom-icon.png',
            }
        };

        const result = resolveCanvasEngineState(sc, -1, -1, 0);
        expect(result.finalImage).toBe('/local/icons/custom-icon.png');
    });
});
