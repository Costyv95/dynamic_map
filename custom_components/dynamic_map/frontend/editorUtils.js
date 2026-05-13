export function getPolygonCenter(polygon) {
    let signedArea = 0;
    let cx = 0;
    let cy = 0;
    
    for (let i = 0; i < polygon.length; i++) {
        let p1 = polygon[i];
        let p2 = polygon[(i + 1) % polygon.length];
        let a = p1[0] * p2[1] - p2[0] * p1[1];
        signedArea += a;
        cx += (p1[0] + p2[0]) * a;
        cy += (p1[1] + p2[1]) * a;
    }
    
    signedArea *= 0.5;
    if (Math.abs(signedArea) < 0.0001) {
        // Fallback to vertex average if area is 0
        let avgX = 0, avgY = 0;
        polygon.forEach(pt => { avgX += pt[0]; avgY += pt[1]; });
        return [avgX / polygon.length, avgY / polygon.length];
    }
    
    return [cx / (6 * signedArea), cy / (6 * signedArea)];
}

export function isPointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function getPolygonArea(polygon) {
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
    }
    return Math.abs(area / 2);
}
