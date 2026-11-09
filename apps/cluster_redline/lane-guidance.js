'use strict';
const {INTERFACE,INSTANCE,FIELD}=require('./lane-config');
const DIRECTIONS=['NONE','STRAIGHT_ON','LEFT','SLIGHT_LEFT','HARD_LEFT','RIGHT','SLIGHT_RIGHT','HARD_RIGHT','UTURN_RIGHT','UTURN_LEFT'];
const INFO=['NONE','ELLIPSIS','BUS','HOV','SCOOTER','BIKE','TOLL_ETC','TOLL_CASH','TOLL_ETC_CASH','BLOCKED'];
const named=(v,n)=>typeof v==='string'&&n.includes(v)?v:Number.isInteger(v)&&v>=0&&v<n.length?n[v]:null;
function decode(value){
 if(!value||!Array.isArray(value.rows)||value.rows.length===0)return null;
 // Row zero is the upcoming lane group. Never substitute a later group's
 // lanes when the first is empty or unreadable. Do not crop road lanes.
 const row=value.rows[0];if(!row||!Array.isArray(row.lanes)||row.lanes.length<1||row.lanes.length>8)return null;
 const list=v=>Array.isArray(v)&&v.length<=10?v.map(d=>named(d,DIRECTIONS)).filter(d=>d&&d!=='NONE').filter((d,i,a)=>a.indexOf(d)===i):[];
 const lanes=row.lanes.map(l=>{
  if(!l||typeof l!=='object')return null;
  const direct=named(l.directionToFollow,DIRECTIONS),directions=list(l.directionsToFollow),other=list(l.otherDirections),info=named(l.additionalLaneInfo,INFO);
  if(!directions.length&&direct&&direct!=='NONE')directions.push(direct);
  if(!directions.length&&!other.length&&info!=='BLOCKED')return null;
  return {directions,other,highlighted:l.isHighlighted===true&&info!=='BLOCKED',blocked:info==='BLOCKED'};
 });
 return lanes.every(Boolean)?{lanes}:null;
}
class LaneGuidance{
 constructor(clock){this.clock=clock;this.sub=null;this.key=null;this.epoch=0;this.revision=0;this.pending=false;this.lastPoll=-Infinity;this.value=null;this.at=null;this.closed=false;this.confirmed=false;this.state='not_connected';this.available=false;}
 attach(sub){if(!this.closed){this.sub=sub;this.context(null);}}
 context(key){
  const available=!!(this.sub&&this.sub.available===true&&!this.sub.error&&this.sub.proxy);
  if(key!==this.key||available!==this.available){this.epoch++;this.key=key;this.available=available;this.value=null;this.at=null;this.confirmed=false;this.lastPoll=-Infinity;}
 }
 sample(value){
  if(this.closed||this.key===null||!this.available||!this.confirmed)return;
  this.revision++;this.accept(value);
 }
 accept(value){this.value=decode(value);this.at=this.value?this.clock():null;this.state=this.value?'lanes_ready':'no_lane_data';}
 tick(now,key){
  this.context(key);const s=this.sub;
  if(this.closed||key===null||!this.available||this.pending||now-this.lastPoll<2000)return;
  this.pending=true;this.lastPoll=now;const epoch=this.epoch,revision=this.revision;
  const current=()=>!this.closed&&epoch===this.epoch&&key===this.key&&s===this.sub&&s.available===true&&!s.error;
  Promise.resolve().then(()=>s.proxy.getValue(FIELD,1000)).then(v=>{
   if(!current())return;this.confirmed=true;if(revision===this.revision)this.accept(v);
  },()=>{if(current()){this.value=null;this.at=null;this.confirmed=false;this.state='read_failed';}}).then(()=>{this.pending=false;});
 }
 read(now,key){return !this.closed&&key!==null&&key===this.key&&this.sub&&this.sub.available===true&&!this.sub.error&&this.value&&this.at!==null&&now>=this.at&&now-this.at<=5000?Object.assign({visible:true},this.value):null;}
 status(now){return {available:this.available,state:this.state,pending:this.pending,ageMs:this.at===null?null:Math.max(0,now-this.at),laneCount:this.value?this.value.lanes.length:0};}
 stop(){this.closed=true;this.epoch++;this.value=null;this.at=null;this.key=null;this.state='stopped';}
}
module.exports={LaneGuidance,decode,INTERFACE,INSTANCE,FIELD};
