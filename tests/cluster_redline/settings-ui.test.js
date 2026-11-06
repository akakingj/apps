'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const stage = path.resolve(process.argv[2]);
const dir = path.join(stage, 'source/javascript');
const { SettingsPage, WARNING, MAP_WARNING, HUD_WARNING, RENDERER_NOTICE, options } = require(path.join(dir, 'settings-ui'));
const { Canvas } = require(path.join(dir, 'kit/canvas'));
const { t } = require(path.join(dir, 'kit/i18n'));
const spec = JSON.parse(fs.readFileSync(path.join(dir, 'kit/app-spec.json')));
const data = {};spec.settings.forEach(s=>{data[s.key]=s.default});
const saved={schema:spec.settings,get:k=>data[k],set:(k,v)=>{data[k]=v}};
const page = new SettingsPage(saved, null, spec.version);
const labels=[], original=Canvas.prototype.text;
Canvas.prototype.text=function(value,x,y,size,color){labels.push({value:t(value),x,y,size,color});return original.apply(this,arguments)};
const cv=page.draw(new Canvas(1600,520));
Canvas.prototype.text=original;
assert(labels.some(l=>l.value===t(WARNING)&&l.color==='#ff9e36'));
assert(labels.some(l=>l.value===t(RENDERER_NOTICE)&&l.color==='#ff9e36'));
assert(labels.some(l=>l.value==='v'+spec.version), 'software header must identify the running build');
assert(labels.find(l=>l.value===t(RENDERER_NOTICE)).y < labels.find(l=>l.value===t(WARNING)).y);
assert(labels.find(l=>l.value===t(WARNING)).y > labels.find(l=>l.value===t('App auto start')).y);
assert.strictEqual(cv.targets.length,7);
const mapLabels = [];
saved.set('displayTarget', 'map');
Canvas.prototype.text = function(value) { mapLabels.push(t(value)); return original.apply(this, arguments); };
page.draw(new Canvas(1600,520));
Canvas.prototype.text = original;
assert(mapLabels.includes(t(MAP_WARNING)), 'map takeover must allow Map view or Off in its instruction');
const hudLabels = [];
saved.set('displayTarget', 'hud');
Canvas.prototype.text = function(value) { hudLabels.push(t(value)); return original.apply(this, arguments); };
page.draw(new Canvas(1600,520));
Canvas.prototype.text = original;
assert(hudLabels.includes(t(HUD_WARNING)), 'HUD instructions describe exclusive output and factory guidance');
assert(!hudLabels.includes(t(WARNING)) && !hudLabels.includes(t(MAP_WARNING)), 'HUD selection must not instruct owners to alter the cluster menu');
if (JSON.parse(fs.readFileSync(path.join(dir,'kit/locale.json'))).language === 'ko') {
    for (const value of [HUD_WARNING, 'HUD (RPM / gear / shift)']) {
        assert.notStrictEqual(t(value), value, 'HUD option and warning must have Korean translations');
    }
}
saved.set('displayTarget', 'panel');
assert.strictEqual(new Set(cv.targets.map(r=>r.key)).size,7);
for(const r of cv.targets){assert.strictEqual(typeof r.run,'function');assert(r.y>=0&&r.y+r.h<=520)}
const full = new Canvas(1600,520); full.chrome = {};
page.draw(full);
assert.strictEqual(full.chrome.tabs.tabs.length,2, 'full-screen path must expose both tabs in the shared Live Data header');
assert(full.chrome.tabs.badges.some(b=>b.text==='v'+spec.version), 'GPU header must identify the running build');
assert.strictEqual(full.targets.length,5, 'full-screen path must not duplicate header tabs in the body');
cv.targets[3].run();assert.strictEqual(page.open,'engineProfile');
let pick=page.draw(new Canvas(1600,520));pick.targets[6].run();assert.strictEqual(data.engineProfile,'hybrid');
page.selectTab(1);page.activate(0);
const list=options(page.item(),page.config());const target=list.findIndex(v=>v[0]===2000);
page.choose(target);assert.strictEqual(data.shiftRpm,2000);
page.selectTab(0);page.focus=2;page.change(1);assert.strictEqual(data.displayMode,'all');
if (JSON.parse(fs.readFileSync(path.join(dir,'kit/locale.json'))).language === 'ko') {
    const atlas=JSON.parse(fs.readFileSync(path.join(dir,'kit/fonts/korean.json'))).sizes[0].glyphs;
    for(const value of labels.map(l=>l.value).concat(hudLabels, [t('HUD (RPM / gear / shift)')]))
        for(const ch of value)if(/[가-힣]/.test(ch))assert(atlas[ch.charCodeAt(0)],'missing glyph '+ch);
}
console.log('PASS: rendered tabs, orange instruction under auto start, clickable rotary/touch targets, preset/RPM choices and Korean glyph coverage');
