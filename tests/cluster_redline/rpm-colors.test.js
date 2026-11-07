'use strict';
const assert=require('assert'),p=require('../../apps/cluster_redline/rpm-colors'),{settings}=require('../../apps/cluster_redline/policy');
const rgb=(s)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
for(const engineProfile of ['petrol','diesel','hybrid','m']) {
    const cfg=settings({engineProfile}),low=rgb(p.colorAt(1000,cfg)),light=rgb(p.colorAt(3000,cfg)),purple=rgb(p.colorAt(4000+(cfg.redlineRpm-4000)*0.4,cfg));
    assert(low[2]>low[0]&&low[2]>low[1]);assert(light[0]>low[0]&&light[1]>low[1]);assert(purple[0]>purple[1]&&purple[2]>purple[1]);
    assert.strictEqual(p.warmStart(cfg),4000);assert.strictEqual(p.colorAt(cfg.redlineRpm,cfg),p.redColor);assert.strictEqual(p.colorAt(cfg.maxRpm,cfg),p.redColor);
}
assert(p.warmStart({redlineRpm:4200})<4200);
console.log('PASS: blue/lighter-blue through4k, purple/pink toward each preset redline, maximum/redline boundaries');
