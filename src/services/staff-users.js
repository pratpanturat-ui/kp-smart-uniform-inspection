import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { provisioningAuth } from './firebase';
import { updateTeacher } from './data';
import { normalizeUsername, usernameToEmail, validateStaffPassword } from '../utils/staff-auth';

/**
 * MVP approach: use a separate in-memory Firebase Auth instance so creating a
 * staff account does NOT replace the signed-in admin's session.
 *
 * Firebase Auth email/password registration is a public API by design: anyone
 * may create an *unprivileged* Auth identity. The Firestore user profile is
 * created with the ADMIN'S distinct session and is protected by Firestore Rules.
 * For tightly controlled Auth provisioning and password reset, implement a
 * privileged backend using Firebase Admin SDK (never expose credentials here).
 */
export async function createStaffAccount({ username, password, name, familyIds }) {
  if (!provisioningAuth) throw new Error('ยังไม่ได้ตั้งค่า Firebase');
  const email = usernameToEmail(username);
  const passwordError = validateStaffPassword(password);
  if (passwordError) throw new Error(passwordError);
  if (!name?.trim()) throw new Error('กรุณากรอกชื่อครู');
  if (!familyIds?.length) throw new Error('กรุณาเลือก KP Family อย่างน้อยหนึ่งครอบครัว');
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(provisioningAuth, email, password);
    try {
      await updateTeacher(credential.user.uid, {
        name, email, username: normalizeUsername(username), familyIds, active: true,
      });
    } catch (err) {
      // Avoid a dangling credential if profile registration failed.
      try { await deleteUser(credential.user); }
      catch { throw new Error(`สร้างบัญชี Firebase แล้ว แต่บันทึกสิทธิ์ไม่สำเร็จ (UID: ${credential.user.uid}) กรุณาตรวจสอบและปิดบัญชีใน Firebase Console`); }
      throw err;
    }
    return { uid: credential.user.uid, username: normalizeUsername(username) };
  } finally {
    // Secondary auth NEVER shares admin persistence, credentials, or session.
    await signOut(provisioningAuth).catch(() => {});
  }
}