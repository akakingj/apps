"""Exercise actual Store/desktop optional-input filtering without tar or a vehicle."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
project = Path(sys.argv[1]).resolve()
loader = importlib.util.spec_from_file_location('integration', ROOT / 'tools/upstream-integration.py')
integration = importlib.util.module_from_spec(loader)
loader.loader.exec_module(integration)
original = (project / 'deploy/mgu-app-install.sh').read_text()
# Existing users already have the earlier Jam marker. It must not bypass this patch.
patched = integration.installer_source(original)
assert integration.INSTALL_MARKER in patched
assert patched.count(integration.OPTIONAL_GUIDANCE_MARKER) == 1
assert integration.installer_source(patched) == patched
# The new optional edit also works before the older metadata integration.
assert integration.optional_guidance_source(integration.optional_guidance_source(original)) == integration.optional_guidance_source(original)
start = re.search(r'^optional_missing\(\) \{', patched, re.M).start()
end = patched.index('\n}\n\n', start) + 3
function = patched[start:end]
NAV = 'de.bmw.infotainment.navigation.guiding.Guidance'
MDRIVE = 'de.bmw.infotainment.misc.MDrive'
MANDATORY = 'de.bmw.infotainment.vehicle.CDS'
manifest = {'proxies': {
    NAV: {'instances': 'Main_Instance', 'attributes': {'guidanceState': 'r'}},
    MDRIVE: {'attributes': {'dataDisplayGearbox': 's'}},
    MANDATORY: {'attributes': {'statusEngineSpeed2': 'rs'}},
}}
node = shutil.which('node')
store_js = r'''
const fs=require('fs'), b=require(process.argv[1]);
const input=JSON.parse(fs.readFileSync(process.argv[2]));
const before=JSON.stringify(input.catalog);
const result=b.filterOptionalProxies(input.manifest,input.catalog,input.optional);
if(JSON.stringify(input.catalog)!==before)throw Error('catalog changed');
process.stdout.write(JSON.stringify(result));
'''
with tempfile.TemporaryDirectory(prefix='redline-optional-guidance-') as temp:
    folder = Path(temp)
    stage = folder / 'stage'
    (stage / 'source/javascript/kit').mkdir(parents=True)
    catalog_file = folder / 'catalog.json'
    harness = folder / 'optional.sh'
    harness.write_text('set -eu\nNODE=$1\nCATALOG=$2\n' + function + '\noptional_missing "$3"\n')
    variants = [
        ('absent interface', None, False),
        ('missing field', {}, False),
        ('notifier only', {'notifier': {'id': 32769}}, False),
        ('getter only', {'getter': {'id': 1}}, True),
        ('getter and notifier', {'getter': {'id': 1}, 'notifier': {'id': 32769}}, True),
        ('empty getter', {'getter': {}}, False),
        ('zero getter ID', {'getter': {'id': 0}}, False),
    ]
    for label, definition, expected in variants:
        catalog = {'interfaces': {
            MANDATORY: {'fields': {'statusEngineSpeed2': {'getter': {'id': 1}, 'notifier': {'id': 32769}}}},
            MDRIVE: {'fields': {'dataDisplayGearbox': {'notifier': {'id': 32769}}}},
        }}
        if definition is not None:
            catalog['interfaces'][NAV] = {'fields': {}}
            if definition:
                catalog['interfaces'][NAV]['fields']['guidanceState'] = definition
        catalog['instanceIDs'] = {NAV: {'Main_Instance': 1}}
        catalog_file.write_text(json.dumps(catalog))
        catalog_hash = hashlib.sha256(catalog_file.read_bytes()).digest()
        for marked_optional in [True, False]:
            requested = copy.deepcopy(manifest)
            optional = {NAV: 'native route-state reader'} if marked_optional else {}
            (stage / 'meta.json').write_text(json.dumps({'id': 'cluster_redline', 'optional': optional}))
            target = stage / 'source/manifest.json'
            target.write_text(json.dumps(requested))
            missing = stage / 'source/javascript/kit/missing-interfaces.json'
            missing.unlink(missing_ok=True)
            subprocess.run(['sh', str(harness), node, str(catalog_file), str(stage)], check=True, capture_output=True, text=True)
            desktop = json.loads(target.read_text())
            store_input = folder / 'input.json'
            store_input.write_text(json.dumps({'manifest': requested, 'catalog': catalog, 'optional': optional}))
            store = json.loads(subprocess.check_output([node, '-e', store_js, str(ROOT / 'tools/store-build.js'), str(store_input)], text=True))
            present = expected or not marked_optional
            for result in [desktop, store]:
                assert (NAV in result['proxies']) == present, (label, marked_optional, result)
                assert result['proxies'][MANDATORY] == manifest['proxies'][MANDATORY]
                assert result['proxies'][MDRIVE] == manifest['proxies'][MDRIVE]
                if present:
                    assert result['proxies'][NAV]['attributes']['guidanceState'] == 'r'
                    assert result['proxies'][NAV]['instances'] == 'Main_Instance'
                assert all('w' not in flags for proxy in result['proxies'].values() for flags in proxy['attributes'].values())
            assert hashlib.sha256(catalog_file.read_bytes()).digest() == catalog_hash
            assert missing.exists() == (marked_optional and not expected)
    # The real catalog has a separate named instance table. A getter is not
    # enough: accepting an absent Main_Instance caused an un-installable proxy.
    for instances in [None, {}, {'1': 1}, {'Other_Instance': 1}, {'Main_Instance': None}, {'Main_Instance': 1}]:
        catalog = {'interfaces': {NAV: {'fields': {'guidanceState': {'getter': {'id': 1}}}},
                                  MDRIVE: {'fields': {'dataDisplayGearbox': {'notifier': {'id': 32769}}}}}}
        if instances is not None: catalog['instanceIDs'] = {NAV: instances}
        catalog_file.write_text(json.dumps(catalog))
        (stage / 'meta.json').write_text(json.dumps({'id': 'cluster_redline', 'optional': {NAV: 'route state'}}))
        target.write_text(json.dumps(manifest))
        subprocess.run(['sh', str(harness), node, str(catalog_file), str(stage)], check=True, capture_output=True, text=True)
        desktop = json.loads(target.read_text())
        store_input.write_text(json.dumps({'manifest': manifest, 'catalog': catalog, 'optional': {NAV: True}}))
        store = json.loads(subprocess.check_output([node, '-e', store_js, str(ROOT / 'tools/store-build.js'), str(store_input)], text=True))
        expected = instances is not None and instances.get('Main_Instance') is not None
        for result in [desktop, store]:
            assert (NAV in result['proxies']) == expected, (instances, result)
            assert result['proxies'][MDRIVE] == manifest['proxies'][MDRIVE]
            if expected: assert result['proxies'][NAV]['instances'] == 'Main_Instance'
    # Preserve Store's pre-existing optional S/M notifier requirements.
    for definition, expected in [(None, False), ({'getter': {'id': 1}}, False), ({'notifier': {'id': 32769}}, True)]:
        catalog = {'interfaces': {MDRIVE: {'fields': {'dataDisplayGearbox': definition}}}} if definition else {'interfaces': {}}
        store_input = folder / 'input.json'
        store_input.write_text(json.dumps({'manifest': manifest, 'catalog': catalog, 'optional': {NAV: True}}))
        result = json.loads(subprocess.check_output([node, '-e', store_js, str(ROOT / 'tools/store-build.js'), str(store_input)], text=True))
        assert (MDRIVE in result['proxies']) == expected
    # New navigation inputs remain independently optional. Never send an
    # unsupported getter/notifier request to BMW's installer generator.
    for label, extras, expected in [
        ('state only', {}, {'guidanceState':'rs'}),
        ('getter only navigation', {'guidingProvider':{'getter':{'id':27}}, 'conclusiveDart':{'getter':{'id':28}}}, {'guidanceState':'rs','guidingProvider':'r','conclusiveDart':'r'}),
        ('full navigation', {'guidingProvider':{'getter':{'id':27},'notifier':{'id':32789}}, 'conclusiveDart':{'getter':{'id':28},'notifier':{'id':32790}}}, {'guidanceState':'rs','guidingProvider':'rs','conclusiveDart':'rs'}),
        ('invalid navigation getters', {'guidingProvider':{'getter':{}}, 'conclusiveDart':{'notifier':{'id':32790}}}, {'guidanceState':'rs'}),
    ]:
        fields={'guidanceState':{'getter':{'id':2},'notifier':{'id':32770}}}
        fields.update(extras)
        catalog={'interfaces':{NAV:{'fields':fields},MDRIVE:{'fields':{'dataDisplayGearbox':{'notifier':{'id':32769}}}}},'instanceIDs':{NAV:{'Main_Instance':128}}}
        requested=copy.deepcopy(manifest)
        requested['proxies'][NAV]['attributes']={key:'rs' for key in ['guidanceState','guidingProvider','conclusiveDart']}
        catalog_file.write_text(json.dumps(catalog))
        (stage/'meta.json').write_text(json.dumps({'id':'cluster_redline','optional':{NAV:'navigation'}}))
        target.write_text(json.dumps(requested))
        subprocess.run(['sh',str(harness),node,str(catalog_file),str(stage)],check=True,capture_output=True,text=True)
        desktop=json.loads(target.read_text())
        store_input.write_text(json.dumps({'manifest':requested,'catalog':catalog,'optional':{NAV:True}}))
        store=json.loads(subprocess.check_output([node,'-e',store_js,str(ROOT/'tools/store-build.js'),str(store_input)],text=True))
        for result in [desktop,store]:
            assert result['proxies'][NAV]['attributes']==expected,(label,result['proxies'][NAV])
            assert result['proxies'][NAV]['instances']=='Main_Instance'
print('PASS: named Main_Instance requirements, missing/empty/invalid getter metadata, actual desktop/Store optional Guidance filtering (missing interface/field/getter, notifier-only, getter-only, both), mandatory preservation, read-only flags/catalog, prior Jam-marker upgrade and idempotency')
