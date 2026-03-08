import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["**/*.md", "**/*.json", "**/*.jsonl", "node_modules/**"]
    },
    js.configs.recommended,
    {
        files: ["**/*.js", "**/*.cjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        },
        rules: {
            "no-unused-vars": "off",
            "no-undef": "off",
            "no-useless-escape": "off",
            "no-mixed-spaces-and-tabs": "off"
        }
    }
];
