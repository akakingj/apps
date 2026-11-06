'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),Module=require('module');
const project=path.resolve(process.argv[2]),stage=path.resolve(process.argv[3] || path.join(project,'dist/cluster_redline'));
const {headUnit}=require(path.join(project,'kit/tools/hu-stub'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'redline-target-migration-'));
const log={info(){},warn(){},error(e){throw e}};
async function start(dir) {
    const hu=headUnit(stage,{dataDir:dir,image:async()=>{},log}), load=Module._load;
    // The upstream stub loads with require(); each simulated process must run
    // its entry again, with its own injected mgu.run and Settings instance.
    delete require.cache[require.resolve(path.join(stage,'source/javascript/app.js'))];
    try { hu.start(); } finally { Module._load=load; }
    await new Promise(r=>setTimeout(r,10));return hu;
}
(async()=>{
    try {
        for(const target of ['panel','map','hud','unknown']) {
            const dir=path.join(root,target);fs.mkdirSync(dir);
            const saved={appEnabled:false,displayTarget:target,engineProfile:'diesel',shiftRpm:4200,widgetScale:75};
            fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify(saved));
            const hu=await start(dir);
            assert.strictEqual(hu.settings.get('displayTarget'),target==='panel'?'map':target);
            assert.strictEqual(hu.settings.get('_clusterMapV'),1);
            for(const k of ['appEnabled','engineProfile','shiftRpm','widgetScale'])assert.strictEqual(hu.settings.get(k),saved[k]);
            if(target==='panel') {
                hu.settings.set('displayTarget','panel');
                const next=await start(dir);assert.strictEqual(next.settings.get('displayTarget'),'panel','an explicit later panel choice must survive restart');
            }
            assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir,'settings.json')))._clusterMapV,1);
        }
        console.log('PASS: actual app migrates old panel to map once, retains HUD/map/unknown, later owner choices, OFF and all other settings');
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
    process.exit(0);
})().catch(e=>{console.error(e);fs.rmSync(root,{recursive:true,force:true});process.exit(1)});
