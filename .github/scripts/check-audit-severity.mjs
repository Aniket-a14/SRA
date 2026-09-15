// Shared by backend.yml and frontend.yml's "Security Scan" step: decides whether a
// `pnpm audit --json` result should fail the build. Kept as one tested module, not
// inlined YAML, because the inline version silently missed "critical" for a while
// (see evaluateAudit's docstring) and that class of bug has no test coverage when it
// lives only in a shell heredoc.

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/**
 * @param {string} rawJson - stdout of `pnpm audit --json`
 * @returns {{ blocking: Array<{severity: string, title: string, module_name: string}>, message: string }}
 */
export function evaluateAudit(rawJson) {
  // Advisory reference text can carry raw control characters (e.g. a multi-line
  // reference list), which are invalid inside a JSON string and crash JSON.parse
  // regardless of severity. Strip them before parsing.
  const cleaned = (rawJson || '{}').replace(/[\x00-\x1f]+/g, ' ');
  const parsed = JSON.parse(cleaned);
  const advisories = Object.values(parsed.advisories || {});
  const blocking = advisories.filter((a) => BLOCKING_SEVERITIES.has(a.severity));

  if (blocking.length > 0) {
    const lines = blocking.map((a) => `- [${a.severity}] ${a.title} (${a.module_name})`);
    return {
      blocking,
      message: `High/critical-severity vulnerabilities found in production dependencies:\n${lines.join('\n')}`,
    };
  }
  return { blocking, message: 'No high/critical-severity vulnerabilities in production dependencies.' };
}

async function main() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  const { blocking, message } = evaluateAudit(data);
  if (blocking.length > 0) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
}

// Only run as a CLI when invoked directly (`node check-audit-severity.mjs < audit.json`),
// not when imported by the test file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
