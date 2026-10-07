import js from "@eslint/js"
import svelte from "eslint-plugin-svelte"
import globals from "globals"

export default [
    { ignores: ["dist/", "dist-ssr/", "public/", "tests/", "test-results/", "playwright-report/", "*.config.ts"] },
    js.configs.recommended,
    ...svelte.configs.recommended,
    { languageOptions: { globals: { ...globals.browser } } },
    { files: ["scripts/**", "*.config.mjs"], languageOptions: { globals: { ...globals.node } } },
    // Legacy modules still waiting to be migrated: real-bug rules only, tidiness rules once they move.
    { files: ["src/lib/**/*.js"], ignores: ["src/lib/**/*.svelte.js"], rules: { "no-unused-vars": "off", "no-useless-assignment": "off" } },
    {
        files: ["**/*.svelte", "**/*.svelte.js"],
        rules: {
            "svelte/button-has-type": "error",
            "svelte/no-add-event-listener": "error",
            "svelte/no-at-html-tags": "error",
            "svelte/no-inline-styles": ["error", { allowTransitions: true }],
            "svelte/no-unused-class-name": "off",
            "svelte/prefer-const": "error",
            "svelte/prefer-writable-derived": "error",
            "svelte/require-each-key": "error",
            "svelte/valid-compile": "error",
            "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
        },
    },
    { files: ["**/*.svelte"], rules: { "svelte/max-lines-per-block": ["error", { script: 150, template: 120, style: 60 }] } },
]
