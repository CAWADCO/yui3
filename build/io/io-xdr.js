YUI.add('io-xdr', function(Y) {

   /**
    * Extends the IO base class to provide an alternate, Flash transport, for making
    * cross-domain requests.
	* @module io
	* @submodule io-xdr
	*/

   /**
	* @event io:xdrReady
	* @description This event is fired by YUI.io when the specified transport is
	* ready for use.
	* @type Event Custom
	*/
	var E_XDR_READY = 'io:xdrReady',


   /**
	* @description Object that stores callback handlers for cross-domain requests
	* when using Flash as the transport.
	*
	* @property _fn
	* @private
	* @static
	* @type object
	*/
	_fn = {},

   /**
	* @description Map of transaction state used when XDomainRequest is the
	* XDR transport.
	*
	* @property _rS
	* @private
	* @static
	* @type object
	*/
	_rS = {};

   /**
	* @description Method that creates the Flash transport swf.
	*
	* @method _swf
	* @private
	* @static
	* @param {string} uri - location of io.swf.
	* @param {string} yid - YUI instance id.
	* @return void
	*/
	function _swf(uri, yid) {
		var o = '<object id="yuiIoSwf" type="application/x-shockwave-flash" data="' +
		        uri + '" width="0" height="0">' +
		     	'<param name="movie" value="' + uri + '">' +
		     	'<param name="FlashVars" value="yid=' + yid + '">' +
                '<param name="allowScriptAccess" value="always">' +
		    	'</object>',
		    c = document.createElement('div');

		document.body.appendChild(c);
		c.innerHTML = o;
	}

   /**
	* @description Sets event handlers for XDomainRequest transactions.
	*
	* @method _xdr
	* @private
	* @static
    * @param {object} o - Transaction object generated by _create() in io-base.
	* @param {object} c - configuration object for the transaction.
	* @return void
	*/
	function _xdr(o, c) {
		o.c.onprogress = function() { _rS[o.id] = 3; }
		o.c.onload = function() {
			_rS[o.id] = 4;
			Y.io.xdrResponse(o, c, 'success');
		};
		o.c.onerror = function() {
			_rS[o.id] = 4;
			Y.io.xdrResponse(o, c, 'failure');
		};
		if (c.timeout) {
			o.c.ontimeout = function() {
				_rS[o.id] = 4;
				Y.io.xdrResponse(o, c, 'timeout');
			};
			o.c.timeout = c.timeout;
		}
	}

   /**
	* @description Creates a response object for XDR transactions, for success
	* and failure cases.
	*
	* @method _data
	* @private
	* @static
    * @param {object} o - Transaction object generated by _create() in io-base.
	* @param {boolean} isFlash - True if Flash was used as the transport.
	* @param {boolean} isXML - True if the response data are XML.
	*
	* @return object
	*/
	function _data(o, isFlash, isXML) {
		var text, xml;

		if (!o.status) {
			text = isFlash ? decodeURI(o.c.responseText) : o.c.responseText;
			xml = isXML ? Y.DataType.XML.parse(text) : null;

			return { id: o.id, c: { responseText: text, responseXML: xml } };
		}
		else {
			return { id: o.id, status: o.status };
		}

	}

   /**
	* @description Method for intiating an XDR transaction abort.
	*
	* @method _abort
	* @private
	* @static
	* @param {object} o - Transaction object generated by _create() in io-base.
	* @param {object} c - configuration object for the transaction.
	*/
	function _abort(o, c) {
		return c.xdr.use === 'flash' ? o.c.abort(o.id, c) : o.c.abort();
	}

   /**
	* @description Method for determining if an XDR transaction has completed
	* and all data are received.
	*
	* @method _isInProgress.
	* @private
	* @static
	* @param {object} o - Transaction object generated by _create() in io-base.
	* @param {object} c - configuration object for the transaction.
	*/
	function _isInProgress(o, t) {
		return (t === 'flash' && o.c) ? o.c.isInProgress(o.id) : _rS[o.id] !== 4;
	}

    Y.mix(Y.io, {

	   /**
		* @description Map of io transports.
		*
		* @property _transport
		* @private
		* @static
		* @type object
		*/
		_transport: {},

	   /**
	   	* @description Method for accessing the transport's interface for making a
	   	* cross-domain transaction.
	   	*
		* @method _xdr
		* @private
		* @static
		* @param {string} uri - qualified path to transaction resource.
    	* @param {object} o - Transaction object generated by _create() in io-base.
		* @param {object} c - configuration object for the transaction.
		*/
		xdr: function(uri, o, c) {
			if (c.on && c.xdr.use === 'flash') {
				_fn[o.id] = {
					on: c.on,
					context: c.context,
					arguments: c.arguments
				};
				// These nodes do not need to be serialized across Flash's
				// ExternalInterface.  Doing so will result in exceptions.
				c.context = null;
				c.form = null;

				o.c.send(uri, c, o.id);
			}
			else if (window.XDomainRequest) {
				_xdr(o, c);
				o.c.open(c.method || 'GET', uri);
				o.c.send(c.data);
			}

			return {
				id: o.id,
				abort: function() {
					return o.c ? _abort(o, c) : false;
				},
				isInProgress: function() {
					return o.c ? _isInProgress(o, c.xdr.use) : false;
				}
			}
		},

	   /**
	   	* @description Response controller for cross-domain requests when using the
	   	* Flash transport or IE8's XDomainRequest object.
	   	*
		* @method xdrResponse
		* @private
		* @static
    	* @param {object} o - Transaction object generated by _create() in io-base.
		* @param {object} c - configuration object for the transaction.
		* @param {string} e - Event name
		* @return object
		*/
		xdrResponse: function(o, c, e) {
   			var m, fn,
   				isFlash = c.xdr.use === 'flash' ? true : false,
   				isXML = c.xdr.dataType === 'xml' ? true : false;
   				c.on = c.on || {};

   			if (isFlash) {
   				m = _fn || {};
   				fn = m[o.id] ? m[o.id] : null;
   				if (fn) {
	   				c.on = fn.on;
	   				c.context = fn.context;
	   				c.arguments = fn.arguments;
				}
			}
			if (e === ('abort' || 'timeout')) {
				o.status = e;
			}

			switch (e) {
				case 'start':
					Y.io.start(o.id, c);
					break;
				case 'success':
					Y.io.success(_data(o, isFlash, isXML), c);
					isFlash ? delete m[o.id] : delete _rS[o.id];
					break;
				case 'timeout':
				case 'abort':
				case 'failure':
					Y.io.failure(_data(o, isFlash, isXML), c);
					isFlash ? delete m[o.id] : delete _rS[o.id];
					break;
			}
		},

	   /**
		* @description Fires event "io:xdrReady"
		*
		* @method xdrReady
		* @private
		* @static
		* @param {number} id - transaction id
		* @param {object} c - configuration object for the transaction.
		*
		* @return void
		*/
		xdrReady: function(id) {
			Y.fire(E_XDR_READY, id);
		},

	   /**
		* @description Method to initialize the desired transport.
		*
		* @method transport
		* @public
		* @static
		* @param {object} o - object of transport configurations.
		* @return void
		*/
		transport: function(o) {
			var id = o.yid ? o.yid : Y.id;

			_swf(o.src, id);
			this._transport.flash = Y.config.doc.getElementById('yuiIoSwf');
		}
	});


}, '@VERSION@' ,{requires:['io-base','datatype-xml']});
