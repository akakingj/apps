'use strict';
const assert=require('assert'),path=require('path');
const {EventEmitter}=require('events'),{Controller}=require('../../apps/cluster_redline/controller'),{settings}=require('../../apps/cluster_redline/policy');
const stage=path.resolve(process.argv[2]),dir=path.join(stage,'source/javascript'),hud=require(path.join(dir,'hud-draw')),cluster=require(path.join(dir,'draw'));
class Client extends EventEmitter{
 constructor(targets){super();this.targets=targets;this.ready=true;this.next=0;this.made=[];this.active=new Set();}
 image(o){assert.strictEqual(this.active.size,0);this.made.push(o);const n=++this.next;this.active.add(n);return n}
 pixels(){}showWhenSent(){}set(){}drop(n){this.active.delete(n)}close(){}
}
const client=new Client('map:1088x480,panel:1920x720,hud:800x480'),c=new Controller(client,cluster,hud);
c.policy.modeSample(1,0);c.policy.rpmSample(5000,1000);c.gear='1';c.gearMode='M';assert(c.tick(1000).requested);
let state=c.tick(1050,{displayTarget:'hud'}),image=client.made[client.made.length-1];assert(state.requested);assert.strictEqual(state.gear,'M1');
assert.deepStrictEqual([image.target,image.iw,image.ih,image.x,image.y,image.w,image.h],['hud',800,240,100,50,600,180]);
assert.strictEqual(image.contend,false);assert.strictEqual(image.exclusive,false);assert.strictEqual(image.guide_hold,false);assert.strictEqual(image.prewarm,false);
for(const targets of ['map:1088x480','hud:353x203','']){const x=new Controller(new Client(targets),cluster,hud);x.policy.modeSample(1,0);x.policy.rpmSample(4000,1000);assert.strictEqual(x.tick(1000,{displayTarget:'hud'}).reason,'target_unavailable')}
const cfg=settings({displayTarget:'hud'}),base={config:cfg,gear:'M1',rpm:4000,shift:false,flash:false};
const before=hud.draw(base),warn=hud.draw(Object.assign({},base,{rpm:5000})),red=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:true})),dim=hud.draw(Object.assign({},base,{rpm:5500,shift:true,flash:false}));
const px=(cv,x,y)=>Array.from(cv.d.slice((y*hud.W+x)*4,(y*hud.W+x)*4+4));
assert.strictEqual(hud.alertStage(base),'green');assert.strictEqual(hud.alertStage(Object.assign({},base,{rpm:5000})),'yellow');
assert.deepStrictEqual(px(before,85,90),[25,238,103,255]);assert.deepStrictEqual(px(warn,85,90),[255,213,34,255]);
assert.deepStrictEqual(px(red,85,90),[255,42,42,255]);assert.notDeepStrictEqual(px(red,85,90),px(dim,85,90));
assert.deepStrictEqual(px(hud.draw(Object.assign({},base,{rpm:700})),85,40),[0,0,0,255]);
assert.strictEqual(px(before,0,0)[3],0);assert.strictEqual(px(before,790,235)[3],0);
for(const [a,b] of [[before,red],[red,before],[red,dim],[before,hud.draw(Object.assign({},base,{gear:'D10'}))]]){
 const aa=Buffer.from(a.d),bb=Buffer.from(b.d),copy=Buffer.from(aa),d=hud.difference(aa,bb);let off=0;
 for(const r of d.rects)for(let y=r.y;y<r.y+r.h;y++){const n=r.w*4;d.pixels.copy(copy,(y*hud.W+r.x)*4,off,off+n);off+=n;}
 assert(copy.equals(bb));assert.strictEqual(off,d.pixels.length);assert(d.pixels.length<aa.length/2);
}
c.policy.modeSample(4,1100);assert.strictEqual(c.tick(1100,{displayTarget:'hud'}).requested,false);assert.strictEqual(client.active.size,0);
console.log('PASS: compact slanted HUD, M1/right-side gear, 5500 threshold, green/yellow/red blink, native-guidance yield flags, exact deltas and release');
