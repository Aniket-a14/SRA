import { defineConfig } from "vitest/config"
import path from "path"

// Unit tests for framework-free logic (lib/*). Component/e2e coverage stays in
// Playwright; vitest here is for pure functions like the BYOK model catalogue.
export default defineConfig({
    test: {
        environment: "node",
        include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
})
