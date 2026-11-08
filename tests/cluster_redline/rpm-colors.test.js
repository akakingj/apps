'use strict';
const assert=require('assert'),p=require('../../apps/cluster_redline/rpm-colors'),{settings}=require('../../apps/cluster_redline/policy');
const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
for(const engineProfile of ['petrol','diesel','hybrid','m']){
 const cfg=settings({engineProfile}),blue=rgb(p.colorAt(1000,cfg)),purple=rgb(p.colorAt(3500,cfg));
 assert(blue[2]>blue[0]&&blue[2]>blue[1]);assert(purple[0]>purple[1]&&purple[2]>purple[0]);
 assert.strictEqual(p.warmStart(cfg),2500);
 assert.strictEqual(p.colorAt(2500,cfg),'#4aaaff');
 const before=rgb(p.colorAt(2499,cfg)),start=rgb(p.colorAt(2500,cfg)),early=rgb(p.colorAt(2600,cfg));
 assert(start.every((v,i)=>Math.abs(v-before[i])<=1));
 assert(early.every((v,i)=>Math.abs(v-start[i])<=2));assert.strictEqual(p.colorAt(cfg.maxRpm,cfg),p.redColor);
 assert.notStrictEqual(p.colorAt(cfg.redlineRpm,cfg),p.redColor);
 let prev=rgb(p.colorAt(2500,cfg));
 for(let rpm=2550;rpm<=cfg.maxRpm;rpm+=50){const next=rgb(p.colorAt(rpm,cfg));assert(next.every((v,i)=>Math.abs(v-prev[i])<=10));prev=next;}
}
assert.strictEqual(p.colorAt(7000,settings()),p.redColor);
console.log('PASS: gentle blue-to-purple from2500 through3500, smooth progression to preset maximum, petrol red at7000');
