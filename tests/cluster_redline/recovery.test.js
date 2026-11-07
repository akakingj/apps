'use strict';
const assert = require('assert'), { EventEmitter } = require('events');
const { Controller } = require('../../apps/cluster_redline/controller');
class Client extends EventEmitter {
    constructor() { super(); this.ready = true; this.targets = 'map:1088x480'; this.next = 0; this.images = []; this.drops = []; this.writes = []; }
    image(options) { const ref = ++this.next; this.images.push({ref,options}); return ref; }
    pixels(ref) { this.writes.push(ref); } set() {} showWhenSent() {} drop(ref) { this.drops.push(ref); } close() {}
}
const painter = { W: 4, H: 4, draw: () => ({ d: Buffer.alloc(64) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
function fixture() {
    const client = new Client(), c = new Controller(client, painter);
    c.policy.modeSample(1, 0);
    function tick(at, raw) { if (at-c.policy.modeAt>3500) c.policy.modeSample(1,at-1000); c.policy.modeSample(1,at); c.policy.rpmSample(4000,at); return c.tick(at, raw); }
    tick(1000); return {client,c,tick};
}
// Before this fix, a single real server "no such layer" answer set a sticky
// refused bit forever, even after native ownership and live input recovered.
{
    const {client,c,tick} = fixture(); const first=c.ref;
    client.emit('refused','frame',first,'no such layer');
    let s=tick(1100); assert(!s.requested); assert.strictEqual(s.reason,'renderer_recovering');
    assert.strictEqual(s.recovery.op,'frame'); assert.strictEqual(s.recovery.reason,'no such layer');
    tick(2999); assert.strictEqual(client.images.length,1);
    s=tick(3000); assert(s.requested); assert(c.ref!==first); assert.strictEqual(client.writes.length,2,'a recovered image starts with a complete frame');
    client.emit('refused','frame',first,'no such layer'); assert(!c.refused,'an old ref cannot stop the recovered output');
    client.emit('refused','drop',c.ref,'no such layer'); assert(!c.refused,'drop acknowledgements cannot stop output');
    client.emit('layer',c.ref,'shown','');
    tick(32999); assert(c.failure); tick(33000); assert.strictEqual(c.failure,null,'reset backoff only after a stable shown period');
}
// The native compositor reports image GPU attachment failures through layer
// state, not a protocol error. Previously that dead image remained cached.
{
    const {client,c,tick}=fixture();
    client.emit('layer',c.ref,'error','image buffer or quad refused');
    assert(c.refused); assert.strictEqual(c.failure.op,'layer-state');
    tick(3000); assert.strictEqual(client.images.length,2);
}
// No new acquisition while another display owns the slot. Slot ownership is
// global and must survive our ref being dropped, including repeated hide().
{
    const {client,c,tick}=fixture();
    client.emit('target','map','parked','stock','parked behind stock',false);
    client.emit('refused','set',c.ref,'no such layer');
    tick(3000); tick(9000); assert.strictEqual(client.images.length,1);
    assert.strictEqual(c.targetStates.map.holder,'stock');
    client.emit('target','map','waiting','foreign','slot in use',false);
    tick(15000); assert.strictEqual(client.images.length,1);
    client.emit('target','map','idle','none','',false);
    assert(tick(15050).requested); assert.strictEqual(client.images.length,2);
}
// Temporary resource errors get at most three spaced retries, rather than an
// endless retry loop that repeatedly requests native content or allocates RAM.
for (const why of ['too many layers', "the service's pixel memory is full"]) {
    const {client,c,tick}=fixture();
    client.emit('refused','layer',c.ref,why);
    for (const at of [3000,8000,18000]) {
        const before=client.images.length;tick(at-1);assert.strictEqual(client.images.length,before);
        tick(at);assert.strictEqual(client.images.length,before+1);
        client.emit('refused','layer',c.ref,why);
    }
    const s=tick(100000); assert.strictEqual(client.images.length,4); assert.strictEqual(s.reason,'renderer_refused');
    assert.strictEqual(s.recovery.state,'failed'); assert.strictEqual(s.recovery.exhausted,true);
}
for (const [op,why] of [['frame','rectangle outside the image'],['layer','unknown target map'],['layer','not supported'],['layer-state','guard disabled']]) {
    const {client,c,tick}=fixture();
    if(op==='layer-state') client.emit('layer',c.ref,'error',why);else client.emit('refused',op,c.ref,why);
    const s=tick(100000); assert.strictEqual(client.images.length,1);assert.strictEqual(s.recovery.retryable,false);
}
// Normal Assist/foreign/native acquisition states are not faults, so this
// recovery cannot turn native parked/backoff waits into app-layer churn.
{
    const {client,c,tick}=fixture();
    let at=1000;
    for(const [state,holder] of [['parked','stock'],['waiting','foreign'],['waiting','none']]) {
        client.emit('target','map',state,holder,'slot in use',false);
        client.emit('layer',c.ref,'waiting','target '+state);
        for(let n=0;n<200;n++)tick(at+=50);
    }
    assert.strictEqual(client.images.length,1);assert.strictEqual(c.failure,null);
}

// Retry clocks do not bypass the normal fresh-RPM gate.
{
    const {client,c,tick}=fixture();
    client.emit('refused','frame',c.ref,'no such layer');
    c.tick(4000); assert.strictEqual(client.images.length,1);
    assert(tick(5000).requested); assert.strictEqual(client.images.length,2);
}
console.log('PASS: recoverable server/attachment failures rebuild once on bounded backoff, ownership/freshness gating, permanent rejection stop, late-ref immunity and no native-wait churn');
