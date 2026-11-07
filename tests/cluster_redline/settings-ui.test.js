'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const stage=path.resolve(process.argv[2]),dir=path.join(stage,'source/javascript');
const {SettingsPage,MAP_WARNING,HUD_WARNING,RENDERER_NOTICE}=require(path.join(dir,'settings-ui'));
const {Canvas}=require(path.join(dir,'kit/canvas')),{t}=require(path.join(dir,'kit/i18n'));
const spec=JSON.parse(fs.readFileSync(path.join(dir,'kit/app-spec.json'))),values={};spec.settings.forEach(s=>values[s.key]=s.default);
const saved={schema:spec.settings,get:k=>values[k],set:(k,v)=>values[k]=v},page=new SettingsPage(saved,null,spec.version);
const labels=[],original=Canvas.prototype.text;
Canvas.prototype.text=function(value,x,y,size,color){labels.push({value:t(value),x,y,size,color});return original.apply(this,arguments)};
try{
 let cv=page.draw(new Canvas(1600,520));assert.strictEqual(cv.targets.length,7);
 assert(labels.some(l=>l.value===t(MAP_WARNING)&&l.color==='#ff9e36'));
 assert(labels.some(l=>l.value===t(RENDERER_NOTICE)&&l.color==='#ff9e36'));
 assert(labels.some(l=>l.value.includes('5500')));assert.deepStrictEqual(page.keys(),['appEnabled','engineProfile','powerUnit','torqueUnit','shiftRpm']);
 page.selectTab(1);assert.deepStrictEqual(page.keys(),['displayMode','sportHudOutput','sportClusterOutput','layout']);
 page.activate(1);page.choose(0);assert.strictEqual(values.sportHudOutput,'redline');
 page.activate(0);page.choose(1);assert.strictEqual(values.displayMode,'all');assert.strictEqual(page.keys()[1],'allHudOutput');
 assert.strictEqual(values.allHudOutput,'stock');
 page.selectTab(0);values.displayMode='sport';page.draw(new Canvas(1600,520));assert(labels.some(l=>l.value===t(HUD_WARNING)));
 page.selectTab(1);page.activate(3);cv=page.draw(new Canvas(1600,520));assert.strictEqual(page.open,'layout');
 for(const r of cv.targets){assert(r.x>=0&&r.y>=0&&r.x+r.w<=1600&&r.y+r.h<=520);assert(r.h>=64)}
 page.layoutTarget='hud';for(let n=0;n<80;n++)page.adjust(0,1);
 const shape=require(path.join(dir,'layout')).placement(page.config(),'hud',require(path.join(dir,'hud-draw')));assert(shape.x>=0&&shape.x+shape.w<=800);
 const full=new Canvas(1600,520);full.chrome={};page.draw(full);assert.strictEqual(full.chrome.tabs.tabs.length,2);
 if(JSON.parse(fs.readFileSync(path.join(dir,'kit/locale.json'))).language==='ko'){
  const atlas=JSON.parse(fs.readFileSync(path.join(dir,'kit/fonts/korean.json'))).sizes[0].glyphs;
  for(const label of labels)for(const ch of label.value)if(/[가-힣]/.test(ch))assert(atlas[ch.charCodeAt(0)],'missing glyph '+ch);
  for(const text of ['Stock display','Position / size','HUD display'])assert.notStrictEqual(t(text),text);
 }
 console.log('PASS: requested basic/advanced groups, 5500 default, independent mode choices, large layout controls, bounds and bilingual glyphs');
}finally{Canvas.prototype.text=original}
