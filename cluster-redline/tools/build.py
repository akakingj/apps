#!/usr/bin/env python3
"""Build the standalone app using an existing Korean-enabled idrive7-apps kit."""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tarfile

ROOT = Path(__file__).resolve().parent.parent


def archive(path, source, names):
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as tar:
            for name in names:
                item = source / name
                if item.exists():
                    tar.add(item, arcname=name)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project', required=True, type=Path, help='Korean-enabled original idrive7-apps folder')
    p.add_argument('--sdk', type=Path, help='vehicle-extracted SDK folder; not needed for preview-only')
    p.add_argument('--output', type=Path, default=ROOT / 'dist')
    p.add_argument('--preview-only', action='store_true')
    a = p.parse_args()
    project, out = a.project.resolve(), a.output.resolve()
    if not (project / 'kit/tools/build.py').is_file():
        p.error('The project must contain kit/tools/build.py')
    if not (project / 'kit/runtime/locales/ko.json').is_file():
        p.error('Apply Korean support to the original project first')
    sys.path.insert(0, str(project / 'kit/tools'))
    s = importlib.util.spec_from_file_location('mgu_base_build', project / 'kit/tools/build.py')
    build = importlib.util.module_from_spec(s)
    s.loader.exec_module(build)
    build.APPS = str(ROOT / 'apps')
    build.DIST = str(out)
    if a.sdk:
        build.SDK = str(a.sdk.resolve())
    build.build('cluster_redline', 'ko', preview_only=a.preview_only)
    stage = out / 'cluster_redline'
    source = stage / 'source'
    package_file = source / 'package.json'
    package = json.loads(package_file.read_text(encoding='utf-8'))
    # mgu-deploy honors this marker on its real install path. Older kit installers do not.
    package['mguAppStartType'] = 'autostart'
    package['mguLocalOnly'] = True
    package_file.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    licenses = source / 'javascript/LICENSES'
    licenses.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'LICENSE', licenses / 'idrive7-apps-MIT.txt')
    shutil.copyfile(ROOT / 'LICENSES/MPL-2.0.txt', licenses / 'MPL-2.0.txt')
    (licenses / 'NOTICE.txt').write_text(
        'Cluster render client: Robert Nisipeanu, MPL-2.0. Unmodified source included.\n'
        'Source: robertnisipeanu/idrive-apps native/cluster-render/js/cluster_render_client.js\n'
        'The MGU runtime remains under its original MIT license. Korean font: OFL-1.1.\n', encoding='utf-8')
    if not a.preview_only:
        ver = package['version']
        archive(out / f'cluster_redline@{ver}.mgu', stage,
                ['meta.json', 'source', 'rhmiData', 'rhmiDataStartWidget', 'oapgen'])
        npm = out / f'cluster_redline@{ver}.tgz'
        with gzip.GzipFile(filename=str(npm), mode='wb', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as tar:
                tar.add(source, arcname='package')
        bundle = out / f'cluster_redline@{ver}.mgu'
        files = [bundle, npm]
        (out / 'SHA256SUMS').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest() + '  ' + f.name + '\n' for f in files))
        (out / 'release.json').write_text(json.dumps({
            'app_id': 'cluster_redline', 'version': ver, 'bundle': bundle.name,
            'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
            'profiles': ['petrol', 'diesel', 'hybrid'],
        }, indent=2) + '\n')
        print('Install with mgu-deploy 0.7.17+ (mguAppStartType=autostart). No root helper is installed.')


if __name__ == '__main__':
    main()
