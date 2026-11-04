#!/usr/bin/env python3
"""Install the iDrive Circuit source overlay into an idrive7-apps checkout."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


def copy_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(source), str(target))
    print('copy', target)


def merge_tsv(additions, target):
    def rows(path):
        out = []
        for raw in path.read_text(encoding='utf-8').splitlines():
            if not raw or raw.startswith('#') or '\t' not in raw:
                continue
            key, value = raw.split('\t', 1)
            out.append((key, value))
        return out

    incoming = rows(additions)
    replacement = dict(incoming)
    merged = []
    seen = set()
    for key, value in rows(target):
        if key in replacement:
            value = replacement[key]
        if key not in seen:
            merged.append((key, value))
            seen.add(key)
    for key, value in incoming:
        if key not in seen:
            merged.append((key, value))
            seen.add(key)
    target.write_text(''.join('%s\t%s\n' % pair for pair in merged), encoding='utf-8')
    print('merge', target, '(%d Korean strings)' % len(incoming))


def main():
    parser = argparse.ArgumentParser(description='Add iDrive Circuit to an idrive7-apps checkout')
    parser.add_argument('target', help='path to the cauliflowermossgrape/idrive7-apps checkout')
    parser.add_argument('--force', action='store_true', help='replace existing iDrive Circuit files')
    parser.add_argument('--no-ko', action='store_true', help='do not merge Korean translations')
    args = parser.parse_args()

    target = Path(args.target).expanduser().resolve()
    if not (target / 'kit/tools/build.py').is_file() or not (target / 'apps').is_dir():
        parser.error('%s is not an idrive7-apps checkout' % target)
    dest_app = target / 'apps/idrive_circuit'
    if dest_app.exists() and not args.force:
        parser.error('%s already exists; inspect it, then rerun with --force' % dest_app)

    for source in sorted((HERE / 'apps/idrive_circuit').iterdir()):
        if source.is_file():
            copy_file(source, dest_app / source.name)
    copy_file(HERE / 'kit/icons/idrive_circuit.svg', target / 'kit/icons/idrive_circuit.svg')
    copy_file(HERE / 'kit/tools/test_idrive_circuit.js', target / 'kit/tools/test_idrive_circuit.js')

    if not args.no_ko:
        ko = target / 'kit/runtime/locales/ko.tsv'
        if not ko.is_file():
            parser.error('Korean locale file is missing: %s' % ko)
        merge_tsv(HERE / 'localization/ko-additions.tsv', ko)
        subprocess.run([sys.executable, str(target / 'kit/tools/sync_locales.py'), 'ko'], cwd=str(target), check=True)

    print('\niDrive Circuit source installed into:', target)
    print('Test:  node kit/tools/test_idrive_circuit.js')
    print('Build: python kit/tools/build.py --language ko --preview-only idrive_circuit')


if __name__ == '__main__':
    main()

