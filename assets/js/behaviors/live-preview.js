// -------------------------------------------
//   Live preview
// -------------------------------------------

Grapse.Behaviors.LivePreview = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    var url = 'https://raw.githubusercontent.com/dspinellis/manview/master/manview.3';
    var parsedURI = URI.parse(window.location.href);
    console.log('parsedURI ' + parsedURI);
    if (parsedURI.query) {
      var query = URI.parseQuery(parsedURI.query);
      console.log('Query: ' + query);
      if (query.src)
	url = query.src;
    }
    this.parser = Grapse.Services.TextParser.new();
    var request = new XMLHttpRequest();
    console.log('Fetching ' + url);
    request.open('GET', url);
    request.responseType = 'text';
    request.onload = function() {
      var customEvent = new CustomEvent("editor:changed", {
	"detail": {
	  text: request.response
	}
      });
      document.dispatchEvent(customEvent);
      console.log("Received " + request.response.length + " bytes");
    };
    request.send();
  },

  channels: {
    'editor:changed': 'refreshChannel',
    'macroLibrary:changed': 'setMacroLib'
  },

  setMacroLib: function(e) {
    this.parser.setMacroLib(e.detail.macroLib);
    this.refresh(this.lastParsedText);
  },

  refreshChannel: function(e) {
    console.log("In refresh channel ");
    console.log("e.detail.text: " + e.detail.text.length);
    this.refresh(e.detail.text);
  },

  refresh: function(text) {
    this.lastParsedText = text;
    this.el.innerHTML = this.parser.parseGroff(text);
    console.log("HTML: " + this.el.innerHTML.length);
  }
});
