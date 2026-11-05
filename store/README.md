# Store runtime templates

These are **SDK-free UI/framework templates**, not installable app releases.
`tools/store-build.js` combines them with the current `apps/<id>/*.js` on the
head unit and writes one SDK-free `<id>@<version>.tgz` into `MGU_OUT`.
MGU Store supplies the vehicle's stock SDK during installation.

Each template excludes all `node_modules` and the app's own JavaScript.
The JSON beside it records size, SHA-256 and a fingerprint of the UI manifest
and Korean additions. Version-only and app-code changes do not require new
UI templates; UI/permissions/translation changes do.

Refresh with `python tools/prepare-store.py --dist <Korean build dist>`.
Preserve the included upstream MIT, MPL-2.0 client and OFL font attribution.
The templates retain the original runtime/font license files.

Registration: add `jaimeen77-cmyk/idrive7-apps-jam` in MGU Store and select
the `main` branch. See [Korean guide](../docs/MGU-STORE.ko.md).
