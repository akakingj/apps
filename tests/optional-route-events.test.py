import copy,importlib.util,json,re,subprocess,tempfile,sys
from pathlib import Path
R=Path(__file__).resolve().parent.parent
I=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else R
spec=importlib.util.spec_from_file_location('integration',R/'tools/upstream-integration.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
source=mod.installer_source((I/'deploy/mgu-app-install.sh').read_text());assert mod.installer_source(source)==source
start=re.search(r'^optional_missing\(\) \{',source,re.M).start();end=source.index('\n}\n\n',start)+3;function=source[start:end]
name='de.bmw.infotainment.navigation.guiding.GuidanceEventList'
catalog={'interfaces':{name:{'serviceId':64283,'version':{'major':5,'minor':0},'methods':{'queryContent':{'methodId':4}}}},'instanceIDs':{name:{'Main_Instance':128}}}
variants=[('supported',lambda d:None,True),('missing interface',lambda d:d['interfaces'].pop(name),False),('missing method',lambda d:d['interfaces'][name]['methods'].pop('queryContent'),False),('wrong method',lambda d:d['interfaces'][name]['methods']['queryContent'].update(methodId=5),False),('wrong major',lambda d:d['interfaces'][name]['version'].update(major=4),False),('wrong service',lambda d:d['interfaces'][name].update(serviceId=1),False),('missing instance',lambda d:d['instanceIDs'][name].pop('Main_Instance'),False),('wrong instance',lambda d:d['instanceIDs'][name].update(Main_Instance=1),False)]
with tempfile.TemporaryDirectory(prefix='route-optional-') as tmp:
 p=Path(tmp);stage=p/'app';(stage/'source/javascript/kit').mkdir(parents=True)
 script=p/'test.sh';script.write_text('NODE="$(command -v node)"\nCATALOG="$1"\n'+function+'\noptional_missing "$2"\n')
 for label,mutation,expected in variants:
  d=copy.deepcopy(catalog);mutation(d);(p/'catalog.json').write_text(json.dumps(d))
  manifest={'proxies':{name:{'attributes':{'registeredViews':'rws'},'methods':['setViewConfig','queryContent'],'instances':'*','broadcasts':['viewsChanged']}}}
  (stage/'meta.json').write_text(json.dumps({'id':'cluster_redline','optional':{name:'read route events'}}));(stage/'source/manifest.json').write_text(json.dumps(manifest))
  subprocess.run(['sh',str(script),str(p/'catalog.json'),str(stage)],check=True,capture_output=True)
  desktop=json.loads((stage/'source/manifest.json').read_text())
  data={'manifest':manifest,'catalog':d,'optional':{name:'read route events'}};(p/'input.json').write_text(json.dumps(data))
  js="const fs=require('fs'),b=require(process.argv[1]),d=JSON.parse(fs.readFileSync(process.argv[2]));console.log(JSON.stringify(b.filterOptionalProxies(d.manifest,d.catalog,d.optional)));"
  store=json.loads(subprocess.check_output(['node','-e',js,str(R/'tools/store-build.js'),str(p/'input.json')],text=True))
  assert desktop==store,label
  for output in [desktop,store]:
   assert (name in output['proxies'])==expected,label
   if expected:assert output['proxies'][name]=={'attributes':{},'methods':['queryContent'],'instances':'Main_Instance'}
print('PASS: actual desktop/Store query-only optional capability whitelist, catalog/version/method/instance refusal and idempotent installer upgrade')
