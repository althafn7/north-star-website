import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.northstaroman.com',
  vite: { plugins: [tailwindcss()] },
});
