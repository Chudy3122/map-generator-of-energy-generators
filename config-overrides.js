module.exports = function override(config, env) {
    // Dodajemy fallback dla modułów Node.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "buffer": require.resolve("buffer/"),
      "timers": require.resolve("timers-browserify")
    };
    
    return config;
  };