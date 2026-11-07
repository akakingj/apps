# Cluster Redline 1.0.1
## 1.0.1

Read-only OEM guidance-state monitoring releases our HUD during route calculation/navigation and whenever that state cannot be checked. Only fresh explicit INACTIVE permits HUD rendering. Missing optional getters are omitted at install time. Native linger and other HUD clients still apply. Add torque/power mini gauges beside RPM, with bounded horizontal placement and real unit conversion. Retry only verified transient layer failures (2/5/10 seconds, three attempts), never bypass native guards. A separate native parked-recovery source patch is provided for upstream review; **the app does not install that renderer patch**, and real-car recovery remains unverified. [Change notes](../../docs/CLUSTER-REDLINE-1.0.1.ko.md).


[한국어](README.ko.md)

RPM, gear and shift lights for the iDrive 7 cluster and HUD. The full-screen settings UI keeps two tabs and large touch/rotary controls.

## Settings

Basic settings: App auto start, vehicle preset, power unit, torque unit, shift alert RPM. The preset threshold is now 5500 rpm for Petrol, eDrive and M; Diesel remains 4200 rpm. Saved explicit thresholds are retained. Presets set display scales, not discovered vehicle specifications. Petrol keeps a 7000 rpm scale and a red zone from 6000.

Advanced settings: Redline display mode (Sport / All drive modes), HUD display (Redline / Stock), Cluster display (Redline / Stock), Position / size. Each display mode remembers its own output choices. Both outputs may run together using the map and HUD targets; selecting Stock releases that output. Panel is no longer selected: panel and HUD share a native scene ID.

Position / size lets you select Cluster or HUD, move in 10-pixel steps and adjust width/height separately in 5% steps. Temporary X/Y/width/height readouts show the bounded native placement. Changes update the existing layer without repeatedly reacquiring it.

The compact HUD uses the cluster's angled RPM cells, M-style framing and a right-side received gear (`M1`, `S1`, `D1`, `P`, etc.). It turns yellow at 85% of the selected shift threshold and red at the threshold, with a 2 Hz bright/dim flash. Unlit shift lights are black. Gear prefixes depend on the car's available selector/programme signals; chassis Sport does not imply gearbox S.

Defaults: Sport only; Cluster Redline, HUD Stock; Petrol; PS/Nm; fixed 20 fps request ceiling. Cluster dimensions default to 80% and HUD to 75%. Actual rendering speed depends on the car. eDrive power is engine-only, estimated from engine torque and RPM, not combined electric output.

## Factory HUD navigation

**Requires cluster-render 0.4.0 or newer.** Version 0.9.1 mistakenly requested a contending HUD layer, which could keep newly arriving stock guidance parked behind Redline. This version requests a non-contending, non-exclusive HUD layer. The native renderer can release it for stock guidance and popups, then reacquire it when the slot is free. Its configured yield/linger delays still apply.

**Simultaneous factory navigation and Redline in the same HUD slot is not implemented.** Positioning a smaller image does not merge two native scenes. When stock guidance occupies that slot it has priority, so Redline may temporarily disappear. Separate-area coexistence needs renderer support and real-car validation; the placement preview does not prove a clear area on a windshield.

The app checks that the native HUD policy leaves stock takeover disabled and includes popup yield slot `0x322`. An unsafe owner override suppresses only this app's HUD output and reports a settings warning. It never enables `hud_take_over_stock`, changes BMW menus, bypasses native guards or resets renderer configuration.

Cluster output continues using the map target and supported maneuver-panel guide hold. Set Instrument cluster > Central display area to Map view or Off. Assisted Driving View and route preview coverage still need car validation. No guarantee of immediate takeover is made.

## Install

In MGU Store add source `jaimeen77-cmyk/apps`, branch `main`, check for updates and choose Korean or English. Store resolves cluster-render >= 0.4.0 before Redline when a registered renderer source offers it. Desktop car kits require that renderer separately.

For desktop builds, merge this source overlay into a complete upstream checkout with your own extracted SDK:

```sh
python tools/install-overlay.py /path/to/idrive7-apps --apps cluster_redline --force
cd /path/to/idrive7-apps
python kit/tools/build.py cluster_redline
python kit/tools/build.py --language ko cluster_redline
```

Use the normal kit/install workflow. Do not publish generated SDK-containing packages. No engine, gearbox, coding or navigation-control APIs are added. Stale data, engine-off, app-off and renderer loss release output. Existing auto-start OFF, custom thresholds and output choices are migrated.

## Validation

Host tests cover settings entry/touch/rotary routing, independent outputs, shared upload pacing, live placement, exact image deltas, lifecycle cleanup and compatibility. The real upstream 0.4.0 SlotManager host suite passes 268 checks, including newly parked HUD guidance yielding and recovery. These use simulated hardware ports; vehicle rendering, HUD coordinates and stock guidance return remain unverified on the car. Unix-socket and Node subprocess archive integration are restricted in the current build sandbox.

[Detailed Korean change/validation notes](../../docs/CLUSTER-REDLINE-1.0.0.ko.md) · [Renderer dependency guide](../../docs/AUTO-RENDERER.ko.md)

![HUD](../../screenshots/cluster_redline/hud-shift-on-black.png)

![Layout settings](../../screenshots/cluster_redline/settings-layout-hud.png)
