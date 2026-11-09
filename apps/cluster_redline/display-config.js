'use strict';
const METRICS=['boost','torque','power','gforce','outside','oil'];
const LABELS={boost:'Boost',torque:'Torque',power:'Power*',gforce:'G-force',outside:'Outside temperature',oil:'Oil temperature'};
const PARTS=['RpmGauge','Gear','Alert','Aux','RpmValue'];
const PART_LABELS=['RPM gauge','Gear','RPM alert','Auxiliary information','RPM number'];
const defaults={displaySettingsRevision:2,clusterAlertStyle:'circle',navDisplayMode:'all',navColor:'blue',navUniformScale:100,hudTextOffsetX:280,hudTextOffsetY:0,hudTextScale:100};
['hud','cluster'].forEach(d=>{
 defaults[d+'AuxConfig']=JSON.stringify({mode:'gauges',items:['boost','torque']});
 PARTS.forEach(p=>{defaults[d+p+'OffsetX']=0;defaults[d+p+'OffsetY']=0;defaults[d+p+'WidthScale']=100;defaults[d+p+'HeightScale']=100;});
});
function auxConfig(value) {
 let v=value;try{if(typeof v==='string')v=JSON.parse(v);}catch(e){v=null;}
 if(!v||!['gauges','values','off'].includes(v.mode)||!Array.isArray(v.items))return {mode:'gauges',items:['boost','torque']};
 const items=v.items.filter((x,i,a)=>METRICS.includes(x)&&a.indexOf(x)===i).slice(0,v.mode==='gauges'?2:4);
 return {mode:v.mode,items:items.length?items:['boost','torque']};
}
function normalize(raw,out) {
 Object.keys(defaults).forEach(k=>{out[k]=defaults[k];});
 out.displaySettingsRevision=raw.displaySettingsRevision===1?1:2;
 out.clusterAlertStyle=['circle','bar'].includes(raw.clusterAlertStyle)?raw.clusterAlertStyle:'circle';
 out.navDisplayMode=raw.navDisplayMode==='excludeSport'?'excludeSport':'all';
 out.navColor=['blue','white','gray'].includes(raw.navColor)?raw.navColor:'blue';
 ['hud','cluster'].forEach(d=>{
  let value=raw[d+'AuxConfig'];
  if(value===undefined&&d==='hud'&&raw.hudAuxDisplay!==undefined)value={mode:raw.hudAuxDisplay,items:['torque','power']};
  out[d+'AuxConfig']=JSON.stringify(auxConfig(value));
  PARTS.forEach(p=>{
   ['OffsetX','OffsetY','WidthScale','HeightScale'].forEach(s=>{
    const k=d+p+s,v=raw[k];if(typeof v==='number'&&isFinite(v))out[k]=/Offset/.test(s)?Math.max(-1000,Math.min(1000,Math.round(v))):Math.max(20,Math.min(200,Math.round(v/5)*5));
   });
   const w=d+p+'WidthScale',h=d+p+'HeightScale';out[h]=Math.max(Math.ceil(out[w]/1.3/5)*5,Math.min(Math.floor(out[w]*1.3/5)*5,out[h]));
  });
 });
 ['OffsetX','OffsetY','Scale'].forEach(s=>{const k='hudText'+s,v=raw[k];if(typeof v==='number'&&isFinite(v))out[k]=s==='Scale'?Math.max(20,Math.min(200,Math.round(v/5)*5)):Math.max(-1000,Math.min(1000,Math.round(v)));});
 // Arrow and text each scale uniformly. Normalize former stretched nav settings.
 if(raw.navUniformScale!==undefined||raw.displaySettingsRevision===2){const n=typeof raw.navUniformScale==='number'&&isFinite(raw.navUniformScale)?raw.navUniformScale:out.hudNavWidthScale;out.hudNavWidthScale=out.hudNavHeightScale=Math.max(20,Math.min(200,n));}
 out.navUniformScale=out.hudNavWidthScale;
 return out;
}
function metricSlots(items) {
 if(items.length<3)return items.map((id,i)=>({id,side:i,row:0,rows:1,index:i+1}));
 return items.map((id,i)=>({id,side:i<2?0:1,row:i%2,rows:i<2||items.length===4?2:1,index:i+1}));
}
function sportMode(mode){return /^(SPORT|PHEV_SPORT)/.test(String(mode||''));}
function navAllowed(cfg,mode){return cfg.hudNavigationEnabled&&!(cfg.navDisplayMode==='excludeSport'&&sportMode(mode));}
function rpmOutput(cfg,name,mode){return cfg['all'+name+'Output']==='redline'||sportMode(mode)&&cfg['sport'+name+'Output']==='redline';}
module.exports={METRICS,LABELS,PARTS,PART_LABELS,defaults,normalize,auxConfig,metricSlots,sportMode,navAllowed,rpmOutput};
