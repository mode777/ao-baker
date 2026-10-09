import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/ao-baker/',
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/three/examples/jsm/libs/draco/gltf/*',
          dest: 'draco',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
});
