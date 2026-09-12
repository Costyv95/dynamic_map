import { describe, it, expect, vi } from 'vitest';
import { axisTicks, nearestPoint, drawTrend, fmtTime } from '../card/TrendChart.js';

describe('trend chart time axis', () => {
    it('puts round-hour ticks every 6 h across the window and "now" at the right edge', () => {
        const now = new Date(2026, 8, 12, 9, 40).getTime();   // local 09:40
        const ticks = axisTicks(now - 24 * 3600 * 1000, now);
        expect(ticks.map(t => t.label)).toEqual(['10:00', '16:00', '22:00', '04:00', 'now']);
        expect(ticks[0].frac).toBeCloseTo(20 / (24 * 60), 3);   // 09:40 → 10:00 is 20 minutes in
        expect(ticks.at(-1).frac).toBe(1);
        expect(fmtTime(new Date(2026, 0, 1, 7, 5).getTime())).toBe('07:05');
    });

    it('draws the polyline over the fixed window, labels the axis, and reads out time and value under the pointer', () => {
        const now = new Date(2026, 8, 12, 12, 0).getTime();
        const h = 3600 * 1000;
        const pts = [[now - 20 * h, 18], [now - 12 * h, 22], [now - 2 * h, 20]];
        const slot = document.createElement('div');
        const onHover = vi.fn();
        drawTrend(slot, pts, { now, onHover });
        expect(slot.hidden).toBe(false);
        expect(slot.querySelector('.dm-rp-trend-label').textContent).toBe('24 h · 18° – 22°');
        expect([...slot.querySelectorAll('.dm-rp-axis span')].map(s => s.textContent)).toEqual(['12:00', '18:00', '00:00', '06:00', 'now']);
        expect(slot.querySelectorAll('.dm-rp-tick').length).toBe(5);
        const svg = slot.querySelector('svg');
        svg.getBoundingClientRect = () => ({ left: 100, width: 200 });
        // pointer at the middle of the chart = 12 h ago = the 22° sample
        svg.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200 }));
        expect(onHover).toHaveBeenCalledWith(true);
        expect(slot.querySelector('.dm-rp-trend-readout').textContent).toBe('00:00 · 22°');
        expect(slot.querySelector('.dm-rp-cursor').style.display).toBe('');
        svg.dispatchEvent(new MouseEvent('pointerleave'));
        expect(onHover).toHaveBeenLastCalledWith(false);
        expect(slot.querySelector('.dm-rp-trend-label').textContent).toBe('24 h · 18° – 22°');
        expect(nearestPoint(pts, 0.95, now - 24 * h, now)).toEqual(pts[2]);
        drawTrend(slot, [[now, 1]], { now });
        expect(slot.hidden).toBe(true);
    });
});
