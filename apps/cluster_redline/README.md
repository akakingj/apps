# Cluster Redline

English | [한국어](README.ko.md)

An ordinary `idrive7-apps` app for the central cluster map area. ID: `cluster_redline`, version **0.3.0**. Auto-starts in the background; remains hidden until confirmed Sport mode and fresh engine RPM are available. Large RPM, bar and shift lights are released on normal mode, engine-off, stale data or renderer disconnect.

**Prototype: no real-vehicle validation.** Read-only vehicle signals; no engine/transmission/coding writes. Only the ID7 `map:1088x480` target is used, not the entire panel or HUD.

## Engine profiles

Select Petrol, Diesel or gasoline-based plug-in Hybrid in settings. Defaults are display presets, not certified engine limits or optimum shift points.

| Profile | Shift alert | Redline | Scale |
|---|---:|---:|---:|
| Petrol | 6500 | 7000 | 8000 rpm |
| Diesel | 4200 | 5000 | 6000 rpm |
| Hybrid | 6500 | 7000 | 8000 rpm |

Hybrid hides when the engine stops and resumes with fresh engine RPM. No EV power, regeneration or SOC inference is made. Profile selection is manual. Existing settings keys and app identity are retained.

## Standard build and language selection

Use a complete upstream project with these sources merged; see [integration guide](../../docs/JAM-INTEGRATION.ko.md). Run from the project root:

```powershell
python kit/tools/build.py --preview-only cluster_redline
python kit/tools/build.py --language ko --preview-only cluster_redline
node kit/tools/preview.js dist/cluster_redline preview/cluster_redline-ui frames=3
node tools/cluster-redline-preview.js
```

The first build is English; the second is Korean. A preview reads the most recently built stage. The custom preview tool generates the RPM widget gallery without connecting to a vehicle.

```powershell
python kit/tools/make_kit.py --language ko
```

This includes **every app**, including Circuit and Cluster Redline, in the usual `dist/mgu-custom-apps-ko.tar.gz`. Use normal `push-to-car` check/install/restore commands. No separate mgu-deploy is required. The guarded integration preserves the app's explicit autostart flag in package metadata, the OAP registry and custom provisioning list.

## Requirements and limits

Requires cluster-render 0.3.10+ and the ID7 map target. The normal installer refuses this app when the required component metadata is missing or old; other accepted apps follow upstream's normal skip/install behavior. RPM and drive-mode getters must also exist. The app independently checks renderer backend, geometry and signal freshness at runtime.

Content is low priority and non-exclusive with `guide_hold=0`; `contend=1` can replace the central stock map while active. Warning/navigation priority, startup, vehicle sleep and stock-screen restoration still require real-car verification.

`cluster_render_client.js` is unmodified MPL-2.0 source. Its license and attribution are included as `LICENSE` and `NOTICE` in both source and standard-built packages.
