// P011 implementer tests: engine-owned linear-time RE2 subset (spec section 11.4; errata E-0021, E-0022 D-05).
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LogicError } from '../framework/engine/logic-errors.mjs';
import { RE2_MAX_REPEAT, compileRe2, searchRe2 } from '../framework/engine/regex-re2.mjs';

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'framework', 'engine');

function matches(pattern, text) {
  const compiled = compileRe2(pattern);
  assert.equal(compiled.ok, true, `compile ${JSON.stringify(pattern)}: ${compiled.reason}`);
  return searchRe2(compiled.program, text);
}

function rejected(pattern) {
  const compiled = compileRe2(pattern);
  assert.equal(compiled.ok, false, `${JSON.stringify(pattern)} must be rejected`);
  assert.equal(typeof compiled.reason, 'string');
  assert.ok(compiled.reason.length > 0);
}

test('§11.4 l.612: accepted syntax matches as an unanchored, case-sensitive search', () => {
  const rows = [
    ['abc', 'xxabcxx', true], ['abc', 'ab', false], ['a', 'A', false], ['^abc$', 'abc', true], ['^abc$', 'abcd', false],
    ['^abc$', 'xabc', false], ['\\d{3}-\\d{2}', 'ab123-45x', true], ['\\d{3}-\\d{2}', '12-345', false], ['[A-Z]{3}[0-9]{2,4}', 'XYZ123', true],
    ['[A-Z]{3}[0-9]{2,4}', 'XY123', false], ['a|b', 'xbx', true], ['a|b', 'xcx', false], ['^(a|b)*c?$', 'abc', true],
    ['^(a|b)*c?$', 'abcc', false], ['(?:ab)+$', 'xabab', true], ['(?:ab)+$', 'ababx', false], ['a{2,3}', 'a', false],
    ['a{2,3}', 'aa', true], ['^a{2}$', 'aaa', false], ['^a{2,}$', 'aaaa', true], ['^a{2,}$', 'a', false], ['x*', '', true],
    ['\\.', 'a.b', true], ['\\.', 'ab', false], ['\\(\\)', 'f()', true], ['\\\\', 'a\\b', true], ['\\\\', 'ab', false],
    ['a.c', 'abc', true], ['a.c', 'ac', false], ['[^0-9]', '123', false], ['[^0-9]', '12a', true],
  ];
  for (const [pattern, text, expected] of rows) assert.equal(matches(pattern, text), expected, `${pattern} on ${JSON.stringify(text)}`);
});

test('§11.4 l.612: lazy forms do not change match / no-match; counted bounds are inclusive up to 1000', () => {
  for (const [pattern, text] of [['a+?', 'baab'], ['^a+?$', 'aaa'], ['a*?b', 'aab'], ['a??', ''], ['a{1,3}?c', 'aac']]) {
    assert.equal(matches(pattern, text), true, pattern);
  }
  assert.equal(RE2_MAX_REPEAT, 1000);
  assert.equal(matches('a{1000}', 'a'.repeat(1000)), true);
  assert.equal(matches('a{1000}', 'a'.repeat(999)), false);
  assert.equal(matches('^a{0,1000}$', 'a'.repeat(1000)), true);
  assert.equal(matches('a{1000,}', 'a'.repeat(1500)), true);
  for (const p of ['a{1001}', 'a{1,1001}', 'a{0,1001}', 'a{1001,}', 'a{99999999999999999999}']) rejected(p);
});

test('§11.4 l.612: matching is over code points, not UTF-16 units', () => {
  assert.equal(matches('^.$', '😀'), true);
  assert.equal(matches('^..$', '😀'), false);
  assert.equal(matches('^caf.$', 'café'), true);
  assert.equal(matches('é', 'café'), true);
  assert.equal(matches('[😀]', 'a😀b'), true);
  assert.equal(matches('^[^a]$', '😀'), true);
  assert.equal(matches('😀{2}', '😀😀'), true);
});

test('§11.4 l.612 (E-0022 D-05): RE2 defaults for newline, anchors and ASCII classes', () => {
  assert.equal(matches('a.c', 'a\nc'), false, '. excludes \\n');
  assert.equal(matches('a.c', 'a\rc'), true);
  assert.equal(matches('^abc$', 'abc\n'), false, '$ is end of text only');
  assert.equal(matches('^abc$', 'abc'), true);
  assert.equal(matches('^b', 'a\nb'), false, '^ is start of text only');
  assert.equal(matches('a$', 'a\nb'), false);
  assert.equal(matches('^\\w$', 'é'), false);
  assert.equal(matches('\\W', 'é'), true);
  assert.equal(matches('\\d', '٣'), false);
  assert.equal(matches('\\D', '٣'), true);
  assert.equal(matches('\\s', ' '), false);
  assert.equal(matches('\\S', ' '), true);
  assert.equal(matches('\\s', '\v'), false, 'RE2 \\s excludes \\v');
  for (const c of [' ', '\t', '\n', '\f', '\r']) assert.equal(matches('^\\s$', c), true, JSON.stringify(c));
  assert.equal(matches('[^a]', '\n'), true, 'negated classes match \\n');
  assert.equal(matches('[\\d]', '7'), true);
  assert.equal(matches('[\\D]', '7'), false);
  assert.equal(matches('[^\\W]', '_'), true);
  assert.equal(matches('[\\s\\d]+$', '1 2 3'), true);
});

