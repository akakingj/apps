# Cluster Redline

English | [한국어](README.ko.md)

A Korean UI app for the BMW MGU / iDrive 7 central cluster map area.
The installed app ID is `cluster_redline`; it is independent of iDrive Circuit.
This version, **0.2.1**, is a prototype without real-vehicle validation.

## Behavior

- Auto-start in the background using mgu-deploy's supported app start type.
- No cluster layer at boot, in normal modes, or with missing/stale signals.
- Show large RPM, a bar and shift lights only after Sport/Sport+/Sport Individual
  and fresh engine RPM have been confirmed for at least one second.
- Release the layer when the mode changes, engine stops or signals become stale.
- Read RPM and drive mode only; no engine, transmission or coding writes.
- The settings UI, mode/status labels and profile names are Korean.

Choose **엔진 프로필** in settings: petrol, diesel or gasoline-based plug-in hybrid.
Defaults are display presets, not vehicle-certified limits or optimum shift points:

| Profile | Shift alert | Redline | Scale maximum |
|---|---:|---:|---:|
| Petrol | 6500 rpm | 7000 rpm | 8000 rpm |
| Diesel | 4200 rpm | 5000 rpm | 6000 rpm |
| Hybrid | 6500 rpm | 7000 rpm | 8000 rpm |

Hybrid hides when its combustion engine stops and resumes with fresh engine RPM.
It does not infer EV drive, regeneration, power or battery SOC from zero RPM.
Engine type selection is manual; pure EVs are not supported by this RPM widget.

## Requirements and preview

Requires `cluster-render >= 0.3.10` with backend `id7`, target `map:1088x480`,
and `mgu-deploy >= 0.7.17` to preserve autostart. Required read-only vehicle fields:
`CDS.statusEngineSpeed2` and `FES.statusFESVehicleDynamicSwitchHMI`.

From the repository root, with a Korean-enabled upstream checkout beside it:

```powershell
python tools/build-apps.py --project "../idrive7-apps" --apps cluster_redline --preview-only
node tools/cluster-redline-preview.js
```

Open `preview/cluster_redline/index.html`. These are actual compiled-app drawings
with demo values, without a vehicle or renderer connection.

## Build and install

```powershell
python tools/build-apps.py --project "../idrive7-apps" --apps cluster_redline
```

This requires your own upstream `oap-sdk`. Result: `dist/cluster_redline-ko-kit.zip`.
Follow the included `INSTALL.ko.md`; use its `check` command before `install`.
Omit `--apps` to include Circuit in one kit, with separate installed identities.

To copy sources into upstream, use
`python tools/install-overlay.py ../idrive7-apps --apps cluster_redline`, then
build there with `python tools/build-apps.py --project . --apps cluster_redline`.
Using only upstream's builder omits the autostart marker. No root background
service is created by this project.

The app requests the central map area with `contend=1`, low content priority,
non-exclusive output and `guide_hold=0`. The stock map may be replaced while
Sport is active. Warning/navigation priority, stock-screen restoration, startup
and vehicle sleep behavior still need real-car verification.

The vendored cluster render client is unmodified and MPL-2.0 licensed; its notice
and source blob are recorded in the repository's `NOTICE.cluster-redline.md`.
