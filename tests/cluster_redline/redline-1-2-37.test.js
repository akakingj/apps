'use strict';
// 1.2.37: the Korean watermark with a kit whose fonts module has no has() (the Store runtime), Redline tiles
// repainted only when what they show changes (same picture as a full repaint), and per-design positions kept
// compact.
// Usage: node redline-1-2-37.test.js <built cluster_redline stage>
const assert=require('assert'),path=require('path'),root=path.join(path.resolve(process.argv[2]),'source/javascript');
const {settings}=require(root+'/policy'),RL=require(root+'/redline-hud'),HUD=require(root+'/hud-compose'),CL=require(root+'/draw');
const {SettingsPage}=require(root+'/settings-ui'),spec=require(root+'/kit/app-spec.json'),{language}=require(root+'/strings');

// 1. Watermark: the Store runtime's kit/fonts exports get() and measure() only.
{
 const fonts=require(root+'/kit/fonts'),has=fonts.has;delete fonts.has;
 try{
  delete require.cache[require.resolve(root+'/settings-bg')];
  const B=require(root+'/settings-bg'),seen=[];
  B.mark({text:v=>{seen.push(v);return 0;},textWidth:()=>100,fillRect:()=>{},drawImage:()=>{}},1600,520);
  if(language()==='ko')assert(seen.some(v=>/잼님/.test(v))&&seen.some(v=>/배움터/.test(v)),'Korean edition keeps the cafe name: '+seen);
  else assert.deepStrictEqual(seen.filter(v=>/[가-힣]/.test(v)),[],'English edition: no Korean words');
 }finally{if(has)fonts.has=has;}
}

// 2. Per-element keys: a cached sweep draws the same picture as drawing each frame from scratch (±1 rounding).
{
 const aux={boost:0.4,outside:18,oil:92,gforce:0.3,gLat:0.2,gLong:0.1};
 for(const [d,P] of [['hud',HUD],['cluster',CL]])for(const st of RL.stylesFor(d)){
  const cfg=settings({[d+'Design']:'rl-'+st,[d+'AuxConfig']:JSON.stringify({mode:'values',items:['outside','oil','boost','torque']})}),cache=P.createCache();
  let i=0;
  for(let rpm=900;rpm<7200;rpm+=410){i++;
   const s=()=>({config:cfg,renderRpm:true,rpm,gear:i%4<2?'D4':'M5',mode:i%6<3?'SPORT':'COMFORT',aux:Object.assign({},aux,{boost:0.2+i/20,oil:90+(i%5)}),torqueNm:200+i*7,powerPS:150,shift:rpm>6000,flash:i%2===0});
   const a=s();Object.defineProperty(a,'renderCache',{value:cache});const cached=Buffer.from(P.draw(a).d),fresh=Buffer.from(P.draw(s()).d);
   let worst=0;for(let k=0;k<cached.length;k++){const v=Math.abs(cached[k]-fresh[k]);if(v>worst)worst=v;}
   assert(worst<=2,d+' '+st+' at '+rpm+' rpm: cached tiles differ from a full draw by '+worst);
  }
 }
}

// 3. Each design's positions: only values changed from the defaults are kept.
{
 const values={};spec.settings.forEach(s=>values[s.key]=s.default);
 const store={schema:spec.settings,get:k=>values[k],set:(k,v)=>values[k]=v,setMany:o=>Object.assign(values,o)},page=new SettingsPage(store,null,'test');page.selectTab(1);
 const sw=n=>store.setMany(page.designSwitch(n));
 RL.stylesFor('hud').forEach(st=>sw('rl-'+st));
 assert(String(values.hudRlLayouts||'').length<10,'untouched designs keep nothing: '+values.hudRlLayouts);
 sw('rl-luxury');values.hudRlGaugeOffsetX=30;sw('rl-sporthud');assert.strictEqual(values.hudRlGaugeOffsetX,0);sw('rl-luxury');assert.strictEqual(values.hudRlGaugeOffsetX,30);
}
console.log('PASS: Korean watermark without fonts.has, per-element Redline tile keys match full draws, compact per-design positions');
