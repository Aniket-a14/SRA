import { defineConfig } from "vitest/config"
import path from "path"

// Two kinds of test live here:
//  - pure logic in lib/* (the BYOK model catalogue, changelog ordering)
//  - component render tests in components/*, which assert what a user actually sees
//
// jsdom is the environment for both. The lib tests are framework-free and read files off
// disk, which works unchanged under jsdom, so a single project keeps the config honest
// rather than splitting it for a difference that does not matter.
//
// No JSX transform is configured: vitest 4 uses oxc, which handles the automatic runtime on
// its own. Setting `esbuild.jsx` here is silently ignored and only prints a warning.
export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/setup-dom.ts"],
        include: [
            "lib/**/*.test.ts",
            "lib/**/*.test.tsx",
            "components/**/*.test.tsx",
            "tests/unit/**/*.test.ts",
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
})
