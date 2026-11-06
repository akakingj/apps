'use strict';
const { t } = require('./kit/i18n');
const G = require('./kit/gauges');
const { header } = require('./settings-chrome');
const { settings: effective, PROFILES } = require('./policy');
const W = 1600, H = 520;
const TABS = ['Basic settings', 'Advanced settings'];
const GROUPS = [
    ['appEnabled', 'engineProfile', 'displayMode', 'powerUnit', 'torqueUnit'],
    ['shiftRpm', 'displayTarget', 'widgetScale'],
];
const WARNING = 'Set Instrument cluster > Central display area to Off for correct operation.';
const MAP_WARNING = 'Set Central display area to Map view or Off. Assist or route preview may cover the widget.';
const RENDERER_NOTICE = 'Install Cluster renderer (cluster-render) from MGU Store first.';
function options(item, cfg) {
    if (item.type === 'bool') return [[false, 'Off'], [true, 'On']];
    if (item.type === 'choice') return item.options;
    const range = PROFILES[cfg.engineProfile] && PROFILES[cfg.engineProfile].ranges[item.key];
    return (item.steps || []).filter((v) => !range || v === 0 || (v >= range[0] && v <= range[1]))
        .map((v) => [v, v === 0 ? 'Preset default' : String(v) + ' ' + (item.unit || '')]);
}
class SettingsPage {
    constructor(settings, changed, version) { this.settings = settings; this.changed = changed || (() => {}); this.version = version; this.tab = 0; this.focus = 0; this.open = null; this.choice = 0; }
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
        const full = !!cv.chrome;
        const fit = (value, size, width) => { while (size > 20 && cv.textWidth(t(value), size) > width) size--; return size; };
        const badges = this.version ? [{ text: 'v' + this.version, color: '#8d97a4' }] : [];
        if (cv.chrome) G.frame(cv, theme, TABS, this.tab, badges);
        else {
            header(cv, theme, 0, 0, W, 80, 'Cluster Redline', TABS, this.tab, badges, true, false);
            (cv.tabRects || []).forEach((r) => targets.push(Object.assign({}, r, { act: () => this.selectTab(r.i) })));
        }
        const marker = full ? 45 : 88;
        ['#39bffa', '#1757ad', '#f32d45'].forEach((color, i) => cv.fillRect(64 + i * 23, marker, 21, 4, color));
        cv.line(134, marker + 2, 1536, marker + 2, 1, '#8b919a');
        if (full) {
            cv.text(TABS[this.tab], 84, 83, 34, '#f3f5f7', { font: 'bold' });
            cv.line(84, 95, 1536, 95, 1, '#71303a');
        }
        if (this.open) this.drawChoices(cv, cfg, targets);
        else {
            let y = 100;
            this.keys().forEach((key, i) => {
                const item = this.settings.schema.find((s) => s.key === key);
                const h = key === 'appEnabled' ? 116 : this.tab === 1 ? 88 : 66;
                const on = i === this.focus;
                if (on) {
                    cv.gradientRect(78, y, 1460, h - 1, [[0, '#291217'], [1, theme.bg]]);
                    cv.fillRect(78, y + 7, 4, 48, '#ef3046');
                }
                const baseline = y + (key === 'appEnabled' ? 40 : h / 2 + 12);
                cv.text(item.label, 100, baseline, 34, '#f1f4fa');
                cv.text(this.value(item, cfg), 1482, baseline, 34, '#c1cddd', { align: 'right' });
                if (item.type !== 'bool') cv.polyline([[1514, y + h / 2 - 12], [1527, y + h / 2], [1514, y + h / 2 + 12]], 3, '#909cac');
                if (key === 'appEnabled') {
                    const warning = cfg.displayTarget === 'map' ? MAP_WARNING : WARNING;
                    cv.text(RENDERER_NOTICE, 100, y + 73, fit(RENDERER_NOTICE, 24, 1400), '#ff9e36');
                    cv.text(warning, 100, y + 102, fit(warning, 24, 1400), '#ff9e36');
                }
                cv.line(84, y + h - 1, 1536, y + h - 1, 0.6, '#292d34');
                targets.push({ x: 78, y, w: 1460, h: h - 1, act: () => this.activate(i) });
                y += h;
            });
            if (this.tab === 0) cv.text('Presets set gauge scales; eDrive shows engine output only, not combined output.', 84, 510, 22, '#8b98aa');
            else {
                cv.text('Status', 84, 408, 26, '#7f8b9d');
                cv.text(status || 'Waiting for background app', 84, 449, 30, '#bdc9d8');
                cv.text('Fixed 20 fps request limit; actual output depends on the car.', 84, 510, 22, '#8b98aa');
            }
        }
        cv.targets = targets.map((target, i) => Object.assign({ key: this.tab + ':' + (this.open || 'rows') + ':' + i, run: target.act }, target));
        return cv;
    }
    drawChoices(cv, cfg, targets) {
        const item = this.item(), list = options(item, cfg), start = Math.max(0, Math.min(list.length - 4, this.choice - 1));
        cv.text(item.label, 100, 126, 32, '#ef4050');
        [-1, 1].forEach((delta, i) => {
            const x = 1302 + i * 112;
            cv.roundRect(x, 80, 96, 64, 8, '#252a31');
            cv.line(x + 30, 112, x + 66, 112, 3, '#ff9e36');
            if (delta > 0) cv.line(x + 48, 94, x + 48, 130, 3, '#ff9e36');
            targets.push({ x, y: 80, w: 96, h: 64, act: () => this.move(delta) });
        });
        list.slice(start, start + 4).forEach((o, row) => {
            const i = start + row, y = 148 + row * 72, selected = o[0] === this.settings.get(item.key);
            if (i === this.choice) cv.gradientRect(78, y, 1460, 70, [[0, '#30131a'], [1, '#090b0e']]);
            cv.line(84, y + 71, 1536, y + 71, 0.6, '#292d34');
            cv.text(o[1], 100, y + 46, 34, '#f4f6fa');
            if (selected) cv.text('Selected', 1500, y + 46, 26, '#ff9e36', { align: 'right' });
            targets.push({ x: 78, y, w: 1460, h: 70, act: () => this.choose(i) });
        });
        cv.roundRect(1210, 448, 326, 64, 8, '#252a31');
        cv.text('Cancel', 1373, 492, 32, '#b2c2d4', { align: 'center' });
        targets.push({ x: 1210, y: 448, w: 326, h: 64, act: () => { this.open = null; this.changed(); } });
    }
}
module.exports = { SettingsPage, GROUPS, TABS, WARNING, MAP_WARNING, RENDERER_NOTICE, options, W, H };
