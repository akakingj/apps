#!/usr/bin/env python3
"""Build one or both Korean apps, then make one private, SDK-containing MGU kit."""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
APP_IDS = ('idrive_circuit', 'cluster_redline')


def translations(path):
    return dict(line.split('\t', 1) for line in path.read_text(encoding='utf-8').splitlines()
                if line and not line.startswith('#') and '\t' in line)


def archive(path, source, names):
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as tar:
            for name in names:
                if (source / name).exists():
                    tar.add(source / name, arcname=name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True, type=Path, help='Korean-enabled upstream idrive7-apps checkout')
    parser.add_argument('--sdk', type=Path, help='owner-provided SDK; defaults to PROJECT/oap-sdk')
    parser.add_argument('--apps', nargs='+', choices=APP_IDS, default=list(APP_IDS))
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--preview-only', action='store_true', help='no SDK needed; creates no installation kit')
    args = parser.parse_args()
    project, output = args.project.resolve(), args.output.resolve()
    apps = list(dict.fromkeys(args.apps))
    required = ('kit/tools/build.py', 'kit/runtime/locales/ko.json',
                'kit/localization/fonts/korean.json', 'kit/localization/fonts/OFL-NotoSansKR.txt')
    if not all((project / p).is_file() for p in required):
        parser.error('Use an upstream checkout with Korean runtime, locale and font support. See README.ko.md.')
    sdk = args.sdk.resolve() if args.sdk else project / 'oap-sdk'
    if not args.preview_only and not all((sdk / p).is_file() for p in ('index.js', 'package.json')):
        parser.error('Your own oap-sdk/index.js and package.json are required; use --preview-only without them.')
    output.mkdir(parents=True, exist_ok=True)
    # Never merge translations or copy apps into the owner's upstream checkout.
    with tempfile.TemporaryDirectory(prefix='idrive-jam-build-') as temp:
        kit = Path(temp) / 'kit'
        shutil.copytree(project / 'kit', kit)
        words = json.loads((kit / 'runtime/locales/ko.json').read_text(encoding='utf-8'))
        words.update(translations(ROOT / 'localization/ko-additions.tsv'))
        (kit / 'runtime/locales/ko.json').write_text(json.dumps(words, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        sys.path.insert(0, str(kit / 'tools'))
        spec = importlib.util.spec_from_file_location('jam_upstream_build', kit / 'tools/build.py')
        build = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(build)
        build.APPS, build.DIST, build.SDK = str(ROOT / 'apps'), str(output), str(sdk)
        records = []
        for app_id in apps:
            build.build(app_id, 'ko', preview_only=args.preview_only)
            stage = output / app_id
            source = stage / 'source'
            package_path = source / 'package.json'
            package = json.loads(package_path.read_text(encoding='utf-8'))
            start_type = 'autostart' if app_id == 'cluster_redline' else 'manually'
            package.update(mguAppStartType=start_type, mguLocalOnly=True)
            package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            licenses = source / 'javascript/LICENSES'
            licenses.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / 'LICENSE', licenses / 'idrive7-apps-MIT.txt')
            if app_id == 'cluster_redline':
                shutil.copy2(ROOT / 'LICENSES/MPL-2.0.txt', licenses / 'MPL-2.0.txt')
                shutil.copy2(ROOT / 'NOTICE.cluster-redline.md', licenses / 'NOTICE.md')
            if not args.preview_only:
                version = package['version']
                bundle = output / ('%s@%s.mgu' % (app_id, version))
                archive(bundle, stage, ('meta.json', 'source', 'rhmiData', 'rhmiDataStartWidget', 'oapgen'))
                with gzip.GzipFile(filename=str(output / ('%s@%s.tgz' % (app_id, version))), mode='wb', mtime=0) as compressed:
                    with tarfile.open(fileobj=compressed, mode='w') as tar:
                        tar.add(source, arcname='package')
                records.append(dict(id=app_id, version=version, bundle=bundle.name,
                                    sha256=hashlib.sha256(bundle.read_bytes()).hexdigest(), start_type=start_type))
    if args.preview_only:
        print('Korean previews staged. No installation ZIP was created or updated.')
        return
    # Each selected set has a separate folder: a single-app build cannot leave the
    # other app in a previously generated combined kit.
    kit_name = 'idrive7-jam-ko-kit' if len(apps) == 2 else apps[0] + '-ko-kit'
    destination = output / kit_name
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()
    for record in records:
        shutil.copy2(output / record['bundle'], destination / record['bundle'])
    (destination / 'kit.json').write_text(json.dumps(dict(schema_version=1, language='ko', apps=records), indent=2) + '\n', encoding='utf-8')
    for name in ('check-kit.js', 'cluster-redline-preflight.js', 'install-on-mgu.sh'):
        shutil.copy2(ROOT / 'tools' / name, destination / name)
    shutil.copy2(ROOT / 'docs/INSTALL-KIT.ko.md', destination / 'INSTALL.ko.md')
    for app_id in apps:
        folder = destination / 'docs' / app_id
        folder.mkdir(parents=True)
        for name in ('README.md', 'README.ko.md'):
            shutil.copy2(ROOT / 'apps' / app_id / name, folder / name)
        images = ROOT / 'screenshots' / app_id
        if images.is_dir():
            shutil.copytree(images, destination / 'screenshots' / app_id)
    sums = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.relative_to(destination).as_posix() + '\n'
                   for p in sorted(destination.rglob('*')) if p.is_file())
    (destination / 'SHA256SUMS').write_text(sums, encoding='utf-8')
    zip_path = output / (kit_name + '.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipped:
        for path in sorted(destination.rglob('*')):
            if path.is_file():
                zipped.write(path, path.relative_to(destination).as_posix())
    print('PRIVATE SDK-containing installation kit:', zip_path)
    print('Do not publish this ZIP, .mgu, .tgz or the SDK on GitHub. Public source is in apps/.')


if __name__ == '__main__':
    main()
