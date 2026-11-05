# iDrive 7 Jam Apps

English | [한국어](README.ko.md)

Source overlays for BMW MGU / iDrive 7. Each app lives directly under `apps/`
and has its own documentation and installed identity.

| App | Source and English guide | 한국어 설명서 |
|---|---|---|
| iDrive Circuit — parked-only circuit puzzle | [idrive_circuit](apps/idrive_circuit/README.md) | [회로 퍼즐](apps/idrive_circuit/README.ko.md) |
| Cluster Redline — sport-only cluster RPM and shift lights | [cluster_redline](apps/cluster_redline/README.md) | [계기판 레드라인](apps/cluster_redline/README.ko.md) |

The shared build tool produces **Korean UI packages for both apps**, with
Circuit manually started and Cluster Redline automatically started in the background.
Cluster Redline is a prototype without real-vehicle validation.

## Build and distribute together

Place this repository beside an existing **Korean-enabled**
[idrive7-apps checkout](https://github.com/cauliflowermossgrape/idrive7-apps).
Python 3.8+ and Node.js 18+ are recommended for host tools. Vehicle code targets Node 8.

```text
work/
  idrive7-apps/          # upstream kit, Korean runtime/font support, owner SDK
  idrive7-apps-jam/      # this repository
```

From `idrive7-apps-jam`, build offline previews without an SDK:

```powershell
python tools/build-apps.py --project "../idrive7-apps" --preview-only
node tools/cluster-redline-preview.js
node ../idrive7-apps/kit/tools/preview.js dist/idrive_circuit preview/idrive_circuit frames=3
```

For a private installation kit, put your vehicle-extracted SDK in
`../idrive7-apps/oap-sdk/`, then run:

```powershell
python tools/build-apps.py --project "../idrive7-apps"
```

Result: `dist/idrive7-jam-ko-kit.zip`, containing two separate `.mgu` packages,
a checksum manifest, one check/install script and separate app guides.
The upstream checkout is not changed by this build.

Build only one app with `--apps idrive_circuit` or `--apps cluster_redline`.
Single-app kits have separate output names and do not include the other app.

Follow the [kit installation guide](docs/INSTALL-KIT.ko.md). Both-app kits require
`mgu-deploy >= 0.7.17`; Cluster Redline also requires `cluster-render >= 0.3.10`
with the ID7 `map:1088x480` target. Every selected package is checked before any
installation starts. Installation is sequential, not an atomic transaction.

## Optional: copy into upstream

```powershell
python tools/install-overlay.py ../idrive7-apps
```

Both apps, their tools and Korean additions are copied. Use `--apps` to select
one app; inspect conflicting files before using `--force`. From the target
checkout, build with `python tools/build-apps.py --project .` to retain Cluster
Redline's autostart metadata. The upstream build command alone omits this marker.

## Public source and private packages

Share this repository or GitHub's **Code → Download ZIP** as the source release.
The repository includes app sources, Korean translation additions, tests, licenses
and preview images. BMW's SDK, vehicle keys and installation binaries are excluded.

The generated installation ZIP, `.mgu` and `.tgz` packages contain your SDK.
Keep them private; do not upload them to a public GitHub repository.

See [NOTICE.cluster-redline.md](NOTICE.cluster-redline.md) and `LICENSES/` for
the cluster client's MPL-2.0 license. Circuit and the base runtime retain their
existing MIT attribution.
