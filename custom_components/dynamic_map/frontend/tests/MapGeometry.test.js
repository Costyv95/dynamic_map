import { describe, it, expect } from 'vitest';
import { MapGeometry } from '../shared/MapGeometry.js';

describe('MapGeometry', () => {
    describe('isPointInPolygon', () => {
        const squarePolygon = [[0, 0], [10, 0], [10, 10], [0, 10]];

        it('should return true for a point strictly inside the polygon', () => {
            expect(MapGeometry.isPointInPolygon([5, 5], squarePolygon)).toBe(true);
        });

        it('should return false for a point outside the polygon', () => {
            expect(MapGeometry.isPointInPolygon([15, 15], squarePolygon)).toBe(false);
            expect(MapGeometry.isPointInPolygon([-5, 5], squarePolygon)).toBe(false);
        });
    });

    describe('getPolygonArea', () => {
        it('should correctly calculate the area of a square', () => {
            const squarePolygon = [[0, 0], [10, 0], [10, 10], [0, 10]];
            expect(MapGeometry.getPolygonArea(squarePolygon)).toBe(100);
        });

        it('should correctly calculate the area of a triangle', () => {
            const trianglePolygon = [[0, 0], [10, 0], [5, 10]];
            expect(MapGeometry.getPolygonArea(trianglePolygon)).toBe(50);
        });
    });

    describe('getPolygonCenter', () => {
        it('should calculate the centroid of a square', () => {
            const squarePolygon = [[0, 0], [10, 0], [10, 10], [0, 10]];
            const center = MapGeometry.getPolygonCenter(squarePolygon);
            expect(center[0]).toBeCloseTo(5);
            expect(center[1]).toBeCloseTo(5);
        });

        it('should fallback to bounding box average for zero-area polygons', () => {
            // A line has zero area
            const linePolygon = [[0, 0], [10, 10]];
            const center = MapGeometry.getPolygonCenter(linePolygon);
            expect(center[0]).toBeCloseTo(5);
            expect(center[1]).toBeCloseTo(5);
        });
    });
});
