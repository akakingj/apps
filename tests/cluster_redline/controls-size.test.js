'use strict';
// Test the actual bundled compositor and input routing with only transport stubbed.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const stage = path.resolve(process.argv[2]), js = path.join(stage, 'source/javascript');
const spec = JSON.parse(fs.readFileSync(path.join(js, 'kit/app-spec.json')));
const { SettingsPage } = require(path.join(js, 'settings-ui'));
const { configure } = require(path.join(js, 'settings-chrome'));
const { Recorder, play } = require(path.join(js, 'kit/record'));
const { Canvas } = require(path.join(js, 'kit/canvas'));
const { t } = require(path.join(js, 'kit/i18n'));
const values = {}, components = {}, calls = [];
spec.settings.forEach((s) => { values[s.key] = s.default; });
class Renderer extends EventEmitter {
    constructor() { super(); this.ready = this.native = this.touch = true; this.screen = { w: 1920, h: 720 }; this.info = { controller: true }; }
    static available() { return true; }
    connect() { this.emit('ready'); }
    place() {} show(on) { this.visible = on; } grab() {} claim() {} frame() {}
}
const ui = { rhmi: { getByName(name) { return components[name] || (components[name] = new EventEmitter()); } },
    onVisible() {}, onFocus() {}, isVisible(name) { return name === 'MAIN'; }, hasFocus() { return true; }, visible() {} };
const settings = { schema: spec.settings, get: (k) => values[k], set(k, v) { values[k] = v; }, onChange() {} };
const log = { info() {}, warn() {}, error(e) { throw e; } };
const box = { module: { exports: {} }, process: { env: {} }, Date, Buffer,
    setTimeout() {}, clearTimeout() {}, setInterval() { return { unref() {} }; },
    require(name) { return name === './renderd' ? { RenderClient: Renderer } : require(path.join(js, 'kit', name)); } };
