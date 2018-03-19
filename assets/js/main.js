// -------------------------------------------
//   Main
// -------------------------------------------

ManView = {};
ManView.Behaviors = {};
ManView.Services = {};

document.addEventListener('DOMContentLoaded', function() {
  Essential.loadBehaviors({
    application: ManView.Behaviors,
    context: document
  });
});
