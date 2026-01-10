export default {
    testEnvironment: 'node',
    transform: {}, // Use native ES modules
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    restoreMocks: true,
};
