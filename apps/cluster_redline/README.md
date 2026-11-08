# Cluster Redline 1.0.10

[한국어](README.ko.md)

RPM, gear and shift lights for the iDrive 7 cluster and HUD. The full-screen settings UI keeps two tabs and large touch/rotary controls.

## Settings

Basic settings: App auto start, independent Start app / Stop app controls, vehicle preset, power unit, torque unit, shift alert RPM. The preset threshold is now 5500 rpm for Petrol, eDrive and M; Diesel remains 4200 rpm. Saved explicit thresholds are retained. Presets set display scales, not discovered vehicle specifications. Petrol keeps a 7000 rpm scale and a red zone from 6000.

Advanced settings: Redline display mode (Sport / All drive modes), HUD display (Redline / Stock), Cluster display (Redline / Stock), Position / size. Sport covers Sport variants; All includes Comfort, Comfort Plus, Eco variants and other valid vehicle modes. Each display mode remembers its own output choices. Both outputs may run together using the map and HUD targets; selecting Stock releases that output. Panel is no longer selected: panel and HUD share a native scene ID.

Position / size lets you select Cluster or HUD, move in 10-pixel steps and adjust width/height separately in 5% steps. Temporary X/Y/width/height readouts show the bounded native placement. Changes update the existing layer without repeatedly reacquiring it.

HUD shows the top RPM bar, central RPM, optional side torque/power values or gauges, and the received gear beside the upper bar. Cluster/HUD share the RPM palette and metallic M. Gear prefixes follow received signals.

Defaults: Sport; Cluster Redline, HUD Stock; Petrol; PS/Nm; fixed 20 fps request ceiling. Normal Comfort, Comfort Individual, Eco and Adaptive require All drive modes. Cluster dimensions default to 80% and HUD to 75%. Actual rendering speed depends on the car. eDrive power is engine-only, estimated from engine torque and RPM, not combined electric output.

## Factory HUD navigation

**Requires cluster-render0.4.0+.** HUD contention is permitted only while fresh supported maneuver data is already composed. Otherwise stock guidance takes priority. Native popup/foreign-owner yielding and linger policies still apply.

**Advanced settings > Position / size > HUD navigation** has its own On/Off, position, width and height. CarPlay/Android Auto schema definitions are used; actual phone-app delivery and vehicle rendering remain unverified. Unsupported guidance preserves the stock HUD.

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

Use the normal kit/install workflow. Do not publish generated SDK-containing packages. No engine, gearbox, coding or navigation-control APIs are added. Stale data, app-off and renderer loss release output. Fresh zero RPM after engine operation retains the face during automatic stops. Existing auto-start OFF, custom thresholds and output choices are migrated.

## Validation

Host tests cover settings entry/touch/rotary routing, independent outputs, shared upload pacing, live placement, exact image deltas, lifecycle cleanup and compatibility. The real upstream 0.4.0 SlotManager host suite passes 268 checks, including newly parked HUD guidance yielding and recovery. These use simulated hardware ports; vehicle rendering, HUD coordinates and stock guidance return remain unverified on the car. Unix-socket and Node subprocess archive integration are restricted in the current build sandbox.

![HUD](../../screenshots/cluster_redline/hud-1.0.10.png)

![Layout settings](../../screenshots/cluster_redline/settings-layout-hud.png)

![Stop & Go](../../screenshots/cluster_redline/stop-go.png)

![HUD navigation](../../screenshots/cluster_redline/hud-navigation-on-black.png)
![Navigation settings](../../screenshots/cluster_redline/settings-layout-hud-navigation.png)

Auto-start sets operation at the next app-process launch. Start/Stop changes the current worker immediately, closing its subscriptions and renderer on Stop; the settings host stays open for restarting.

## HUD appearance

Advanced settings → HUD display → HUD appearance selects a top shift-alert bar or a filled circle beside the gear. A real RPM preview appears below the choices. The circle is hidden before the existing green-alert threshold, then follows the existing green/yellow/flashing-red timing. Its diameter is 70% of the gear glyph height. Gear and warning align beside the upper RPM bar.

HUD torque/power offers Gauges, Values only (torque · RPM · power with matching numeric sizes), and Off. The upper M is removed; the RPM bar is 90% of its prior height; text is 10% larger. Metrics move upward, auxiliary gauges shrink by 10% in each dimension and the lower M/frame moves upward with clearance below the scale labels. Appearance changes redraw at unchanged RPM.

The optional GuidanceEventList.queryContent reader uses named enums; an Android Auto diagnostic returned a valid turn and formatted distance. Queries are bounded and tied to the active phone/provider lifecycle. This does not yet confirm CarPlay data delivery, app-UID permissions or real-vehicle simultaneous HUD display. Missing/invalid/stale guidance preserves stock guidance. It does not add junction-map images.

[Current guide](../../docs/CLUSTER-REDLINE.ko.md) · [Changelog](https://github.com/jaimeen77-cmyk/apps/blob/main/CHANGELOG.md)
