export const ISSUE_TYPES = [
  { id: 'hair', label: 'ทรงผม' },
  { id: 'shirt', label: 'เสื้อ / เครื่องหมาย' },
  { id: 'bottom', label: 'กางเกง / กระโปรง' },
  { id: 'shoes', label: 'รองเท้า / ถุงเท้า' },
  { id: 'belt', label: 'เข็มขัด' },
  { id: 'nails', label: 'เล็บ' },
  { id: 'accessory', label: 'เครื่องประดับ' },
  { id: 'other', label: 'อื่น ๆ' },
];
export const STATUS_META = {
  pass: { label: 'ผ่าน', badge: 'pass' },
  issue: { label: 'ต้องแก้ไข', badge: 'issue' },
  not_checked: { label: 'ไม่ได้ตรวจ', badge: 'neutral' },
};
export function inspectionId(roundId, studentId) {
  return `${roundId}__${studentId}`;
}
export function normalizeStudent(row) {
  return {
    studentId: String(row.studentId ?? '').trim(),
    name: String(row.name ?? '').trim(),
    room: String(row.room ?? '').trim(),
    familyId: String(row.familyId ?? '').trim().toUpperCase(),
  };
}
export function validateStudent(row, knownFamilyIds = []) {
  const s = normalizeStudent(row);
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(s.studentId)) return 'รหัสนักเรียนต้องเป็นอักษรอังกฤษ/ตัวเลข/ขีด ความยาวไม่เกิน 60 ตัว';
  if (!s.name || s.name.length > 150) return 'ชื่อนักเรียนว่างหรือยาวเกิน 150 ตัวอักษร';
  if (!s.room || s.room.length > 30) return 'ห้องเรียนไม่ถูกต้อง';
  if (!/^[A-Z0-9_-]{1,30}$/.test(s.familyId)) return 'รหัส KP Family ไม่ถูกต้อง';
  if (knownFamilyIds.length && !knownFamilyIds.includes(s.familyId)) return `ไม่พบครอบครัว ${s.familyId} ในระบบ`;
  return null;
}
export function summarize(students, inspections) {
  const inspected = inspections.filter(i => i.status === 'pass' || i.status === 'issue');
  const pass = inspected.filter(i => i.status === 'pass').length;
  const issue = inspected.filter(i => i.status === 'issue').length;
  const pending = inspected.filter(i => i.status === 'issue' && i.resolution === 'pending').length;
  const fixed = inspected.filter(i => i.status === 'issue' && i.resolution === 'resolved').length;
  return { total: students.length, inspected: inspected.length, pass, issue, pending, fixed, notInspected: students.length - inspected.length };
}
export function prettyError(error) {
  const code = error?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (code === 'auth/too-many-requests') return 'เข้าสู่ระบบผิดหลายครั้ง กรุณาลองใหม่ภายหลัง';
  if (code === 'permission-denied') return 'ไม่มีสิทธิ์ดำเนินการนี้ หรือรอบตรวจปิดแล้ว';
  if (code === 'failed-precondition') return 'Firestore ยังไม่มีดัชนีสำหรับคำค้นนี้ กรุณาติดตั้ง firestore.indexes.json';
  if (code === 'unavailable') return 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
  return error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}