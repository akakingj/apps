"""Run the install report's real SSH payload against a read-only fixture."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / 'tools/collect-redline-install.ps1').read_text(encoding='utf-8')
script = re.search(r"\$remoteScript = @'\n(.*?)\n'@", source, re.S).group(1)
script.encode('ascii')
subprocess.run(['sh', '-n'], input=script, text=True, check=True)


def write(root, name, value):
    file = root / name.lstrip('/')
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(value if isinstance(value, str) else json.dumps(value), encoding='utf-8')


def snapshot(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file()}


def capture(root):
    run = subprocess.run(['sh', '-s', '--', str(root)], input=script + '\n\r\n',
                         text=True, capture_output=True, timeout=10)
    assert run.returncode == 0, run.stderr
    assert not run.stderr, run.stderr
    return run.stdout


with tempfile.TemporaryDirectory(prefix='redline-install-') as temp:
    root = Path(temp)
    write(root, '/tmp/mgu-updater.log.1', 'older install attempt\n')
    write(root, '/tmp/mgu-updater.log', 'cluster_redline@0.8.4: UPDATE_FAILED; the previous version was kept\n')
    write(root, '/var/opt/public/oap/oap_5002/data/mgu-deploy-inplace.json',
          {'state': 'failed', 'error': 'UPDATE_FAILED', 'trace': {'ops': [{'m': 'update', 'app': 'cluster_redline'}]}})
    for uid, name, version, entry in [('12501', 'cluster_redline', '0.7.0', "ctx.ui.onClick('BTN_SETTINGS', () => {});"),
                                       ('12502', 'cluster_redline_en2', '0.8.4', 'const page = new SettingsPage();')]:
        base = '/var/opt/public/oap/oap_' + uid + '/source/'
        write(root, base + 'package.json', {'name': name, 'version': version})
        write(root, base + 'javascript/app.js', entry)
        write(root, base + 'javascript/kit/app-spec.json', {'version': version, 'settings': [{'key': 'appEnabled'}]})
    write(root, '/var/opt/public/oap/oap_12502/data/cluster_redline_en2.log', 'CURRENT_APP_LOG: initialized\n')
    write(root, '/var/opt/public/oap/oap_12503/data/unrelated.log', 'DO_NOT_REPORT_OTHER_APP_LOG')
    write(root, '/proc/101/status', 'Name:\tnode\nUid:\t12502\t12502\t12502\t12502\nVmRSS:\t65536 kB\n')
    write(root, '/proc/101/comm', 'node\n')
    write(root, '/proc/102/status', 'Name:\tother\nUid:\t12503\t12503\t12503\t12503\n')
    write(root, '/proc/102/comm', 'DO_NOT_REPORT_OTHER_PROCESS\n')
    write(root, '/var/opt/public/oap/oap_12503/source/package.json', {'name': 'unrelated', 'private': 'DO_NOT_REPORT_OTHER_APP'})
    write(root, '/var/opt/mgu-updater/current/component.json', {'id': 'mgu-updater', 'version': '1.0.0'})
    write(root, '/etc/oap/someip/someip-interfaces.json', {'interfaces': {
        'de.bmw.infotainment.vehicle.CDS': {'fields': {'statusEngineSpeed2': {'secret': 'DO_NOT_REPORT_CATALOG'}}},
        'de.bmw.infotainment.misc.MDrive': {'fields': {'unrelated': {}}},
        'unrelated.private.Interface': {'secret': 'DO_NOT_REPORT_CATALOG'},
    }})
    before = snapshot(root)
    report = capture(root)
    assert snapshot(root) == before, 'Must not change files on the head unit'
    for text in ['UPDATE_FAILED', 'previous version was kept', 'older install attempt', '0.7.0', '0.8.4',
                 '"hasTabbedEntry": true', '"hasTabbedEntry": false', '"hasLegacySettingsButton": true',
                 '"pid": 101', '"rssKB": 65536', 'CURRENT_APP_LOG: initialized', '"mainSha256":',
                 '"name":"statusEngineSpeed2","present":true', '"name":"dataDisplayGearbox","present":false']:
        assert text in report, text
    assert 'DO_NOT_REPORT_CATALOG' not in report and 'DO_NOT_REPORT_OTHER_APP' not in report
    assert 'DO_NOT_REPORT_OTHER_PROCESS' not in report

with tempfile.TemporaryDirectory(prefix='redline-install-empty-') as temp:
    root = Path(temp)
    report = capture(root)
    for marker in ['INSTALL_RESULT_NOT_FOUND', 'INSTALLED_REDLINE_NOT_FOUND', 'VEHICLE_INTERFACE_CATALOG_NOT_FOUND', 'INSTALL REPORT END']:
        assert marker in report, marker
    assert not list(root.rglob('*')), 'Missing paths must stay missing'

print('PASS: real read-only SSH payload, update rejection trace, installed versions/aliases/entry kind, selected field presence, missing paths and CRLF stdin')
