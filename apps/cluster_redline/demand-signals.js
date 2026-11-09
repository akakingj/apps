'use strict';
// Field masks change only on settings/drive-mode transitions. No independent
// intervals: the existing worker timer owns polling, and shutdown cancels it.
class DemandSignals{
 constructor(source){this.source=source;this.groups=[];this.now=0;this.closed=false;this.signals=Object.create(source||{});this.signals.watch=(...args)=>this.watch(...args);}
 watch(iface,instance,handlers,log,opts){
  const g={iface,instance,handlers:handlers||{},log,opts:opts||{},wanted:[],signature:null,generation:0,binding:null,pending:false,closed:false,error:null,reads:{},revision:{}};
  try{g.config=this.source.loadConfig(iface);}catch(e){g.config=null;}
  const facade={iface,shutdown:()=>this.close(g)};
  Object.defineProperties(facade,{available:{get:()=>!!(g.binding&&g.binding.available)},proxy:{get:()=>g.binding&&g.binding.proxy},error:{get:()=>g.error||g.binding&&g.binding.error}});
  this.groups.push(g);return Promise.resolve(facade);
 }
 dispose(s){try{return Promise.resolve(s&&s.shutdown()).catch(()=>{});}catch(e){return Promise.resolve();}}
 close(g){if(g.closed)return;g.closed=true;g.generation++;const s=g.binding;g.binding=null;return this.dispose(s);}
 open(g){
  if(this.closed||g.closed||g.pending||!g.wanted.length||g.binding||g.error)return;
  g.pending=true;const generation=g.generation,handlers={};g.reads={};
  g.wanted.filter(f=>f!=='*').forEach(f=>{g.reads[f]={pending:false,last:this.now};handlers[f]=v=>{
   if(this.closed||g.closed||generation!==g.generation)return;if(g.reads[f])g.reads[f].last=this.now;g.revision[f]=(g.revision[f]||0)+1;g.handlers[f](v);
  };});
  let opened;try{opened=this.source.watch(g.iface,g.instance,handlers,g.log,{});}catch(e){opened=Promise.reject(e);}
  Promise.resolve(opened).then(s=>{
   g.pending=false;if(this.closed||g.closed||generation!==g.generation){this.dispose(s);this.open(g);return;}g.binding=s;
  },e=>{g.pending=false;if(generation===g.generation)g.error=String(e);this.open(g);});
 }
 reconcile(fields,now){
  this.now=now;if(this.closed)return;
  this.groups.forEach(g=>{
   if(g.closed)return;const names=Object.keys(g.handlers),wanted=names.length?names.filter(f=>fields.has(g.iface+'.'+f)):fields.has(g.iface)?['*']:[],signature=wanted.join('|');
   if(signature!==g.signature){g.generation++;g.signature=signature;g.wanted=wanted;g.error=null;const old=g.binding;g.binding=null;this.dispose(old);}
   this.open(g);const s=g.binding;
   if(!s||!s.available||s.error||!s.proxy||typeof s.proxy.getValue!=='function'||!g.opts.pollMs)return;
   const cfg=g.config;if(!cfg)return;
   g.wanted.forEach(f=>{
    const state=g.reads[f],def=cfg.fields&&cfg.fields[f];if(!state||state.pending||now-state.last<g.opts.pollMs||!def||!def.getter)return;
    state.pending=true;state.last=now;const generation=g.generation,revision=g.revision[f]||0;
    Promise.resolve().then(()=>s.proxy.getValue(f,1000)).then(v=>{
     if(!this.closed&&!g.closed&&generation===g.generation&&s===g.binding&&revision===(g.revision[f]||0)){g.revision[f]=revision+1;g.handlers[f](v);}
    },()=>{}).then(()=>{state.pending=false;});
   });
  });
 }
 status(){return this.groups.filter(g=>!g.closed&&g.wanted.length).map(g=>({interface:g.iface,fields:g.wanted.slice(),available:!!(g.binding&&g.binding.available),pending:g.pending,error:g.error||g.binding&&g.binding.error||null}));}
 stop(){this.closed=true;this.groups.forEach(g=>this.close(g));}
}
module.exports={DemandSignals};
