// Firebase Auth natively signs in using an email address. Staff type only a
// username; the application converts it to a deterministic, reserved-domain
// internal identifier. This is NOT a deliverable mailbox.
export const STAFF_EMAIL_DOMAIN = 'staff.kp-uniform.invalid';
const RESERVED = new Set(['admin', 'root', 'system', 'firebase', 'support']);

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}
export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
    return 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษขึ้นต้นด้วยตัวอักษร ยาว 3–32 ตัว และใช้ตัวเลข จุด ขีด หรือขีดล่างได้';
  }
  if (RESERVED.has(username)) return 'ชื่อผู้ใช้นี้สงวนไว้สำหรับระบบ';
  return null;
}
export function usernameToEmail(value) {
  const error = validateUsername(value);
  if (error) throw new Error(error);
  return `${normalizeUsername(value)}@${STAFF_EMAIL_DOMAIN}`;
}
export function validateStaffPassword(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128
    ? null : 'รหัสผ่านครูต้องมีความยาวอย่างน้อย 10 ตัวและไม่เกิน 128 ตัว';
}