import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exactMatch, fuzzyMatch, tokenOverlap } from '../src/scorers/text-match';

test('exactMatch: identical strings score 1', () => {
  const r = exactMatch('hello world', 'hello world');
  assert.equal(r.score, 1);
  assert.equal(r.matched, true);
});

test('exactMatch: case-insensitive by default', () => {
  const r = exactMatch('Hello World', 'hello world');
  assert.equal(r.matched, true);
});

test('exactMatch: case-sensitive option detects case difference', () => {
  const r = exactMatch('Hello World', 'hello world', { caseSensitive: true });
  assert.equal(r.matched, false);
});

test('exactMatch: whitespace normalized by default', () => {
  const r = exactMatch('hello   world', 'hello world');
  assert.equal(r.matched, true);
});

test('fuzzyMatch: small typo passes default threshold', () => {
  const r = fuzzyMatch('teh quick brown fox', 'the quick brown fox');
  assert.ok(r.score > 0.85, `score=${r.score}`);
  assert.equal(r.matched, true);
});

test('fuzzyMatch: very different strings fail', () => {
  const r = fuzzyMatch('abc', 'xyz');
  assert.ok(r.score < 0.5);
  assert.equal(r.matched, false);
});

test('fuzzyMatch: threshold respected', () => {
  // 1 char different out of 4 = 0.75 similarity
  const r = fuzzyMatch('abcd', 'abce', 0.9);
  assert.equal(r.matched, false);
});

test('tokenOverlap: same words different order matches', () => {
  const r = tokenOverlap('the cat sat on the mat', 'mat the on cat sat the');
  assert.equal(r.matched, true);
  assert.equal(r.score, 1);
});

test('tokenOverlap: partial overlap below threshold fails', () => {
  const r = tokenOverlap('the cat sat', 'the dog ran', 0.9);
  assert.equal(r.matched, false);
});
