import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://danielgormly.github.io',
  base: '/primavera-ui',
  integrations: [
    expressiveCode({
      themes: ["min-light", "kanagawa-dragon"],
      themeCssSelector: (theme) => `[data-code-theme='${theme.name}']`,
    }),
  ],
});
