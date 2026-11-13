'use strict';
// 1.2.39: tighter dirty rectangles for the renderer, settings normalised once per frame, and an end-to-end
// run (outputs -> controllers -> painters -> a renderer that applies the rectangles) through every design:
// what the renderer shows must always equal a fresh full draw of the frame it was sent.
// Usage: node redline-1-2-39.test.js <built cluster_redline stage>
const assert=require('assert'),path=require('path'),{EventEmitter}=require('events'),root=path.join(path.resolve(process.argv[2]),'source/javascript');
const {dirtyRects}=require(root+'/component-canvas'),{settings,DEFAULTS}=require(root+'/policy'),{Outputs}=require(root+'/outputs');
const ph=require(root+'/hud-compose'),pc=require(root+'/draw'),RL=require(root+'/redline-hud');

// 1. dirtyRects: applying the rectangles to the old frame gives the new one; never more than 12 rectangles.
{
 let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
 for(let t=0;t<60;t++){
  const w=t%2?1088:800,h=480,a=Buffer.alloc(w*h*4);for(let i=0;i<a.length;i+=4)a[i+3]=(i>>6)&255;
  const b=Buffer.from(a),n=1+Math.floor(rnd()*40);
  for(let k=0;k<n;k++){const x=Math.floor(rnd()*w),y=Math.floor(rnd()*h),rw=1+Math.floor(rnd()*120),rh=1+Math.floor(rnd()*60);
   for(let yy=y;yy<Math.min(h,y+rh);yy++)for(let xx=x;xx<Math.min(w,x+rw);xx++)b[(yy*w+xx)*4]=(b[(yy*w+xx)*4]+1+k)&255;}
  const d=dirtyRects(a,b,w,h);assert(d.rects.length<=12,'rect count '+d.rects.length);
  const c=Buffer.from(a);let off=0;
  for(const r of d.rects){assert(r.x>=0&&r.y>=0&&r.x+r.w<=w&&r.y+r.h<=h);for(let y=r.y;y<r.y+r.h;y++){d.pixels.copy(c,(y*w+r.x)*4,off,off+r.w*4);off+=r.w*4;}}
  assert.strictEqual(off,d.pixels.length);assert(c.equals(b),'frame '+t+' rebuilt from its rectangles');
  for(let i=0;i<d.rects.length;i++)for(let j=i+1;j<d.rects.length;j++){const p=d.rects[i],q=d.rects[j];assert(!(p.x<q.x+q.w&&q.x<p.x+p.w&&p.y<q.y+q.h&&q.y<p.y+p.h),'rectangles do not overlap');}
 }
 const z=Buffer.alloc(800*480*4);assert.strictEqual(dirtyRects(z,Buffer.from(z),800,480).rects.length,0);
}

// 2. A normalised copy with the outputs' overrides is the same as normalising it again from scratch.
{
 for(const d of ['own'].concat(RL.STYLES.map(s=>'rl-'+s)))for(const over of [{displayMode:'all',displayTarget:'hud',appEnabled:true},{displayMode:'sport',displayTarget:'map',appEnabled:false}]){
  const norm=settings(Object.assign({},DEFAULTS,{hudDesign:d,clusterDesign:d,shiftRpm:6100})),fast=settings(Object.assign({},norm,over)),slow=settings(JSON.parse(JSON.stringify(Object.assign({},norm,over))));
  assert.strictEqual(JSON.stringify(fast),JSON.stringify(slow),d);
 }
 // any other change to a normalised copy is normalised again (here: uniform element size)
 const n=settings(Object.assign({},DEFAULTS,{hudDesign:'rl-standard'}));
 assert.strictEqual(settings(Object.assign({},n,{hudRlReadWidthScale:150,hudRlReadHeightScale:100})).hudRlReadHeightScale,150);
 assert.strictEqual(settings(Object.assign({},n,{displayTarget:'bogus'})).displayTarget,settings(JSON.parse(JSON.stringify(Object.assign({},n,{displayTarget:'bogus'})))).displayTarget);
}

// 3. End to end through every design, design switches every 2 s, 20 frames/s.
{
 const screens=new Map(),last={};
 class Client extends EventEmitter{constructor(){super();this.ready=true;this.targets='map:1088x480,hud:800x480';this.n=0;}
  image(o){const id=++this.n;screens.set(id,{w:o.iw,h:o.ih,d:Buffer.alloc(o.iw*o.ih*4),target:o.target});return id;}
  pixels(ref,rects,px){const s=screens.get(ref);s.state=last[s.target];if(!rects){px.copy(s.d);return;}let o=0;for(const r of rects)for(let y=r.y;y<r.y+r.h;y++){px.copy(s.d,(y*s.w+r.x)*4,o,o+r.w*4);o+=r.w*4;}}
  showWhenSent(){}set(){}drop(ref){screens.delete(ref);}close(){}}
 const wrap=(p,target)=>Object.assign(Object.create(p),{draw:s=>{last[target]=s;return p.draw(s);}});
 const o=new Outputs(new Client(),wrap(pc,'map'),wrap(ph,'hud'));
 const aux=JSON.stringify({mode:'values',items:['outside','oil','boost','torque']});
 const raw=Object.assign({},DEFAULTS,{sportClusterOutput:'redline',sportHudOutput:'redline',allClusterOutput:'redline',allHudOutput:'redline',hudAuxConfig:aux,clusterAuxConfig:aux});
 // the default design between every layout, so its parts must go when the next one comes
 const hud=[].concat(...RL.stylesFor('hud').map(s=>['own','rl-'+s])),cl=[].concat(...RL.stylesFor('cluster').map(s=>['own','rl-'+s]));
 const steps=Math.max(hud.length,cl.length)*60;let checked=0,hudChecked=0,ownChecked=0;
 for(let i=0;i<steps;i++){const now=1000+i*50,k=Math.floor(i/60);
  raw.hudDesign=hud[k%hud.length];raw.clusterDesign=cl[(k+3)%cl.length];raw.hudAlertStyle=k%3?'circle':'bar';raw.clusterAlertStyle=k%2?'bar':'circle';
  o.policy.modeSample(i%60<50?'SPORT':'COMFORT',now);o.policy.rpmSample(Math.round(4300+2600*Math.sin(i/9)),now);o.gear=i%60<30?'D3':'D4';
  o.aux={boost:0.3+(i%50)/100,oil:90,outside:15,gforce:0.2,gLat:0.1,gLong:0.1};
  o.tick(now,settings(raw));
  if(i%60===49)for(const n of ['cluster','hud']){const c=o[n],s=c.ref&&screens.get(c.ref);if(!s||!s.state)continue;
   const f=(n==='hud'?ph:pc).draw(Object.assign({},s.state)).d;if(n==='hud'&&raw.hudDesign==='own')ownChecked++;let bad=0;
   for(let p=0;p<f.length;p+=4)for(let ch=0;ch<3;ch++)if(Math.abs(f[p+ch]*f[p+3]-s.d[p+ch]*s.d[p+3])/255>8){bad++;break;}
   assert.strictEqual(bad,0,n+' '+raw[n+'Design']+' at step '+i+': the renderer shows '+bad+' pixels unlike the frame it was sent');checked++;if(n==='hud')hudChecked++;}
 }
 assert(checked>25,'checked '+checked);assert(hudChecked>15&&ownChecked>5,'HUD checked '+hudChecked+', default design '+ownChecked);
}
console.log('PASS: dirty rectangles rebuild every frame (<= 12, no overlap), one normalisation per frame, renderer output equals fresh draws through every design');
