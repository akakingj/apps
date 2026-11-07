'use strict';
// Read-only decoding of the vehicle's Guidance schema. No destinations or coordinates.
const TTL_MS=5000;
const DIRECTIONS=['NONE','STRAIGHT_ON','LEFT','SLIGHT_LEFT','HARD_LEFT','RIGHT','SLIGHT_RIGHT','HARD_RIGHT','UTURN_RIGHT','UTURN_LEFT'];
const PROVIDERS=['NONE','CAR_PLAY','ANDROID_AUTO','CAR_LIFE','OTHER'];
const STATES=['INACTIVE','CALCULATING_ROUTE','ACTIVE'];
const UNITS=['','km','mi','mi','m','yd','ft'];
const UNIT_NAMES=['NONE','KM','MILE_UK','MILE_US','METER','YARD','FEET'];
const BRANCHES=['NONE','BRANCH_LEFT','BRANCH_RIGHT','HIGHWAY_IN_LEFT','HIGHWAY_IN_RIGHT','HIGHWAY_IN_STRAIGHT','HIGHWAY_OUT_LEFT','HIGHWAY_OUT_RIGHT','HIGHWAY_OUT_STRAIGHT','FORK_LEFT','FORK_RIGHT','TRIPLE_FORK_LEFT','TRIPLE_FORK_RIGHT','TRIPLE_FORK_STRAIGHT','OVERPASS','UNDERPASS'];
function enumeration(value,names) { return typeof value==='string'&&names.indexOf(value)>=0?value:typeof value==='number'&&value===Math.floor(value)&&value>=0&&value<names.length?names[value]:null; }
function object(v) { return !!v&&typeof v==='object'&&!Array.isArray(v); }
function distanceText(value) {
    if(!object(value)||typeof value.distance!=='string')return null;
    // Display the supplied localized number and declared unit, never assume rawDistance is metres.
    const text=value.distance.trim(),unit=enumeration(value.unit,UNIT_NAMES);
    if(!text||!/[0-9]/.test(text)||text.length>24||!unit||unit==='NONE'||/[\x00-\x1f\x7f]/.test(text))return null;
    const suffix=UNITS[UNIT_NAMES.indexOf(unit)];
    return text.toLowerCase().endsWith(suffix)?text:text+' '+suffix;
}
function decodeDart(value) {
    if(!object(value)||!object(value.maneuver))return null;
    const stamp=value.timeStamp;
    if(stamp&&((stamp.date&&stamp.date.invalid===true)||(stamp.time&&stamp.time.invalid===true)))return null;
    const union=value.maneuver,keys=Object.keys(union).filter((k)=>union[k]!==undefined&&union[k]!==null);
    if(keys.length!==1)return null;
    const kind=keys[0],item=union[kind];
    if(!object(item)||item.unreliable===true)return null;
    let maneuver=null,exitNumber=null;
    if(kind==='intersection')maneuver=enumeration(item.direction,DIRECTIONS);
    else if(kind==='branch') {
        const branch=enumeration(item.branchType,BRANCHES);
        if(branch&&/LEFT$/.test(branch))maneuver='SLIGHT_LEFT';
        else if(branch&&/RIGHT$/.test(branch))maneuver='SLIGHT_RIGHT';
        else if(branch&&/STRAIGHT$/.test(branch))maneuver='STRAIGHT_ON';
    } else if(kind==='roundabout'&&Number.isInteger(item.exitNumber)&&item.exitNumber>0&&item.exitNumber<100) {
        maneuver='ROUNDABOUT';exitNumber=item.exitNumber;
    }
    const text=distanceText(item.formattedDistance);
    return maneuver&&maneuver!=='NONE'&&text?{maneuver,distanceText:text,exitNumber}:null;
}
class NativeNavigation {
    constructor(ttl) { this.ttl=ttl||TTL_MS;this.clear(); }
    clear() { this.state=null;this.provider=null;this.dart=null;this.stateAt=this.providerAt=this.dartAt=null; }
    sample(field,value,now) {
        if(typeof now!=='number'||!isFinite(now)||now<0){this.clear();return;}
        if(field==='guidanceState') { const next=enumeration(value,STATES);if(this.state!==next||next!=='ACTIVE'){this.dart=null;this.dartAt=null;}this.state=next;this.stateAt=now; }
        if(field==='guidingProvider') { const next=enumeration(value,PROVIDERS);if(this.provider!==null&&this.provider!==next){this.dart=null;this.dartAt=null;}this.provider=next;this.providerAt=now; }
        if(field==='conclusiveDart') { this.dart=this.state==='ACTIVE'?decodeDart(value):null;this.dartAt=this.dart?now:null; }
    }
    read(now,available) {
        const fresh=(at)=>typeof now==='number'&&isFinite(now)&&at!==null&&now>=at&&now-at<=this.ttl;
        let reason='navigation_unavailable';
        if(available===true) {
            if(!fresh(this.stateAt)||!this.state)reason='navigation_unknown';
            else if(this.state!=='ACTIVE')reason=this.state==='INACTIVE'?'navigation_inactive':'navigation_calculating';
            else if(!this.provider||!fresh(this.providerAt))reason='navigation_provider_unknown';
            else if(!this.dart||!fresh(this.dartAt))reason='navigation_maneuver_unknown';
            else return Object.assign({visible:true,reason:'navigation_ready',provider:this.provider,ageMs:now-this.dartAt},this.dart);
        }
        return {visible:false,reason,provider:this.provider,maneuver:null,distanceText:null,exitNumber:null};
    }
}
module.exports={NativeNavigation,decodeDart,distanceText,TTL_MS,DIRECTIONS,PROVIDERS};
