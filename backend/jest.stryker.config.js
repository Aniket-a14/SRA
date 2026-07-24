// Jest config used only by Stryker mutation testing. Scoped to fast, self-contained
// pure-logic suites so each mutant runs a small, deterministic test set — mutation
// testing re-runs the suite once per mutant, so a narrow scope keeps it tractable.
export default {
    testEnvironment: 'node',
    transform: {}, // native ES modules
    testMatch: [
        '**/tests/unit/model_discovery.test.js',
        '**/tests/regression/response_envelope.regression.test.js',
    ],
    forceExit: true,
    clearMocks: true,
    restoreMocks: true,
};
