// -------------------------------------------
//   Set title
// -------------------------------------------

ManView.Behaviors.SetTitle = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    var title = "<a href='https://github.com/dspinellis/manview'>manview</a>";
    var parsedURI = URI.parse(window.location.href);
    if (parsedURI.query) {
      var query = URI.parseQuery(parsedURI.query);
      if (query.name && query.link)
	title += " — " + "<a href='" + query.link + "'>" + query.name + "</a>";
      else if (query.name)
	title += " — " + query.name;
      else if (query.link)
	title += " — " + "<a href='" + query.link + "'>Manual Page</a>";
      this.el.innerHTML = title;
    }
  },

});
