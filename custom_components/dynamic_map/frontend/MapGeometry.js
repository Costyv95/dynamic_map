export class MapGeometry {
    static getPolygonCenter(polygon) {
        let avgX = 0, avgY = 0;
        polygon.forEach(pt => { avgX += pt[0]; avgY += pt[1]; });
        return [avgX / polygon.length, avgY / polygon.length];
    }

    static isPointInPolygon(point, vs) {
        let x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i][0], yi = vs[i][1];
            let xj = vs[j][0], yj = vs[j][1];
            let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    static getRandomPointInPolygon(polygon) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of polygon) {
            minX = Math.min(minX, pt[0]);
            maxX = Math.max(maxX, pt[0]);
            minY = Math.min(minY, pt[1]);
            maxY = Math.max(maxY, pt[1]);
        }
        
        // Try up to 100 times to find a point inside
        for (let i = 0; i < 100; i++) {
            const rx = minX + Math.random() * (maxX - minX);
            const ry = minY + Math.random() * (maxY - minY);
            if (this.isPointInPolygon([rx, ry], polygon)) {
                return [rx, ry];
            }
        }
        return this.getPolygonCenter(polygon);
    }

    static getRoomAtCoords(rooms, pctX, pctY) {
        for (const room of rooms) {
            if (this.isPointInPolygon([pctX, pctY], room.polygon)) {
                return room;
            }
        }
        return null;
    }
}
