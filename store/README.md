# Store runtime templates

These are **SDK-free UI/framework templates**, not installable app releases.
`tools/store-build.js` combines them with the current `apps/<id>/*.js` on the
head unit and writes one SDK-free `<id>@<version>.tgz` into `MGU_OUT`.
MGU Store supplies the vehicle's stock SDK during installation.

Each template excludes all `node_modules` and the app's own JavaScript.
The JSON beside it records size, SHA-256 and a fingerprint of the UI manifest
and Korean additions. `*.en.tgz`/`*.en.json` are the English UI templates;
the existing unsuffixed templates remain Korean. Version-only and app-code changes do not require new
UI templates; UI/permissions/translation changes do.

Refresh each language with `python tools/prepare-store.py --language ko --dist <build dist>`
and `--language en` after building English packages. This also synchronizes
the small English edition manifests and icons in `store/apps/<id>_en/`.
Those folders contain no duplicate app logic: English builds read the current
`apps/<original-id>/` through `--source`, then assign their own package/RHMI ids.
Publish version bumps with these manifests (the builder rejects mismatched versions).
Preserve the included upstream MIT, MPL-2.0 client and OFL font attribution.
The templates retain the original runtime/font license files.

Registration: add `jaimeen77-cmyk/idrive7-apps-jam` in MGU Store and select
the `main` branch. Each app has a **한국어** and **English** listing.
They install separately and retain separate settings; use only one Cluster Redline
edition's Sport auto-display. See [Korean guide](../docs/MGU-STORE.ko.md).
