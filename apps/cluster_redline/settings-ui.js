'use strict';
const { t } = require('./kit/i18n');
const G = require('./kit/gauges');
const { settings: effective, PROFILES } = require('./policy');
const W = 1600, H = 520;
const TABS = ['Basic settings', 'Advanced settings'];
const GROUPS = [
    ['appEnabled', 'engineProfile', 'displayMode', 'powerUnit', 'torqueUnit'],
    ['shiftRpm', 'frameRate', 'displayTarget', 'widgetScale'],
];
const WARNING = 'Set Instrument cluster > Central display area to Off for correct operation.';
function options(item, cfg) {
    if (item.type === 'bool') return [[false, 'Off'], [true, 'On']];
    if (item.type === 'choice') return item.options;
    const range = PROFILES[cfg.engineProfile] && PROFILES[cfg.engineProfile].ranges[item.key];
    return (item.steps || []).filter((v) => !range || v === 0 || (v >= range[0] && v <= range[1]))
        .map((v) => [v, v === 0 ? 'Preset default' : String(v) + ' ' + (item.unit || '')]);
}
class SettingsPage {
    constructor(settings, changed) { this.settings = settings; this.changed = changed || (() => {}); this.tab = 0; this.focus = 0; this.open = null; this.choice = 0; }
    config() {
        const raw = {}; this.settings.schema.forEach((s) => { raw[s.key] = this.settings.get(s.key); });
        return effective(raw);
    }
    keys() { return GROUPS[this.tab]; }
    item() { return this.settings.schema.find((s) => s.key === this.keys()[this.focus]); }
    selectTab(index) { this.tab = index === 1 ? 1 : 0; this.focus = 0; this.open = null; this.changed(); }
    move(delta) {
        if (this.open) { const n = options(this.item(), this.config()).length; this.choice = (this.choice + delta + n) % n; }
        else this.focus = (this.focus + delta + this.keys().length) % this.keys().length;
        this.changed();
    }
    value(item, cfg) {
        const value = this.settings.get(item.key), selected = options(item, cfg).find((o) => o[0] === value);
        if (item.key === 'shiftRpm' && value === 0) return String(cfg.shiftRpm) + ' rpm (' + t('Preset default') + ')';
        return selected ? t(selected[1]) : t('Check required');
    }
    change(delta) {
        const item = this.item(), list = options(item, this.config());
        const at = list.findIndex((o) => o[0] === this.settings.get(item.key));
        this.settings.set(item.key, list[(at + delta + list.length) % list.length][0]);
        this.open = null; this.changed();
    }
    activate(index) {
        if (index !== undefined) this.focus = index;
        const item = this.item();
        if (item.type === 'bool') { this.change(1); return; }
        this.open = item.key;
        this.choice = Math.max(0, options(item, this.config()).findIndex((o) => o[0] === this.settings.get(item.key)));
        this.changed();
    }
    choose(index) {
        const list = options(this.item(), this.config());
        if (!list[index]) return;
        this.settings.set(this.item().key, list[index][0]); this.open = null; this.changed();
    }
    draw(cv, status) {
        const cfg = this.config(), targets = [];
        const theme = { bg: '#090b0e', text: '#f3f5f7', dim: '#8d97a4', sel: '#f32b40', accent: '#f32b40' };
        cv.clear(theme.bg);
        // Use the same kit header as Live Data. Full-screen renderers place the
        // title/tabs in the real HMI strip; software draws them together here.
        const offset = cv.chrome ? 0 : 66;
        if (cv.chrome) G.frame(cv, theme, TABS, this.tab, []);
        else {
            G.header(cv, theme, 0, 0, W, 62, 'Cluster Redline', TABS, this.tab, [], true, false);
            (cv.tabRects || []).forEach((r) => targets.push(Object.assign({}, r, { act: () => this.selectTab(r.i) })));
        }
        ['#39bffa', '#1757ad', '#f32d45'].forEach((color, i) => cv.fillRect(64 + i * 23, offset + 18, 21, 4, color));
        cv.line(134, offset + 20, 1536, offset + 20, 1, '#8b919a');
        cv.text(TABS[this.tab], 84, offset + 59, 28, '#f3f5f7', { font: 'bold' });
        cv.line(84, offset + 73, 1536, offset + 73, 1, '#71303a');
        if (this.open) this.drawChoices(cv, cfg, targets, offset);
        else {
            let y = offset + 86;
            this.keys().forEach((key, i) => {
                const item = this.settings.schema.find((s) => s.key === key), h = key === 'appEnabled' ? 82 : 58;
                const on = i === this.focus;
                if (on) {
                    cv.gradientRect(78, y, 1460, h - 1, [[0, '#291217'], [1, theme.bg]]);
                    cv.fillRect(78, y + 7, 3, 35, '#ef3046');
                }
                cv.text(item.label, 100, y + 34, 25, '#f1f4fa');
                cv.text(this.value(item, cfg), 1482, y + 34, 25, '#c1cddd', { align: 'right' });
                if (item.type !== 'bool') cv.polyline([[1518, y + 20], [1526, y + 28], [1518, y + 36]], 2, '#909cac');
                if (key === 'appEnabled') cv.text(WARNING, 100, y + 65, 21, '#ff9e36');
                cv.line(84, y + h - 1, 1536, y + h - 1, 0.6, '#292d34');
                targets.push({ x: 78, y, w: 1460, h: h - 1, act: () => this.activate(i) });
                y += h;
            });
            if (this.tab === 0) cv.text('Presets set gauge scales; eDrive shows engine output only, not combined output.', 84, 500, 19, '#8b98aa');
            else {
                cv.text('Status', 84, 421, 21, '#7f8b9d');
                cv.text(status || 'Waiting for background app', 84, 454, 23, '#bdc9d8');
                cv.text('Refresh rate is a requested limit; actual output depends on the car.', 84, 500, 19, '#8b98aa');
            }
        }
        cv.targets = targets.map((target, i) => Object.assign({ key: this.tab + ':' + (this.open || 'rows') + ':' + i, run: target.act }, target));
        return cv;
    }
    drawChoices(cv, cfg, targets, offset) {
        const item = this.item(), list = options(item, cfg), start = Math.max(0, Math.min(list.length - 5, this.choice - 2));
        cv.text(item.label, 100, offset + 109, 23, '#ef4050');
        [-1, 1].forEach((delta, i) => {
            const x = 1370 + i * 90;
            cv.line(x + 25, offset + 101, x + 45, offset + 101, 2, '#ff9e36');
            if (delta > 0) cv.line(x + 35, offset + 91, x + 35, offset + 111, 2, '#ff9e36');
            targets.push({ x, y: offset + 79, w: 70, h: 43, act: () => this.move(delta) });
        });
        list.slice(start, start + 5).forEach((o, row) => {
            const i = start + row, y = offset + 124 + row * 53, selected = o[0] === this.settings.get(item.key);
            if (i === this.choice) cv.gradientRect(78, y, 1460, 49, [[0, '#30131a'], [1, '#090b0e']]);
            cv.line(84, y + 50, 1536, y + 50, 0.6, '#292d34');
            cv.text(o[1], 100, y + 33, 25, '#f4f6fa');
            if (selected) cv.text('Selected', 1500, y + 33, 22, '#ff9e36', { align: 'right' });
            targets.push({ x: 78, y, w: 1460, h: 50, act: () => this.choose(i) });
        });
        cv.text('Cancel', 1450, 492, 24, '#b2c2d4', { align: 'right' });
        targets.push({ x: 1300, y: 460, w: 250, h: 48, act: () => { this.open = null; this.changed(); } });
    }
}
module.exports = { SettingsPage, GROUPS, TABS, WARNING, options, W, H };
