'use strict';
const assert=require('assert'),path=require('path');
const {EventEmitter}=require('events'),{Controller}=require('../../apps/cluster_redline/controller'),{settings}=require('../../apps/cluster_redline/policy');
const stage=path.resolve(process.argv[2]),dir=path.join(stage,'source/javascript');
const hud=require(path.join(dir,'hud-draw')),cluster=require(path.join(dir,'draw'));
class Client extends EventEmitter {
    constructor(targets){super();this.targets=targets;this.ready=true;this.next=0;this.made=[];this.active=new Set();}
    image(o){assert.strictEqual(this.active.size,0);this.made.push(o);const n=++this.next;this.active.add(n);return n;}
    pixels(){}showWhenSent(){}set(){}drop(n){this.active.delete(n);}close(){}
}
const client=new Client('map:1088x480,panel:1920x720,hud:800x480'),c=new Controller(client,cluster,hud);
c.policy.modeSample(1,0);c.policy.rpmSample(5000,1000);c.gear='1';c.gearMode='M';assert(c.tick(1000).requested);
let state=c.tick(1050,{displayTarget:'hud'}),image=client.made[client.made.length-1];assert(state.requested);assert.strictEqual(state.gear,'M1');
assert.deepStrictEqual([image.target,image.iw,image.ih,image.x,image.y,image.w,image.h],['hud',800,353,100,8,600,265]);
assert.strictEqual(image.contend,false);assert.strictEqual(image.exclusive,false);assert.strictEqual(image.guide_hold,false);assert.strictEqual(image.prewarm,false);
for(const targets of ['map:1088x480','hud:353x203','']) {
    const x=new Controller(new Client(targets),cluster,hud);x.policy.modeSample(1,0);x.policy.rpmSample(4000,1000);
    assert.strictEqual(x.tick(1000,{displayTarget:'hud'}).reason,'target_unavailable');
}
const base={config:settings(),gear:'M1',rpm:4000,shift:false,flash:false,torqueNm:380,powerPS:216,torquePeak:410,powerPeak:250};
function parity(value) {
    const a=cluster.draw(value),b=hud.draw(value),expected=Buffer.alloc(hud.W*hud.H*4);
    const scale=Math.min(hud.W/a.w,hud.H/a.h),fw=Math.round(a.w*scale),fh=Math.round(a.h*scale);
    const ox=Math.round((hud.W-fw)/2),oy=Math.round((hud.H-fh)/2);
    for(let y=0;y<fh;y++)for(let x=0;x<fw;x++) {
        const sx=Math.min(a.w-1,Math.floor((x+0.5)*a.w/fw));
        const sy=Math.min(a.h-1,Math.floor((y+0.5)*a.h/fh));
        expected.set(a.d.slice((sy*a.w+sx)*4,(sy*a.w+sx)*4+4),((y+oy)*hud.W+x+ox)*4);
    }
    assert(Buffer.from(b.d).equals(expected),'HUD pixels must retain the shared cluster layout, color and alpha');
    return b;
}
const before=parity(base),frames=[before];
for(const engineProfile of ['petrol','diesel','hybrid','m']) {
    const cfg=settings({engineProfile});
    for(const rpm of [0,700,3500,cfg.shiftRpm,cfg.redlineRpm,cfg.maxRpm])
        frames.push(parity(Object.assign({},base,{config:cfg,rpm,shift:rpm>=cfg.shiftRpm,flash:true})));
}
for(const next of [
    {gear:'D10'},{gear:'P'},{gear:'R'},{gear:'--'},
    {torqueNm:210,torquePeak:450},{powerPS:180,powerPeak:290},{torquePeak:480,powerPeak:295},
    {torqueNm:null,powerPS:null},{config:settings({torqueUnit:'kgfm',powerUnit:'kW'})},
    {rpm:5500,shift:true,flash:false},{rpm:5500,shift:true,flash:true}
])frames.push(parity(Object.assign({},base,next)));
for(const b of frames) {
    const aa=Buffer.from(before.d),bb=Buffer.from(b.d),copy=Buffer.from(aa),d=hud.difference(aa,bb);let off=0;
    assert(d.rects.length<=6);
    for(const r of d.rects){
        assert(r.x>=0&&r.y>=0&&r.x+r.w<=hud.W&&r.y+r.h<=hud.H);
        for(let y=r.y;y<r.y+r.h;y++){const n=r.w*4;d.pixels.copy(copy,(y*hud.W+r.x)*4,off,off+n);off+=n;}
    }
    assert(copy.equals(bb),'frame deltas must also restore erased/transparent pixels');assert.strictEqual(off,d.pixels.length);
    assert(d.pixels.length<aa.length/2,'updates must not become full-canvas traffic');
}
assert.strictEqual(hud.difference(Buffer.from(before.d),Buffer.from(before.d)).rects.length,0);
function px(cv,x,y){return Array.from(cv.d.slice((y*cv.w+x)*4,(y*cv.w+x)*4+4));}
for(const [x,y] of [[0,0],[50,176],[790,346],[400,220]])assert.strictEqual(px(before,x,y)[3],0,'empty space remains transparent');
const lit=parity(Object.assign({},base,{rpm:5000}));
assert.deepStrictEqual(px(hud.draw(Object.assign({},base,{rpm:700})),185,22),[0,0,0,255],'unlit shift LEDs stay pure black');
assert(px(lit,185,22)[1]>100,'cluster green LED is retained');
assert.deepStrictEqual(px(before,200,98).slice(0,3),px(cluster.draw(base),272,133).slice(0,3),'RPM ramp is the cluster ramp, not the former solid green HUD bar');
// An isolated value/peak update does not retransmit the sibling gauge or gear.
for(const [value,left,right] of [[{torqueNm:210,torquePeak:480},0,353],[{powerPS:180,powerPeak:290},447,800]]) {
    const next=hud.draw(Object.assign({},base,value));const d=hud.difference(Buffer.from(before.d),Buffer.from(next.d));
    assert(d.rects.length>0);for(const r of d.rects)assert(r.x>=left&&r.x+r.w<=right&&r.y>=Math.ceil(308*hud.H/cluster.H));
}
assert.deepStrictEqual([hud.layout.faceX,hud.layout.faceY,hud.layout.faceW,hud.layout.faceH],[0,0,800,353]);
assert.strictEqual(hud.draw(base),hud.draw(Object.assign({},base,{flash:true})), 'no flash redraw is needed below the shift threshold');
const flashOn=parity(Object.assign({},base,{rpm:5500,shift:true,flash:true}));
const flashOff=parity(Object.assign({},base,{rpm:5500,shift:true,flash:false}));
assert.notStrictEqual(flashOn,flashOff,'the active shift phase belongs to the cached face key');
const bright=px(flashOn,185,22),dim=px(flashOff,185,22);
assert(bright[0]>220&&bright[1]<80&&bright[2]<80,'shift LEDs flash red on both displays');
assert(dim[0]<bright[0]&&dim[1]<80,'the other phase dims the red LEDs');
const blinkDelta=hud.difference(Buffer.from(flashOn.d),Buffer.from(flashOff.d));
assert.strictEqual(blinkDelta.rects.length,1);
assert(blinkDelta.rects[0].y+blinkDelta.rects[0].h<=Math.ceil(90*hud.H/cluster.H),'only the shared alert strip changes phase');
const rpmStart=Math.ceil(205*hud.H/cluster.H)*hud.W*4,rpmEnd=Math.ceil(308*hud.H/cluster.H)*hud.W*4;
assert(Buffer.from(flashOn.d).slice(rpmStart,rpmEnd).equals(Buffer.from(flashOff.d).slice(rpmStart,rpmEnd)),'RPM digits stay steadily red through the blink');
const restored=Buffer.from(flashOn.d);let cursor=0;
for(const rect of blinkDelta.rects)for(let y=rect.y;y<rect.y+rect.h;y++){const bytes=rect.w*4;blinkDelta.pixels.copy(restored,(y*hud.W+rect.x)*4,cursor,cursor+bytes);cursor+=bytes;}
assert(restored.equals(Buffer.from(flashOff.d)),'blink delta reconstructs the exact other phase');
assert.strictEqual(hud.layout.gearX,hud.W/2);assert(hud.layout.gearY>hud.layout.baseline);
c.policy.modeSample(4,1100);assert.strictEqual(c.tick(1100,{displayTarget:'hud'}).requested,false);assert.strictEqual(client.active.size,0);
console.log('PASS: HUD shares cluster face/colors/logos/gear arrangement for every preset and units, preserves placement/alpha, exact bounded metric deltas and native guidance yield');
