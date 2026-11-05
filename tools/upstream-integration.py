#!/usr/bin/env python3
"""Small, guarded edits for upstream's normal build and car installer paths."""
from pathlib import Path

BUILD_MARKER = '# Jam package metadata v1'
INSTALL_MARKER = '# Jam package start type v1'


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Unsupported upstream version: expected one integration anchor: ' + old[:95])
    return text.replace(old, new, 1)


def build_source(text):
    if BUILD_MARKER in text:
        return text
    anchor = "    json.dump(pkg, open(os.path.join(src, 'package.json'), 'w', encoding='utf-8', newline='\\n'), indent=2)"
    addition = '''    # Jam package metadata v1: normal apps keep their existing manual startup.
    if 'mguAppStartType' in spec:
        if spec['mguAppStartType'] not in ('manually', 'autostart'):
            raise ValueError('Invalid mguAppStartType')
        pkg['mguAppStartType'] = spec['mguAppStartType']
    if 'mguLocalOnly' in spec:
        if not isinstance(spec['mguLocalOnly'], bool):
            raise ValueError('Invalid mguLocalOnly')
        pkg['mguLocalOnly'] = spec['mguLocalOnly']
    if 'mguClusterRenderMinVersion' in spec:
        if not isinstance(spec['mguClusterRenderMinVersion'], str) or not re.fullmatch(r'\\d+\\.\\d+\\.\\d+', spec['mguClusterRenderMinVersion']):
            raise ValueError('Invalid mguClusterRenderMinVersion')
        pkg['mguClusterRenderMinVersion'] = spec['mguClusterRenderMinVersion']
'''
    return replace_once(text, anchor, addition + anchor)


APP_START_HELPER = '''# Jam package start type v1: validate before registry or app files are changed.
app_start_type() {
    "$NODE" - "$1" <<'JAM_METADATA'
const fs = require('fs');
try {
    const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const start = p.mguAppStartType === undefined ? 'manually' : p.mguAppStartType;
    if (start !== 'manually' && start !== 'autostart') throw new Error('Invalid mguAppStartType');
    if (p.mguClusterRenderMinVersion !== undefined) {
        const minimum = p.mguClusterRenderMinVersion;
        if (typeof minimum !== 'string' || !/^\\d+\\.\\d+\\.\\d+$/.test(minimum)) throw new Error('Invalid cluster-render requirement');
        // Jam renderer discovery v2: prefer active metadata; old layouts store it at the tool root.
        let component;
        for (const file of ['/var/opt/cluster-render/current/component.json', '/var/opt/cluster-render/component.json']) {
            try { component = JSON.parse(fs.readFileSync(file, 'utf8')); break; }
            catch (e) { if (e.code !== 'ENOENT') throw e; }
        }
        if (!component) throw new Error('cluster-render metadata missing; need >= ' + minimum + ' (0.3.1 is older than 0.3.10)');
        if (component.id !== 'cluster-render' || typeof component.version !== 'string' || !/^\\d+\\.\\d+\\.\\d+$/.test(component.version)) throw new Error('cluster-render metadata is invalid');
        const have = component.version.split('.').map(Number), want = minimum.split('.').map(Number);
        let enough = true;
        for (let i = 0; i < 3; i++) {
            if (have[i] !== want[i]) { enough = have[i] > want[i]; break; }
        }
        if (!enough) throw new Error('cluster-render >= ' + minimum + ' required; found ' + component.version + '. Update the renderer (current upstream: 0.4.0).');
    }
    process.stdout.write(start);
} catch (e) { console.error('[mgu-app] package requirements: ' + e.message); process.exit(1); }
JAM_METADATA
}

'''


def installer_source(text):
    if INSTALL_MARKER in text:
        if 'Jam renderer discovery v2' not in text:
            text = replace_once(text, "        const component = JSON.parse(fs.readFileSync('/var/opt/cluster-render/current/component.json', 'utf8'));", """        // Jam renderer discovery v2: prefer active metadata; old layouts store it at the tool root.
        let component;
        for (const file of ['/var/opt/cluster-render/current/component.json', '/var/opt/cluster-render/component.json']) {
            try { component = JSON.parse(fs.readFileSync(file, 'utf8')); break; }
            catch (e) { if (e.code !== 'ENOENT') throw e; }
        }
        if (!component) throw new Error('cluster-render metadata missing; need >= ' + minimum + ' (0.3.1 is older than 0.3.10)');""")
            text = replace_once(text, "if (!enough) throw new Error('cluster-render ' + minimum + '+ required');", "if (!enough) throw new Error('cluster-render >= ' + minimum + ' required; found ' + component.version + '. Update the renderer (current upstream: 0.4.0).');")
        return text
    text = replace_once(text, 'custom_list() {', APP_START_HELPER + 'custom_list() {')
    text = replace_once(text,
        'const fs = require("fs"), f = process.argv[1], op = process.argv[2], id = process.argv[3];',
        'const fs = require("fs"), f = process.argv[1], op = process.argv[2], id = process.argv[3], start = process.argv[4] || "manually";')
    text = replace_once(text,
        'if (op === "add") c[id] = c[id] || { "-appStartType": "manually", "-userLoginRequired": "false" };',
        'if (op === "add") c[id] = Object.assign({}, c[id] || {}, { "-appStartType": start, "-userLoginRequired": "false" });')
    text = replace_once(text,
        '\' "$CUSTOM" "$1" "$2" || warn "could not update $CUSTOM"',
        '\' "$CUSTOM" "$1" "$2" "${3:-manually}" || warn "could not update $CUSTOM"')
    anchor = '    optional_missing "$TMP" || die "cannot read $pkg or $CATALOG"'
    if text.count(anchor) != 2:
        raise ValueError('Unsupported installer: verify and install requirement anchors changed')
    text = text.replace(anchor,
        '    start_type=$(app_start_type "$TMP/source/package.json") || die "package requirements failed for $id"\n' + anchor)
    text = replace_once(text, '"-appStartType":"manually"', '"-appStartType":"%s"')
    text = replace_once(text, '\' "$u" > "$REG/$id.json"', '\' "$u" "$start_type" > "$REG/$id.json"')
    text = replace_once(text, '    custom_list add "$id"', '    custom_list add "$id" "$start_type"')
    return text



def kit_source(text):
    if '# Jam cluster diagnostic v1' in text:
        return text
    before = "    for src, dst in CAR_FILES:"
    addition = """    # Jam cluster diagnostic v1: standalone, read-only by default; explicit setup/restore options.
    if 'cluster_redline' in apps:
        shutil.copyfile(os.path.join(ROOT, 'apps', 'cluster_redline', 'renderer.js'),
                        os.path.join(OUT, 'cluster-redline-renderer.js'))
"""
    text = replace_once(text, before, addition + before)
    checksum = "    with open(os.path.join(OUT, 'KIT_SUMS'), 'w', encoding='utf-8', newline='\\n') as f:"
    extra = "    if os.path.isfile(os.path.join(OUT, 'cluster-redline-renderer.js')): names.append('cluster-redline-renderer.js')\n"
    return replace_once(text, checksum, extra + checksum)


def plan_upstream(target):
    target = Path(target)
    changes = {}
    for name, transform in [('kit/tools/build.py', build_source), ('deploy/mgu-app-install.sh', installer_source),
                            ('kit/tools/make_kit.py', kit_source)]:
        path = target / name
        if not path.is_file():
            raise ValueError('Missing upstream integration file: ' + str(path))
        original = path.read_bytes().decode('utf-8').replace('\r\n', '\n')
        revised = transform(original)
        if revised != original:
            changes[path] = revised
    return changes
