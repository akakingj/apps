'use strict';
// Entry-only migration; never writes a BMW setting.
function migrate(store,old){
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
module.exports={migrate};
