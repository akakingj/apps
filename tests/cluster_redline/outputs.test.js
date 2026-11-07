'use strict';
const assert=require('assert'),{EventEmitter}=require('events');
const {Outputs}=require('../../apps/cluster_redline/outputs');
class Client extends EventEmitter {
    constructor(){super();this.ready=true;this.targets='map:1088x480,hud:800x480';this.next=0;this.active=new Map();this.events=[];}
    image(o){const ref=++this.next;this.active.set(ref,Object.assign({},o));this.events.push(['image',ref,o]);return ref;}
    pixels(ref,rects,pixels){this.events.push(['pixels',ref,pixels.length]);}
    showWhenSent(ref){assert(this.events.some(e=>e[0]==='pixels'&&e[1]===ref));this.events.push(['show',ref]);}
    set(ref,o){Object.assign(this.active.get(ref),o);this.events.push(['set',ref,o]);}
    drop(ref){this.active.delete(ref);this.events.push(['drop',ref]);}close(){this.ready=false;}
}
const cluster={W:1088,H:480,draw:()=>({d:Buffer.alloc(64)}),difference:()=>({rects:[],pixels:Buffer.alloc(0)})};
const hud=Object.assign({},cluster,{W:800,H:353});
const client=new Client(),out=new Outputs(client,cluster,hud);
const sample=(t,rpm=5000,mode=1)=>{out.policy.modeSample(mode,t-1000);out.policy.rpmSample(rpm,t);};
sample(1000);let s=out.tick(1000,{sportHudOutput:'redline'});
assert(s.outputs.cluster.requested&&s.outputs.hud.requested);assert.strictEqual(client.active.size,2);
const mapRef=out.cluster.ref,hudRef=out.hud.ref;
assert.strictEqual(client.active.get(hudRef).contend,false);assert.strictEqual(client.active.get(hudRef).exclusive,false);assert.strictEqual(client.active.get(hudRef).guide_hold,false);
assert.strictEqual(client.events.filter(e=>e[0]==='pixels').length,1,'a shared initial-frame allowance must pace both outputs');
out.tick(1250,{sportHudOutput:'redline'});assert.strictEqual(client.events.filter(e=>e[0]==='pixels').length,2);
assert.strictEqual(out.upload.sent,128);
out.tick(1300,{sportHudOutput:'stock'});assert(!client.active.has(hudRef));assert(client.active.has(mapRef));assert.strictEqual(out.upload.sent,128,'hiding the stock output must not reset the sibling upload allowance');
const images=client.next;
out.tick(1400,{clusterOffsetX:30,clusterOffsetY:10,clusterWidthScale:75,clusterHeightScale:70});
assert.strictEqual(client.next,images,'live position/size changes must update, not recreate, the native layer');
assert(client.events.some(e=>e[0]==='set'&&e[2].w===816));
sample(1600);out.tick(1600,{sportClusterOutput:'stock',sportHudOutput:'redline'});assert(!client.active.has(mapRef));assert.strictEqual(client.active.size,1);
out.tick(1700,{sportClusterOutput:'stock',sportHudOutput:'stock'});assert.strictEqual(client.active.size,0);
sample(2000,5000,7);s=out.tick(2000,{displayMode:'all',allClusterOutput:'stock',allHudOutput:'redline',sportHudOutput:'stock'});assert(s.outputs.hud.requested&&!s.outputs.cluster.requested,'all-mode and sport choices are independent');
out.tick(2050,{appEnabled:false});assert.strictEqual(client.active.size,0);
sample(3000,5600);s=out.tick(3000,{sportHudOutput:'redline'});assert(s.outputs.hud.shift);assert.strictEqual(s.outputs.hud.flash,true);
s=out.tick(3250,{sportHudOutput:'redline'});assert.strictEqual(s.outputs.hud.flash,false);
sample(3300,5600,4);out.tick(3300,{sportHudOutput:'redline'});assert.strictEqual(client.active.size,0,'Sport exit drops both outputs');
sample(5000);out.tick(5000,{sportHudOutput:'redline'});out.tick(7000,{sportHudOutput:'redline'});assert.strictEqual(client.active.size,0,'stale signals release both outputs');
out.hudBlocked=true;sample(8000);out.tick(8000,{sportHudOutput:'redline'});
sample(10000);s=out.tick(10000,{sportHudOutput:'redline'});
assert(s.outputs.cluster.requested&&!s.outputs.hud.requested);assert.strictEqual(s.outputs.hud.reason,'hud_safety','unsafe native HUD configuration must not block cluster or factory guidance');
out.close();assert.strictEqual(client.listenerCount('target'),0);assert.strictEqual(client.listenerCount('ready'),0);
console.log('PASS: independent stock/Redline outputs, both modes, one socket/budget, paced startup, live placement without churn, blinking and complete release');
