export default {
    testEnvironment: 'node',
    transform: {}, // Native ES modules — the CLI is "type": "module", not transpiled.
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    verbose: true,
    // Commands print user-facing chatter on every path by design; surfacing it here buries
    // the actual test output. Failures still report normally.
    silent: true,
    clearMocks: true,
    restoreMocks: true,
};
