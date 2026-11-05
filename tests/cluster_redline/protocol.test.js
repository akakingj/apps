'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { ClusterRender } = require('../../apps/cluster_redline/cluster_render_client');
const { Controller } = require('../../apps/cluster_redline/controller');
function message(o) {
    const body = Buffer.from(JSON.stringify(o)), b = Buffer.alloc(body.length + 5);
    b.writeUInt32LE(body.length + 1, 0); b[4] = 0x4a; body.copy(b, 5); return b;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-protocol-'));
    const socket = process.platform === 'win32' ? '\\\\.\\pipe\\cluster-redline-test-' + process.pid : path.join(folder, 'render.sock');
    const commands = []; let peer;
    const server = net.createServer((s) => {
        peer = s; let buffer = Buffer.alloc(0);
        s.on('data', (d) => {
            buffer = Buffer.concat([buffer, d]);
            while (buffer.length >= 5 && buffer.length >= buffer.readUInt32LE(0) + 4) {
                const size = buffer.readUInt32LE(0), type = buffer[4], body = buffer.slice(5, size + 4);
                buffer = buffer.slice(size + 4);
                if (type === 0x4a) {
                    const c = JSON.parse(body); commands.push(c);
                    if (c.op === 'hello') s.write(message({ ev: 'hello', proto: 1, backend: 'id7', targets: 'map:1088x480,panel:1920x720,hud:800x480' }));
                } else commands.push({ op: 'frame', type: type, bytes: body.length, ref: body.readUInt32LE(0) });
            }
        });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
    const client = new ClusterRender('cluster-redline-test', socket);
    const painter = { W: 4, H: 4, draw: () => ({ d: Buffer.alloc(64, 255) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
    const controller = new Controller(client, painter);
    try {
        const ready = new Promise((resolve) => client.once('ready', resolve));
        client.connect(); await ready; await sleep(20);
        controller.tick(0); await sleep(20);
        assert.deepStrictEqual(commands.map((x) => x.op), ['hello']);
        controller.policy.modeSample('SPORT_DYNAMIC', 0); controller.policy.rpmSample(6500, 1000);
        controller.tick(1000); await sleep(30);
        assert.deepStrictEqual(commands.map((x) => x.op), ['hello', 'layer', 'frame', 'set']);
        const layer = commands[1]; assert.strictEqual(layer.target, 'panel'); assert.strictEqual(layer.visible, 0);
        assert.strictEqual(layer.guide_hold, 0); assert.strictEqual(layer.prewarm, 0);
        assert.strictEqual(layer.contend, 0); assert.strictEqual(layer.exclusive, 0); assert.strictEqual(layer.z, 100);
        assert.strictEqual(layer.x, 958.5); assert.strictEqual(layer.y, 358.5); // centered 3x3 display of 4x4 fixture
        assert.strictEqual(commands[2].type, 0x46); assert.strictEqual(commands[2].bytes, 14 + 64);
        assert.strictEqual(commands[3].visible, 1);
        for (const rate of [30, 60]) {
            const from = commands.length;
            controller.tick(1000, { frameRate: rate }); await sleep(30);
            assert.deepStrictEqual(commands.slice(from).map((c) => c.op), ['drop', 'layer', 'frame', 'set']);
            assert.strictEqual(commands[from + 1].fps, rate);
        }
        const beforeHide = commands.length;
        controller.policy.modeSample(4, 1100); controller.tick(1100); await sleep(20);
        assert.strictEqual(commands[beforeHide].op, 'drop');
        controller.policy.modeSample(1, 2000); controller.policy.rpmSample(4200, 3000); controller.tick(3000); await sleep(20);
        peer.destroy(); await sleep(30);
        assert.strictEqual(client.layers.size, 0, 'disconnect cannot leave cached visible content');
        console.log('PASS: real protocol handshake, no boot layer, image/frame/visible ordering, normal-mode drop and disconnect cleanup');
    } finally {
        controller.close(); if (peer) peer.destroy(); await new Promise((r) => server.close(r));
        fs.rmSync(folder, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
