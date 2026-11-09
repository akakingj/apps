'use strict';
const assert=require('assert');
const {HudGuidance}=require('../../apps/cluster_redline/hud-guidance');
const {INTERFACE,filterRendered}=require('../../apps/cluster_redline/hud-guidance-config');
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const event=direction=>({intersection:{direction,formattedDistance:{distance:'300',unit:'METER'},unreliable:false}});
function fixture(options){
 const opt=options||{},calls=[];let now=0;
 const ids=opt.ids||['cid','hud'];const sub={available:true,proxy:{getValue(name,ms){assert.strictEqual(name,'registeredViews');assert.strictEqual(ms,1000);return Promise.resolve(ids);}}};
 const reader=new HudGuidance(()=>now,async(p,name,args,timeout)=>{
  assert.strictEqual(p,sub.proxy);assert(['getViewConfig','getViewContent'].includes(name));assert.strictEqual(timeout,1000);calls.push([name,args.viewId]);
  if(opt.hold)return opt.hold.promise;
  if(opt.fail)throw Error('test read failure');
  if(name==='getViewConfig')return {GenericListError:0,configSequenceId:1,viewConfig:{targetUI:args.viewId==='cid'?'CID':'HUD'}};
  const associated=opt.highways?{branch:{branchType:args.viewId==='h2'?'HIGHWAY_OUT_RIGHT':'HIGHWAY_IN_RIGHT',formattedDistance:{distance:'300',unit:'METER'}}}:event(args.viewId==='h2'?'LEFT':'RIGHT');
  return {GenericListError:opt.error||0,viewContent:{configSequenceId:1,ramsesSceneId:123,type:{contentType:opt.type||'HIGH_GUIDING'},associatedEvent:associated}};
 });reader.attach(sub);return {reader,sub,calls,time:n=>now=n};
}
(async()=>{
 const f=fixture();f.reader.tick(0,null);await flush();assert.strictEqual(f.calls.length,0);
 f.reader.tick(0,'route-A');f.reader.tick(0,'route-A');await flush();
 let r=f.reader.read(0,'route-A');assert(r&&r.visible&&r.maneuver==='RIGHT');assert.strictEqual(r.source,'hud_rendered_event');
 assert(!f.calls.some(x=>x[0]==='getViewContent'&&x[1]==='cid'),'CID data cannot supply HUD directions');
 assert.strictEqual(f.reader.read(2001,'route-A'),null);assert.strictEqual(f.reader.read(10,'route-B'),null);
 f.sub.available=false;assert.strictEqual(f.reader.read(10,'route-A'),null);f.reader.tick(10,'route-A');assert.strictEqual(f.reader.value,null);
 for(const options of [{type:'NOTIFY'},{error:1},{ids:[]},{fail:true},{ids:['hud','h2']},{ids:['hud','h2'],highways:true}]){
  const f=fixture(options);f.reader.tick(0,'route');await flush();assert.strictEqual(f.reader.read(0,'route'),null,JSON.stringify(options));
 }
 let resolve;const hold={promise:new Promise(r=>resolve=r)};const late=fixture({hold});late.reader.tick(0,'A');await flush();late.reader.tick(10,'B');resolve({GenericListError:0,configSequenceId:1,viewConfig:{targetUI:'HUD'}});await flush();assert.strictEqual(late.reader.read(10,'B'),null);
 const stopped=fixture();stopped.reader.tick(0,'route');stopped.reader.stop();await flush();assert.strictEqual(stopped.reader.read(0,'route'),null);
 const definition={fields:{registeredViews:{getter:{id:1}}},methods:{getViewConfig:{methodId:5},getViewContent:{methodId:3}}};
 const catalog={interfaces:{[INTERFACE]:definition},instanceIDs:{[INTERFACE]:{Main_Instance:128}}},optional={[INTERFACE]:'optional HUD'};
 for(const mutation of [()=>{},d=>delete d.interfaces[INTERFACE],d=>delete d.instanceIDs[INTERFACE].Main_Instance,d=>d.interfaces[INTERFACE].methods.getViewContent.methodId=0,d=>delete d.interfaces[INTERFACE].fields.registeredViews.getter]){
  const d=JSON.parse(JSON.stringify(catalog));mutation(d);const m={proxies:{[INTERFACE]:{attributes:{registeredViews:'rw'},methods:['setViewConfig','getViewContent']}}};
  filterRendered(m,d,optional);if(m.proxies[INTERFACE]){assert.deepStrictEqual(m.proxies[INTERFACE].methods,['getViewConfig','getViewContent']);assert.deepStrictEqual(m.proxies[INTERFACE].attributes,{registeredViews:'r'});}else assert.notDeepStrictEqual(d,catalog);
 }
 console.log('PASS: existing HUD/HIGH_GUIDING views only, valid turn decoding, ambiguity/error/stale/route/stop gates, no overlapping reads or view writes, strict optional capabilities');
})().catch(e=>{console.error(e);process.exitCode=1;});
