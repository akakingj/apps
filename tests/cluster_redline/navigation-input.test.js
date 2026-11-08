'use strict';
const assert=require('assert');
const {summarize}=require('../../apps/cluster_redline/navigation-input');
const {NativeNavigation}=require('../../apps/cluster_redline/native-navigation');
const payload={maneuver:{pointOfInterest:{category:6,unreliable:false,poiId:'PRIVATE_POI_ID',formattedDistance:{distance:'300',unit:'METER',rawDistance:999},serviceIconHandles:[{valid:true,id:'icon-123',url:'http://127.0.0.1/resource/123?token=SECRET&size=64',cache:true,variant:1}],description:{elements:[{text:'PRIVATE_ROAD_NAME'},{icon:{text:'PRIVATE_DESCRIPTION',iconHandle:{valid:true,id:'arrow',url:'resource://123'}}}]}}}};
const result=summarize(payload);assert.strictEqual(result.category,6);assert.strictEqual(result.formattedDistance.distance,'300');assert.strictEqual(result.serviceIconHandles[0].id,'icon-123');assert.strictEqual(result.descriptionIcons[0].id,'arrow');
const json=JSON.stringify(result);for(const s of ['PRIVATE_POI_ID','PRIVATE_ROAD_NAME','PRIVATE_DESCRIPTION','SECRET'])assert(!json.includes(s));assert(json.includes('[redacted]'));
const many=JSON.parse(JSON.stringify(payload));many.maneuver.pointOfInterest.serviceIconHandles=Array.from({length:40},()=>({id:'x'.repeat(1000),url:'x'.repeat(10000)}));
const clipped=summarize(many);assert.strictEqual(clipped.serviceIconCount,40);assert.strictEqual(clipped.serviceIconHandles.length,8);assert(clipped.serviceIconHandles[0].urlTruncated);assert(JSON.stringify(clipped).length<22000);
for(const p of [null,{},[],{maneuver:{pointOfInterest:null}},{maneuver:{pointOfInterest:{},intersection:{}}}])assert.strictEqual(summarize(p),null);
// Same active Android Auto + unsupported POI as the supplied on/off screenshots.
const n=new NativeNavigation();n.projectionAvailability('ANDROID_AUTO',true,0);n.projectionSample('ANDROID_AUTO','projectedGuidanceActive',true,0);n.sample('guidanceState','INACTIVE',0);n.sample('guidingProvider','ANDROID_AUTO',0);n.sample('conclusiveDart',payload,10);
let s=n.read(20,true);assert.strictEqual(s.kind,'pointOfInterest');assert.strictEqual(s.detail,'maneuver_unsupported');assert(!s.visible&&s.needsStock);assert.strictEqual(s.input.serviceIconHandles[0].id,'icon-123');
assert.strictEqual(n.read(5020,true).input,undefined); // phone state expired: no diagnostic payload exposed
n.projectionSample('ANDROID_AUTO','projectedGuidanceActive',false,5030);assert.strictEqual(n.inputSummary,null);
console.log('PASS: received POI icon/distance diagnostics, identity/text omission, credential redaction, bounded arrays/strings, source freshness and unchanged stock-guidance fallback');
