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
      var customEvent = new CustomEvent("source:retrieved", {
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
    'source:retrieved': 'refreshChannel',
  },

  refreshChannel: function(e) {
    console.log("Source text length: " + e.detail.text.length);
    this.el.innerHTML = this.parser.parseGroff(e.detail.text);
    console.log("HTML length: " + this.el.innerHTML.length);
  },

});
