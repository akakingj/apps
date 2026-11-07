'use strict';
// Shared names and install-time capability filtering. No vehicle calls.
const PROJECTED = {
    ANDROID_AUTO: {
        iface: 'de.bmw.infotainment.sdi.aap.androidautoprojectedmanager.AndroidAutoProjectedManager',
        instance: 'AndroidAutoProjectedManagerInst1'
    },
    CAR_PLAY: {
        iface: 'de.bmw.infotainment.a4a.carplay.CarPlayManager',
        instance: 'CarPlayManagerInst1'
    }
};
function validId(value) { return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value > 0 && value < 0x8000; }
function validNotifier(value) { return value && typeof value.id === 'number' && isFinite(value.id) && Math.floor(value.id) === value.id && value.id >= 0x8000 && value.id <= 0xffff; }
function filterProjections(manifest, catalog, optional, missing) {
    catalog = catalog || {}; optional = optional || {};
    const proxies = manifest.proxies || {}, interfaces = catalog.interfaces || {}, instanceIDs = catalog.instanceIDs || {};
    Object.keys(PROJECTED).forEach(function (provider) {
        const config = PROJECTED[provider], name = config.iface, proxy = proxies[name];
        if (!optional[name] || !proxy) return;
        const fields = interfaces[name] && interfaces[name].fields || {};
        const active = fields.projectedGuidanceActive, named = instanceIDs[name];
        const instance = named && Object.prototype.hasOwnProperty.call(named, config.instance) ? named[config.instance] : null;
        const attributes = proxy.attributes || {};
        const flags = attributes.projectedGuidanceActive;
        if (!active || !active.getter || !validId(active.getter.id) || typeof instance !== 'number' ||
            !isFinite(instance) || Math.floor(instance) !== instance || instance < 0 || instance > 0xffff ||
            typeof flags !== 'string' || flags.indexOf('r') < 0) {
            if (missing) missing[name] = optional[name];
            delete proxies[name]; return;
        }
        ['projectedGuidanceActive', 'projectedGuidanceMetadataAvailable'].forEach(function (key) {
            const field = fields[key], requested = attributes[key];
            if (requested === undefined) return;
            if (!field || !field.getter || !validId(field.getter.id) || typeof requested !== 'string') {
                delete attributes[key]; return;
            }
            // These manager inputs are read-only. A missing notifier downgrades
            // RS to R rather than sending an unsupported subscription request.
            const readable = requested.replace(/w/g, '');
            const supported = validNotifier(field.notifier) ? readable : readable.replace(/s/g, '');
            if (supported) attributes[key] = supported;
            else delete attributes[key];
        });
    });
    return manifest;
}
module.exports = { PROJECTED: PROJECTED, filterProjections: filterProjections };
