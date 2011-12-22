/**
 * AjaxUploader.js v0.5.0 {{{
 *
 * jQuery-AjaxUploader - released under MIT License
 * Author: Kelly Hallman <khallman@gmail.com>
 * http://github.com/tapmodo/jquery-ajaxUploader
 *
 * }}}
 */

/**
 * AjaxUploader constructor
 */
$.AjaxUploader = function(obj,options){
  this.$input = $(obj);
  this.options  = $.extend({}, $.ajaxSettings, $.AjaxUploader.defaults, options);
  this.uniqid   = new Date().getTime();
  this.frameId  = 'jUploadFrame' + this.uniqid;
  this.formId   = 'jUploadForm' + this.uniqid;
  this.xml      = {};
  this.data     = {};
  if ($.isPlainObject(this.options.data)) this.setData(this.options.data);
  if (!!options.init) this.init();
}

$.extend($.AjaxUploader.prototype,{
  init: function(url,data,dataType){
    if (url) this.setUrl(url);
    if ($.isPlainObject(data)) this.setData(data);
    if (dataType) this.setDataType(dataType);

    this.$form    = this.createForm();
    this.$io      = this.createIframe(this.options.secureuri);

    var requestDone = false,
      that = this;

    $(document.body).append(this.$io, this.$form);

    // Watch for a new set of requests
    if (this.options.global && ! $.active++){
      $.event.trigger('ajaxStart');
    }

    // Create the request object
    if (this.options.global)
      $.event.trigger('ajaxSend', [this.xml, this.options]);

    // Timeout checker
    if (this.options.timeout > 0){
      window.setTimeout(function(){
        // Check to see if the request is still happening
        if(!requestDone && that.uploadCallback) that.uploadCallback.call(that,'timeout');
      }, this.options.timeout);
    }

    try{

      this.$form.attr({
        action: this.options.url,
        method: 'POST',
        target: this.frameId,
      })
        .attr(this.$form.encoding?'encoding':'enctype','multipart/form-data')
        .submit();

    }
    catch(e){
      this.handleError(this.options, this.xml, null, e);
    }

    // Attach onload handler to the iframe
    this.$io.load($.proxy(this.uploadCallback,this));
  },
  /**
   * Set request data
   */
  setData: function(data){
    this.data = data;
    return this;
  },
  setUrl: function(url){
    this.options.url = url;
    return this;
  },
  setDataType: function(dataType){
    this.options.dataType = dataType;
    return this;
  },

  /**
   * Create and return jQuery form
   */
  createForm: function(){

    // Create jQuery form element
    var $form = $('<form />').attr({
      method:   'POST',
      name:     this.formId,
      enctype:  'multipart/form-data'
    }).css({
      position: 'absolute',
      top:      '-1200px',
      left:     '-1200px'
    });

    // Clone the element
    var newElement = this.$input.clone();

    this.$input.attr('id','jUploadFile'+this.uniqid)

      // Place the clone before "this" input element
      .before(newElement)

      // Then append the original element to the new form
      // (this has the effect of moving it into $form)
      .appendTo($form);

    // Add any form data as hidden values
    $.each(this.data,function(i,v){
      $form.append($('<input type="hidden" />').attr('name',i).val(v));
    });

    return $form;
  },
  /**
   * Create and return jQuery iframe
   */
  createIframe: function(uri){

    // Create jQuery iframe element
    var $iframe = $('<iframe />').attr({
      name: this.frameId,
      id: this.frameId
    }).css({
      position: 'absolute',
      top: '-9999px',
      left: '-9999px'
    });
    
    if (window.ActiveXObject) {
      switch(typeof(uri)) {
        case 'boolean':
          $iframe.attr('src','javascript:false');
          break;
        case 'string':
          $iframe.attr('src',uri);
          break;
      }
    }

    return $iframe;
  },
  /**
   * Called when upload is complete or timed-out(?)
   */
  uploadCallback: function(isTimeout){
    var xml = this.xml;
    var io = this.$io[0];
    var that = this;

    try {
      var cw = io.contentWindow, cd = io.contentDocument;
      if (cw) {
        // I had to hack this here to look for innerText in the case of JSON
        // TODO: need to test with other dataType settings and browsers
        if (this.options.dataType == 'json')
          xml.responseText = cw.document.body? cw.document.body.innerText: null;
        else xml.responseText = cw.document.body? cw.document.body.innerHTML: null;

        xml.responseXML  = cw.document.XMLDocument? cw.document.XMLDocument: cw.document;
      }
      else if(cd) {
        xml.responseText = cd.document.body? cd.document.body.innerHTML: null;
        xml.responseXML  = cd.document.XMLDocument? cd.document.XMLDocument: cd.document;
      }
    } catch(e) {
      this.handleError(this.options, xml, null, e);
    }

    if (xml || isTimeout == 'timeout')
    {       
      requestDone = true;
      var status;
      try {
        status = isTimeout != 'timeout' ? 'success' : 'error';
        // Make sure that the request was successful or notmodified
        if (status != 'error')
        {
          // process the data (runs the xml through httpData regardless of callback)
          var data = this.uploadHttpData.call(this, xml, this.options.dataType);

          // If a local callback was specified, fire it and pass it the data
          if (this.options.success)
            this.options.success.call(this, data, status);

          // Fire the global callback
          if(this.options.global)
            $.event.trigger('ajaxSuccess', [xml, this.options]);

        }
        else this.handleError(this.options, xml, status);
      }
      catch(e) {
        status = 'error';
        this.handleError(this.options, xml, status, e);
      }

      // The request was Vcompleted
      if(this.options.global)
        $.event.trigger('ajaxComplete', [xml, this.options]);

      // Handle the global AJAX counter
      if (this.options.global && ! --$.active)
        $.event.trigger('ajaxStop');

      // Process result
      if (this.options.complete)
        this.options.complete.call(this, xml, status);

      this.$io.unbind();

      window.setTimeout($.proxy(this.remove,this),100);
      this.xml = null;
    }
  },
  /**
   * Remove form and iframe elements from DOM
   */
  remove: function(){
    try{
      this.$io.remove();
      this.$form.remove();
    }
    catch(e){
      this.handleError(this.options, this.xml, null, e);
    }                 
  },
  /**
   * Convert data from request object
   */
  uploadHttpData: function(r, type){
    var data = !type;
    data = type == 'xml' || data ? r.responseXML : r.responseText;

    // If the type is "script", eval it in global context
    if (type == 'script') $.globalEval(data);

    // Get the JavaScript object, if JSON is used.
    if (type == 'json') data = $.parseJSON(data);
      //safer than: eval("data = " + data);

    // evaluate scripts within html
    // TODO: doesn't evalScripts require another plugin??
    if (type == 'html')
      $('<div>').html(data).evalScripts();

    return data;
  },
  /**
   * Internal error handling
   */
  handleError: function(s, data, status, exc) {

    if (this.options.error)
      this.options.error.call(this, data, status, exc);

    else if (this.options.throwExceptions) throw exc;
  }

});

// Default settings for AjaxUploader
$.AjaxUploader.defaults = {
  data:     null,
  dataType: 'xml',
  throwExceptions: true,
  init:     false
};

// Client code example:
//var uploader = new $.AjaxUploader('fileElementId',{ /*options*/ });
