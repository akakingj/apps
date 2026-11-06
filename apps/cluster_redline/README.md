# Cluster Redline

한국어: [README.ko.md](README.ko.md)

A background MGU app for cluster RPM and shift lights. Version **0.8.7** opens directly to **Basic settings / Advanced settings** and shows its running version in the header.

For stock-map takeover, choose **Advanced settings > Display layer > Map area (legacy)**
and set **Instrument cluster > Central display area > Map view or Off**.
Install **Cluster renderer (cluster-render)** from MGU Store first; the orange text says so.
Front-center retains its Off recommendation. The orange instruction follows the selected layer; the app does not change the BMW menu.

Since 0.8.2, initial image visibility is deferred until queued pixels have been written to the socket,
following the phone-map app's show-when-sent ordering. This is not an acknowledgement that
the cluster has displayed the frame; native DCSM acquisition races remain unverified on the car.

Basic settings: App auto start; vehicle preset (Petrol, Diesel, eDrive PHEV, M); display mode (Sport modes only, All drive modes); power unit (PS/kW); torque unit (Nm/kgf·m).

Advanced settings: shift alert RPM; front-center or legacy map target; widget size (60–100% discrete steps).
Manual gearbox prefixes and RPM/torque/power scale settings are removed. Prefixes use received selector/programme data; scales follow the selected preset. These are display presets, not automatically discovered model specifications.

Defaults: Petrol, Sport only, fixed 20 fps, 80%, PS/Nm. Petrol has a 7000 RPM scale, red zone from 6000 and shift alert at 6500. The alert colors RPM digits red. All-mode display still requires fresh RPM/mode data and hides on engine-off, stale data or renderer loss.
Auto start OFF releases output, subscriptions and worker timers; MainApp retains a lightweight settings host so it can be enabled again. An old OFF choice and saved shift threshold are migrated.

Power* is estimated from ECU engine torque and RPM. eDrive shows engine output only, not electric or combined system output. Unit changes convert values, peaks and scales together. Chassis Sport alone never implies gearbox S/M; unavailable programme signals limit automatic prefix detection.

## Build and install

Install either language entry from this repository in MGU Store, or copy the source overlay to upstream and use its normal build/install workflow:

Store installs a missing/older required cluster-render first, then the app;
a compatible installed renderer is reused. The registered upstream source
(normally `robertnisipeanu/idrive-apps` Releases) must offer the renderer.
See the [automatic dependency guide](../../docs/AUTO-RENDERER.ko.md).

```sh
python tools/install-overlay.py /path/to/idrive7-apps --apps cluster_redline --force
cd /path/to/idrive7-apps
python kit/tools/build.py cluster_redline
# Korean:
python kit/tools/build.py --language ko cluster_redline
```

Requires an extracted oap-sdk for desktop builds and cluster-render >= 0.3.10 on the car. No BMW SDK is published here. MainApp manages app startup. No engine, transmission or coding control APIs are used.

The actual screen previews are generated with `node tools/cluster-redline-settings-preview.js dist/cluster_redline`.
Native RHMI bottom-bar controls remain available without a touch-capable MGU renderer.

Map takeover can race BMW's own scene. Front-center visibility above every stock map/Assisted Driving View is not verified; this release does not claim to fix that. Sustained 20 fps and programme signal reception also require car testing.

[Korean update/validation guide](../../docs/CLUSTER-REDLINE-0.8.0.ko.md) · [Overlay investigation](../../docs/CLUSTER-OVERLAY-RESEARCH.ko.md)

The refresh-rate selector is removed. Old saved rates cannot override the fixed 20fps request ceiling. Actual throughput depends on the car; 20fps is not a stated hardware limit.

[0.8.3 update guide](../../docs/CLUSTER-REDLINE-0.8.3.ko.md)

[0.8.4: 실행 버전 확인 / Verify the running version](../../docs/CLUSTER-REDLINE-0.8.4.ko.md)

[0.8.5 install fix: notifier-only gearbox programme](../../docs/CLUSTER-REDLINE-0.8.5.ko.md)

[0.8.7: Larger settings text and touch controls](../../docs/CLUSTER-REDLINE-0.8.7.ko.md)
