import copy,importlib.util,json,re,subprocess,tempfile,sys
from pathlib import Path
R=Path(__file__).resolve().parent.parent
I=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else R
spec=importlib.util.spec_from_file_location('integration',R/'tools/upstream-integration.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
source=mod.installer_source((I/'deploy/mgu-app-install.sh').read_text());assert mod.installer_source(source)==source
start=re.search(r'^optional_missing\(\) \{',source,re.M).start();end=source.index('\n}\n\n',start)+3;function=source[start:end]
name='de.bmw.infotainment.navigation.projectedmodeguiding.ProjectedModeGuiding'
catalog={'interfaces':{name:{'serviceId':64309,'version':{'major':1,'minor':3},'fields':{'currentLaneGuiding':{'getter':{'id':7},'notifier':{'id':32772},'setter':{'id':8}}}}},'instanceIDs':{name:{'Main_Instance':128}}}
variants=[('supported',lambda d:None,True),('no notifier',lambda d:d['interfaces'][name]['fields']['currentLaneGuiding'].pop('notifier'),True),('wrong notifier',lambda d:d['interfaces'][name]['fields']['currentLaneGuiding']['notifier'].update(id=32773),True),('missing interface',lambda d:d['interfaces'].pop(name),False),('missing field',lambda d:d['interfaces'][name]['fields'].pop('currentLaneGuiding'),False),('missing getter',lambda d:d['interfaces'][name]['fields']['currentLaneGuiding'].pop('getter'),False),('wrong getter',lambda d:d['interfaces'][name]['fields']['currentLaneGuiding']['getter'].update(id=8),False),('wrong major',lambda d:d['interfaces'][name]['version'].update(major=2),False),('wrong service',lambda d:d['interfaces'][name].update(serviceId=1),False),('missing instance',lambda d:d['instanceIDs'][name].pop('Main_Instance'),False),('wrong instance',lambda d:d['instanceIDs'][name].update(Main_Instance=1),False)]
with tempfile.TemporaryDirectory(prefix='lanes-optional-') as tmp:
 p=Path(tmp);stage=p/'app';(stage/'source/javascript/kit').mkdir(parents=True)
 script=p/'test.sh';script.write_text('NODE="$(command -v node)"\nCATALOG="$1"\n'+function+'\noptional_missing "$2"\n')
 for label,mutation,expected in variants:
  d=copy.deepcopy(catalog);mutation(d);(p/'catalog.json').write_text(json.dumps(d))
  manifest={'proxies':{name:{'attributes':{'currentLaneGuiding':'rws'},'methods':['setLaneGuiding'],'instances':'*','broadcasts':['viewsChanged']}}}
  (stage/'meta.json').write_text(json.dumps({'id':'cluster_redline','optional':{name:'read route events'}}));(stage/'source/manifest.json').write_text(json.dumps(manifest))
  subprocess.run(['sh',str(script),str(p/'catalog.json'),str(stage)],check=True,capture_output=True)
  desktop=json.loads((stage/'source/manifest.json').read_text())
  data={'manifest':manifest,'catalog':d,'optional':{name:'read route events'}};(p/'input.json').write_text(json.dumps(data))
  js="const fs=require('fs'),b=require(process.argv[1]),d=JSON.parse(fs.readFileSync(process.argv[2]));console.log(JSON.stringify(b.filterOptionalProxies(d.manifest,d.catalog,d.optional)));"
  store=json.loads(subprocess.check_output(['node','-e',js,str(R/'tools/store-build.js'),str(p/'input.json')],text=True))
  assert desktop==store,label
  for output in [desktop,store]:
   assert (name in output['proxies'])==expected,label
   if expected:assert output['proxies'][name]=={'attributes':{'currentLaneGuiding':'rs' if label=='supported' else 'r'},'instances':'Main_Instance'}
print('PASS: read-only lane field desktop/Store parity, capability ID/version/instance rejection, notifier downgrade and idempotent v8 upgrade')
