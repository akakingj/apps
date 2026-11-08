'use strict';
const assert=require('assert');
const {RouteEvents,decodeReply}=require('../../apps/cluster_redline/route-events');
const {queryParams}=require('../../apps/cluster_redline/route-events-config');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function reply(direction,distance) {
    return {GuidanceEventListError:'NO_ERROR',viewContent:[{eventsInView:[{intersection:{direction:direction||'SLIGHT_LEFT',unreliable:false,formattedDistance:{distance:distance||'799',unit:'METER'}}}]}]};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function main(){
    const known=decodeReply(reply());
    assert.strictEqual(known.state,'maneuver_ready');assert.strictEqual(known.value.maneuver,'SLIGHT_LEFT');assert.strictEqual(known.value.distanceText,'799 m');
    assert.strictEqual(decodeReply({viewContent:reply().viewContent}).value,null,'a missing success status is not a success');
    assert.strictEqual(decodeReply({GuidanceEventListError:'INVALID_VIEW_PARAMS'}).state,'query_rejected');
    assert.strictEqual(decodeReply({GuidanceEventListError:0,viewContent:[]}).value,null);
    assert.strictEqual(decodeReply({GuidanceEventListError:0,viewContent:[{eventsInView:[]}]}).state,'no_route_events');
    const future=reply();future.viewContent[0].eventsInView.unshift({pointOfInterest:{category:'SERVICE_AREA'}});
    assert.strictEqual(decodeReply(future).value,null,'never skip an unreadable current event to show a later turn');
    const unsafe=reply();unsafe.viewContent[0].eventsInView[0].intersection.unreliable=true;assert.strictEqual(decodeReply(unsafe).value,null);
    const badDistance=reply();badDistance.viewContent[0].eventsInView[0].intersection.formattedDistance.unit='NONE';assert.strictEqual(decodeReply(badDistance).value,null);
    let now=0;const calls=[],sub={available:true,proxy:{}};
    const reader=new RouteEvents(()=>now,(proxy,method,args,timeout)=>{
        assert.strictEqual(proxy,sub.proxy);assert.strictEqual(method,'queryContent');assert.strictEqual(timeout,1000);
        assert.deepStrictEqual(args,queryParams());const d=deferred();calls.push(d);return d.promise;
    });
    reader.attach(sub);reader.tick(now,null);await flush();assert.strictEqual(calls.length,0);
    reader.tick(now,'route1:ANDROID_AUTO');await flush();assert.strictEqual(calls.length,1);
    now=100;calls[0].resolve(reply());await flush();
    assert.strictEqual(reader.read(now,'route1:ANDROID_AUTO').source,'route_event_list');
    now=999;reader.tick(now,'route1:ANDROID_AUTO');await flush();assert.strictEqual(calls.length,1);
    now=1000;reader.tick(now,'route1:ANDROID_AUTO');await flush();assert.strictEqual(calls.length,2);
    now=1500;reader.tick(now,null);assert.strictEqual(reader.read(now,'route1:ANDROID_AUTO'),null);
    calls[1].resolve(reply('RIGHT','100'));await flush();assert.strictEqual(reader.read(now,null),null);
    now=2000;reader.tick(now,'route2:CAR_PLAY');await flush();assert.strictEqual(calls.length,3);
    sub.available=false;reader.tick(now,'route2:CAR_PLAY');sub.available=true;reader.tick(now,'route2:CAR_PLAY');
    calls[2].resolve(reply());await flush();assert.strictEqual(reader.read(now,'route2:CAR_PLAY'),null,'a pre-reconnect result must not reappear');
    now=3000;reader.tick(now,'route2:CAR_PLAY');await flush();calls[3].resolve(reply('RIGHT','120'));await flush();
    assert.strictEqual(reader.read(now,'route2:CAR_PLAY').distanceText,'120 m');
    now=5001;assert.strictEqual(reader.read(now,'route2:CAR_PLAY'),null,'stale values expire without another successful query');
    reader.tick(now,'route2:CAR_PLAY');await flush();calls[4].reject(new Error('query failed'));await flush();
    assert.strictEqual(reader.status(now).state,'read_failed');assert.strictEqual(reader.read(now,'route2:CAR_PLAY'),null);
    now=6100;reader.tick(now,'route2:CAR_PLAY');await flush();reader.stop();calls[5].resolve(reply());await flush();
    assert.strictEqual(reader.read(now,'route2:CAR_PLAY'),null);assert.strictEqual(reader.status(now).state,'stopped');
    reader.attach(sub);reader.tick(8000,'route3');await flush();assert.strictEqual(calls.length,6);
    console.log('PASS: queried direction/distance, strict first-event selection, bounded queries, TTL, source/route/reconnect races, failures and stop');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
