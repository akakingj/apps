# Cluster Redline

English | [한국어](README.ko.md)

An ordinary `idrive7-apps` app for the central cluster area. ID: `cluster_redline`, version **0.5.0**. Auto-starts in the background; remains hidden until confirmed Sport mode and fresh engine RPM are available. Large RPM, bar and shift lights are released on normal mode, engine-off, stale data or renderer disconnect.


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

Requires cluster-render 0.3.10+ and the selected exact ID7 target: panel 1920x720 or map 1088x480. The normal installer refuses this app when the required component metadata is missing or old; other accepted apps follow upstream's normal skip/install behavior. RPM and drive-mode getters must also exist. The app independently checks renderer backend, geometry and signal freshness at runtime.

Version 0.5.0 adds **Display layer → Front center (test)**, the new default. It places only a 1088x480 image at (416,120) inside the 1920x720 `panel` target. The rest of that scene stays transparent. It uses an overlay with `exclusive=false`, `contend=false`: it does not hide other renderer layers or take the panel from a stock speech dialog. This is a test candidate for stock map/Assisted Driving View covering the old map image; its real-vehicle priority is not yet verified. The old map target's `z` only orders that scene's layers, not BMW scenes in other display slots.

**Map area (legacy)** retains the original exclusive content layer, `contend=1`, `guide_hold=0` and `map_take_over_stock=1` requirement. The selected target must advertise its exact geometry; missing targets stay hidden, with no automatic fallback to another target or HUD. Leaving Sport, stale signals or disconnect releases the requested layer. No MGU preferences or coding are changed. The renderer may fade/release the scene after the layer is dropped.

**Cluster refresh rate** now offers 12, 30 and 60 fps alongside the lower rates. Default: 12; saved values are retained. These are requested upper rates, not measured sustained output or new sensor samples. Unchanged input values skip canvas redraw; changed images still use dirty rectangles and the renderer's shared upload budget. Real-vehicle timing and display priority must be tested. See [0.5.0 instructions](../../docs/CLUSTER-REDLINE-0.5.0.ko.md).

`cluster_render_client.js` is unmodified MPL-2.0 source. Its license and attribution are included as `LICENSE` and `NOTICE` in both source and standard-built packages.

## 0.4.0 changes

The 2000 rpm option now applies to petrol and hybrid profiles as well as diesel. The RPM digits turn red at the selected threshold. The cluster face matches the original M Tricolour Redline style, has no app title or shift footer, and displays the real gear below the bar. Missing gear data is shown as `--`; it is not guessed.

The normal car kit includes `cluster-redline-renderer.js`. On the MGU, `node cluster-redline-renderer.js --check` reports installed version and map takeover configuration. `--enable-map` explicitly enables compositor takeover with a backup; `--restore-map` restores that backup. MGU preferences/coding are not written. See [Korean troubleshooting](../../docs/CLUSTER-REDLINE-0.4.0.ko.md).

In 0.4.1 the petrol preset follows the owner's G20 330i: scale maximum 7000 rpm and red zone from 6000 rpm. The shift alert is independent. Saved custom values are retained; adjust them explicitly if needed. Diesel and hybrid presets are unchanged.
