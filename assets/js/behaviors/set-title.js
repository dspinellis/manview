// -------------------------------------------
//   Set title
// -------------------------------------------

ManView.Behaviors.SetTitle = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    this.el.innerHTML = "<a href='https://github.com/dspinellis/manview'>manview</a>";
  },

});
