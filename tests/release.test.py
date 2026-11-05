#!/usr/bin/env python3
"""Inspect the real SDK-containing kit locally; never upload its contents."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def verify(directory, expected):
    manifest = json.loads((directory / 'kit.json').read_text())
    assert [app['id'] for app in manifest['apps']] == expected
    assert sorted(p.name for p in directory.glob('*.mgu')) == sorted(a['bundle'] for a in manifest['apps'])
    for app in manifest['apps']:
        bundle = directory / app['bundle']
        assert hashlib.sha256(bundle.read_bytes()).hexdigest() == app['sha256']
        with tarfile.open(bundle) as tar:
            package = json.load(tar.extractfile('source/package.json'))
            assert package['name'] == app['id'] and package['version'] == app['version']
            assert package['mguAppStartType'] == app['start_type']
            assert package['mguAppStartType'] == ('autostart' if app['id'] == 'cluster_redline' else 'manually')
            assert package['mguLocalOnly'] is True
            locale = json.load(tar.extractfile('source/javascript/kit/locale.json'))
            assert locale['language'] == 'ko'
            assert locale['strings']['iDrive Circuit'] == '아이드라이브 회로'
            assert 'source/javascript/kit/fonts/korean.json' in tar.getnames()
            for source in (ROOT / 'apps' / app['id']).glob('*.js'):
                name = 'app.js' if source.name == 'main.js' else source.name
                assert tar.extractfile('source/javascript/' + name).read().endswith(source.read_bytes())
            spec = json.load(tar.extractfile('source/javascript/kit/app-spec.json'))
            if app['id'] == 'cluster_redline':
                assert spec['title'] == '계기판 레드라인'
                labels = [s['label'] for s in spec['settings']]
                assert '엔진 프로필' in labels and '렌더러' in labels
        for name in ('README.md', 'README.ko.md'):
            assert (directory / 'docs' / app['id'] / name).is_file()
    subprocess.run(['node', str(ROOT / 'tools/check-kit.js'), '--verify-only', str(directory)], check=True, stdout=subprocess.DEVNULL)
    with zipfile.ZipFile(directory.with_suffix('.zip')) as zipped:
        assert zipped.testzip() is None
        assert sorted(p for p in zipped.namelist() if p.endswith('.mgu')) == sorted(a['bundle'] for a in manifest['apps'])


if __name__ == '__main__':
    verify(ROOT / 'dist/idrive7-jam-ko-kit', ['idrive_circuit', 'cluster_redline'])
    if len(sys.argv) > 1:
        project = Path(sys.argv[1]).resolve()
        with tempfile.TemporaryDirectory(prefix='jam-single-release-') as temporary:
            # Reuse an output folder deliberately to test switching the selected app.
            output = Path(temporary)
            for app in ('idrive_circuit', 'cluster_redline'):
                subprocess.run([sys.executable, str(ROOT / 'tools/build-apps.py'), '--project', str(project),
                                '--output', str(output), '--apps', app], check=True, stdout=subprocess.DEVNULL)
                verify(output / (app + '-ko-kit'), [app])
    print('PASS: real Korean packages, app source, font, separate guides, manual/autostart metadata, combined ZIP and isolated single-app kits')
