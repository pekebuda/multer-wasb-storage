var _           = require('lodash')
,   parseUrl    = require('url').parse
;




/******************************************************************************
 * @description
 * Parses Azure BLob service URI into an Object containing as much information 
 * as possible about the route. 
 *
 * 
 * @param {String} uri                  Azure Blob Service URL en su forma
 * https://epimeteo.blob.core.windows.net/pekebuda/dataset/b03f22de2e095. Si la 
 * URI carece de protocolo (http:// o https://)
 *
 * 
 * @return {Object}
 *
 * 
 * @example 
 * Sea la URI https://epimeteo.blob.core.windows.net/pekebuda/dataset/b03f22de2e095, genera: 
 * 
 * + href: https://epimeteo.blob.core.windows.net/pekebuda/dataset/b03f22de2e095
 * + uri: https://epimeteo.blob.core.windows.net/pekebuda/dataset/b03f22de2e095    igual a href
 * + protocol: https 
 * + auth:
 * + hostname: epimeteo.blob.core.windows.net
 * + port:
 * + resource: pekebuda/dataset/b03f22de2e095     sin initial `/`
 * + pathname: dataset/b03f22de2e095              overrides `#pathname` generado por parseUrl      
 * + dirname: dataset                             sin trailing '/'
 * + basename: b03f22de2e095
 * + service: epimeteo
 * + container: pekebuda
 * + key: dataset/b03f22de2e095
 * + prefix: dataset/b03f22de2e095/               facilita generar nombres (keys) de los blobs subidos, reduciendolo a un append   
 *
 * 
 * @important 
 * En casos distales, `pathname` (y `dirname`) pueden ser cadena vacia si nos 
 * encontramos en la raiz del `container` (en estos casos, `basename` no es 
 * cadena vacia, sino undefined @TODO).
 * La propiedad `prefix` es una propiedad auxiliar, no en si una propiedad de la 
 * ruta.
 */
exports.parseAzureStorageUri = function(uri){
    //@TODO esta no es ni mucho menos la mejor forma de hacer esto. Deberia lanzar error.
    //inyeccion de protocolo
    const IS_HTTP = uri.indexOf("http") !== -1;
    const IS_HTTPS = uri.indexOf("https") !== -1;
    if (!IS_HTTP && !IS_HTTPS) uri = "http://" + uri;


    const STORAGE       = parseUrl(uri);
    //
    STORAGE.uri         = STORAGE.href;
    STORAGE.resource    = STORAGE.pathname.slice(1);
    STORAGE.path        = _.tail(STORAGE.resource.split("/"));
    STORAGE.pathname    = STORAGE.path.join("/");
    STORAGE.basename    = _.last(STORAGE.path);
    STORAGE.dirname     = _.initial(STORAGE.path).join("/");
    //
    STORAGE.service     = STORAGE.hostname.split(".")[0];
    STORAGE.container   = _.head(STORAGE.resource.split("/"));
    STORAGE.key         = STORAGE.pathname;
    //
    STORAGE.prefix      = (STORAGE.pathname)? STORAGE.pathname+"/" : "";

    return STORAGE;
};