test('§11.4 l.612 (E-0022 D-05): accepted escapes, the empty pattern and class edge cases', () => {
  for (const [pattern, text] of [['\\n', 'a\nb'], ['\\t', 'a\tb'], ['\\r', 'a\rb'], ['\\f', 'a\fb'], ['\\v', 'a\u000bb'], ['[\\n]', '\n']]) {
    assert.equal(matches(pattern, text), true, pattern);
  }
  assert.equal(matches('\\n', 'a b'), false);
  assert.equal(matches('', 'abc'), true);
  assert.equal(matches('', ''), true);
  assert.equal(matches('^$', ''), true);
  assert.equal(matches('(|a)', 'xyz'), true);
  assert.equal(matches('[]a]', ']'), true, '] first in a class is a literal');
  assert.equal(matches('[^]a]', 'b'), true);
  assert.equal(matches('[^]a]', ']'), false);
  assert.equal(matches('[a-]', '-'), true);
  assert.equal(matches('[-a]', '-'), true);
  assert.equal(matches('[a\\-z]', '-'), true);
  assert.equal(matches('[a\\-z]', 'b'), false);
  assert.equal(matches('[\\]]', ']'), true);
  assert.equal(matches('a}', 'a}'), true);
  assert.equal(matches('\\{\\}', '{}'), true);
  assert.equal(matches('\\^\\$', '^$'), true);
  assert.equal(matches('()', 'x'), true);
  assert.equal(matches('(?:)', 'x'), true);
  assert.equal(matches('(a*)*', 'b'), true);
  assert.equal(matches('^(a*)+$', 'aaaa'), true);
});

test('§11.4 l.612: constructs E-0021 names as rejected are not compilable', () => {
  for (const p of [
    '(a)\\1', '(?=a)', '(?!a)', '(?<=a)', '(?<!a)', '(?P<n>a)', '(?<n>a)', '(?i)a', '(?s:a)', '\\p{L}', '\\pL', '\\P{L}', '(?>a)',
    'a++', 'a*+', 'a?+', 'a{2}+', '\\1', '\\k<n>', '(?#comment)', '(?|a)',
  ]) rejected(p);
});

test('§11.4 l.612 (E-0022 D-05): unlisted constructs and syntax errors are not compilable', () => {
  for (const p of [
    'a**', 'a*+', 'a+*', 'a+??', 'a{2}{3}', 'a{2}*', '\\b', '\\B', '\\A', '\\z', '\\Z', '\\x41', '\\u0041', '\\0', '\\a', '\\e', '\\d\\_',
    '[[:alpha:]]', '[[:^digit:]]', '[a-\\d]', '[\\d-z]', '[z-a]', '[a', '[', '[^', '[]', '(', ')', '(a', 'a)', '(?', '(?:', '(?:a',
    'a{3,2}', 'a{', 'a{,5}', 'a{x}', 'a{2,x}', '{2}', '*a', '+', '?', 'a|*', '|*', '(*)', '^*', '$+', '\\', 'a\\', '[\\', '\\_', '\\é',
  ]) rejected(p);
  assert.equal(matches('\\.\\*\\+\\?\\|\\(\\)\\[\\]\\{\\}\\^\\$\\-\\\\\\/', '.*+?|()[]{}^$-\\/'), true);
});

test('§11.4 l.612: a compiled program above 100000 instructions is rejected, the bound is checked before building it', () => {
  const start = performance.now();
  for (const p of ['(a{1000}){1000}', '((a{1000}){1000}){1000}', '(((((a{1000}){1000}){1000}){1000}){1000}){1000}', '(a{1000}){101}', '(((a{1000}){1000}){1000}){1000}']) rejected(p);
  assert.ok(performance.now() - start < 2000, 'oversized programs fail without being built');
  assert.equal(matches('(a{100}){100}', 'a'.repeat(10000)), true);
  assert.equal(matches('(a{100}){100}', 'a'.repeat(9999)), false);
  assert.equal(compileRe2('(a{100}){999}').ok, true, '99900 instructions + match is under the cap');
  assert.equal(compileRe2('(a{100}){1000}').ok, false, '100000 instructions + match exceeds the cap');
});

