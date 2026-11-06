'use strict';
// Uses the built app's actual painter and language; no vehicle or network connection.
const fs = require('fs'), path = require('path');
const stage = path.resolve(process.argv[2] || 'dist/cluster_redline');
const out = path.resolve(process.argv[3] || 'preview/cluster_redline/settings');
const js = path.join(stage, 'source/javascript');
const { Canvas } = require(path.join(js, 'kit/canvas'));
const { SettingsPage } = require(path.join(js, 'settings-ui'));
const spec = JSON.parse(fs.readFileSync(path.join(js, 'kit/app-spec.json'), 'utf8'));
const values = {};
spec.settings.forEach((s) => { values[s.key] = s.default; });
const saved = { schema: spec.settings, get: (k) => values[k], set: (k, v) => { values[k] = v; } };
const page = new SettingsPage(saved, null, spec.version);
fs.mkdirSync(out, { recursive: true });
function save(name) { fs.writeFileSync(path.join(out, name + '.png'), page.draw(new Canvas(1600, 520)).png()); }
page.selectTab(0); save('settings-basic');
page.selectTab(1); save('settings-advanced');
page.selectTab(0); page.activate(1); save('settings-presets');
console.log('Actual settings previews: ' + out);
