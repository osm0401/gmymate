(async function startApp(app) {
  await app.initializeCloud?.();
  app.setupOnboarding?.();
  app.setupMain?.();
  app.setupWorkoutLog?.();
  app.setupRoutines?.();
  app.setupAiChat?.();
  app.setupTapEffects?.();
})(window.Gmymate = window.Gmymate || {});
