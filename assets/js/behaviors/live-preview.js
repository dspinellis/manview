// -------------------------------------------
//   Live preview
// -------------------------------------------

Grapse.Behaviors.LivePreview = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    this.parser = Grapse.Services.TextParser.new();
    var request = new XMLHttpRequest();
    url = 'https://raw.githubusercontent.com/dspinellis/unix-history-repo/BSD-4_1c_2/usr/man/man2/syscall.2';
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
