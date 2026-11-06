[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$')]
    [string]$CarIp,

    [Parameter(Mandatory = $true)]
    [string]$IdentityFile,

    [string]$OutputFile = (Join-Path (Get-Location).Path ('cluster-redline-install-report-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt'))
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($CarIp, [ref]$parsedAddress)) {
    throw 'CarIp must be the IPv4 address you use for the existing car SSH connection.'
}
$sshCommand = Get-Command ssh -CommandType Application -ErrorAction Stop | Select-Object -First 1
$keyPath = (Resolve-Path -LiteralPath $IdentityFile -ErrorAction Stop).ProviderPath
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw 'IdentityFile must point to your existing SSH private key file.'
}
$reportPath = [System.IO.Path]::GetFullPath($OutputFile)

# Literal ASCII script: sent to SSH stdin, without local PowerShell expansion.
# Reads only installer logs, component/app metadata and requested field presence.
# No settings writes, service restarts, DCSM requests, or key content collection.
$remoteScript = @'
task_root=${1:-}
printf '%s\n' 'CLUSTER REDLINE INSTALL REPORT (READ ONLY)' '=== TIME (UTC) ==='
date -u '+%Y-%m-%dT%H:%M:%SZ'
printf '%s\n' '=== UPDATER LOGS ==='
for suffix in /tmp/mgu-updater.log.1 /tmp/mgu-updater.log; do
    file="$task_root$suffix"
    if [ -r "$file" ]; then printf '%s\n' "PATH: $suffix"; tail -n 300 "$file"; fi
done
printf '%s\n' '=== APP MANAGER INSTALL RESULT ==='
found=0
for file in "$task_root"/var/opt/public/oap/oap_*/data/mgu-deploy-inplace.json; do
    [ -r "$file" ] || continue
    found=1
    printf '%s\n' "PATH: $file"
    head -c 65536 "$file"
    printf '\n'
done
[ "$found" -eq 1 ] || printf '%s\n' 'INSTALL_RESULT_NOT_FOUND'
printf '%s\n' '=== INSTALLED COMPONENTS ==='
for component in mgu-updater mgu-deploy cluster-render; do
    for layout in current/component.json component.json; do
        file="$task_root/var/opt/$component/$layout"
        if [ -r "$file" ]; then printf '%s\n' "COMPONENT: $component"; cat "$file"; printf '\n'; break; fi
    done
done
printf '%s\n' '=== INSTALLED REDLINE AND REQUESTED INTERFACES ==='
if command -v node >/dev/null 2>&1; then
    node - "$task_root" <<'NODE'
'use strict';
const fs = require('fs'), path = require('path'), root = process.argv[2] || '';
const at = (p) => root + p;
function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
function text(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } }
function list(dir) { try { return fs.readdirSync(dir); } catch (e) { return []; } }
const home = at('/var/opt/public/oap');
let found = false;
list(home).filter((name) => /^oap_\d+$/.test(name)).forEach((name) => {
    const source = path.join(home, name, 'source'), pkg = read(path.join(source, 'package.json'));
    if (!pkg || !/^cluster_redline(?:_en)?\d*$/.test(pkg.name || '')) return;
    found = true;
    const main = text(path.join(source, 'javascript/app.js'));
    const spec = read(path.join(source, 'javascript/kit/app-spec.json')) || {};
    const manifest = read(path.join(source, 'manifest.json')) || {};
    console.log(JSON.stringify({ app: pkg.name, version: pkg.version, home: name,
        specVersion: spec.version, hasTabbedEntry: /new SettingsPage\(/.test(main),
        hasLegacySettingsButton: main.indexOf('BTN_SETTINGS') >= 0,
        screens: (spec.screens || []).map((s) => ({ name: s.name, kind: s.kind })),
        settings: (spec.settings || []).map((s) => s.key), limits: pkg.oapAppSettings,
        requestedVehicleInterfaces: Object.keys(manifest.proxies || {}).filter((n) => /CDS$|FES$|VehicleInformation$|MDrive$/.test(n))
            .map((n) => ({ interface: n, request: manifest.proxies[n] })) }, null, 2));
});
if (!found) console.log('INSTALLED_REDLINE_NOT_FOUND');
// Report only presence of the app's requested fields, never the vehicle catalog.
const catalog = read(at('/etc/oap/someip/someip-interfaces.json'));
if (!catalog || !catalog.interfaces) console.log('VEHICLE_INTERFACE_CATALOG_NOT_FOUND');
else {
    const requested = {
        'de.bmw.infotainment.vehicle.CDS': ['statusEngineSpeed2'],
        'de.bmw.infotainment.drivingexcitement.FES': ['statusFESVehicleDynamicSwitchHMI', 'statusActualValueTorque2'],
        'de.bmw.infrastructure.VehicleInformation': ['statusGearboxDrive', 'DataPowerTrain2'],
        'de.bmw.infotainment.misc.MDrive': ['dataDisplayGearbox'],
    };
    Object.keys(requested).forEach((name) => {
        const iface = catalog.interfaces[name];
        console.log(JSON.stringify({ interface: name, present: !!iface,
            fields: requested[name].map((field) => ({ name: field, present: !!(iface && iface.fields && iface.fields[field]) })) }));
    });
}
NODE
else
    printf '%s\n' 'NODE_NOT_FOUND'
fi
printf '%s\n' '=== INSTALL REPORT END ==='
exit 0
'@
$remoteScript = $remoteScript.Replace("`r", '')
# Keep exit on an LF-terminated line before Windows appends its pipe newline.
$remoteScript += "`n"

Write-Host 'Collecting existing install logs. No reinstall, restart or setting change.'
Write-Host ('Report: ' + $reportPath)

# Windows PowerShell can turn native stderr into ErrorRecords. Preserve them in
# the report, then use the SSH exit code to distinguish connection failures.
$ErrorActionPreference = 'Continue'
try {
    $capture = @($remoteScript | & $sshCommand.Source -T -i $keyPath -o BatchMode=yes -o ConnectTimeout=10 ('root@' + $CarIp) 'sh -s' 2>&1)
    $sshExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = 'Stop'
}
$capture | ForEach-Object { $_.ToString() } | Out-File -LiteralPath $reportPath -Encoding utf8
if ($sshExit -ne 0) {
    throw ('SSH failed (exit ' + $sshExit + '). Details are in ' + $reportPath + '. Check your normal car SSH connection first.')
}
Write-Host ('Saved: ' + $reportPath)
