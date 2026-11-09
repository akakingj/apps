'use strict';
// Run the real worker, output coordinator and guidance policy. Only transport,
// vehicle bindings, filesystem and monotonic scheduling are replaced.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const { Outputs } = require('../../apps/cluster_redline/outputs');
const policy = require('../../apps/cluster_redline/policy');
const guidance = require('../../apps/cluster_redline/guidance');
const {SOURCES}=require('../../apps/cluster_redline/aux-info');
const {PROJECTED}=require('../../apps/cluster_redline/projection-config');
const {INTERFACE:HUD_GUIDANCE}=require('../../apps/cluster_redline/hud-guidance-config');
const {INTERFACE:ROUTE_EVENTS}=require('../../apps/cluster_redline/route-events-config');
const source = fs.readFileSync(path.join(__dirname, '../../apps/cluster_redline/worker.js'), 'utf8');
const CDS = 'de.bmw.infotainment.vehicle.CDS', FES = 'de.bmw.infotainment.drivingexcitement.FES';
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness(options) {
    const opt = options || {}, files = {}, feeds = {}, subscriptions = {}, watches = [], loads = [], polls = [], events = [];
    const app = new EventEmitter(), proc = new EventEmitter(), lateSubscriptions = [];
    const config = policy.settings({ displayMode: 'all', allClusterOutput: 'redline', allHudOutput: 'redline' });
    const auxReads=[];
    let time = 0, timer = null, client, writeCount = 0, pollThrow = null;
    class FakeClient extends EventEmitter {
        constructor() {
            super(); client = this; this.ready = false; this.backend = 'id7';
            this.targets = 'map:1088x480,hud:800x480'; this.next = 0; this.active = new Map();
        }
        connect() { this.ready = true; events.push(['connect']); this.emit('ready'); }
        image(value) { const ref = ++this.next; this.active.set(ref, value); events.push(['image', ref, value.target]); return ref; }
        pixels(ref) { assert(this.active.has(ref)); events.push(['pixels', ref]); }
        showWhenSent(ref) { assert(this.active.has(ref)); events.push(['visible', ref]); }
        set(ref, value) { assert(this.active.has(ref)); events.push(['set', ref, value]); }
        drop(ref) { assert(this.active.has(ref)); this.active.delete(ref); events.push(['drop', ref]); }
        close() { this.ready = false; events.push(['close']); }
    }
    const painter = { W: 1088, H: 480, draw: () => ({ d: Buffer.alloc(4) }), difference: () => ({ rects: [], pixels: Buffer.alloc(0) }) };
    const box = { module: { exports: {} }, require(name) {
        if (name === 'fs') return {
            readFileSync(file) { assert.strictEqual(file, '/run/cluster-render/status.txt'); return 'backend=id7\n'; },
            writeFileSync(file, value) { files[file] = value; writeCount++; },
            renameSync(from, to) { files[to] = files[from]; delete files[from]; },
        };
        if (name === 'path') return path;
        if (name === './outputs') return { Outputs };
        if (name === './cluster_render_client') return { ClusterRender: FakeClient };
        if (name === './draw') return painter;
        if (name === './hud-compose') return Object.assign({}, painter, { W: 800, H: 353 });
        if(name==='./aux-info'||name==='./display-config')return require('../../apps/cluster_redline/'+name.slice(2));
        if (name === './policy') return policy;
        if (name === './guidance') return guidance;
        if(name === './native-navigation')return require('../../apps/cluster_redline/native-navigation');
        if(name === './projection-config')return {PROJECTED};
        if(name === './hud-guidance')return require('../../apps/cluster_redline/hud-guidance');
        if(name === './route-events')return require('../../apps/cluster_redline/route-events');
        if (name === './gear') return require('../../apps/cluster_redline/gear');
        if (name === './renderer') return { inspect: () => ({ compatible: true, version: '0.4.0', hudGuidanceSafe: true }) };
        if(name==='./battery-voltage')return require('../../apps/cluster_redline/battery-voltage');
        throw new Error('Unexpected dependency ' + name);
    }, process: {
        hrtime: () => [Math.floor(time / 1000), Math.round((time % 1000) * 1000000)],
        once: proc.once.bind(proc), removeListener: proc.removeListener.bind(proc),
    }, setTimeout(fn, ms) { assert.strictEqual(ms, 50); assert.strictEqual(timer, null, 'worker owns only one timer'); timer = fn; return 1; },
    clearTimeout() { timer = null; }, console };
    vm.runInNewContext(source, box, { filename: 'worker.js' });
    const signals = {
        hasNative: () => true,
        call(proxy,method,args,timeout){
            if(method==='queryContent') {
                assert(opt.routeEvents);assert.strictEqual(timeout,1000);
                assert.strictEqual(args.viewConfigs[0].viewport.startPoint.anchorPoint.standardReferencePoint,'CCP');
                return Promise.resolve({GuidanceEventListError:'NO_ERROR',viewContent:[{eventsInView:[{intersection:{direction:'SLIGHT_LEFT',unreliable:false,formattedDistance:{distance:'799',unit:'METER'},description:{elements:[{text:'교차로'}]}}}]}]});
            }
            assert(opt.renderedHUD);assert.strictEqual(args.viewId,'test-hud');assert.strictEqual(timeout,1000);
            if(method==='getViewConfig')return Promise.resolve({GenericListError:0,configSequenceId:1,viewConfig:{targetUI:'HUD'}});
            assert.strictEqual(method,'getViewContent');return Promise.resolve({GenericListError:0,viewContent:{configSequenceId:1,ramsesSceneId:123,type:{contentType:'HIGH_GUIDING'},associatedEvent:{intersection:{direction:'RIGHT',formattedDistance:{distance:'200',unit:'METER'}}}}});
        },
        loadConfig(iface) {
            loads.push(iface);
            if(opt.aux&&SOURCES.some(s=>s.iface===iface)){const fields={};SOURCES.filter(s=>s.iface===iface).forEach(s=>{fields[s.field]={getter:{id:1}};});return {fields};}
            if(opt.routeEvents&&iface===ROUTE_EVENTS)return {methods:{queryContent:{methodId:4}}};
            if(opt.renderedHUD&&iface===HUD_GUIDANCE)return {fields:{registeredViews:{getter:{id:1}}},methods:{getViewConfig:{methodId:5},getViewContent:{methodId:3}}};
            if (iface === guidance.INTERFACE) {
                if (opt.missing) throw new Error('guidance absent');
                const fields={guidanceState:opt.definition===undefined?{getter:{id:3}}:opt.definition,guidingProvider:{getter:{id:27}}};
                if(opt.withManeuvers){fields.guidingProvider={getter:{id:27}};fields.conclusiveDart={getter:{id:28}};}return {fields};
            }
            if(opt.phoneStatus&&Object.keys(PROJECTED).some(p=>PROJECTED[p].iface===iface))return {fields:{projectedGuidanceActive:{getter:{id:2}},projectedGuidanceMetadataAvailable:{getter:{id:3}}}};
            throw new Error('optional interface absent');
        },
        watch(iface, instance, handlers, log, flags) {
            watches.push({ iface, instance, handlers, flags }); feeds[iface] = handlers;
            const sub = { available: true, shutdowns: 0, shutdown() { this.shutdowns++; } };watches[watches.length-1].sub=sub;
            if (iface === guidance.INTERFACE) {
                assert.strictEqual(iface, 'de.bmw.infotainment.navigation.guiding.Guidance');
                assert.strictEqual(instance, 'Main_Instance');
                assert.deepStrictEqual(Object.keys(handlers),opt.withManeuvers?['guidanceState','guidingProvider','conclusiveDart']:['guidanceState','guidingProvider']);
                assert.strictEqual(Object.keys(flags).length, 0, 'guidance polling belongs to the worker timer');
                sub.proxy = { getValue(field, timeout) {
                    assert((opt.withManeuvers?['guidanceState','guidingProvider','conclusiveDart']:['guidanceState','guidingProvider']).includes(field));assert.strictEqual(timeout,1000);
                    if(field==='guidingProvider'&&!opt.withManeuvers)return Promise.resolve('NONE');
                    if (pollThrow) throw pollThrow;
                    const read = deferred(); polls.push(Object.assign(read, { field, timeout, at: time })); return read.promise;
                }, setValue() { throw new Error('worker must not write native guidance'); }, callMethod() { throw new Error('worker must not control routing'); } };
            } else if(iface===ROUTE_EVENTS) {
                assert.strictEqual(instance,'Main_Instance');assert.strictEqual(Object.keys(handlers).length,0);sub.proxy={};
            } else if(iface===HUD_GUIDANCE){
                assert.strictEqual(instance,'Main_Instance');sub.proxy={getValue:()=>Promise.resolve(['test-hud'])};
            } else if(Object.keys(PROJECTED).some(p=>PROJECTED[p].iface===iface)) {
                const provider=Object.keys(PROJECTED).find(p=>PROJECTED[p].iface===iface);assert.strictEqual(instance,PROJECTED[provider].instance);
                sub.proxy={getValue:(field)=>Promise.resolve(sub.phoneValues&&sub.phoneValues[field]===true)};
                for(const field of Object.keys(handlers)){const callback=handlers[field];handlers[field]=(value)=>{sub.phoneValues=sub.phoneValues||{};sub.phoneValues[field]=value;callback(value);};}
            } else if(opt.aux&&Object.keys(handlers).every(f=>SOURCES.some(s=>s.iface===iface&&s.field===f))){
                assert.strictEqual(Object.keys(flags).length,0);sub.proxy={getValue(field){const d=deferred();auxReads.push(Object.assign(d,{iface,field}));return d.promise;}};
            } else {
                assert.strictEqual(instance, '1'); assert.strictEqual(flags.pollMs, 1000);
            }
            subscriptions[iface] = sub;
            if (opt.lateSubscriptions) { const later = deferred(); lateSubscriptions.push({ later, sub }); return later.promise; }
            return Promise.resolve(sub);
        },
    };
    const worker = box.module.exports.start({ dataDir: '/data', app, signals, settings: { get: key => config[key] }, log: { warn() {} } });
    function vehicle() {
        feeds[CDS].statusEngineSpeed2({ actualValueRPMEngineCrankshaft: 16000 });
        feeds[FES].statusFESVehicleDynamicSwitchHMI({ actualValueModeDrivingExperience: 'SPORT_DYNAMIC' });
    }
    function tick(at) {
        assert(at >= time); time = at; vehicle(); assert(timer, 'a live worker must schedule its next tick');
        const fn = timer; timer = null; fn();
    }
    function navigate(value, at) { if (at !== undefined) { assert(at >= time); time = at; } if(!opt.withManeuvers)feeds[guidance.INTERFACE].guidingProvider('NONE');feeds[guidance.INTERFACE].guidanceState(value); }
    function both() { assert(worker.controller.cluster.ref, 'cluster remains requested'); assert(worker.controller.hud.ref, 'fresh inactive guidance permits a HUD layer request'); }
    function onlyCluster(reason) {
        assert(worker.controller.cluster.ref, 'guidance must never suppress cluster output'); assert.strictEqual(worker.controller.hud.ref, 0);
        if (reason) assert.strictEqual(worker.controller.hudBlockReason, reason);
    }
    function stopped() {
        assert.strictEqual(timer, null); assert.strictEqual(client.active.size, 0);
        assert.strictEqual(proc.listenerCount('exit'), 0); assert.strictEqual(app.listenerCount('shutdown'), 0);
        for (const sub of Object.values(subscriptions)) assert.strictEqual(sub.shutdowns, 1);
    }
    return { config, worker, client, app, proc, files, feeds, loads, subscriptions, watches, polls, events, lateSubscriptions, auxReads,
        tick, navigate, both, onlyCluster, stopped, setPollThrow: value => { pollThrow = value; },
        get writes() { return writeCount; }, get pendingTimer() { return timer; } };
}
async function eventYield() {
    for (const [value, reason] of [['ACTIVE', 'guidance_active'], ['CALCULATING_ROUTE', 'guidance_calculating'], [null, 'guidance_unknown'], [{}, 'guidance_unknown'], ['INACTVE', 'guidance_unknown']]) {
        const h = harness();
        try {
            await flush(); h.navigate('INACTIVE'); h.tick(1000); h.both();
            const cluster = h.worker.controller.cluster.ref, hud = h.worker.controller.hud.ref;
            h.navigate(value, 1100);
            assert.strictEqual(h.worker.controller.hud.ref, 0, 'guidance events drop HUD before the next worker tick');
            assert.strictEqual(h.worker.controller.cluster.ref, cluster); assert(h.events.some(e => e[0] === 'drop' && e[1] === hud));
            h.tick(1150); h.onlyCluster(reason==='guidance_active'?'navigation_maneuver_unknown':reason==='guidance_calculating'?'navigation_calculating':reason);
            h.navigate('INACTIVE', 1200); h.client.emit('target', 'hud', 'idle', '', '', false); h.tick(1250); h.both();
            assert.strictEqual(h.worker.controller.cluster.ref, cluster, 'HUD yield/recovery must not churn cluster acquisition');
            assert.strictEqual(h.loads.filter(x => x === guidance.INTERFACE).length, 1);
            const watch = h.watches.find(x => x.iface === guidance.INTERFACE); assert.strictEqual(watch.instance, 'Main_Instance');
        } finally { h.worker.stop(); h.stopped(); }
    }
}
async function optionalReadSafety() {
    for (const options of [{ missing: true }, { definition: { setter: { id: 5 } } }, { definition: { notifier: { id: 32769 } } }, { definition: null }]) {
        const h = harness(options);
        try {
            await flush(); h.tick(1000); h.onlyCluster('guidance_unavailable');
            assert(!h.watches.some(w => w.iface === guidance.INTERFACE), 'only a declared readable getter enables guidance integration');
            assert.strictEqual(h.polls.length, 0);
        } finally { h.worker.stop(); h.stopped(); }
    }
    const h = harness();
    try {
        await flush(); h.tick(1000); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 1050); h.tick(1100); h.both();
        h.tick(6100); h.onlyCluster('guidance_stale');
        h.navigate('INACTIVE', 6150); h.tick(6200); h.both();
        h.subscriptions[guidance.INTERFACE].available = false; h.tick(6250); h.onlyCluster('guidance_unavailable');
        h.subscriptions[guidance.INTERFACE].available = true; h.tick(6300); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 6350); h.tick(6400); h.both();
        h.subscriptions[guidance.INTERFACE].error = new Error('provider failed'); h.tick(6450); h.onlyCluster('guidance_unavailable');
    } finally { h.worker.stop(); h.stopped(); }
}
async function pollingAndRaces() {
    const h = harness();
    try {
        await flush(); h.tick(1000); await flush(); h.onlyCluster('guidance_unknown'); assert.strictEqual(h.polls.length, 1);
        h.polls[0].resolve('INACTIVE'); await flush(); h.tick(1050); h.both();
        h.tick(1999); assert.strictEqual(h.polls.length, 1, 'owned reads are limited to once a second');
        h.tick(2000); await flush(); assert.strictEqual(h.polls.length, 2);
        h.tick(3000); h.tick(4000); assert.strictEqual(h.polls.length, 2, 'one unresolved getter must not spawn additional reads');
        h.navigate('ACTIVE', 4050); assert.strictEqual(h.worker.controller.hud.ref, 0);
        h.polls[1].resolve('INACTIVE'); await flush(); h.tick(4100); await flush(); h.onlyCluster('navigation_maneuver_unknown');
        assert.strictEqual(h.polls.length, 3, 'a completed old read frees the next poll without overwriting the newer event');
        h.polls[2].resolve('INACTIVE'); await flush(); h.tick(4150); h.both();
        h.tick(5100); await flush(); assert.strictEqual(h.polls.length, 4);
        h.polls[3].reject(new Error('read failed')); await flush();
        assert.strictEqual(h.worker.controller.hud.ref, 0, 'a failed getter releases HUD immediately');
        h.tick(5150); h.onlyCluster('guidance_unknown');
        h.navigate('INACTIVE', 5200); h.tick(5250); h.both();
        h.setPollThrow(new Error('synchronous binding failure')); h.tick(6100); await flush(); h.tick(6150); h.onlyCluster('guidance_unknown');
    } finally { h.worker.stop(); h.stopped(); }
}
async function providerReconnectRace() {
    const h = harness();
    try {
        await flush(); h.navigate('INACTIVE'); h.tick(1000); await flush(); h.both();
        assert.strictEqual(h.polls.length, 1);
        h.subscriptions[guidance.INTERFACE].available = false; h.tick(1100); h.onlyCluster('guidance_unavailable');
        h.subscriptions[guidance.INTERFACE].available = true; h.tick(1200); h.onlyCluster('guidance_unknown');
        h.polls[0].resolve('INACTIVE'); await flush(); h.tick(1250); h.onlyCluster('guidance_unknown');
        assert.strictEqual(h.polls.length, 1, 'reconnection does not bypass the owned one-second polling interval');
        h.tick(2000); await flush(); assert.strictEqual(h.polls.length, 2);
        h.polls[1].resolve('INACTIVE'); await flush(); h.tick(2050); h.both();
        // An error from a superseded read is equally unable to overwrite a
        // newer event, including a fresh native INACTIVE notification.
        h.tick(3000); await flush(); assert.strictEqual(h.polls.length, 3);
        h.navigate('INACTIVE', 3050); h.polls[2].reject(new Error('old read failed')); await flush();
        h.tick(3100); h.both();
    } finally { h.worker.stop(); h.stopped(); }
}
async function lateReadsAndSubscriptions() {
    const h = harness();
    await flush(); h.navigate('INACTIVE'); h.tick(1000); await flush(); h.both();
    const pending = h.polls[0];
    h.app.emit('shutdown'); h.stopped();
    const count = h.events.length, writes = h.writes;
    pending.resolve('ACTIVE'); await flush(); h.navigate('INACTIVE');
    assert.strictEqual(h.events.length, count, 'late getter/events cannot recreate or change a stopped output');
    assert.strictEqual(h.writes, writes); h.stopped(); h.worker.stop(); h.stopped();
    const early = harness({ lateSubscriptions: true });
    early.worker.stop();
    for (const entry of early.lateSubscriptions) entry.later.resolve(entry.sub);
    await flush(); early.stopped();
    assert.strictEqual(early.events.filter(e => e[0] === 'image').length, 0);
}
async function composedNavigation() {
    const h=harness({withManeuvers:true,phoneStatus:true});
    const dart={maneuver:{intersection:{direction:'RIGHT',unreliable:false,formattedDistance:{distance:'300',unit:'METER'}}}};
    try {
        await flush();h.navigate('ACTIVE');
        h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(true);h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceMetadataAvailable(true);
        h.feeds[guidance.INTERFACE].guidingProvider('ANDROID_AUTO');
        h.feeds[guidance.INTERFACE].conclusiveDart(dart);
        h.tick(1000);await flush();h.both();
        assert.strictEqual(h.worker.controller.navigation.distanceText,'300 m');
        assert.strictEqual(h.client.active.get(h.worker.controller.hud.ref).contend,true,'only a composed current arrow permits contention');
        h.config.hudNavigationEnabled=false;h.tick(1100);h.onlyCluster('guidance_active');
        h.config.hudNavigationEnabled=true;h.tick(1200);h.both();
        h.feeds[guidance.INTERFACE].conclusiveDart({maneuver:{placeholderElement:{type:'GAP'}}});
        assert.strictEqual(h.worker.controller.hud.ref,0);h.tick(1250);h.onlyCluster('navigation_maneuver_unknown');
        h.feeds[guidance.INTERFACE].conclusiveDart(dart);h.tick(1300);h.both();
        h.feeds[PROJECTED.CAR_PLAY.iface].projectedGuidanceActive(true);
        h.feeds[guidance.INTERFACE].guidingProvider('CAR_PLAY');
        assert.strictEqual(h.worker.controller.hud.ref,0,'new provider must wait for its own maneuver');
        h.feeds[guidance.INTERFACE].conclusiveDart(dart);h.tick(1350);h.both();
        h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(false);h.feeds[PROJECTED.CAR_PLAY.iface].projectedGuidanceActive(false);h.navigate('INACTIVE',1400);h.tick(1450);h.both();
        assert(!h.worker.controller.navigation.visible);assert.strictEqual(h.client.active.get(h.worker.controller.hud.ref).contend,false);
    } finally {h.worker.stop();h.stopped();}
}
async function repeatedNotificationsWhilePolling() {
    const h=harness({withManeuvers:true,phoneStatus:true});
    const dart=(direction,distance)=>({maneuver:{intersection:{direction,unreliable:false,formattedDistance:{distance,unit:'METER'}}}});
    try {
        await flush();h.navigate('ACTIVE');
        h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(true);h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceMetadataAvailable(true);
        h.feeds[guidance.INTERFACE].guidingProvider('ANDROID_AUTO');
        h.feeds[guidance.INTERFACE].conclusiveDart(dart('LEFT','300'));
        h.tick(1000);await flush();h.both();
        assert.strictEqual(h.polls.length,3);
        h.navigate('ACTIVE',1100); // Same state, newer notification while getters are pending.
        for(const read of h.polls)read.resolve(read.field==='guidanceState'?'ACTIVE':read.field==='guidingProvider'?'ANDROID_AUTO':dart('RIGHT','200'));
        await flush();h.tick(1150);h.both();
        assert.strictEqual(h.worker.controller.navigation.distanceText,'200 m','repeated unchanged state must not discard fresh maneuver/provider reads');
        assert.strictEqual(h.worker.controller.navigation.maneuver,'RIGHT');
        const count=h.polls.length;h.tick(2000);await flush();
        h.feeds[guidance.INTERFACE].conclusiveDart(dart('LEFT','150'));
        for(const read of h.polls.slice(count))read.resolve(read.field==='guidanceState'?'ACTIVE':read.field==='guidingProvider'?'ANDROID_AUTO':dart('RIGHT','100'));
        await flush();h.tick(2050);h.both();
        assert.strictEqual(h.worker.controller.navigation.maneuver,'LEFT','older getter must not overwrite a newer maneuver event');
        assert.strictEqual(h.worker.controller.navigation.distanceText,'150 m');
    } finally {h.worker.stop();h.stopped();}
}
async function reportedProjectedGuidanceWithNativeInactive() {
    for(const provider of ['ANDROID_AUTO','CAR_PLAY']) {
        const h=harness({withManeuvers:true,phoneStatus:true}),definition=PROJECTED[provider];
        const dart=(direction,distance)=>({maneuver:{intersection:{direction,unreliable:false,formattedDistance:{distance,unit:'METER'}}}});
        try {
            await flush();h.navigate('INACTIVE');
            h.feeds[definition.iface].projectedGuidanceActive(true);
            h.feeds[definition.iface].projectedGuidanceMetadataAvailable(true);
            h.feeds[guidance.INTERFACE].guidingProvider(provider);
            h.feeds[guidance.INTERFACE].conclusiveDart(dart('RIGHT','300'));
            h.tick(1000);await flush();h.both();
            assert.strictEqual(h.worker.controller.navigation.visible,true,'reported native INACTIVE must not hide active phone guidance');
            h.navigate('INACTIVE',1100);h.tick(1150);h.both();
            assert.strictEqual(h.worker.controller.navigation.distanceText,'300 m','repeated native INACTIVE must not erase the phone arrow');
            h.subscriptions[definition.iface].available=false;h.tick(1200);h.onlyCluster('projection_unavailable');
            h.subscriptions[definition.iface].available=true;h.tick(1250);assert.strictEqual(h.worker.controller.hud.ref,0);
            h.feeds[definition.iface].projectedGuidanceActive(true);
            h.tick(1300);assert.strictEqual(h.worker.controller.hud.ref,0,'reconnected phone cannot replay the old route arrow');
            h.feeds[guidance.INTERFACE].conclusiveDart(dart('LEFT','150'));h.tick(1350);h.both();
            for(const read of h.polls)read.resolve(read.field==='guidanceState'?'INACTIVE':read.field==='guidingProvider'?provider:dart('RIGHT','999'));
            await flush();h.tick(1400);h.both();
            assert.strictEqual(h.worker.controller.navigation.distanceText,'150 m','pre-reconnect read cannot reinsert the old arrow');
            h.feeds[definition.iface].projectedGuidanceActive(false);h.tick(1450);h.both();
            assert.strictEqual(h.worker.controller.navigation.visible,false,'phone route end clears the arrow even with native INACTIVE unchanged');
            assert.strictEqual(h.client.active.get(h.worker.controller.hud.ref).contend,false);
        } finally {h.worker.stop();h.stopped();}
    }
}
async function actualHudViewFallback(){
 const h=harness({withManeuvers:true,phoneStatus:true,renderedHUD:true});
 const empty={maneuver:{pointOfInterest:{category:'SERVICE_AREA',formattedDistance:{distance:'',unit:'NONE'},serviceIconHandles:[]}}};
 try{
  await flush();h.navigate('INACTIVE');h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(true);h.feeds[guidance.INTERFACE].guidingProvider('ANDROID_AUTO');h.feeds[guidance.INTERFACE].conclusiveDart(empty);
  h.tick(1000);await flush();h.tick(1050);h.both();
  assert.strictEqual(h.worker.controller.navigation.source,'hud_rendered_event');assert.strictEqual(h.worker.controller.navigation.maneuver,'RIGHT');
  const ref=h.worker.controller.hud.ref;
  h.feeds[guidance.INTERFACE].conclusiveDart(empty);h.tick(1100);h.both();
  assert.strictEqual(h.worker.controller.hud.ref,ref,'common empty POI cannot repeatedly hide a valid HUD event');
  h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(false);h.tick(1150);h.both();assert(!h.worker.controller.navigation.visible);
  h.feeds[PROJECTED.ANDROID_AUTO.iface].projectedGuidanceActive(true);h.tick(1200);assert.strictEqual(h.worker.controller.hud.ref,0,'new route waits for a fresh HUD view');
 }finally{h.worker.stop();h.stopped();}
}
async function queriedRouteEventFallback(){
 for(const provider of ['ANDROID_AUTO','CAR_PLAY']) {
  const h=harness({withManeuvers:true,phoneStatus:true,routeEvents:true}),phone=PROJECTED[provider];
  const empty={maneuver:{pointOfInterest:{category:'SERVICE_AREA',formattedDistance:{distance:'',unit:'NONE'}}}};
  try {
   await flush();h.navigate('INACTIVE');h.feeds[phone.iface].projectedGuidanceActive(true);h.feeds[guidance.INTERFACE].guidingProvider(provider);h.feeds[guidance.INTERFACE].conclusiveDart(empty);
   h.tick(1000);await flush();h.tick(1050);h.both();
   assert.strictEqual(h.worker.controller.navigation.source,'route_event_list');
   assert.strictEqual(h.worker.controller.navigation.maneuver,'SLIGHT_LEFT');
   assert.strictEqual(h.worker.controller.navigation.distanceText,'799 m');
   assert.strictEqual(h.worker.controller.navigation.description,'교차로');
   const ref=h.worker.controller.hud.ref;
   h.feeds[guidance.INTERFACE].conclusiveDart(empty);h.tick(1100);h.both();
   assert.strictEqual(h.worker.controller.hud.ref,ref,'empty common guidance must not hide a valid queried turn');
   h.feeds[phone.iface].projectedGuidanceActive(false);h.tick(1150);h.both();assert(!h.worker.controller.navigation.visible);
   h.feeds[phone.iface].projectedGuidanceActive(true);h.tick(1200);assert.strictEqual(h.worker.controller.hud.ref,0,'new route waits for its own query');
   h.tick(2000);await flush();h.tick(2050);h.both();
   h.subscriptions[ROUTE_EVENTS].available=false;h.tick(2100);assert.strictEqual(h.worker.controller.hud.ref,0,'lost event provider must release HUD to stock');
  }finally{h.worker.stop();h.stopped();}
 }
}
async function optionalAuxiliaryWorker(){
 const h=harness({aux:true});
 try{
  await flush();h.navigate('INACTIVE');h.tick(1000);await flush();
  const watched=h.watches.filter(w=>Object.keys(w.handlers).every(f=>SOURCES.some(s=>s.iface===w.iface&&s.field===f)));
  assert.strictEqual(watched.length,new Set(SOURCES.map(s=>s.iface)).size,'auxiliary fields reuse one proxy per interface');assert.strictEqual(h.auxReads.length,SOURCES.length);
  const boost=watched.find(w=>w.handlers.statusSwitchDriveDynamicSport2);boost.handlers.statusSwitchDriveDynamicSport2({displayBoostPressure:85});
  for(const read of h.auxReads){const source=SOURCES.find(s=>s.iface===read.iface&&s.field===read.field),value={};for(const [name,spec] of Object.entries(source.members))value[spec[0]]=name==='boost'?40:name==='oil'||name==='oilFallback'?143:name==='outside'?116:32500;read.resolve(value);}
  await flush();h.tick(1050);assert.strictEqual(h.worker.controller.aux.boost,0.85,'an older getter must not overwrite a newer notification');assert.strictEqual(h.worker.controller.aux.oil,95);assert.strictEqual(h.worker.controller.aux.outside,18);
  boost.sub.available=false;h.tick(1100);assert.strictEqual(h.worker.controller.aux.boost,null,'provider loss clears its metric');
  h.tick(4000);await flush();h.worker.stop();for(const w of h.watches)assert.strictEqual(w.sub.shutdowns,1);h.stopped();
  for(const read of h.auxReads)read.resolve({displayBoostPressure:200});await flush();assert.strictEqual(h.pendingTimer,null);
 }finally{h.worker.stop();}
}
(async () => {
    await optionalAuxiliaryWorker();await queriedRouteEventFallback();await actualHudViewFallback();await reportedProjectedGuidanceWithNativeInactive();await repeatedNotificationsWhilePolling();await composedNavigation();await eventYield(); await optionalReadSafety(); await pollingAndRaces(); await providerReconnectRace(); await lateReadsAndSubscriptions();
    console.log('PASS: actual worker native-guidance getter gating/instance, immediate HUD-only yield, fresh recovery, optional/stale/provider safety, bounded polling, event/read/provider-reconnect races and complete late-work shutdown');
})().catch(error => { console.error(error); process.exitCode = 1; });
