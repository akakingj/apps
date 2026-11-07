'use strict';
const { t } = require('./kit/i18n');
const G = require('./kit/gauges');
const { header } = require('./settings-chrome');
const { settings: effective, PROFILES } = require('./policy');
const { placement } = require('./layout');
const HUD = require('./hud-draw');
const W = 1600, H = 520;
const TABS = ['Basic settings', 'Advanced settings'];
const GROUPS = [
    ['appEnabled', 'engineProfile', 'powerUnit', 'torqueUnit', 'shiftRpm'],
    ['displayMode', 'sportHudOutput', 'sportClusterOutput', 'layout'],
];
const WARNING = 'Set Instrument cluster > Central display area to Off for correct operation.';
const MAP_WARNING = 'Set Central display area to Map view or Off. Assist or route preview may cover the widget.';
const RENDERER_NOTICE = 'Install Cluster renderer (cluster-render) from MGU Store first.';
const HUD_WARNING = 'Stock HUD guidance has priority; same-slot content cannot be shown together.';
const STOCK_NOTICE = 'Stock displays selected; Redline does not occupy either display.';
const LAYOUT_ITEM = { key: 'layout', label: 'Position / size', type: 'layout' };
function options(item, cfg) {
    if (item.type === 'bool') return [[false, 'Off'], [true, 'On']];
    if (item.type === 'choice') return item.options;
    const range = PROFILES[cfg.engineProfile] && PROFILES[cfg.engineProfile].ranges[item.key];
    return (item.steps || []).filter((v) => !range || v === 0 || (v >= range[0] && v <= range[1]))
        .map((v) => [v, v === 0 ? 'Preset default' : String(v) + ' ' + (item.unit || '')]);
}
class SettingsPage {
    constructor(settings, changed, version) { this.settings = settings; this.changed = changed || (() => {}); this.version = version; this.tab = 0; this.focus = 0; this.open = null; this.choice = 0; this.layoutTarget = 'cluster'; this.layoutParam = 0; }
    config() {
        const raw = {}; this.settings.schema.forEach((s) => { raw[s.key] = this.settings.get(s.key); });
        return effective(raw);
    }
    keys() {
        if (!this.tab) return GROUPS[0];
        const prefix = this.settings.get('displayMode') === 'all' ? 'all' : 'sport';
        return ['displayMode', prefix+'HudOutput', prefix+'ClusterOutput', 'layout'];
    }
    item() { const key=this.keys()[this.focus]; return key==='layout'?LAYOUT_ITEM:this.settings.schema.find((s) => s.key === key); }
    selectTab(index) { this.tab = index === 1 ? 1 : 0; this.focus = 0; this.open = null; this.changed(); }
    move(delta) {
        if (this.open === 'layout') this.layoutParam = (this.layoutParam + delta + 4) % 4;
        else if (this.open) { const n = options(this.item(), this.config()).length; this.choice = (this.choice + delta + n) % n; }
        else this.focus = (this.focus + delta + this.keys().length) % this.keys().length;
        this.changed();
    }
    value(item, cfg) {
        if (item.key === 'layout') return t('Adjust');
        const value = this.settings.get(item.key), selected = options(item, cfg).find((o) => o[0] === value);
        if (item.key === 'shiftRpm' && value === 0) return String(cfg.shiftRpm) + ' rpm (' + t('Preset default') + ')';
        return selected ? t(selected[1]) : t('Check required');
    }
    change(delta) {
        if (this.open === 'layout') { this.adjust(this.layoutParam, delta); return; }
        const item = this.item(), list = options(item, this.config());
        if (item.key === 'layout') { this.open='layout';this.changed();return; }
        const at = list.findIndex((o) => o[0] === this.settings.get(item.key));
        this.settings.set(item.key, list[(at + delta + list.length) % list.length][0]);
        this.open = null; this.changed();
    }
    activate(index) {
        if (index !== undefined) this.focus = index;
        const item = this.item();
        if (item.key === 'layout') { this.open='layout';this.changed();return; }
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
        if (this.open === 'layout') this.drawLayout(cv, cfg, targets);
        else if (this.open) this.drawChoices(cv, cfg, targets);
        else {
            let y = 100;
            this.keys().forEach((key, i) => {
                const item = key==='layout'?LAYOUT_ITEM:this.settings.schema.find((s) => s.key === key);
                const h = key === 'appEnabled' ? 116 : this.tab === 1 ? 74 : 66;
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
                    const prefix=cfg.displayMode==='all'?'all':'sport';
                    const warning = cfg[prefix+'HudOutput']==='redline' ? HUD_WARNING : cfg[prefix+'ClusterOutput']==='redline' ? MAP_WARNING : STOCK_NOTICE;
                    cv.text(RENDERER_NOTICE, 100, y + 73, fit(RENDERER_NOTICE, 24, 1400), '#ff9e36');
                    cv.text(warning, 100, y + 102, fit(warning, 24, 1400), '#ff9e36');
                }
                cv.line(84, y + h - 1, 1536, y + h - 1, 0.6, '#292d34');
                targets.push({ x: 78, y, w: 1460, h: h - 1, act: () => this.activate(i) });
                y += h;
            });
            if (this.tab === 0) cv.text('Presets set gauge scales; eDrive shows engine output only, not combined output.', 84, 510, 22, '#8b98aa');
            else {
                cv.text('Status', 84, 430, 26, '#7f8b9d');
                if (Array.isArray(status)) status.forEach((line,i)=>cv.text(line,84,457+i*28,fit(line,24,1450),'#bdc9d8'));
                else cv.text(status || 'Waiting for background app', 84, 470, fit(status || 'Waiting for background app',30,1450), '#bdc9d8');
                cv.text('Fixed 20 fps request limit; actual output depends on the car.', 84, 510, 22, '#8b98aa');
            }
        }
        cv.targets = targets.map((target, i) => Object.assign({ key: this.tab + ':' + (this.open || 'rows') + ':' + i, run: target.act }, target));
        return cv;
    }
    adjust(param, delta) {
        this.layoutParam=param;
        const cfg=this.config(),name=this.layoutTarget,suffix=['OffsetX','OffsetY','WidthScale','HeightScale'][param];
        const shape={W:name==='hud'?HUD.W:1088,H:name==='hud'?HUD.H:480},r=placement(cfg,name==='hud'?'hud':'map',shape);
        const key=name+suffix,step=param<2?10:5;
        const min=param===0?r.minX:param===1?r.minY:20,max=param===0?r.maxX:param===1?r.maxY:param===3&&name==='hud'?150:100;
        this.settings.set(key,Math.max(min,Math.min(max,cfg[key]+delta*step)));
        this.changed();
    }
    drawLayout(cv,cfg,targets) {
        const button=(label,x,y,w,h,act,on)=>{
            cv.roundRect(x,y,w,h,8,on?'#57202d':'#252a31');
            if (['↑','←','→','↓'].indexOf(label)>=0) {
                const cx=x+w/2,cy=y+h/2,points=label==='↑'?[[cx-16,cy+8],[cx,cy-10],[cx+16,cy+8]]:label==='↓'?[[cx-16,cy-8],[cx,cy+10],[cx+16,cy-8]]:label==='←'?[[cx+8,cy-16],[cx-10,cy],[cx+8,cy+16]]:[[cx-8,cy-16],[cx+10,cy],[cx-8,cy+16]];
                cv.polyline(points,4,'#f3f5f7');
            } else if (label==='−' || label==='+') {
                cv.line(x+w/2-18,y+h/2,x+w/2+18,y+h/2,3,'#f3f5f7');
                if(label==='+')cv.line(x+w/2,y+h/2-18,x+w/2,y+h/2+18,3,'#f3f5f7');
            } else cv.text(label,x+w/2,y+h/2+11,30,'#f3f5f7',{align:'center'});
            targets.push({x,y,w,h,act});
        };
        ['cluster','hud'].forEach((name,i)=>button(name==='hud'?'HUD':'Cluster',84+i*260,110,240,64,()=>{this.layoutTarget=name;this.changed();},this.layoutTarget===name));
        button('Back',1260,110,276,64,()=>{this.open=null;this.changed();});
        cv.text('Position',100,208,28,'#b8c5d4');
        button('↑',320,218,100,72,()=>this.adjust(1,-1),this.layoutParam===1);
        button('←',200,302,100,72,()=>this.adjust(0,-1),this.layoutParam===0);
        button('→',440,302,100,72,()=>this.adjust(0,1),this.layoutParam===0);
        button('↓',320,386,100,72,()=>this.adjust(1,1),this.layoutParam===1);
        ['Gauge width','Gauge height'].forEach((label,i)=>{
            const y=226+i*140,key=this.layoutTarget+(i?'HeightScale':'WidthScale');
            cv.text(label,800,y,30,'#b8c5d4');
            button('−',1020,y+18,100,72,()=>this.adjust(i+2,-1),this.layoutParam===i+2);
            button('+',1140,y+18,100,72,()=>this.adjust(i+2,1),this.layoutParam===i+2);
            cv.text(String(cfg[key])+' %',1500,y+67,34,'#ffffff',{align:'right',font:'num'});
        });
        const shape={W:this.layoutTarget==='hud'?HUD.W:1088,H:this.layoutTarget==='hud'?HUD.H:480};
        const r=placement(cfg,this.layoutTarget==='hud'?'hud':'map',shape);
        cv.text(t('Coordinates')+': X '+r.x+' · Y '+r.y+' · '+r.w+' × '+r.h,84,503,24,'#ffad45',{literal:true});
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
module.exports = { SettingsPage, GROUPS, TABS, WARNING, MAP_WARNING, HUD_WARNING, RENDERER_NOTICE, options, W, H };
