# iDrive 7 Jam Apps

Cluster Redline **1.0.5** fixes guidance reads discarded by repeated status notifications and old reads overwriting newer arrows. [Fix notes](docs/CLUSTER-REDLINE-1.0.5.ko.md).

Cluster Redline **1.0.4** restores the earlier HUD layout, shares the new RPM palette, and adds native turn guidance with independent position/size controls. [Changes](docs/CLUSTER-REDLINE-1.0.4.ko.md).

1.0.3 keeps fresh zero-RPM output through automatic stop/start after a running-engine sample. HUD now uses the cluster face and palette, matching metallic M marks and shared red shift-light pulses. HUD source height is now353px; placement controls use its actual dimensions. [Change notes](docs/CLUSTER-REDLINE-1.0.3.ko.md).

English | [한국어](README.ko.md)

Two ordinary apps for the existing [idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps) build and deployment workflow.

Cluster Redline **1.0.3** adds independent HUD/cluster output choices per Sport/all mode, live position and size controls, a compact color-changing HUD and a 5500 rpm petrol preset. It fixes the contending HUD request that could block stock guidance. Fresh supported maneuver data can be composed with Redline; otherwise stock HUD guidance has priority. [Change and validation notes](docs/CLUSTER-REDLINE-1.0.0.ko.md).

| App | English guide | 한국어 설명서 |
|---|---|---|
| iDrive Circuit — parked-only puzzle | [Circuit](apps/idrive_circuit/README.md) | [회로 퍼즐](apps/idrive_circuit/README.ko.md) |
| Cluster Redline — configurable cluster RPM and shift lights | [Cluster Redline](apps/cluster_redline/README.md) | [계기판 레드라인](apps/cluster_redline/README.ko.md) |

## Install through MGU Store

This repository now supports the **Repo tree** layout. In MGU Store, open
**Settings → Add source**, enter `jaimeen77-cmyk/apps`, choose
**main**, then **Check now**. Choose the listing marked **한국어** or **English**
for each app. The head unit builds the selected language; no build flag is needed.
Existing Korean app ids are retained. English editions have separate ids and settings.
For Cluster Redline, enable Sport auto-display in only the edition you use.
No GitHub token or publicly redistributed SDK is needed for this public source.

[Store registration and migration guide](docs/MGU-STORE.ko.md).
The committed `store/runtime/*.tgz.part-*` files are SDK-free runtime/UI templates,
not the SDK-containing packages produced by an ordinary PC car-kit build.

## Merge once, then use the normal commands

If this checkout contains the complete upstream kit (`kit/tools/build.py`), skip the merge step.
For the source-overlay checkout, place upstream beside it and run:

```powershell
python tools/install-overlay.py ../idrive7-apps-main
```

Then run all commands below **from the merged upstream folder**:

```powershell
python kit/tools/build.py --language ko --preview-only idrive_circuit cluster_redline
node kit/tools/preview.js dist/cluster_redline preview/cluster_redline-ui frames=3
```

English is the default: omit `--language ko` and rebuild for English.
The normal all-app car kit includes these apps alongside Redline, Service and every other app:

```powershell
deploy\make-car-kit.cmd --language ko
```

On macOS/Linux use `deploy/make-car-kit.sh --language ko`.
Output: **`dist/mgu-custom-apps-ko.tar.gz`**. Omit app names to include every app.
Use the existing `deploy/push-to-car.ps1` or `.sh` **check**, then **install**, commands.
The normal backup/restore path is retained. No separate mgu-deploy installation is required.

[Full integration and installation guide](docs/JAM-INTEGRATION.ko.md).