vm.runInNewContext(fs.readFileSync(path.join(js, 'kit/display.js'), 'utf8'), box);
const display = new box.module.exports.Display(ui, log, spec, settings, () => require(path.join(js, 'kit/themes')).theme());
configure({ display, hideButton: (id) => display.hideButton(id) });
let page, bodyWords;
const oldText = Recorder.prototype.text;
Recorder.prototype.text = function (value, x, y, size) { calls.push({ value: t(value), size }); return oldText.apply(this, arguments); };
function render() {
    const r = page.draw(display.canvas(1600, 520)); bodyWords = new Uint32Array(r.words());
    return display.present('MAIN_GFX', r, () => {});
}
page = new SettingsPage(settings, render, spec.version);
display.onTab = (i) => page.selectTab(i);
function tapLogical(r) { display._touch(1, r.x + r.w / 2, r.y + r.h / 2); display._touch(3, r.x + r.w / 2, r.y + r.h / 2); }
function save(name) {
    if (!process.argv[3]) return;
    const out = path.resolve(process.argv[3]); fs.mkdirSync(out, { recursive: true });
    const pageImage = new Canvas(1600, 520), chrome = new Canvas(1920, 720), result = new Canvas(1920, 720);
    play(bodyWords, pageImage);
    // Native chrome ends with clipped transparent masks for HMI icons. The
    // software player ignores clips, so omit those clears in this host image;
    // no stock status icons are included in the preview.
    chrome.clear = () => chrome;
    play(display.chromeRec.words(), chrome);
    const p = display.place; result.clear('#090b0e');
    result.drawImage(pageImage.d, 1600, 520, p.ox, p.oy, 1600 * p.scale, 520 * p.scale); result.blit(chrome, 0, 0);
    fs.writeFileSync(path.join(out, name + '.png'), result.png());
}
try {
    render(); assert(display.own()); assert.strictEqual(display.barH(), 80);
    assert.deepStrictEqual(Array.from(display.buttons(), (b) => b.id), ['BTN_PREVIOUS', 'BTN_NEXT', 'BTN_VALUE_DOWN', 'BTN_VALUE_UP']);
    const buttons = display.buttons();
    assert.strictEqual(buttons[0].x, 84); assert.strictEqual(buttons[3].x + buttons[3].w, 1920);
    buttons.forEach((b) => assert(b.w >= 450));
    for (const text of ['Basic settings', 'Advanced settings']) assert(calls.some((c) => c.value === t(text).toUpperCase() && c.size === 28));
    assert(calls.some((c) => c.value === t('Vehicle preset') && c.size === 34));
    display.pageTargets.forEach((r) => assert(r.h >= 50 && r.y + r.h <= 520));
    save('settings-basic-full');
    tapLogical(display.pageTargets[6]); assert.strictEqual(page.open,'shiftRpm');
    assert.strictEqual(display.pageTargets[0].w,96);assert.strictEqual(display.pageTargets[0].h,64);
    save('settings-rpm-full');
    tapLogical(display.pageTargets[display.pageTargets.length-1]);
    tapLogical(display.tabs[1]);assert.strictEqual(page.tab,1);assert.strictEqual(display.pageTargets.length,4);
    display.pageTargets.forEach(r=>assert(r.h>=73));save('settings-advanced-full');
    tapLogical(display.pageTargets[1]);assert.strictEqual(page.open,'sportHudOutput');
    tapLogical(display.pageTargets[2]);assert.strictEqual(values.sportHudOutput,'redline');
    tapLogical(display.pageTargets[2]);assert.strictEqual(page.open,'sportClusterOutput');
    tapLogical(display.pageTargets[3]);assert.strictEqual(values.sportClusterOutput,'stock');
    tapLogical(display.pageTargets[0]);tapLogical(display.pageTargets[3]);assert.strictEqual(values.displayMode,'all');
    assert.strictEqual(page.keys()[1],'allHudOutput');assert.strictEqual(values.allHudOutput,'stock');
    tapLogical(display.pageTargets[0]);tapLogical(display.pageTargets[2]);assert.strictEqual(values.displayMode,'sport');
    assert.strictEqual(values.sportHudOutput,'redline');assert.strictEqual(values.sportClusterOutput,'stock');
    tapLogical(display.pageTargets[3]);assert.strictEqual(page.open,'layout');save('settings-layout-cluster-full');
    tapLogical(display.pageTargets[1]);assert.strictEqual(page.layoutTarget,'hud');
    tapLogical(display.pageTargets[6]);assert.strictEqual(values.hudOffsetX,10);
    tapLogical(display.pageTargets[9]);assert.strictEqual(values.hudWidthScale,80);save('settings-layout-hud-full');
    tapLogical(display.pageTargets[2]);assert.strictEqual(page.layoutTarget,'hudNav');
    tapLogical(display.pageTargets.find(r=>r.x===1140&&r.y===244));assert.strictEqual(values.hudNavWidthScale,105);
    assert.strictEqual(values.hudWidthScale,80,'navigation width is independent of RPM HUD width');
    tapLogical(display.pageTargets.find(r=>r.x===890&&r.y===110));assert.strictEqual(values.hudNavigationEnabled,false);
    tapLogical(display.pageTargets.find(r=>r.x===440&&r.y===302));assert.strictEqual(values.hudNavOffsetX,10);
    save('settings-layout-hud-navigation-full');
    tapLogical(display.pageTargets.find(r=>r.x===1210&&r.y===448));assert.strictEqual(page.open,null);
    tapLogical(display.tabs[0]);
    save('settings-hud-basic-full');
    components.BTN_NEXT.on('action', () => page.move(1));
    components.BTN_VALUE_UP.on('action', () => page.change(1));
    function tapBar(id) {
        const b = display.buttons().find((q) => q.id === id), p = display.place;
        tapLogical({ x: (b.x - p.ox) / p.scale, y: (720 - display.barH() - p.oy) / p.scale, w: b.w / p.scale, h: display.barH() / p.scale });
    }
    tapBar('BTN_NEXT'); tapBar('BTN_NEXT'); assert.strictEqual(page.focus, 2);
    tapBar('BTN_VALUE_UP'); assert.strictEqual(values.engineProfile, 'diesel');
    page.selectTab(1);page.activate(1);render();
    tapLogical(display.pageTargets.find(r=>r.x===84&&r.y===448&&r.w===520));assert.strictEqual(page.section,'hud');
    page.activate(0);page.move(1);render();
    assert(calls.some(c=>c.value===String(Math.round(page.config().shiftRpm*0.92/10)*10)&&c.size>50));
    const nativeFrame=page.draw(display.canvas(1600,520));
    assert.strictEqual(nativeFrame.images.size,0,'HUD previews must not request unsupported native pixel-image operations');
    tapLogical(display.pageTargets.find(r=>r.x>800&&r.y===148));assert.strictEqual(values.hudAlertStyle,'circle');
    save('settings-hud-alert-full');
    page.activate(1);render();tapLogical(display.pageTargets.find(r=>r.x>500&&r.x<1100&&r.y===148));
    assert.strictEqual(values.hudAuxDisplay,'values');save('settings-hud-values-full');
    tapLogical(display.pageTargets.find(r=>r.x===1210&&r.y===448));assert.strictEqual(page.section,null);
    console.log('PASS: real compositor tabs/large controls, native vector HUD preview without image ops, touch choices and back navigation');
} finally { Recorder.prototype.text = oldText; }
