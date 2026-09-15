import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from './check-audit-severity.mjs';

function auditJson(advisories) {
  return JSON.stringify({ advisories });
}

test('passes when there are no advisories', () => {
  const { blocking } = evaluateAudit(auditJson({}));
  assert.equal(blocking.length, 0);
});

test('passes when only moderate/low advisories are present', () => {
  const { blocking } = evaluateAudit(
    auditJson({
      1: { severity: 'moderate', title: 'qs bypass', module_name: 'qs' },
      2: { severity: 'low', title: 'minor issue', module_name: 'foo' },
    }),
  );
  assert.equal(blocking.length, 0);
});

test('blocks on a high-severity advisory', () => {
  const { blocking, message } = evaluateAudit(
    auditJson({ 1: { severity: 'high', title: 'RCE in bar', module_name: 'bar' } }),
  );
  assert.equal(blocking.length, 1);
  assert.match(message, /bar/);
});

// Regression test: the original inline script filtered `a.severity === "high"` only,
// so a critical advisory (e.g. the Next.js unauthenticated RCE, GHSA-p293-qw3h-jr36)
// passed through uncaught. This must fail.
test('blocks on a critical-severity advisory', () => {
  const { blocking, message } = evaluateAudit(
    auditJson({ 1: { severity: 'critical', title: 'Unauthenticated RCE', module_name: 'next' } }),
  );
  assert.equal(blocking.length, 1);
  assert.match(message, /Unauthenticated RCE/);
});

test('reports every blocking advisory, not just the first', () => {
  const { blocking } = evaluateAudit(
    auditJson({
      1: { severity: 'high', title: 'A', module_name: 'a' },
      2: { severity: 'critical', title: 'B', module_name: 'b' },
      3: { severity: 'moderate', title: 'C', module_name: 'c' },
    }),
  );
  assert.equal(blocking.length, 2);
});

// Regression test: pnpm's own advisory "references" text can contain a raw newline,
// which is invalid inside a JSON string. The original script's bare `JSON.parse(data)`
// threw an uncaught SyntaxError on this, crashing the step with a stack trace instead
// of a clean pass/fail regardless of severity.
test('does not crash on control characters embedded in advisory text', () => {
  const withRawNewline =
    '{"advisories":{"1":{"severity":"moderate","title":"qs bug","module_name":"qs",' +
    '"references":"- https://a.example/one\n- https://a.example/two"}}}';
  const { blocking } = evaluateAudit(withRawNewline);
  assert.equal(blocking.length, 0);
});

test('treats missing/empty input as no advisories rather than throwing', () => {
  assert.doesNotThrow(() => evaluateAudit(''));
  assert.doesNotThrow(() => evaluateAudit(undefined));
});
