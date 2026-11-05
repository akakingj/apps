# Cluster Redline

English | [한국어](README.ko.md)

An ordinary `idrive7-apps` app for the central cluster map area. ID: `cluster_redline`, version **0.4.1**. Auto-starts in the background; remains hidden until confirmed Sport mode and fresh engine RPM are available. Large RPM, bar and shift lights are released on normal mode, engine-off, stale data or renderer disconnect.

**Prototype: no real-vehicle validation.** Read-only vehicle signals; no engine/transmission/coding writes. Only the ID7 `map:1088x480` target is used, not the entire panel or HUD.

## Engine profiles

Select Petrol, Diesel or gasoline-based plug-in Hybrid in settings. Defaults are display presets, not certified engine limits or optimum shift points.

| Profile | Shift alert | Redline | Scale |
|---|---:|---:|---:|
| Petrol (G20 330i preset) | 6500 | 6000 | 7000 rpm |
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

While Sport is active, content uses z=100 and exclusive output inside the map target, with `guide_hold=0` and `contend=1`. This places it ahead of lower content layers; renderer overlay/alert layers remain above it. Stock-map takeover also requires the renderer setting `map_take_over_stock=1`. Releasing the layer restores the previous content without changing MGU map preferences. Warning/navigation priority, startup, vehicle sleep and stock-screen restoration still require real-car verification.

`cluster_render_client.js` is unmodified MPL-2.0 source. Its license and attribution are included as `LICENSE` and `NOTICE` in both source and standard-built packages.

## 0.4.0 changes

The 2000 rpm option now applies to petrol and hybrid profiles as well as diesel. The RPM digits turn red at the selected threshold. The cluster face matches the original M Tricolour Redline style, has no app title or shift footer, and displays the real gear below the bar. Missing gear data is shown as `--`; it is not guessed.

The normal car kit includes `cluster-redline-renderer.js`. On the MGU, `node cluster-redline-renderer.js --check` reports installed version and map takeover configuration. `--enable-map` explicitly enables compositor takeover with a backup; `--restore-map` restores that backup. MGU preferences/coding are not written. See [Korean troubleshooting](../../docs/CLUSTER-REDLINE-0.4.0.ko.md).

In 0.4.1 the petrol preset follows the owner's G20 330i: scale maximum 7000 rpm and red zone from 6000 rpm. The shift alert is independent. Saved custom values are retained; adjust them explicitly if needed. Diesel and hybrid presets are unchanged.
