'use strict';
const assert=require('assert');
const {NativeNavigation,decodeDart,distanceText,DIRECTIONS}=require('../../apps/cluster_redline/native-navigation');
const dart=(direction,extra)=>Object.assign({maneuver:{intersection:{direction,unreliable:false,formattedDistance:{distance:'300',unit:'METER',rawDistance:99999}}}},extra);
for(let n=1;n<DIRECTIONS.length;n++) {
    assert.strictEqual(decodeDart(dart(n)).maneuver,DIRECTIONS[n]);
    assert.strictEqual(decodeDart(dart(DIRECTIONS[n])).maneuver,DIRECTIONS[n]);
}
assert.strictEqual(decodeDart(dart('LEFT')).distanceText,'300 m','rawDistance cannot override the provided displayed number');
assert.strictEqual(distanceText({distance:'1.5',unit:1}),'1.5 km');
assert.strictEqual(distanceText({distance:'300 m',unit:4}),'300 m');
for(const value of [null,{}, {distance:'--',unit:4},{distance:'3',unit:'BAD'},{distance:'3',unit:0}])assert.strictEqual(distanceText(value),null);
for(const value of [null,{},dart('UNKNOWN'),dart(0),dart('LEFT',{timeStamp:{date:{invalid:true}}}),{maneuver:{placeholderElement:{type:'GAP'}}}])assert.strictEqual(decodeDart(value),null);
let bad=dart('RIGHT');bad.maneuver.intersection.unreliable=true;assert.strictEqual(decodeDart(bad),null);
bad=dart('RIGHT');bad.maneuver.branch={};assert.strictEqual(decodeDart(bad),null,'ambiguous union must not guess its arrow');
const branch={maneuver:{branch:{branchType:'HIGHWAY_OUT_RIGHT',formattedDistance:{distance:'1',unit:'KM'}}}};
assert.strictEqual(decodeDart(branch).maneuver,'SLIGHT_RIGHT');
const round={maneuver:{roundabout:{exitNumber:3,formattedDistance:{distance:'500',unit:'METER'}}}};
assert.strictEqual(decodeDart(round).exitNumber,3);
function ready(provider,ttl) {
    const n=new NativeNavigation(ttl);
    if(provider==='ANDROID_AUTO'||provider==='CAR_PLAY') {
        n.projectionAvailability(provider,true,0);
        n.projectionSample(provider,'projectedGuidanceActive',true,0);
        n.projectionSample(provider,'projectedGuidanceMetadataAvailable',true,0);
    }
    n.sample('guidanceState',provider==='NONE'?'ACTIVE':'INACTIVE',0);
    n.sample('guidingProvider',provider,0);n.sample('conclusiveDart',dart('LEFT'),0);
    return n;
}
// Reported vehicle case: BMW native route is INACTIVE while Android Auto guides.
for(const provider of ['ANDROID_AUTO','CAR_PLAY']) {
    const n=ready(provider);assert(n.read(100,true).visible);assert(n.read(100,true).active);
    assert.strictEqual(n.read(100,true).provider,provider);
    for(let t=100;t<=1000;t+=100){n.sample('guidanceState','INACTIVE',t);assert(n.read(t,true).visible,'unchanged nativeINACTIVE cannot clear the phone arrow');}
    const status=n.projectedStatus(1000)[provider];
    assert.strictEqual(status.available,true);assert.strictEqual(status.active,true);assert.strictEqual(status.activeFresh,true);
    assert.strictEqual(status.metadataAvailable,true);assert.strictEqual(status.metadataFresh,true);
    n.projectionSample(provider,'projectedGuidanceMetadataAvailable',false,1100);
    assert(n.read(1100,true).visible,'metadata capability is diagnostic; a confirmed current maneuver is the data');
}
// Provider identity alone cannot activate a phone route, nor can the other phone.
const wrong=new NativeNavigation();
wrong.projectionAvailability('ANDROID_AUTO',true,0);wrong.projectionSample('ANDROID_AUTO','projectedGuidanceActive',false,0);
wrong.projectionAvailability('CAR_PLAY',true,0);wrong.projectionSample('CAR_PLAY','projectedGuidanceActive',true,0);
wrong.sample('guidanceState','INACTIVE',0);wrong.sample('guidingProvider','ANDROID_AUTO',0);wrong.sample('conclusiveDart',dart('RIGHT'),0);
assert(!wrong.read(100,true).visible);assert(wrong.read(100,true).needsStock);
const identityOnly=new NativeNavigation();identityOnly.sample('guidanceState','ACTIVE',0);identityOnly.sample('guidingProvider','ANDROID_AUTO',0);identityOnly.sample('conclusiveDart',dart('LEFT'),0);
assert(!identityOnly.read(100,true).visible);assert(identityOnly.read(100,true).needsStock);
// Route end/restart and unknown state must not replay the previous maneuver.
const n=ready('ANDROID_AUTO');
n.projectionSample('ANDROID_AUTO','projectedGuidanceActive',false,100);
assert(!n.read(100,true).visible);assert.strictEqual(n.read(100,true).needsStock,false);
n.sample('conclusiveDart',dart('RIGHT'),150);
n.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,200);
assert(!n.read(200,true).visible,'reactivation waits for a maneuver sampled after activation');
n.sample('conclusiveDart',dart('RIGHT'),210);assert.strictEqual(n.read(210,true).maneuver,'RIGHT');
n.projectionSample('ANDROID_AUTO','projectedGuidanceActive','true',220);assert(!n.read(220,true).visible);assert(n.read(220,true).needsStock);
n.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,230);assert(!n.read(230,true).visible);
n.sample('conclusiveDart',dart('LEFT'),240);assert(n.read(240,true).visible);
// Provider changes, disconnects, reconnects and unrelated provider outages.
n.projectionAvailability('CAR_PLAY',true,250);n.projectionSample('CAR_PLAY','projectedGuidanceActive',true,250);
n.sample('guidingProvider','CAR_PLAY',260);assert(!n.read(260,true).visible);
n.sample('conclusiveDart',dart('RIGHT'),270);assert(n.read(270,true).visible);
n.projectionAvailability('ANDROID_AUTO',false,280);assert(n.read(280,true).visible,'unrelated source loss must not clear the chosen phone');
n.projectionAvailability('CAR_PLAY',false,290);assert(!n.read(290,true).visible);assert(n.read(290,true).needsStock);
n.projectionAvailability('CAR_PLAY',true,300);assert(!n.read(300,true).visible);assert.strictEqual(n.projectedStatus(300).CAR_PLAY.active,null);
n.projectionSample('CAR_PLAY','projectedGuidanceActive',true,310);assert(!n.read(310,true).visible);
n.sample('conclusiveDart',dart('RIGHT'),320);assert(n.read(320,true).visible);
// Stale phone status invalidates the arrow even if common guidance remains fresh.
const stale=ready('ANDROID_AUTO',1000);
stale.sample('guidingProvider','ANDROID_AUTO',1000);stale.sample('conclusiveDart',dart('LEFT'),1000);
assert(!stale.read(1001,true).visible);assert(stale.read(1001,true).needsStock);
stale.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,1010);assert(!stale.read(1010,true).visible);
stale.sample('conclusiveDart',dart('RIGHT'),1020);assert(stale.read(1020,true).visible,'phone route need not require a fresh nativeACTIVE sample');
const noInterveningRead=ready('ANDROID_AUTO',1000);
noInterveningRead.sample('conclusiveDart',dart('LEFT'),900);noInterveningRead.sample('guidingProvider','ANDROID_AUTO',1100);
noInterveningRead.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,1100);
assert(!noInterveningRead.read(1100,true).visible,'fresh true after an unobserved stale gap also needs a new dart');
// Unordered first reads safely wait until the activation/providing identity is known.
const unordered=new NativeNavigation();unordered.sample('conclusiveDart',dart('LEFT'),0);
unordered.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,1);
unordered.projectionAvailability('ANDROID_AUTO',true,2);unordered.sample('guidanceState','INACTIVE',2);unordered.sample('guidingProvider','ANDROID_AUTO',2);
assert(!unordered.read(2,true).visible);unordered.sample('conclusiveDart',dart('LEFT'),3);assert(unordered.read(3,true).visible);
// Common guidance loss clears its data but retains independently watched phone facts.
const retained=ready('ANDROID_AUTO');retained.clearGuidance();
assert.strictEqual(retained.projectedStatus(100).ANDROID_AUTO.active,true);assert(!retained.read(100,true).visible);
retained.sample('guidanceState','INACTIVE',100);retained.sample('guidingProvider','ANDROID_AUTO',100);retained.sample('conclusiveDart',dart('LEFT'),100);
assert(retained.read(100,true).visible);assert(!retained.read(100,false).visible);
retained.clear();assert.strictEqual(retained.projectedStatus(100).ANDROID_AUTO.active,null);
// Native-only routing remains based on BMW's native state.
const native=ready('NONE');assert(native.read(100,true).visible);
native.sample('guidanceState','INACTIVE',200);assert(!native.read(200,true).visible);assert.strictEqual(native.read(200,true).needsStock,false);
native.sample('conclusiveDart',dart('LEFT'),210);native.sample('guidanceState','ACTIVE',220);
assert(!native.read(220,true).visible);native.sample('conclusiveDart',dart('RIGHT'),230);assert(native.read(230,true).visible);
native.sample('guidanceState','CALCULATING_ROUTE',240);assert(!native.read(240,true).visible);assert(native.read(240,true).needsStock);
for(const stamp of [undefined,null,-1,NaN]){native.sample('guidanceState','ACTIVE',stamp);assert(!native.read(500,true).visible);assert(native.read(500,true).needsStock);}
console.log('PASS: schema decoding plus nativeINACTIVE/projectedACTIVE AndroidAuto+CarPlay, matched-source gating, stale/false/loss/restart/provider races, unordered reads, retained projection facts and native-only routing');
