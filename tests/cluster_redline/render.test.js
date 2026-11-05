'use strict';
const assert = require('assert');
const path = require('path');
const stage = path.resolve(process.argv[2] || path.join(__dirname, '../../dist/cluster_redline'));
const { draw, difference, W, H } = require(path.join(stage, 'source/javascript/draw'));
const { settings } = require('../../apps/cluster_redline/policy');
const { Canvas } = require(path.join(stage, 'source/javascript/kit/canvas'));
const text = Canvas.prototype.text, labels = [];
Canvas.prototype.text = function(value) { labels.push(String(value)); return text.apply(this, arguments); };
const ordinary = draw({ rpm: 1990, gear: '4', shift: false, config: settings({ shiftRpm: 2000 }) });
const alert = draw({ rpm: 2000, gear: '4', shift: true, config: settings({ shiftRpm: 2000 }) });
Canvas.prototype.text = text;
assert(labels.includes('4')); assert(labels.includes('rpm'));
assert(!labels.some((s) => /REDLINE|SHIFT|SPORT|변속|레드라인|가솔린/.test(s)), 'cluster face must omit the app title and shift footer');
function redPixels(cv) {
    let count = 0;
    for (let y = 100; y < 210; y++) for (let x = 280; x < 815; x++) {
        const i = (y * W + x) * 4;
        if (cv.d[i] > 220 && cv.d[i + 1] < 80 && cv.d[i + 2] < 80) count++;
    }
    return count;
}
assert(redPixels(alert) > 300 && redPixels(ordinary) === 0, '2000 rpm threshold must turn the actual RPM glyph pixels red');
const a = Buffer.from(draw({ rpm: 4200, shift: false, config: settings() }).d);
const b = Buffer.from(draw({ rpm: 6500, shift: true, config: settings() }).d);
assert.strictEqual(a.length, W * H * 4);
assert.strictEqual(difference(a, a).rects.length, 0);
const d = difference(a, b); assert(d.rects.length > 0 && d.rects.length <= 4);
const copy = Buffer.from(a); let off = 0;
d.rects.forEach((r) => {
    assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H);
    for (let y = r.y; y < r.y + r.h; y++) {
        const bytes = r.w * 4;
        d.pixels.copy(copy, (y * W + r.x) * 4, off, off + bytes); off += bytes;
    }
});
assert(copy.equals(b)); assert.strictEqual(off, d.pixels.length);
// Every UI glyph actually used by the new app must be present in the atlas.
const fs = require('fs');
const atlas = JSON.parse(fs.readFileSync(path.join(stage, 'source/javascript/kit/fonts/korean.json'))).sizes[0].glyphs;
const src = ['app.js', 'draw.js', 'policy.js', 'kit/app-spec.json', 'kit/locale.json'].map((f) => fs.readFileSync(path.join(stage, 'source/javascript', f), 'utf8')).join('\n');
for (const ch of src) if (/[가-힣]/.test(ch)) assert(atlas[ch.charCodeAt(0)], 'Missing Korean glyph: ' + ch);
console.log('PASS: real 1088x480 drawing, exact partial-frame reconstruction and all Korean display glyphs');
