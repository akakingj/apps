"""Reproduce the notifier-only gearbox regression using upstream's checker."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
project = Path(sys.argv[1]).resolve()
checker = project / 'kit/tools/check_signals.py'
spec = json.loads((ROOT / 'apps/cluster_redline/app.json').read_text())
iface = 'de.bmw.infotainment.misc.MDrive'
field = 'dataDisplayGearbox'
assert spec['signals'][iface][field] == 's'
nav = 'de.bmw.infotainment.navigation.guiding.Guidance'
assert spec['signals'][nav]['_instances'] == 'Main_Instance'
assert all(spec['signals'][nav][key]=='rs' for key in ['guidanceState','guidingProvider','conclusiveDart'])

with tempfile.TemporaryDirectory(prefix='redline-manifest-') as temp:
    root = Path(temp)
    app = root / 'apps/cluster_redline/app.json'
    app.parent.mkdir(parents=True)
    catalog = {'interfaces': {}}
    for name, fields in spec['signals'].items():
        definitions = {}
        for key, flags in fields.items():
            if key.startswith('_'):
                continue
            definitions[key] = {'getter': {'id': 1}, 'notifier': {'id': 32769}}
        catalog['interfaces'][name] = {'fields': definitions}
    # Matches the reported firmware: the S/M programme only notifies.
    del catalog['interfaces'][iface]['fields'][field]['getter']
    fixture = root / 'catalog.json'
    fixture.write_text(json.dumps(catalog))
    broken = copy.deepcopy(spec)
    broken['signals'][iface][field] = 'rs'
    app.write_text(json.dumps(broken))
    before = subprocess.run([sys.executable, str(checker), str(fixture)], cwd=root, text=True, capture_output=True)
    assert before.returncode != 0 and field + ' no getter' in before.stdout, before.stdout + before.stderr
    app.write_text(json.dumps(spec))
    after = subprocess.run([sys.executable, str(checker), str(fixture)], cwd=root, text=True, capture_output=True)
    assert after.returncode == 0, after.stdout + after.stderr

for suffix in ('', '-ko.1'):
    for extension, manifest_path in [('mgu', 'source/manifest.json'), ('tgz', 'package/manifest.json')]:
        package = project / 'dist' / ('cluster_redline@' + spec['version'] + suffix + '.' + extension)
        with tarfile.open(package) as archive:
            manifest = json.load(archive.extractfile(manifest_path))
        assert manifest['proxies'][iface]['attributes'][field] == 's', str(package)
        assert manifest['proxies'][nav]['instances'] == 'Main_Instance', str(package)
        assert all(manifest['proxies'][nav]['attributes'][key]=='rs' for key in ['guidanceState','guidingProvider','conclusiveDart']), str(package)

print('PASS: upstream getter regression; all four language artifacts preserve notifier-only gearbox and read-only Guidance/Main_Instance')
