// -------------------------------------------
//   Live preview
// -------------------------------------------

ManView.Behaviors.PageView = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    var url = 'https://raw.githubusercontent.com/dspinellis/manview/master/manview.3';
    var parsedURI = URI.parse(window.location.href);
    var query = {};
    console.log('parsedURI ' + parsedURI);
    if (parsedURI.query) {
      query = URI.parseQuery(parsedURI.query);
      console.log('Query: ' + query);
      if (query.src)
	url = query.src;
    }
    this.sourceName = query.name || '';
    this.sourceLink = query.link || '';
    this.parser = ManView.Services.TextParser.new();
    var request = new XMLHttpRequest();
    console.log('Fetching ' + url);
    request.open('GET', url);
    request.responseType = 'text';
    request.onload = function() {
      var customEvent = new CustomEvent("source:retrieved", {
	"detail": {
	  text: request.response,
	  lastModified: request.getResponseHeader('Last-Modified')
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
    var text = e.detail.text;
    var hasHeader = text.search(/^\.(TH|Dt)\b/m) != -1;
    var html;
    console.log("Source text length: " + text.length);
    if (text.search(".Dd") != -1)
      this.parser.setMacroLib("doc");
    html = this.parser.parseGroff(text);
    this.renderManual(html, hasHeader);
    this.setFooter(e.detail.lastModified);
    console.log("HTML length: " + this.el.innerHTML.length);
  },

  renderManual: function(html, hasHeader) {
    var container = document.createElement('div');
    var header;

    container.innerHTML = html;
    header = container.querySelector('p:first-of-type');

    if (hasHeader && header) {
      if (this.sourceLink) {
	this.linkHeaderSpans(header);
      }
      this.setTopBar(header);
      header.parentNode.removeChild(header);
    } else if (this.sourceName) {
      this.setTopBar(this.createFallbackHeader());
    }

    this.el.innerHTML = container.innerHTML;
  },

  setTopBar: function(header) {
    var title = document.querySelector('[data-behavior="set-title"]');

    if (title) {
      title.innerHTML = header.innerHTML;
    }
  },

  setFooter: function(lastModified) {
    var footerDate = document.querySelector('[data-role="manual-date"]');
    var date = lastModified ? new Date(lastModified) : new Date();

    if (isNaN(date.getTime())) {
      date = new Date();
    }

    if (footerDate) {
      footerDate.textContent = this.formatIsoDate(date);
    }
  },

  formatIsoDate: function(date) {
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());

    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }

    return date.getFullYear() + '-' + month + '-' + day;
  },

  linkHeaderSpans: function(header) {
    var spans = header.querySelectorAll('span');
    var i;

    for (i = 0; i < spans.length; i++) {
      this.wrapContentsWithLink(spans[i]);
    }
  },

  wrapContentsWithLink: function(element) {
    var link = document.createElement('a');

    link.href = this.sourceLink;
    while (element.firstChild) {
      link.appendChild(element.firstChild);
    }
    element.appendChild(link);
  },

  createFallbackHeader: function() {
    var header = document.createElement('p');
    var span = document.createElement('span');

    header.className = 'manual-header';

    if (this.sourceLink) {
      span.appendChild(this.createSourceLink(this.sourceName));
    } else {
      span.textContent = this.sourceName;
    }

    header.appendChild(span);
    return header;
  },

  createSourceLink: function(text) {
    var link = document.createElement('a');

    link.href = this.sourceLink;
    link.textContent = text;

    return link;
  },

});
