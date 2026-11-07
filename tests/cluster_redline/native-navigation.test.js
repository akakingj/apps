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
const nav=new NativeNavigation();
nav.sample('guidanceState','ACTIVE',0);nav.sample('guidingProvider','ANDROID_AUTO',0);nav.sample('conclusiveDart',dart('LEFT'),0);
assert(nav.read(100,true).visible);assert.strictEqual(nav.read(100,true).provider,'ANDROID_AUTO');
assert(!nav.read(5001,true).visible);assert(!nav.read(100,false).visible);
nav.sample('guidingProvider','CAR_PLAY',200);assert(!nav.read(200,true).visible,'provider change cannot retain the old arrow');
nav.sample('conclusiveDart',dart('RIGHT'),200);assert.strictEqual(nav.read(200,true).maneuver,'RIGHT');
nav.sample('guidanceState','INACTIVE',300);nav.sample('conclusiveDart',dart('LEFT'),310);assert(!nav.read(310,true).visible);
nav.sample('guidanceState','ACTIVE',400);assert(!nav.read(400,true).visible,'inactive route data must not reappear on a new route');
nav.sample('conclusiveDart',dart('LEFT'),400);assert(nav.read(400,true).visible);
nav.sample('guidanceState','CALCULATING_ROUTE',500);assert(!nav.read(500,true).visible);
nav.clear();assert(!nav.read(600,true).visible);
for(const t of [undefined,null,-1,NaN]) {nav.sample('guidanceState','ACTIVE',t);assert(!nav.read(600,true).visible);}
console.log('PASS: actual turn/provider enums, formatted units, branches/roundabout, ambiguous/invalid/unreliable data, lifecycle/provider freshness and stale-arrow removal');
