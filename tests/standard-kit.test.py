#!/usr/bin/env python3
"""Check the actual all-app kit produced by the unmodified make-car-kit entry point."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

PROJECT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
folder = PROJECT / 'dist/mgu-custom-apps-ko'
expected = {json.loads(p.read_text())['id'] for p in (PROJECT / 'apps').glob('*/app.json')}
actual = set()
for package_path in (folder / 'apps').glob('*.mgu'):
    with tarfile.open(package_path) as package:
        app = json.load(package.extractfile('source/package.json'))
        identity = app['name']
        assert identity not in actual
        actual.add(identity)
        assert json.load(package.extractfile('source/javascript/kit/locale.json'))['language'] == 'ko'
        assert 'source/javascript/kit/fonts/korean.json' in package.getnames()
        if identity == 'cluster_redline':
            assert app['mguAppStartType'] == 'autostart'
            assert app['mguClusterRenderMinVersion'] == '0.3.10'
            assert app['mguLocalOnly'] is True
            assert 'source/javascript/LICENSE' in package.getnames()
            assert 'source/javascript/NOTICE' in package.getnames()
            for source in (PROJECT / 'apps/cluster_redline').glob('*.js'):
                name = 'app.js' if source.name == 'main.js' else source.name
                assert package.extractfile('source/javascript/' + name).read().endswith(source.read_bytes())
        else:
            assert app.get('mguAppStartType', 'manually') == 'manually'
assert expected == actual and {'idrive_circuit', 'cluster_redline', 'redline', 'service'} <= actual
sums = {}
for row in (folder / 'KIT_SUMS').read_text().splitlines():
    digest, name = row.split('  ', 1)
    assert hashlib.md5((folder / name).read_bytes()).hexdigest() == digest
    sums[name] = digest
assert {str(p.relative_to(folder)).replace('\\', '/') for p in (folder / 'apps').glob('*.mgu')} <= set(sums)
installer = (folder / 'mgu-app-install.sh').read_text()
assert 'Jam package start type v1' in installer and 'custom_list add "$id" "$start_type"' in installer
with tarfile.open(PROJECT / 'dist/mgu-custom-apps-ko.tar.gz') as archive:
    names = set(archive.getnames())
    assert {'mgu-custom-apps/' + name for name in sums} <= names
    assert archive.extractfile('mgu-custom-apps/mgu-app-install.sh').read() == (folder / 'mgu-app-install.sh').read_bytes()
print('PASS: actual standard Korean kit contains all %d apps, both new apps, preserved startup modes, current source, licenses, KIT_SUMS and normal deployment scripts' % len(actual))