test('§11.4 l.612: nesting is bounded (no stack overflow on hostile patterns)', () => {
  assert.equal(compileRe2(`${'('.repeat(500)}a${')'.repeat(500)}`).ok, true);
  rejected(`${'('.repeat(1200)}a${')'.repeat(1200)}`);
  rejected('('.repeat(200000));
  rejected(`${'(?:'.repeat(100000)}a`);
  assert.equal(compileRe2('a|'.repeat(20000)).ok, true, 'long alternations are fine');
  assert.equal(matches('x'.repeat(5000), 'x'.repeat(5000)), true);
});

test('§11.4 l.612: pathological patterns run in linear time (no catastrophic backtracking)', () => {
  const cases = [
    ['(a+)+$', `${'a'.repeat(50000)}b`, false], ['(a+)+$', 'a'.repeat(50000), true], ['(a|aa)+$', `${'a'.repeat(50000)}b`, false],
    ['(a*)*b', 'a'.repeat(50000), false], ['(x+x+)+y', 'x'.repeat(50000), false], ['^(([a-z])+.)+[A-Z]([a-z])+$', `${'a'.repeat(30000)}!`, false],
    ['(.*)*(.*)*(.*)*z', 'a'.repeat(20000), false], ['(a?){30}a{30}', 'a'.repeat(30), true], ['^(a?){1000}a{1000}$', 'a'.repeat(1000), true],
    ['^(a|a)*$', `${'a'.repeat(50000)}!`, false],
  ];
  for (const [pattern, text, expected] of cases) {
    const start = performance.now();
    assert.equal(matches(pattern, text), expected, pattern);
    assert.ok(performance.now() - start < 5000, `${pattern} took ${performance.now() - start} ms`);
  }
});

test('§11.4 l.612: search time grows linearly with the text for a fixed pattern', () => {
  const compiled = compileRe2('(a+)+$');
  const timeOf = (n) => {
    const text = `${'a'.repeat(n)}b`;
    const start = performance.now();
    searchRe2(compiled.program, text);
    return performance.now() - start;
  };
  timeOf(1000);
  const small = timeOf(20000);
  const large = timeOf(200000);
  assert.ok(large < 5000, `200000 chars took ${large} ms`);
  assert.ok(large < Math.max(small, 5) * 100, `10x the text must not cost 100x (small ${small} ms, large ${large} ms)`);
});

test('§11.4 l.612: lone surrogates and every BMP/astral code point are handled without throwing', () => {
  const lone = '\ud800';
  assert.equal(matches('^.$', lone), true);
  assert.equal(matches('^..$', '😀'), false);
  assert.equal(matches('[\\s\\S]', '\u{10ffff}'), true);
  assert.equal(matches('[^a]', '\u{10ffff}'), true);
});

test('§11.4 l.612: non-string patterns and texts, and foreign programs, are INVALID_ARGUMENT', () => {
  for (const bad of [null, undefined, 5, {}, [], Symbol.iterator]) {
    assert.throws(() => compileRe2(bad), (error) => error instanceof LogicError && error.code === 'INVALID_ARGUMENT');
  }
  const { program } = compileRe2('a');
  for (const bad of [null, undefined, 5, {}, []]) {
    assert.throws(() => searchRe2(program, bad), (error) => error instanceof LogicError && error.code === 'INVALID_ARGUMENT');
  }
  for (const bad of [null, {}, { ops: [] }, 'a']) {
    assert.throws(() => searchRe2(bad, 'a'), (error) => error instanceof LogicError && error.code === 'INVALID_ARGUMENT');
  }
});

test('§11.4 l.612: compile is deterministic and programs are immutable and reusable', () => {
  const a = compileRe2('^[a-c]+x?$');
  const b = compileRe2('^[a-c]+x?$');
  assert.equal(a.ok && b.ok, true);
  assert.deepEqual(a.program.ops, b.program.ops);
  assert.equal(Object.isFrozen(a.program), true);
  assert.equal(searchRe2(a.program, 'abcabc'), true);
  assert.equal(searchRe2(a.program, 'abcd'), false);
  assert.equal(searchRe2(a.program, 'abcabc'), true, 'a program has no match state');
});

test('§11.4 l.612: the engine never builds or applies a host RegExp from a user pattern (source scan)', async () => {
  for (const file of ['regex-re2.mjs', 'decision-table.mjs']) {
    const source = (await fs.readFile(path.join(ENGINE, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const pattern of [/new\s+RegExp/, /\bRegExp\s*\(/, /\.match\s*\(/, /\.exec\s*\(/, /\.test\s*\(/, /\.matchAll\s*\(/, /\.replace\s*\(\s*\//, /\.search\s*\(/]) {
      assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
    }
  }
});
