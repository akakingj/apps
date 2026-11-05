#!/usr/bin/env python3
"""Copy selected Jam app sources and their shared tools into an upstream checkout."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent.parent
APPS = ('idrive_circuit', 'cluster_redline')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', type=Path)
    parser.add_argument('--apps', nargs='+', choices=APPS, default=list(APPS))
    parser.add_argument('--force', action='store_true', help='replace conflicting selected app/tool files')
    parser.add_argument('--no-ko', action='store_true', help='leave the target Korean catalog unchanged')
    args = parser.parse_args()
    target = args.target.expanduser().resolve()
    selected = list(dict.fromkeys(args.apps))
    if target == HERE or not (target / 'kit/tools/build.py').is_file() or not (target / 'apps').is_dir():
        parser.error('Target must be a separate upstream idrive7-apps checkout')
    files = []
    for app in selected:
        files.extend(p.relative_to(HERE) for p in (HERE / 'apps' / app).rglob('*') if p.is_file())
        images = HERE / 'screenshots' / app
        if images.is_dir():
            files.extend(p.relative_to(HERE) for p in images.rglob('*') if p.is_file())
        if app == 'idrive_circuit':
            files += [Path('kit/icons/idrive_circuit.svg'), Path('kit/tools/test_idrive_circuit.js')]
        else:
            files.extend(p.relative_to(HERE) for p in (HERE / 'tests/cluster_redline').glob('*.js'))
    files += [Path('tools') / p for p in ('build-apps.py', 'cluster-redline-preview.js',
              'cluster-redline-preflight.js', 'check-kit.js', 'install-on-mgu.sh')]
    files += [Path(p) for p in ('docs/INSTALL-KIT.ko.md', 'localization/ko-additions.tsv',
              'LICENSES/MPL-2.0.txt', 'NOTICE.cluster-redline.md')]
    conflicts = [str(p) for p in files if (target / p).exists() and
                 ((target / p).is_dir() or (target / p).read_bytes() != (HERE / p).read_bytes())]
    if conflicts and not args.force:
        parser.error('Inspect conflicting files, then use --force to replace them: ' + ', '.join(conflicts))
    ko = target / 'kit/runtime/locales/ko.json'
    if not args.no_ko and not ko.is_file():
        parser.error('Korean runtime is missing; apply Korean support before merging translations')
    for relative in files:
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(HERE / relative, destination)
    if not args.no_ko:
        spec = importlib.util.spec_from_file_location('jam_build', HERE / 'tools/build-apps.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        additions = module.translations(HERE / 'localization/ko-additions.tsv')
        words = json.loads(ko.read_text(encoding='utf-8'))
        words.update(additions)
        tsv = target / 'kit/runtime/locales/ko.tsv'
        if tsv.is_file() and (target / 'kit/tools/sync_locales.py').is_file():
            rows = dict(line.split('\t', 1) for line in tsv.read_text(encoding='utf-8').splitlines()
                        if line and not line.startswith('#') and '\t' in line)
            rows.update(additions)
            tsv.write_text(''.join(key + '\t' + value + '\n' for key, value in rows.items()), encoding='utf-8')
            subprocess.run([sys.executable, str(target / 'kit/tools/sync_locales.py'), 'ko'], cwd=str(target), check=True)
        ko.write_text(json.dumps(words, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Installed source overlay:', ', '.join(selected))
    print('From the target folder: python tools/build-apps.py --project . --apps ' + ' '.join(selected))
    print('Use the resulting kit installer for Cluster Redline autostart support.')


if __name__ == '__main__':
    main()
