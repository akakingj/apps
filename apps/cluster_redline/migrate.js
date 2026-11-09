'use strict';
// Entry-only migration; never writes a BMW setting.
function previous(store,old){
 old=old||{};
 if(old.autoStart===undefined)store.set('autoStart',old.appEnabled!==undefined?old.appEnabled===true:old.autoSport!==false);
 if(old.appEnabled===undefined&&old.autoSport===false)store.set('appEnabled',false);
 if(old.renderer==='software')store.set('renderer','auto');
 if(store.get('_outputsV')!==1){
  ['sport','all'].forEach(mode=>{
   const hud=mode+'HudOutput',cluster=mode+'ClusterOutput';
   if(old[hud]===undefined)store.set(hud,old.displayTarget==='hud'?'redline':'stock');
   if(old[cluster]===undefined)store.set(cluster,old.displayTarget===undefined||['map','panel'].includes(old.displayTarget)?'redline':'stock');
  });
  if(typeof old.widgetScale==='number')['clusterWidthScale','clusterHeightScale'].forEach(k=>{if(old[k]===undefined)store.set(k,old.widgetScale);});
  store.set('_outputsV',1);
 }
 // Apply the requested right-hand NAV position once, then keep user edits.
 if(store.get('_navRightV')!==1){store.set('hudNavOffsetX',280);store.set('hudTextOffsetX',280);store.set('_navRightV',1);}
 if(store.get('_displaySettingsV')===2)return;
 // Former all-mode choices were inactive while Sport was selected. Do not
 // unexpectedly enable those old defaults across Comfort/Eco after upgrading.
 if(old.displayMode!=='all'){store.set('allHudOutput','stock');store.set('allClusterOutput','stock');}
 store.set('hudAlertStyle','circle');store.set('clusterAlertStyle','circle');
 ['hud','cluster'].forEach(d=>{if(old[d+'AuxConfig']===undefined)store.set(d+'AuxConfig',JSON.stringify({mode:'gauges',items:['boost','torque']}));});
 store.set('navUniformScale',typeof old.hudNavWidthScale==='number'?old.hudNavWidthScale:100);
 const navY=typeof old.hudNavOffsetY==='number'&&isFinite(old.hudNavOffsetY)?old.hudNavOffsetY:0;
 if(navY<60)store.set('hudNavOffsetY',60);
 if(old.hudTextOffsetY===undefined)store.set('hudTextOffsetY',Math.max(0,navY-60));
 store.set('displaySettingsRevision',2);store.set('_displaySettingsV',2);
}
function migrate(store,old){
 old=old||{};previous(store,old);if(store.get('_layoutV3')===1)return;
 ['hud','cluster'].forEach(d=>['Left','Right'].forEach(side=>['OffsetX','OffsetY','WidthScale','HeightScale'].forEach(s=>{
  const key=d+'Aux'+side+s,legacy=old[d+'Aux'+s];
  if(old[key]===undefined){const value=typeof legacy==='number'&&isFinite(legacy)?legacy:/Scale/.test(s)?100:0;store.set(key,d==='cluster'&&s==='OffsetY'&&value===0?50:value);}
 })));
 [['hudNavOffsetX',210],['hudNavOffsetY',30],['hudNavWidthScale',70],['hudNavHeightScale',70],['navUniformScale',70],['hudTextOffsetX',180],['hudTextOffsetY',10],['hudTextScale',65]].forEach(v=>store.set(v[0],v[1]));
 store.set('displaySettingsRevision',3);store.set('_layoutV3',1);
}
module.exports={migrate};
