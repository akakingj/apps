'use strict';
const assert = require('assert'), { EventEmitter } = require('events');
const { Controller } = require('../../apps/cluster_redline/controller');
const { mapStatus } = require('../../apps/cluster_redline/output-status');
class Client extends EventEmitter {
    constructor() { super(); this.ready = true; this.targets = 'map:1088x480,panel:1920x720,hud:800x480'; this.images = []; this.drops = []; }
    image(o) { this.images.push(o); return this.images.length; }
    drop(ref) { this.drops.push(ref); } pixels() {} set() {} close() {}
}
const painter = { W:1088, H:480, draw:()=>({d:Buffer.alloc(4)}), difference:()=>({rects:[],pixels:Buffer.alloc(0)}) };
const client = new Client(), c = new Controller(client,painter);
c.policy.modeSample(1,0); c.policy.rpmSample(4000,1000);
let state = c.tick(1000);
assert.strictEqual(state.targetName,'map');
assert.strictEqual(client.images[0].contend,true);
assert.strictEqual(client.images[0].guide_hold,true);
assert.strictEqual(mapStatus(state),'Waiting for map acquisition');
client.emit('target','map','parked','stock','parked behind stock',false);
state=c.tick(1050); assert.strictEqual(mapStatus(state),'Waiting for stock map release');
for(let at=1100;at<9000;at+=50) {
    c.policy.modeSample(1,at); c.policy.rpmSample(4200,at); c.tick(at);
}
assert.strictEqual(client.images.length,1,'stock-map retries belong to the native renderer; never churn the app layer');
client.emit('target','map','shown','us','',false);
state=c.tick(9000); assert.strictEqual(mapStatus(state),'Map slot acquired');
client.emit('target','map','shown','us','',true);
state=c.tick(9010); assert.strictEqual(state.guidanceDisabled,true);
assert.strictEqual(mapStatus(state),'Guidance hide unavailable','guard refusal must not be reported as successful guidance suppression');
c.policy.modeSample(4,9020);state=c.tick(9020);
assert.strictEqual(state.requested,false);assert.strictEqual(client.drops.length,1);
assert.strictEqual(mapStatus(state),null);
assert.strictEqual(mapStatus({targetName:'hud',requested:true,targetState:'shown'}),null,'do not change HUD status behaviour');
assert.strictEqual(mapStatus({targetName:'panel',requested:true,targetState:'shown'}),null);
console.log('PASS: default map contention + guide hold, native retry ownership, truthful acquisition/guard status, and Sport-exit release');
