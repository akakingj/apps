'use strict';
// Read only the standardized ECU voltage PID/DID. No diagnostic sessions,
// security access, coding or write requests. Lazy and scoped to this worker.
const IFACE='com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu';
function supported(catalog){
 const d=(catalog.interfaces||{})[IFACE],ids=(catalog.instanceIDs||{})[IFACE];
 return !!(d&&d.serviceId===63654&&d.version&&d.version.major===1&&ids&&ids.SystemFunctionsInternalTasuInst1===128&&d.methods&&d.methods.sendTasuRequest&&d.methods.sendTasuRequest.methodId===1&&d.events&&d.events.sendTasuResponse&&d.events.sendTasuResponse.eventId===32769);
}
function close(diag){if(!diag)return;diag.removeAllListeners&&diag.removeAllListeners('frame');Promise.resolve().then(()=>diag.p&&diag.p.shutdown&&diag.p.shutdown()).catch(()=>{});}
class BatteryVoltage{
 constructor(signals,log,clock,create){this.signals=signals;this.log=log;this.clock=clock;this.create=create||(()=>{const {Diag}=require('./kit/diag');return new Diag(signals,log);});this.diag=null;this.initializing=false;this.pending=false;this.stopped=false;this.epoch=0;this.value=null;this.at=-Infinity;this.last=-Infinity;this.retry=2000;this.choice=0;this.lastEngine=-Infinity;}
 tick(now,wanted,running){
  if(this.stopped)return;
  if(running)this.lastEngine=now;
  if(!wanted||now-this.lastEngine>180000){this.value=null;if(this.diag||this.initializing)this.release();return;}
  if(!this.diag){
   if(this.initializing||now-this.last<this.retry)return;this.initializing=true;this.last=now;const epoch=this.epoch,d=this.create();d.quiet=true;
   Promise.resolve().then(()=>d.init()).then(()=>{if(this.stopped||epoch!==this.epoch){close(d);return;}this.initializing=false;if(d.error){close(d);this.retry=30000;return;}this.diag=d;},()=>{close(d);if(epoch===this.epoch){this.initializing=false;this.retry=30000;}});return;
  }
  if(this.diag.available===false){this.value=null;return;}
  if(this.pending||now-this.last<this.retry)return;
  this.pending=true;this.last=now;const epoch=this.epoch,d=this.diag,candidates=[[18,1,[0x42]],[18,0x22,[0xF4,0x42]],[24,1,[0x42]]],candidate=candidates[this.choice];
  const sid=candidate[1],query=candidate[2],prefix=sid===1?[0x41,0x42]:[0x62,0xF4,0x42];
  const accept=u=>Array.isArray(u)&&(prefix.every((n,i)=>u[i]===n)||(u[0]===0x7F&&u[1]===sid));
  Promise.resolve().then(()=>d.physical(candidate[0],sid,query,1200,accept,{maxRetries:0,callTimeoutMs:1000,hardTimeoutMs:1600,pendingTimeoutMs:1200})).then(reply=>{
   if(this.stopped||epoch!==this.epoch)return;
   const offset=prefix.length,valid=Array.isArray(reply)&&prefix.every((n,i)=>reply[i]===n)&&reply.length>=offset+2&&reply.slice(offset,offset+2).every(n=>Number.isInteger(n)&&n>=0&&n<=255),v=valid?((reply[offset]<<8)|reply[offset+1])/1000:null;
   if(v!==null&&v>=5&&v<=18){this.value=v;this.at=this.clock();this.retry=2000;}
   else{this.value=null;this.choice=(this.choice+1)%candidates.length;this.retry=this.choice===0?30000:2000;}
  },()=>{if(!this.stopped&&epoch===this.epoch){this.value=null;this.retry=30000;}}).then(()=>{if(epoch===this.epoch)this.pending=false;});
 }
 read(now){return !this.stopped&&now>=this.at&&now-this.at<=10000?this.value:null;}
 release(){this.epoch++;this.value=null;this.pending=false;const d=this.diag;this.diag=null;this.initializing=false;close(d);}
 stop(){this.stopped=true;this.release();}
}
module.exports={BatteryVoltage,supported,IFACE};
