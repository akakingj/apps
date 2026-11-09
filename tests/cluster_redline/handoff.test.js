'use strict';
// Deterministic wire-order tests with real client/controller code and socket backpressure.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const { Controller } = require('../../apps/cluster_redline/controller');
const clientFile = path.resolve(process.argv[2] || path.join(__dirname, '../../apps/cluster_redline/cluster_render_client.js'));
function packet(value) {
    const body = Buffer.from(JSON.stringify(value)), result = Buffer.alloc(body.length + 5);
    result.writeUInt32LE(body.length + 1, 0); result[4] = 0x4a; body.copy(result, 5); return result;
}
function fixture(blockLayer, blockFrame, target = 'map') {
    const sent = [];
    class Socket extends EventEmitter {
        write(bytes) {
            const command = bytes[4] === 0x4a ? JSON.parse(bytes.slice(5).toString('utf8')) : { op: 'frame' };
            sent.push(command);
            if (blockLayer && command.op === 'layer') { blockLayer = false; return false; }
            if (blockFrame && command.op === 'frame') { blockFrame = false; return false; }
            return true;
        }
        destroy() { this.emit('close'); }
    }
    const sock = new Socket(), box = { module: { exports: {} }, Buffer, setTimeout, clearTimeout,
        require: (name) => name === 'net' ? { connect: () => sock } : require(name) };
    vm.runInNewContext(fs.readFileSync(clientFile, 'utf8'), box, { filename: clientFile });
    const client = new box.module.exports.ClusterRender('handoff-test');
    const painter = { W: 4, H: 4, draw: () => ({ d: Buffer.alloc(64) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
    const controller = new Controller(client, painter, painter);
    client.connect(); sock.emit('connect');
    sock.emit('data', packet({ ev: 'hello', backend: 'id7', targets: 'map:1088x480,panel:1920x720,hud:800x480' }));
    function live(now) { controller.policy.modeSample(1, now - 1000); controller.policy.rpmSample(4200, now); }
    function tick(now) { return controller.tick(now, { displayTarget: target }); }
    live(1000);
    return { sent, client, controller, sock, live, tick, ops: () => sent.map((x) => x.op) };
}

const waiting = fixture(true, false);
try {
    waiting.tick(1000);
    assert.deepStrictEqual(waiting.ops(), ['hello', 'layer'], 'first visibility must wait while its frame is queued');
    assert.strictEqual(waiting.sent[1].contend, 1); assert.strictEqual(waiting.sent[1].visible, 0);
    assert.strictEqual(waiting.sent[1].target, 'map');
    assert.strictEqual(waiting.sent[1].guide_hold, 1, 'guide hold must reach the native renderer on the wire');
    waiting.sock.emit('drain');
    assert.deepStrictEqual(waiting.ops(), ['hello', 'layer', 'frame', 'set']);
    assert.strictEqual(waiting.sent[3].visible, 1);
    const ref = waiting.controller.ref;
    waiting.sock.emit('data', packet({ ev: 'target', target: 'map', state: 'parked', holder: 'stock', reason: 'parked behind stock' }));
    for (let now = 2000; now <= 45000; now += 1000) { waiting.live(now); waiting.tick(now); }
    assert.strictEqual(waiting.controller.ref, ref, 'parked acquisition must keep its original layer');
    assert.deepStrictEqual(waiting.ops(), ['hello', 'layer', 'frame', 'set'], 'waiting cannot restart requests or repeatedly show');
    waiting.sock.emit('data', packet({ ev: 'target', target: 'map', state: 'shown', holder: 'us', reason: '' }));
    waiting.sock.emit('data', packet({ ev: 'layer', ref, state: 'shown', reason: '' }));
    waiting.live(46000); const shown = waiting.tick(46000);
    assert.strictEqual(shown.targetState, 'shown'); assert.strictEqual(shown.layerState, 'shown');
    waiting.controller.policy.modeSample(4, 46100); waiting.tick(46100);
    assert.strictEqual(waiting.ops().filter((s) => s === 'drop').length, 1);
} finally { waiting.controller.close(); }

const highWater = fixture(false, true);
try {
    highWater.tick(1000);
    assert.deepStrictEqual(highWater.ops(), ['hello', 'layer', 'frame', 'set'], 'a frame accepted by write(false) still precedes its visibility on the ordered socket');
    highWater.sock.emit('drain');
    assert.strictEqual(highWater.ops().filter((s) => s === 'set').length, 1, 'no repeated show on drain');
} finally { highWater.controller.close(); }

for (const reason of ['comfort', 'stale', 'disconnect']) {
    const cancelled = fixture(true, false);
    try {
        cancelled.tick(1000);
        if (reason === 'comfort') { cancelled.controller.policy.modeSample(4, 1100); cancelled.tick(1100); }
        else if (reason === 'stale') cancelled.tick(4000);
        else cancelled.sock.destroy();
        cancelled.sock.emit('drain');
        assert(!cancelled.ops().includes('frame') && !cancelled.ops().includes('set'), reason + ' must cancel the deferred first show');
        assert.strictEqual(cancelled.client.layers.size, 0);
    } finally { cancelled.controller.close(); }
}
const hud = fixture(true, false, 'hud');
try {
    hud.controller.navigation={visible:true,maneuver:'RIGHT',distanceText:'55 m'};
    hud.tick(1000);const ref=hud.controller.ref;
    assert.strictEqual(hud.sent[1].contend,0,'new HUD does not contend before its frame');
    assert(!hud.sent.some(x=>x.op==='set'&&x.contend===1));
    hud.sock.emit('drain');
    const frame=hud.sent.findIndex(x=>x.op==='frame'),take=hud.sent.findIndex(x=>x.op==='set'&&x.contend===1);
    assert(frame>=0&&take>frame,'guidance contention follows the composed frame on the wire');
    hud.controller.yieldGuidance();hud.controller.navigation={visible:false};hud.live(1300);hud.tick(1300);
    assert.strictEqual(hud.controller.ref,ref);assert(!hud.ops().includes('drop'),'guidance expiry keeps RPM layer');
    assert.strictEqual(hud.client.layers.get(ref).opts.contend,false);
    hud.controller.navigation={visible:true,maneuver:'RIGHT',distanceText:'55 m'};hud.live(1600);hud.tick(1600);
    assert.strictEqual(hud.controller.ref,ref);assert.strictEqual(hud.client.layers.get(ref).opts.contend,true,'identical fresh arrow can regain contention');
} finally {hud.controller.close();}
for(const cancel of ['yield','stop','disconnect']) {
    const blocked=fixture(true,false,'hud');
    try {
        blocked.controller.navigation={visible:true,maneuver:'RIGHT',distanceText:'55 m'};blocked.tick(1000);
        if(cancel==='yield')blocked.controller.yieldGuidance();
        else if(cancel==='stop')blocked.controller.hide();
        else blocked.sock.destroy();
        blocked.sock.emit('drain');
        assert(!blocked.sent.some(x=>x.op==='set'&&x.contend===1),cancel+' cancels delayed HUD contention');
    } finally {blocked.controller.close();}
}
console.log('PASS: frame-before-show under socket backpressure, stable 45s map acquisition, shown handoff, single release and cancelled late shows');
