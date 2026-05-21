const pb1 = { regions: [[[0,0], [100,0], [100,100], [0,100]]], inverted: false };
const p1 = {x: 50, y: -10};
const p2 = {x: 50, y: 110};
const dx = p2.x - p1.x; // 0
const dy = p2.y - p1.y; // 120
const len = Math.hypot(dx, dy); // 120
const nx = -dy/len; // -1
const ny = dx/len; // 0
const BIG = 10000;
const sliceBoxOld = [
    [p1.x - nx*BIG - dx*BIG, p1.y - ny*BIG - dy*BIG],
    [p1.x + nx*BIG - dx*BIG, p1.y + ny*BIG - dy*BIG],
    [p2.x + nx*BIG + dx*BIG, p2.y + ny*BIG + dy*BIG],
    [p2.x - nx*BIG + dx*BIG, p2.y - ny*BIG + dy*BIG]
];
const sliceBoxNew = [
    [p1.x - dx*BIG, p1.y - dy*BIG],
    [p1.x + nx*BIG - dx*BIG, p1.y + ny*BIG - dy*BIG],
    [p2.x + nx*BIG + dx*BIG, p2.y + ny*BIG + dy*BIG],
    [p2.x + dx*BIG, p2.y + dy*BIG]
];
console.log("old:", sliceBoxOld);
console.log("new:", sliceBoxNew);
