import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [svelte()],
    build: { rollupOptions: { input: "calc.html" } },
    // WSL can't watch Windows drives (/mnt/c) with inotify.
    server: { watch: { usePolling: process.cwd().startsWith("/mnt/") } },
})
