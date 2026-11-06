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
    display.pageTargets.forEach((r) => assert(r.h >= 65 && r.y + r.h <= 520));
    save('settings-basic-full');
    tapLogical(display.tabs[1]); assert.strictEqual(page.tab, 1);
    display.pageTargets.forEach((r) => assert(r.h >= 87));
    save('settings-advanced-full');
    tapLogical(display.pageTargets[0]); assert.strictEqual(page.open, 'shiftRpm');
    assert.strictEqual(display.pageTargets[0].w, 96); assert.strictEqual(display.pageTargets[0].h, 64);
    assert(display.pageTargets.slice(2, -1).every((r) => r.h === 70));
    assert.strictEqual(display.pageTargets[display.pageTargets.length - 1].h, 64);
    save('settings-rpm-full');
    const choice = page.choice; tapLogical(display.pageTargets[1]); assert.notStrictEqual(page.choice, choice);
    tapLogical(display.pageTargets[display.pageTargets.length - 1]); assert.strictEqual(page.open, null);
    tapLogical(display.pageTargets[1]); assert.strictEqual(page.open, 'displayTarget');
    save('settings-hud-target-full');
    tapLogical(display.pageTargets[4]); assert.strictEqual(values.displayTarget, 'hud', 'HUD target can be selected through real compositor touch routing');
    tapLogical(display.tabs[0]);
    save('settings-hud-basic-full');
    components.BTN_NEXT.on('action', () => page.move(1));
    components.BTN_VALUE_UP.on('action', () => page.change(1));
    function tapBar(id) {
        const b = display.buttons().find((q) => q.id === id), p = display.place;
        tapLogical({ x: (b.x - p.ox) / p.scale, y: (720 - display.barH() - p.oy) / p.scale, w: b.w / p.scale, h: display.barH() / p.scale });
    }
    tapBar('BTN_NEXT'); assert.strictEqual(page.focus, 1);
    tapBar('BTN_VALUE_UP'); assert.strictEqual(values.engineProfile, 'diesel');
    console.log('PASS: real compositor has 28px tabs, 34px rows, four 80px bottom buttons, bounded large targets and working tab/list/footer touches');
} finally { Recorder.prototype.text = oldText; }
