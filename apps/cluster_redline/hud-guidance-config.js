'use strict';
const INTERFACE='de.bmw.infotainment.navigation.guiding.GuidanceRenderedContent';
const INSTANCE='Main_Instance',METHODS=['getViewConfig','getViewContent'];
const validId=v=>typeof v==='number'&&isFinite(v)&&Math.floor(v)===v&&v>0&&v<0x8000;
function filterRendered(manifest,catalog,optional,missing) {
    const proxy=manifest.proxies&&manifest.proxies[INTERFACE];
    if(!proxy||!optional||!optional[INTERFACE])return manifest;
    const definition=catalog.interfaces&&catalog.interfaces[INTERFACE],instances=catalog.instanceIDs&&catalog.instanceIDs[INTERFACE];
    const instance=instances&&instances[INSTANCE],field=definition&&definition.fields&&definition.fields.registeredViews;
    if(!field||!field.getter||!validId(field.getter.id)||typeof instance!=='number'||!isFinite(instance)||Math.floor(instance)!==instance||instance<0||instance>65535||
        METHODS.some(n=>!definition.methods||!definition.methods[n]||!validId(definition.methods[n].methodId))) {
        delete manifest.proxies[INTERFACE];if(missing)missing[INTERFACE]=optional[INTERFACE];return manifest;
    }
    proxy.attributes={registeredViews:'r'};proxy.methods=METHODS.slice();
    return manifest;
}
module.exports={INTERFACE,INSTANCE,METHODS,filterRendered};
