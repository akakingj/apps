'use strict';
const INTERFACE='de.bmw.infotainment.navigation.projectedmodeguiding.ProjectedModeGuiding';
const INSTANCE='Main_Instance',FIELD='currentLaneGuiding';
function filterLanes(manifest,catalog,optional,missing){
 const p=manifest.proxies&&manifest.proxies[INTERFACE];
 if(!p||!optional||!optional[INTERFACE])return manifest;
 const d=catalog.interfaces&&catalog.interfaces[INTERFACE],ids=catalog.instanceIDs&&catalog.instanceIDs[INTERFACE],f=d&&d.fields&&d.fields[FIELD];
 if(!d||d.serviceId!==64309||!d.version||d.version.major!==1||!ids||ids[INSTANCE]!==128||!f||!f.getter||f.getter.id!==7){
  if(missing)missing[INTERFACE]=optional[INTERFACE];delete manifest.proxies[INTERFACE];return manifest;
 }
 p.instances=INSTANCE;p.attributes={[FIELD]:f.notifier&&f.notifier.id===32772?'rs':'r'};
 delete p.methods;delete p.broadcasts;return manifest;
}
module.exports={INTERFACE,INSTANCE,FIELD,filterLanes};
