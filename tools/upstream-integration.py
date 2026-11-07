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


OPTIONAL_GUIDANCE_MARKER = '// Jam optional guidance fields v3'


def _optional_guidance_source_v3(text):
    if OPTIONAL_GUIDANCE_MARKER in text:
        if '// Jam optional guidance field persistence v3' in text:
            return text
        return replace_once(text, '        if (!Object.keys(missing).length) process.exit(0);',
            '        // Jam optional guidance field persistence v3\n        fs.writeFileSync(mf, JSON.stringify(m, null, 1));\n        if (!Object.keys(missing).length) process.exit(0);')
    original = '        for (const i of Object.keys(opt)) if (!have[i]) { missing[i] = opt[i]; delete m.proxies[i]; }'
    prior = """        // Jam optional guidance getter v1: polling needs a getter, not only a notifier.
        const supportsOptional = (i) => {
            if (!have[i]) return false;
            if (i !== "de.bmw.infotainment.navigation.guiding.Guidance") return true;
            const field = have[i].fields && have[i].fields.guidanceState;
            return !!(field && field.getter);
        };
        for (const i of Object.keys(opt)) if (!supportsOptional(i)) { missing[i] = opt[i]; delete m.proxies[i]; }"""
    after = """        // Jam optional guidance fields v3: the runtime connects to Main_Instance.
        const all = JSON.parse(fs.readFileSync(catalog, "utf8"));
        const supportsOptional = (i) => {
            if (!have[i]) return false;
            if (i !== "de.bmw.infotainment.navigation.guiding.Guidance") return true;
            const field = have[i].fields && have[i].fields.guidanceState;
            const instances = all.instanceIDs && all.instanceIDs[i];
            const named = instances && Object.prototype.hasOwnProperty.call(instances, "Main_Instance") && instances.Main_Instance != null;
            return !!(field && field.getter && field.getter.id && named);
        };
        for (const i of Object.keys(opt)) if (!supportsOptional(i)) { missing[i] = opt[i]; delete m.proxies[i]; }
        const nav="de.bmw.infotainment.navigation.guiding.Guidance";
        if(opt[nav] && m.proxies[nav]) {
            const attrs=m.proxies[nav].attributes||{};
            ["guidanceState","guidingProvider","conclusiveDart"].forEach((key)=>{
                const item=have[nav].fields&&have[nav].fields[key];
                if(!item||!item.getter||!item.getter.id)delete attrs[key];
                else if(attrs[key]&&(!item.notifier||!item.notifier.id))attrs[key]=attrs[key].replace(/s/g,"");
            });
        }"""
    if '// Jam optional guidance instance v2' in text:
        start=text.index('        // Jam optional guidance instance v2')
        end=text.index('        for (const i of Object.keys(opt)) if (!supportsOptional(i)) { missing[i] = opt[i]; delete m.proxies[i]; }',start)
        end+=len('        for (const i of Object.keys(opt)) if (!supportsOptional(i)) { missing[i] = opt[i]; delete m.proxies[i]; }')
        return _optional_guidance_source_v3(text[:start]+after+text[end:])
    return _optional_guidance_source_v3(replace_once(text, prior if '// Jam optional guidance getter v1' in text else original, after))


OPTIONAL_PROJECTION_MARKER = '// Jam optional projection managers v4'


def optional_guidance_source(text):
    text = _optional_guidance_source_v3(text)
    if OPTIONAL_PROJECTION_MARKER in text:
        return text
    projection = r"""        // Jam optional projection managers v4: named phone guidance inputs.
        // Keep this whitelist here; do not execute app-provided JS as root.
        const projected = [
            ["de.bmw.infotainment.sdi.aap.androidautoprojectedmanager.AndroidAutoProjectedManager", "AndroidAutoProjectedManagerInst1"],
            ["de.bmw.infotainment.a4a.carplay.CarPlayManager", "CarPlayManagerInst1"]
        ];
        const projectionGetter = (v) => typeof v === "number" && isFinite(v) && Math.floor(v) === v && v > 0 && v < 0x8000;
        const projectionNotifier = (v) => v && typeof v.id === "number" && isFinite(v.id) && Math.floor(v.id) === v.id && v.id >= 0x8000 && v.id <= 0xffff;
        projected.forEach((entry) => {
            const name = entry[0], instanceName = entry[1], proxy = m.proxies[name];
            if (!opt[name] || !proxy) return;
            const fields = have[name] && have[name].fields || {}, active = fields.projectedGuidanceActive;
            const named = all.instanceIDs && all.instanceIDs[name];
            const instance = named && Object.prototype.hasOwnProperty.call(named, instanceName) ? named[instanceName] : null;
            const attributes = proxy.attributes || {}, flags = attributes.projectedGuidanceActive;
            if (!active || !active.getter || !projectionGetter(active.getter.id) || typeof instance !== "number" ||
                !isFinite(instance) || Math.floor(instance) !== instance || instance < 0 || instance > 0xffff ||
                typeof flags !== "string" || flags.indexOf("r") < 0) {
                missing[name] = opt[name]; delete m.proxies[name]; return;
            }
            ["projectedGuidanceActive", "projectedGuidanceMetadataAvailable"].forEach((key) => {
                const field = fields[key], requested = attributes[key];
                if (requested === undefined) return;
                if (!field || !field.getter || !projectionGetter(field.getter.id) || typeof requested !== "string") {
                    delete attributes[key]; return;
                }
                const readable = requested.replace(/w/g, "");
                const supported = projectionNotifier(field.notifier) ? readable : readable.replace(/s/g, "");
                if (supported) attributes[key] = supported;
                else delete attributes[key];
            });
        });
"""
    anchor = '        // Jam optional guidance field persistence v3'
    return replace_once(text, anchor, projection + anchor)


def installer_source(text):
    text = optional_guidance_source(text)
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
