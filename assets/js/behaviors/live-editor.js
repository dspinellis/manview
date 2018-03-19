// -------------------------------------------
//   Live editor
// -------------------------------------------

Grapse.Behaviors.LiveEditor = Essential.Behavior.extend({
  init: function() {
    /* Behavior variables */
    this.editor = ace.edit(this.el);
    this.editor.setTheme("ace/theme/chrome");
    this.editor.getSession().setMode("ace/mode/groff");

    /* Bindings */
    this.editor.on("change", this.emitChangedContent.bind(this));

  },

  emitChangedContent: function() {
  }
});
