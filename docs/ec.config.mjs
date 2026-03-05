import { defineEcConfig } from 'astro-expressive-code';

export default defineEcConfig({
  themes: ["min-light", "kanagawa-dragon"],
  themeCssSelector: (theme) => `[data-code-theme='${theme.name}']`,
});
