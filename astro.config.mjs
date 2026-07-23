import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    site: process.env.SITE_URL || 'https://tazelite.netlify.app',
    vite: {
        plugins: [tailwindcss()]
    },
    adapter: netlify({
        devFeatures: {
            environmentVariables: true
        }
    })
});
