import { describe, it, expect, vi } from 'vitest';
import { animateViewBox, zoomTransform, settleViewBox } from '../card/RoomFocus.js';

function fakeSvg() {
    const anims = [];
    return {
        style: {}, anims,
        getBoundingClientRect: () => ({ width: 1000, height: 500 }),
        animate(frames, opts) { const a = { frames, opts, cancel: vi.fn(), onfinish: null }; anims.push(a); return a; }
    };
}

describe('room zoom animation', () => {
    it('zoomTransform maps the target viewBox onto the current one (scale about 0,0 plus shift)', () => {
        const from = { x: 0, y: 0, w: 1000, h: 500 }, to = { x: 250, y: 100, w: 500, h: 250 };
        // ppu 1, no letterbox: scale 2, and the target origin (250,100) must land at (0,0): translate(-500px, -200px)
        expect(zoomTransform(from, to, { width: 1000, height: 500 })).toBe('translate(-500.00px, -200.00px) scale(2.00000)');
        // letterboxed: a 1000x1000 element showing a 2:1 box leaves 250px above and below
        expect(zoomTransform(from, from, { width: 1000, height: 1000 })).toBe('translate(0.00px, 0.00px) scale(1.00000)');
    });

    it('animates with a compositor transform and writes the viewBox once at the end', () => {
        const svg = fakeSvg();
        const host = { svg, vb: { x: 0, y: 0, w: 1000, h: 500 }, updateViewBox: vi.fn() };
        animateViewBox(host, { x: 250, y: 100, w: 500, h: 250 }, 300);
        expect(svg.anims.length).toBe(1);
        expect(svg.style.willChange).toBe('transform');
        expect(svg.anims[0].frames[1].transform).toContain('scale(2.00000)');
        expect(host.vb).toEqual({ x: 0, y: 0, w: 1000, h: 500 });     // no per-frame viewBox writes
        svg.anims[0].onfinish();
        expect(host.vb).toEqual({ x: 250, y: 100, w: 500, h: 250 });
        expect(host.updateViewBox).toHaveBeenCalledTimes(2);          // once before, once after
        expect(svg.anims[0].cancel).toHaveBeenCalled();
        expect(svg.style.willChange).toBe('');
        expect(host._vbAnim).toBeNull();
    });

    it('a manual pan settles a running zoom at its interpolated position; a retarget continues from there', () => {
        const svg = fakeSvg();
        const host = { svg, vb: { x: 0, y: 0, w: 1000, h: 500 }, updateViewBox: vi.fn() };
        animateViewBox(host, { x: 500, y: 0, w: 1000, h: 500 }, 300);
        host._vbAnim.start -= 150;                                     // half-way through
        settleViewBox(host);
        expect(host._vbAnim).toBeNull();
        expect(Math.abs(host.vb.x - 250)).toBeLessThan(2);              // eased midpoint of 0..500
        expect(svg.anims[0].cancel).toHaveBeenCalled();
        animateViewBox(host, { x: 0, y: 0, w: 1000, h: 500 }, 300);
        expect(svg.anims[1].frames[1].transform).toContain('scale(1.00000)');
    });

    it('falls back to per-frame interpolation without the Web Animations API', () => {
        const host = { svg: { style: {} }, vb: { x: 0, y: 0, w: 100, h: 50 }, updateViewBox: vi.fn() };
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { cb(performance.now() + 1000); return 1; });
        animateViewBox(host, { x: 10, y: 10, w: 50, h: 25 }, 10);
        expect(host.vb).toEqual({ x: 10, y: 10, w: 50, h: 25 });
        raf.mockRestore();
    });
});
