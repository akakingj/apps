#!/usr/bin/env python3
"""Exercise the real installer functions only against a temporary fake OAP tree."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PROJECT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT
source = (PROJECT / 'deploy/mgu-app-install.sh').read_text()


def function(name):
    # Shell functions end at an unindented brace followed by a blank line.
    start = re.search(r'^' + name + r'\(\) \{', source, re.M).start()
    end = source.index('\n}\n\n', start) + 3
    return source[start:end]


with tempfile.TemporaryDirectory(prefix='jam-installer-test-') as temporary:
    folder = Path(temporary)
    oap = folder / 'oap'
    (oap / 'oap_12201/security').mkdir(parents=True)
    (oap / 'oap_12201/data/apps').mkdir(parents=True)
    (oap / 'oap_12201/security/uids.txt').write_text('')
    packages = []
    for app, start in [('idrive_circuit', None), ('cluster_redline', 'autostart')]:
        stage = folder / app
        (stage / 'source').mkdir(parents=True)
        (stage / 'rhmiData').mkdir()
        (stage / 'oapgen').mkdir()
        (stage / 'oapgen/gen.js').write_text('// fixture')
        (stage / 'meta.json').write_text(json.dumps(dict(id=app, version='1.0.0')))
        package = dict(name=app, version='1.0.0')
        if start:
            package['mguAppStartType'] = start
        (stage / 'source/package.json').write_text(json.dumps(package))
        (stage / 'source/manifest.json').write_text('{}')
        destination = folder / (app + '.mgu')
        with tarfile.open(destination, 'w:gz') as tar:
            for item in stage.iterdir():
                tar.add(item, arcname=item.name)
        packages.append(destination)
    harness = folder / 'harness.sh'
    # Only the temp tree is writable. Hardware generation, ownership/ACL operations
    # and process discovery are stubbed; real tar/copy/registry code still executes.
    header = '''set -eu
NODE=$1
OAP=$2
MAIN=$OAP/oap_12201
UIDS=$MAIN/security/uids.txt
REG=$MAIN/data/apps
CUSTOM=$MAIN/data/custom_apps.json
TMP=$3/unpack
CATALOG=$3/catalog.json
FIRST_UID=12450
LAST_UID=12351
NEED_RESTART=0
CHANGED=0
say() { :; }
warn() { echo "$*" >&2; }
die() { echo "$*" >&2; exit 1; }
pidof() { :; }
chown() { :; }
set_acls() { :; }
optional_missing() { :; }
gen() { mkdir -p "$3"; }
'''
    names = ['uid_of', 'app_of', 'is_ours', 'free_uid', 'ensure_newline',
             'app_start_type', 'custom_list', 'verify_one', 'install_one']
    footer = '''
verify_one "$3/idrive_circuit.mgu"
verify_one "$3/cluster_redline.mgu"
install_one "$3/idrive_circuit.mgu"
install_one "$3/cluster_redline.mgu"
# A stale manual custom-list entry must be updated, preserving unrelated flags.
"$NODE" -e 'const fs=require("fs"),p=process.argv[1],c=JSON.parse(fs.readFileSync(p));c.cluster_redline["-appStartType"]="manually";c.cluster_redline.keep="owner";fs.writeFileSync(p,JSON.stringify(c))' "$CUSTOM"
install_one "$3/cluster_redline.mgu"
'''
    harness.write_text(header + '\n\n'.join(function(name) for name in names) + footer)
    subprocess.run(['sh', str(harness), shutil.which('node'), str(oap), str(folder)], check=True)
    custom = json.loads((oap / 'oap_12201/data/custom_apps.json').read_text())
    assert custom['idrive_circuit']['-appStartType'] == 'manually'
    assert custom['cluster_redline']['-appStartType'] == 'autostart'
    assert custom['cluster_redline']['keep'] == 'owner'
    for app, expected in [('idrive_circuit', 'manually'), ('cluster_redline', 'autostart')]:
        registry = json.loads((oap / 'oap_12201/data/apps' / (app + '.json')).read_text())
        assert registry['provisioningCache']['-appStartType'] == expected
        assert registry['installationSource'] == 'PREINSTALLED'
print('PASS: actual standard verify/install functions, manual default, autostart registry, custom-list persistence and update migration (temporary OAP tree only)')
