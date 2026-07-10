(function startApp(app) {
  app.setupOnboarding?.();
  app.setupMain?.();
  app.setupWorkoutLog?.();
  app.setupTapEffects?.();
})(window.Gmymate = window.Gmymate || {});
