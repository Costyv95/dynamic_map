import { describe, it, expect } from 'vitest';
import { outsideItemView, markHiddenEdges } from '../card/OutsideBar.js';

describe('outside bar on a narrow card (#2507)', () => {
    it('words the weather condition', () => {
        const v = outsideItemView({ entity_id: 'weather.home' }, { state: 'partlycloudy', attributes: {} });
        expect(v.label).toBe('Partly cloudy');
        expect(v.value).toBe('Partly cloudy');
    });
    it('keeps an unknown condition readable', () => {
        expect(outsideItemView({ entity_id: 'weather.home' }, { state: 'dust_storm', attributes: { temperature: 9 } }))
            .toMatchObject({ value: '9°', label: 'dust storm' });
    });
    const bar = (scrollWidth, clientWidth, scrollLeft) => {
        const el = document.createElement('div');
        Object.defineProperties(el, { scrollWidth: { value: scrollWidth }, clientWidth: { value: clientWidth } });
        el.scrollLeft = scrollLeft;
        markHiddenEdges(el);
        return [el.classList.contains('dm-more-start'), el.classList.contains('dm-more-end')];
    };
    it('fades the edge that hides items, and none when all fit', () => {
        expect(bar(491, 372, 0)).toEqual([false, true]);
        expect(bar(491, 372, 119)).toEqual([true, false]);
        expect(bar(491, 372, 60)).toEqual([true, true]);
        expect(bar(300, 372, 0)).toEqual([false, false]);
    });
});
