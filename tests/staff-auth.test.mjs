import test from 'node:test';
import assert from 'node:assert/strict';
import { usernameToEmail, normalizeUsername, validateUsername, validateStaffPassword } from '../src/utils/staff-auth.js';

test('username canonicalization and internal email mapping', () => {
  assert.equal(normalizeUsername(' F01.Teacher '),'f01.teacher');
  assert.equal(usernameToEmail(' F01.Teacher '),'f01.teacher@staff.kp-uniform.invalid');
  assert.equal(validateUsername('abc_20'), null);
});
test('username validation rejects emails, whitespace, non-ASCII and reserved names', () => {
  for (const candidate of ['A@B.com','นฤทธิ์','ab','1teacher','a b','admin','system', 'x'.repeat(35)]) {
    assert.ok(validateUsername(candidate),candidate);
    assert.throws(()=>usernameToEmail(candidate));
  }
});
test('password policy requires at least 10 and up to 128 characters', () => {
  assert.ok(validateStaffPassword('abc123'));
  assert.equal(validateStaffPassword('example-P@ssword-2026'),null);
  assert.ok(validateStaffPassword('x'.repeat(129)));
});