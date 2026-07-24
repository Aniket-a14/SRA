export default {
    testEnvironment: 'node',
    transform: {}, // Use native ES modules
    testMatch: ['**/tests/**/*.test.js'],
    // Stryker copies the project into .stryker-tmp/sandbox-*/ during mutation runs;
    // never let the normal suite pick up those transient copies.
    testPathIgnorePatterns: ['/node_modules/', '/.stryker-tmp/'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    restoreMocks: true,
};
