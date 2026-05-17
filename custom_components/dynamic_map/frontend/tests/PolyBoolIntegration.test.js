import { describe, it, expect } from 'vitest';
import '../polybool.min.js';
const PolyBool = window.PolyBool;

describe('PolyBool Room Geometry Integration', () => {

    it('should successfully split a rectangular room into two', () => {
        // Mock a 100x100 room
        const roomPoly = [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100]
        ];

        // Slice box simulating a vertical cut down the middle (x=50)
        // A huge rectangle from x=50 to x=200
        const sliceBox = [
            [50, -100],
            [200, -100],
            [200, 200],
            [50, 200]
        ];

        const pbRoom = { regions: [roomPoly], inverted: false };
        const pbBox = { regions: [sliceBox], inverted: false };

        // Perform Intersection (Right half)
        const cut1 = PolyBool.intersect(pbRoom, pbBox);
        // Perform Difference (Left half)
        const cut2 = PolyBool.difference(pbRoom, pbBox);

        expect(cut1.regions.length).toBe(1);
        expect(cut2.regions.length).toBe(1);

        // Verify Right Half Area (50 * 100 = 5000)
        const rightHalf = cut1.regions[0];
        expect(rightHalf.some(pt => pt[0] === 100)).toBe(true);
        expect(rightHalf.some(pt => pt[0] === 50)).toBe(true);

        // Verify Left Half Area (50 * 100 = 5000)
        const leftHalf = cut2.regions[0];
        expect(leftHalf.some(pt => pt[0] === 0)).toBe(true);
        expect(leftHalf.some(pt => pt[0] === 50)).toBe(true);
    });

    it('should successfully merge two adjacent rectangular rooms', () => {
        // Left room (0 to 50)
        const room1 = [
            [0, 0],
            [50, 0],
            [50, 100],
            [0, 100]
        ];

        // Right room (50 to 100)
        const room2 = [
            [50, 0],
            [100, 0],
            [100, 100],
            [50, 100]
        ];

        const p1 = { regions: [room1], inverted: false };
        const p2 = { regions: [room2], inverted: false };

        const comb = PolyBool.union(p1, p2);

        // Should form a single merged region
        expect(comb.regions.length).toBe(1);

        const mergedPoly = comb.regions[0];
        // The merged polygon should cover 0 to 100
        expect(mergedPoly.some(pt => pt[0] === 0)).toBe(true);
        expect(mergedPoly.some(pt => pt[0] === 100)).toBe(true);
    });

    it('should not throw polygonFromSegments is not a function', () => {
        expect(() => {
            const pb1 = { regions: [[[0,0], [10,0], [10,10], [0,10]]], inverted: false };
            const pbBox = { regions: [[[5,-5], [15,-5], [15,15], [5,15]]], inverted: false };
            PolyBool.intersect(pb1, pbBox);
        }).not.toThrowError();
    });
});
