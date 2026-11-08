'use strict';
// Bounded diagnostics from an already received value. No resource fetching,
// additional SOME/IP calls, road names, destinations or coordinates.
function object(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function scalar(v) { return typeof v === 'string' ? v.slice(0,64) : typeof v === 'number' && isFinite(v) ? v : null; }
function resource(v) {
    if (!object(v)) return null;
    const out={};
    ['valid','cache'].forEach(k=>{if(typeof v[k]==='boolean')out[k]=v[k];});
    ['id','url'].forEach(k=>{
        if(typeof v[k]!=='string')return;
        const limit=k==='url'?2048:256;
        const text=v[k].replace(/([?&](?:access_token|token|key|signature|auth|password)=)[^&#]*/gi,'$1[redacted]')
            .replace(/(https?:\/\/)[^/@]+@/gi,'$1[redacted]@');
        out[k]=text.slice(0,limit);if(text.length>limit)out[k+'Truncated']=true;
    });
    if(scalar(v.variant)!==null)out.variant=scalar(v.variant);
    return out;
}
function summarize(value) {
    if(!object(value)||!object(value.maneuver))return null;
    const keys=Object.keys(value.maneuver).filter(k=>value.maneuver[k]!==undefined&&value.maneuver[k]!==null);
    if(keys.length!==1)return null;
    const kind=keys[0],item=value.maneuver[kind];if(!object(item))return null;
    const out={kind:kind.slice(0,64)};
    if(typeof item.unreliable==='boolean')out.unreliable=item.unreliable;
    if(scalar(item.category)!==null)out.category=scalar(item.category);
    if(object(item.formattedDistance)) {
        const f=item.formattedDistance;out.formattedDistance={unit:scalar(f.unit)};
        if(typeof f.distance==='string')out.formattedDistance.distance=f.distance.slice(0,64);
        if(typeof f.rawDistance==='number'&&isFinite(f.rawDistance))out.formattedDistance.rawDistance=f.rawDistance;
    }
    const icons=Array.isArray(item.serviceIconHandles)?item.serviceIconHandles:[];
    out.serviceIconHandles=icons.slice(0,8).map(resource).filter(Boolean);
    out.serviceIconCount=icons.length;
    const elements=object(item.description)&&Array.isArray(item.description.elements)?item.description.elements:[];
    const described=elements.filter(e=>object(e)&&object(e.icon)&&object(e.icon.iconHandle));
    out.descriptionIcons=described.slice(0,8).map(e=>resource(e.icon.iconHandle)).filter(Boolean);
    out.descriptionIconCount=described.length;
    return out;
}
module.exports={summarize};
