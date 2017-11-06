var fs            = require('fs')
,   Stream        = require('stream')
,   digestStream  = require('digest-stream')
,   selftils      = require("./selftils")
;




/** 
 * @constructor
 *
 *
 * @param {Object} opts                   	Opciones de configuracion del 
 * almacenamiento
 * @param {Connection} opts.client         	Conexion establecida con el Servicio 
 * de ALmacenamiento de Blobs en Azure, y en general generado usanto la libreria
 * `azure-storage` mediante la llamada `azure.createBlobService`
 * @param {String} opts.uri 				URL where files where files will be 
 * stored into.
 * @param {Function} opts.keygen          	Funcion generatriz del nombre con 
 * que ha de almacenarse el fichero en Azure Blob Storage
 * @param {[Function]} opts.tranformers   	Funciones accesorias a ejecutar en el 
 * curso de la subida a Azure. @TBD
 *
 * @vid https://github.com/jeffbski/digest-stream/blob/master/lib/digest-stream.js#L28
 */
function WasbStorage(opts){
	opts = opts || {};

	//
	this.client = opts.client;
	this.uri = opts.uri || "";
	this.keygen = opts.keygen || function(req, file, info){ 
		return ( Date.now() + "/" + file.originalname ); 
	};
	this.transformers = opts.transformers || [];
}




/**
 * @description 
 * Responsible for storing the file and returning information on how to access 
 * the file in the future.
 * This information, which is returned via callback, will be merged with 
 * multer's own `file` information and made accessible to the user via `req.file`
 * 
 * @param {Object} req                [description]
 * @param {Object} file               https://github.com/expressjs/multer#file-information
 * @param {String} file.originalname 
 * @param {String} file.encoding 
 * @param {Function} cb               Callback invocado a la conclusion con la 
 * info adicional que se desee que contenga el objeto `req`
 * 
 * @return {Error || Object}          Informacion generada durante el proceso
 * de almacenaje de la imagen
 */
WasbStorage.prototype._handleFile = function(req, file, cb){
	const STORAGE = this;
	const VAULT = selftils.parseAzureStorageUri(STORAGE.uri);
	var LENGTH;     //length of stream to be uploaded
	var CHECKSUM;   //md5 of the file to be uploaded
	var ALGORITHM;  //digest algorithm


	//CONFIGURA STREAM DE OBTENCION DE CHECKSUM
	DIGESTER = digestStream('md5', 'hex', function(digest, length){
			ALGORITHM = "md5";
			CHECKSUM = digest;
			LENGTH = length;
		}
	);


	//CONFIGURA STREAM DE SUBIDA A AZURE
	var UPLOADER = new Stream.Duplex();
	UPLOADER._read = function(size){};
	//obtiene sus datos via escritura en el mismo
	UPLOADER._write = function(chunk, encoding, signal){
		this.push(chunk); 
		return signal();
	};
	//emitted after stream.end() method has been called, and all data has been flushed
	UPLOADER.on('finish', function(){
			//Passing null to read queue signals the end of the stream (EOF), after 
			//which no more data can be written. 
			//Si se elimina, la subida con el cliente a Azure queda en un limbo 
			//y nunca acaba, por algun motivo
			this.push(null); 	//In fact, tells the consumer that stream is done outputting data
			//verifico que el cliente puede ser invocado
			if (!LENGTH) return cb(new Error());  //@TODO
			//compongo el nombre (key) del fichero en WASB
			const KEY = STORAGE.keygen(req, file, {checksum: CHECKSUM, length: LENGTH});
			//subo el contenido del Stream a Azure
			STORAGE.client.createBlockBlobFromStream(VAULT.container, KEY, UPLOADER, LENGTH, function(e, r){
				if (e) return cb(e);
				//else: devuelvo info del blob creado
				const EXTRA_INFO = {
					uri: VAULT.service + ".blob.core.windows.net/" + VAULT.container + "/" + KEY,
					service: VAULT.service,
					container: VAULT.container,
					key: KEY,
					size: LENGTH,
					checksum: CHECKSUM,
					digestAlgorithm: ALGORITHM,
				};
				return cb(null, EXTRA_INFO);
			}
		);
		}
	);
	//emitted when data is completely consumed (read); here, when uploaded to Azure
	UPLOADER.on('end', function(){});




	//EJECUCION DEL FLUJO DE STREAMS
	file.stream
		.pipe(DIGESTER)
		.pipe(UPLOADER);




	//EJECUCION DE STREAMS ACCESORIOS
	// let inletStream = UPLOADER;
	// let outletStream;
	// let i = 0;
	// while (i < STORAGE.transformers.length) {
	// 	outletStream = STORAGE.transformers[0];
	// 	inletStream.pipe(outletStream);
	// 	//reasigno para que en la siguiente iteracion pueda 'enchufarse' al outlet actual
	// 	inletStream = outletStream;
	// 	//
	// 	i++;
	// }
};




/**
 * @description
 * Storage engine is also responsible for removing files if an error is encountered 
 * later on. Multer will decide which files to delete and when.
 * 
 * @param  {Object}   req               [description]
 * @param  {Object}   file              https://github.com/expressjs/multer#file-information
 * @param  {String}   file.originalname 
 * @param  {String}   file.service      Procedente de la informacion extra generada al almacenar
 * @param  {String}   file.container    Procedente de la informacion extra generada al almacenar
 * @param  {String}   file.key          Procedente de la informacion extra generada al almacenar
 * @param  {Function} cb                [description]
 * 
 * @return {[type]}        [description]
 */
WasbStorage.prototype._removeFile = function(req, file, cb){
	const STORAGE = this;

	if (!file.container) return cb(new Error("No contaier specified"));
	if (!file.key) return cb(new Error("No key specified"));
	STORAGE.client.deleteBlob(file.container, file.key, function(error, respone){
			if (error) return cb(error, null);
			else return cb(null, req.file.uri);
		}
	);
};




//////
module.exports = WasbStorage;