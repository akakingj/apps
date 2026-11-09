"""Run actual Store and desktop field filters against partial vehicle catalogs."""
import copy,importlib.util,json,re,subprocess,tempfile,sys
from pathlib import Path
R=Path(__file__).resolve().parent.parent
I=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else R
spec=importlib.util.spec_from_file_location('integration',R/'tools/upstream-integration.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
source=mod.installer_source((I/'deploy/mgu-app-install.sh').read_text());assert mod.installer_source(source)==source
start=re.search(r'^optional_missing\(\) \{',source,re.M).start();end=source.index('\n}\n\n',start)+3;function=source[start:end]
cds='de.bmw.infotainment.vehicle.CDS';fes='de.bmw.infotainment.drivingexcitement.FES';env='de.bmw.infrastructure.EnvironmentalInformation'
fields={cds:['statusEngineSpeed2','statusEngineTemperature','statusBattery2'],fes:['statusActualValueTorque2','statusSwitchDriveDynamicSport2'],cds+'2':['statusInjectionVolume','statusLateralAccelerationMassCenter','statusLongitudinalAccelerationMassCenter'],env:['UnitBN2020','ExteriorTemperature'],'de.bmw.infotainment.KombiIF':['statusBordcomputerAverage']}
extras=[(i,k) for i,keys in fields.items() for k in keys if k not in ['statusEngineSpeed2','statusActualValueTorque2','UnitBN2020']]
catalog={'interfaces':{i:{'fields':{k:{'getter':{'id':n+1},'notifier':{'id':32770+n}} for n,k in enumerate(keys)}} for i,keys in fields.items()},'instanceIDs':{}}
manifest={'proxies':{i:{'attributes':{k:'rs' for k in keys},'instances':'1'} for i,keys in fields.items()}}
variants=[('supported','none'),('missing extras','missing'),('poll only','notifier_missing'),('invalid notifier','notifier_bad'),('invalid getter','getter_bad')]
with tempfile.TemporaryDirectory(prefix='aux-optional-') as tmp:
 p=Path(tmp);stage=p/'app';(stage/'source/javascript/kit').mkdir(parents=True)
 script=p/'test.sh';script.write_text('NODE="$(command -v node)"\nCATALOG="$1"\n'+function+'\noptional_missing "$2"\n')
 for label,kind in variants:
  d=copy.deepcopy(catalog)
  for i,k in extras:
   if kind=='missing':d['interfaces'][i]['fields'].pop(k)
   elif kind=='notifier_missing':d['interfaces'][i]['fields'][k].pop('notifier')
   elif kind=='notifier_bad':d['interfaces'][i]['fields'][k]['notifier']['id']=1
   elif kind=='getter_bad':d['interfaces'][i]['fields'][k]['getter']['id']=32768
  (p/'catalog.json').write_text(json.dumps(d));opt={cds+'2':'optional aux',env:'optional outside'}
  (stage/'meta.json').write_text(json.dumps({'id':'cluster_redline','optional':opt}));(stage/'source/manifest.json').write_text(json.dumps(manifest))
  subprocess.run(['sh',str(script),str(p/'catalog.json'),str(stage)],check=True,capture_output=True)
  desktop=json.loads((stage/'source/manifest.json').read_text())
  (p/'input.json').write_text(json.dumps({'manifest':manifest,'catalog':d,'optional':opt}))
  js="const fs=require('fs'),m=require(process.argv[1]),d=JSON.parse(fs.readFileSync(process.argv[2]));console.log(JSON.stringify(m.filterOptionalProxies(d.manifest,d.catalog,d.optional)));"
  store=json.loads(subprocess.check_output(['node','-e',js,str(R/'tools/store-build.js'),str(p/'input.json')],text=True));assert desktop==store,label
  for out in [desktop,store]:
   for i,k in [(cds,'statusEngineSpeed2'),(fes,'statusActualValueTorque2'),(env,'UnitBN2020')]:assert out['proxies'][i]['attributes'][k]=='rs',label
   for i,k in extras:
    attrs=out['proxies'].get(i,{}).get('attributes',{})
    if kind in ['missing','getter_bad']:assert k not in attrs,label
    else:assert attrs[k]==('rs' if kind=='none' else 'r'),label
print('PASS: Store/desktop parity for six optional fields, missing/invalid getter isolation, notifier downgrade, read-only access and preserved core RPM/torque/unit inputs')
# The voltage transport is optional and may expose only the named read API.
tasu='com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu'
with tempfile.TemporaryDirectory(prefix='voltage-optional-') as tmp:
 p=Path(tmp);stage=p/'app';(stage/'source/javascript/kit').mkdir(parents=True)
 script=p/'test.sh';script.write_text('NODE="$(command -v node)"\nCATALOG="$1"\n'+function+'\noptional_missing "$2"\n')
 for kind in ['supported','missing_method','wrong_instance','wrong_version','missing_event']:
  d=copy.deepcopy(catalog);d['interfaces'][tasu]={'serviceId':63654,'version':{'major':1},'methods':{'sendTasuRequest':{'methodId':1}},'events':{'sendTasuResponse':{'eventId':32769}}};d['instanceIDs'][tasu]={'SystemFunctionsInternalTasuInst1':128}
  if kind=='missing_method':d['interfaces'][tasu]['methods']={}
  if kind=='wrong_instance':d['instanceIDs'][tasu]['SystemFunctionsInternalTasuInst1']=1
  if kind=='wrong_version':d['interfaces'][tasu]['version']['major']=2
  if kind=='missing_event':d['interfaces'][tasu]['events']={}
  m=copy.deepcopy(manifest);m['proxies'][tasu]={'instances':'SystemFunctionsInternalTasuInst1','methods':['sendTasuRequest'],'broadcasts':['sendTasuResponse']};opt={tasu:'optional voltage'}
  (p/'catalog.json').write_text(json.dumps(d));(stage/'meta.json').write_text(json.dumps({'id':'cluster_redline','optional':opt}));(stage/'source/manifest.json').write_text(json.dumps(m));subprocess.run(['sh',str(script),str(p/'catalog.json'),str(stage)],check=True,capture_output=True)
  desktop=json.loads((stage/'source/manifest.json').read_text());(p/'input.json').write_text(json.dumps({'manifest':m,'catalog':d,'optional':opt}));store=json.loads(subprocess.check_output(['node','-e',js,str(R/'tools/store-build.js'),str(p/'input.json')],text=True));assert desktop==store,kind
  if kind=='supported':assert store['proxies'][tasu]==m['proxies'][tasu]
  else:assert tasu not in store['proxies'],kind
print('PASS: optional voltage transport version/instance/method/event gates agree for desktop and Store; only the bounded voltage reader uses it')
