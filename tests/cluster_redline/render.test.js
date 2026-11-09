'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const stage = path.resolve(process.argv[2] || path.join(__dirname, '../../dist/cluster_redline'));
const { draw, difference, W, H, layout: L } = require(path.join(stage, 'source/javascript/draw'));
const { settings } = require('../../apps/cluster_redline/policy');
const { Canvas } = require(path.join(stage, 'source/javascript/kit/canvas'));
const text = Canvas.prototype.text, labels = [], seams = [];
const line = Canvas.prototype.line;
Canvas.prototype.text = function(value, x, y, size) { labels.push({ value: String(value), x, y, size }); return text.apply(this, arguments); };
Canvas.prototype.line = function(x, y, x2, y2) { if (y === L.top && y2 === L.bottom) seams.push(x); return line.apply(this, arguments); };
const normal = { rpm: 3400, gear: 'D4', shift: false, torqueNm: 380, powerPS: 227, torquePeak: 400, powerPeak: 250, config: settings({clusterAlertStyle:'bar'}) };
const face = draw(normal);
Canvas.prototype.text = text; Canvas.prototype.line = line;
assert.strictEqual(seams.length, 13, '7000 RPM uses exactly 14 cells (two per 1000)');
assert(labels.some((l) => l.value === 'D4' && l.size === 74));
assert(labels.some((l) => l.value === 'RPM' && l.y > L.bottom));
assert(labels.some((l) => l.value === 'Boost'));
assert(labels.some((l) => l.value === 'Torque'));
assert.deepStrictEqual(labels.filter((l) => l.y === 187).map((l) => l.value), ['0', '1', '2', '3', '4', '5', '6', '7']);
assert(!labels.some((l) => /REDLINE|SHIFT|SPORT|변속|레드라인/.test(l.value)));
function px(cv, x, y) { return Array.from(cv.d.slice((y * W + x) * 4, (y * W + x) * 4 + 4)); }
for (const point of [[0, 0], [50, 240], [1030, 240], [W - 1, H - 1], [544, 300]]) assert.strictEqual(px(face, point[0], point[1])[3], 0, 'empty widget space must preserve stock cluster');
let visible = 0;
for (let i = 3; i < face.d.length; i += 4) if (face.d[i]) visible++;
assert(visible < W * H * 0.25, 'must not reintroduce an opaque rectangular background');
assert.deepStrictEqual(px(face, 250, (L.alertTop + L.alertBottom) / 2), [0, 0, 0, 255], 'unlit LED cells are solid black, without a faint glow');
const partial = draw(Object.assign({}, normal, { rpm: 5000 }));
assert(px(partial, 250, (L.alertTop + L.alertBottom) / 2)[1] > 100);
assert.deepStrictEqual(px(partial, 840, (L.alertTop + L.alertBottom) / 2), [0, 0, 0, 255]);
function redDigits(cv) {
    let n = 0;
    for (let y = 205; y < 285; y++) for (let x = 300; x < 800; x++) {
        const i = (y * W + x) * 4;
        if (cv.d[i] > 220 && cv.d[i + 1] < 80 && cv.d[i + 2] < 80) n++;
    }
    return n;
}
const before = draw(Object.assign({}, normal, { rpm: 1990, config: settings({ shiftRpm: 2000 }) }));
const alert = draw(Object.assign({}, normal, { rpm: 2000, shift: true, config: settings({ shiftRpm: 2000 }) }));
assert.strictEqual(redDigits(before), 0); assert(redDigits(alert) > 200, 'configured shift threshold colors the actual RPM digits red');
const redzone = draw(Object.assign({}, normal, { rpm: 6200 }));
const rx = Math.round(L.left + (L.right - L.left - L.slant) * 6100 / 7000 + 7);
const tint = px(redzone, rx, 132);
assert(tint[0] > tint[1] && tint[2] > tint[1], 'filled high RPM stays pink/purple as it approaches red at7000');
assert.strictEqual(redDigits(redzone), 0);
const a = Buffer.from(face.d), b = Buffer.from(draw(Object.assign({}, normal, { rpm: 6500, shift: true, gear: 'S4' })).d);
assert.strictEqual(a.length, W * H * 4); assert.strictEqual(difference(a, a).rects.length, 0);
const d = difference(a, b), copy = Buffer.from(a); let off = 0;
assert(d.rects.length > 0 && d.rects.length <= 6);
d.rects.forEach((r) => {
    assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H);
    for (let y = r.y; y < r.y + r.h; y++) { const bytes = r.w * 4; d.pixels.copy(copy, (y * W + r.x) * 4, off, off + bytes); off += bytes; }
});
assert(copy.equals(b)); assert.strictEqual(off, d.pixels.length);
if (JSON.parse(fs.readFileSync(path.join(stage, 'source/javascript/kit/locale.json'))).language === 'ko') {
const atlas = JSON.parse(fs.readFileSync(path.join(stage, 'source/javascript/kit/fonts/korean.json'))).sizes[0].glyphs;
const src = ['app.js', 'draw.js', 'policy.js', 'kit/app-spec.json', 'kit/locale.json'].map((f) => fs.readFileSync(path.join(stage, 'source/javascript', f), 'utf8')).join('\n');
for (const ch of src) if (/[가-힣]/.test(ch)) assert(atlas[ch.charCodeAt(0)], 'Missing Korean glyph: ' + ch);
}
console.log('PASS: transparent stock-preserving face, compact layout, 14 RPM cells, black unlit LEDs, shift digits, D4/S4, exact alpha-aware frame deltas and Korean glyphs');
