'use strict';
const assert=require('assert'),{DemandSignals}=require('../../apps/cluster_redline/demand-signals');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();},deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
(async()=>{
 const native=[],gets=[],seen=[],pending=[];
 const source={loadConfig:()=>({fields:{rpm:{getter:{}},gear:{getter:{}}}}),watch(iface,instance,handlers,log,opts){
  assert.strictEqual(opts.pollMs,undefined,'SDK intervals must not outlive a hidden worker');
  const sub={available:true,proxy:{getValue(f){const d=deferred();gets.push({f,d});return d.promise;}},shutdowns:0,shutdown(){this.shutdowns++;}};
  native.push({handlers,sub});const d=deferred();pending.push(d);return d.promise;
 }};
 const m=new DemandSignals(source),facade=await m.signals.watch('car','1',{rpm:v=>seen.push(['rpm',v]),gear:v=>seen.push(['gear',v])},{},{pollMs:1000});
 m.reconcile(new Set(),0);await flush();assert.strictEqual(native.length,0,'all hidden never opens a subscription');
 m.reconcile(new Set(['car.rpm']),0);assert.deepStrictEqual(Object.keys(native[0].handlers),['rpm']);
 m.reconcile(new Set(['car.gear']),1);m.reconcile(new Set(['car.rpm','car.gear']),2);assert.strictEqual(native.length,1,'one initialization at a time');
 pending[0].resolve(native[0].sub);await flush();assert.strictEqual(native[0].sub.shutdowns,1);assert.strictEqual(native.length,2);assert.deepStrictEqual(Object.keys(native[1].handlers),['rpm','gear']);
 pending[1].resolve(native[1].sub);await flush();m.reconcile(new Set(['car.rpm','car.gear']),1002);await flush();assert.strictEqual(gets.length,2);
 native[1].handlers.rpm(5000);gets[0].d.resolve(1000);gets[1].d.resolve('D');await flush();assert.deepStrictEqual(seen,[['rpm',5000],['gear','D']],'old getter cannot replace a newer notification');
 m.reconcile(new Set(),1100);assert.strictEqual(native[1].sub.shutdowns,1);native[1].handlers.rpm(9000);assert.strictEqual(seen.length,2);
 m.reconcile(new Set(),4000);await flush();assert.strictEqual(gets.length,2,'hidden fields neither poll nor receive values');
 m.reconcile(new Set(['car.gear']),5000);m.stop();pending[2].resolve(native[2].sub);await flush();assert.strictEqual(native[2].sub.shutdowns,1);assert(!facade.available);assert.strictEqual(native.length,3);
 console.log('PASS: zero hidden subscriptions/reads, exact active field masks, serialized/coalesced initialization, late-data rejection, owned polling and complete shutdown');
})().catch(e=>{console.error(e);process.exitCode=1;});
