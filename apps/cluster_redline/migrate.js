'use strict';
// Entry-only migration, before any worker starts. Never writes a BMW setting.
function migrate(store, old) {
    old = old || {};
    if (old.appEnabled === undefined && old.autoSport === false) store.set('appEnabled', false);
    if (old.renderer === 'software') store.set('renderer', 'auto');
    if (store.get('_outputsV') === 1) return;
    ['sport','all'].forEach((mode) => {
        const hud = mode+'HudOutput', cluster = mode+'ClusterOutput';
        if (old[hud] === undefined) store.set(hud, old.displayTarget === 'hud' ? 'redline' : 'stock');
        if (old[cluster] === undefined) store.set(cluster, old.displayTarget === undefined || ['map','panel'].indexOf(old.displayTarget)>=0 ? 'redline' : 'stock');
    });
    if (typeof old.widgetScale === 'number') {
        ['clusterWidthScale','clusterHeightScale'].forEach((key) => { if (old[key] === undefined) store.set(key, old.widgetScale); });
    }
    store.set('_outputsV',1);
}
module.exports = { migrate };
