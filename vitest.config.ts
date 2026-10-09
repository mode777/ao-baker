import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // CJS emscripten glue: must be inlined so vite's commonjs plugin
        // converts module.exports for the ESM test pipeline
        inline: [/draco_decoder\.js$/],
      },
    },
  },
});
