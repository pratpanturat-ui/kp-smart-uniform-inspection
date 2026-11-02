# KP Smart Uniform Inspection (MVP v0.1)

**ระบบตรวจเครื่องแต่งกาย โรงเรียนคีรีราษฎร์พัฒนา**  
React 19 + Vite 7 + Tailwind CSS 4 + Firebase Authentication (Email/Password) + Cloud Firestore + Cloudflare Pages + GitHub.

> ซอร์สโค้ดถูกจัดเตรียมสำหรับ Repository `pratpanturat-ui/kp-smart-uniform-inspection` **ยังไม่ได้เชื่อม Firebase จริงหรือ Deploy ขึ้น Cloudflare** และยังไม่ได้ทดสอบ Firestore Emulator. ห้ามนำไปใช้งานจริงจนกว่าจะทดสอบ Security Rules สำเร็จ
> **คำเตือน:** Repository ที่สร้างครั้งแรกมีสถานะ Public; ควรเปลี่ยนเป็น **Private** ก่อนนำข้อมูลบุคลากรหรือข้อมูลนักเรียนใด ๆ มาใช้ และห้าม Commit ข้อมูลนักเรียนจริงหรือ service account

## ความสามารถเวอร์ชันนี้

- ลงชื่อเข้าใช้ด้วย Email/Password ส่วนบุคคล ผ่าน Firebase Authentication ไม่มีหน้าให้สมัครเอง
- Admin คนแรกหนึ่งบัญชี (bootstrap ผ่าน Firebase Console) จัดการครู ครอบครัว รอบตรวจ และนำเข้า CSV นักเรียน
- ครูเห็นเฉพาะนักเรียนและผลตรวจของ KP Family ที่กำหนดใน `users/{uid}.familyIds` โดย Security Rules บังคับฝั่ง Firestore
- ตรวจตามครอบครัว: ผ่าน / ต้องแก้ไข (หลายข้อ) / ไม่ได้ตรวจ (ไม่ใช่สถานะขาดเรียน)
- หนึ่งเอกสารผลตรวจต่อหนึ่งนักเรียนต่อหนึ่งรอบ; อัปเดตซ้ำได้ ไม่เพิ่มจำนวนผลตรวจซ้ำ
- ติดตามสถานะ `pending` / `resolved`; บันทึกประวัติการกดใน `inspection_events` แบบ append-only
- Dashboard ตัวเลขผลตรวจ แยกครอบครัว; ส่งออก CSV UTF-8 สำหรับ Excel; พิมพ์เป็น PDF ได้ผ่านฟังก์ชัน Print ของเบราว์เซอร์
- **ยังไม่มี** อัปโหลดรูป / แจ้ง LINE / ตัดคะแนนพฤติกรรม / สร้างบัญชี Firebase Auth ด้วยหน้า Admin / ความสามารถออฟไลน์สมบูรณ์

## 1) ติดตั้งบนเครื่อง

ติดตั้ง Node.js 22 (หรือเวอร์ชัน LTS ที่รองรับ Vite 7), Git และ Java (สำหรับ Firebase Emulator)

```bash
npm install
cp .env.example .env
npm run dev
```

เปิดเว็บที่ URL ที่ Vite แสดงในเทอร์มินัล (ปกติ `http://localhost:5173`).

**Windows PowerShell** ใช้ `Copy-Item .env.example .env` แทน `cp` ได้

## 2) สร้าง Firebase project

1. ไปที่ [Firebase Console](https://console.firebase.google.com/) เลือก `Add project` ชื่อเช่น `kp-smart-uniform`.
2. เลือก `Build > Authentication > Sign-in method > Email/Password` แล้วกด Enable. **อย่าเปิดวิธีอื่นหากยังไม่ต้องการ**.
3. เลือก `Build > Firestore Database > Create database` เลือก location ที่เหมาะสม (แก้ region ภายหลังไม่ได้ง่าย) และสร้างแบบ **Production mode** ห้ามตั้ง Allow All.
4. ไปที่ `Project settings > Your apps > Web > Add app` แล้วคัดลอก `firebaseConfig` ค่ามาใส่ `.env`:

| Firebase config | .env |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

> ตัวแปร `VITE_` ฝังในเว็บฝั่งผู้ใช้โดยออกแบบไว้แบบนี้ **ไม่ใช่รหัสลับ**. ความปลอดภัยขึ้นอยู่กับ Auth + Firestore Rules. อย่าใส่ service account/private key ลงใน `VITE_*`, `.env` ที่ Commit หรือ GitHub.

## 3) ติดตั้ง Security Rules และ Indexes ก่อนใช้งาน

จากโฟลเดอร์โปรเจกต์:

```bash
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules,firestore:indexes
```

หรือแก้ `.firebaserc.example` เป็น `.firebaserc` แล้วแทน `YOUR_FIREBASE_PROJECT_ID` เป็น projectId จริง (`.firebaserc` อย่าใส่ข้อมูลลับ).

**ทดสอบก่อน Deploy**:

```bash
npm test
npm run rules:test
```

`npm run rules:test` ใช้ Firebase Firestore Emulator (`127.0.0.1:8080`), ต้องมี Java และการติดตั้ง emulator binary ตามคำแนะนำ CLI. ชุดทดสอบครอบคลุมผู้ใช้ที่ไม่ล็อกอิน ครูข้ามครอบครัว การยกระดับสิทธิ์ การบันทึกตรวจ และรอบปิด. สำหรับ production ควรทดสอบซ้ำหลังแก้ Rules ทุกครั้ง.

## 4) สร้าง Admin คนแรก (Bootstrap)

1. Firebase Console > Authentication > Users > **Add user** ใส่อีเมลและรหัสผ่านส่วนบุคคลที่คาดเดายากของ Admin.
2. คัดลอก `User UID` (ไม่ใช่อีเมล).
3. Firestore Database > Start collection > ชื่อ `users` > Document ID = **UID ของ Admin**.
4. เพิ่ม Field ด้านล่างด้วยชนิดข้อมูลให้ถูกต้อง:

```json
{
  "name": "ผู้ดูแลระบบกิจการนักเรียน",
  "email": "admin@your-school-domain.example",
  "role": "admin",
  "active": true,
  "familyIds": []
}
```

`familyIds` ต้องเป็น **Array** จริง ไม่ใช่ String. ต้องตรงกับบัญชี Firebase Authentication ที่สร้าง. Console เป็น trusted administrative tool ที่กำหนด role แรกได้; กฎ Firestore ของโปรเจกต์ไม่อนุญาตให้สร้าง admin คนที่สองจากหน้าเว็บ.

> ผู้ดูแลระบบควรเป็นคนเดียวตามนโยบายโรงเรียน เก็บรักษารหัสผ่านอย่างปลอดภัย และเปิด MFA เมื่อมีวิธีการยืนยันตัวตนที่เหมาะสมกับบัญชีนี้.

## 5) ลำดับการตั้งค่าจากหน้า Admin

1. **KP Family** > `สร้าง F01–F21` (สร้างชื่อ placeholder ยกเว้น F13 ชื่อ `วิชาดี`) แล้วกด `แก้ไข` เพื่อเปลี่ยนเป็นชื่อจริงของแต่ละครอบครัว.
2. **รอบตรวจ** > เพิ่มรอบ `2026-11`, วันที่ตรวจ (เช่น `2026-11-03`), สถานะ `open`.
3. **ข้อมูลนักเรียน** > `ดาวน์โหลดไฟล์ตัวอย่าง` แล้วจัดข้อมูล CSV UTF-8 ตามรูปแบบ:

```csv
studentId,name,room,familyId
00123,เด็กชาย ก.,ม.3/1,F01
00124,เด็กหญิง ข.,ม.3/1,F13
```

สามารถแปลง Excel เป็น CSV UTF-8 โดยใช้ Excel > Save As > `CSV UTF-8` (รักษาศูนย์นำหน้ารหัสนักเรียนโดยตั้งคอลัมน์เป็น Text ก่อนเปิด/แก้ไขไฟล์). อย่าใช้ข้อมูลจริงใน source code หรือ public repository.

4. **สิทธิ์ครู** > Firebase Authentication > Users > Add user (ทำทีละคน) > คัดลอก UID > หน้า Admin > ใส่ UID ชื่อครู อีเมล และเลือก KP Family ที่รับผิดชอบ. ต้องสร้างบัญชีใน Firebase Auth และเอกสาร `users/{uid}` จึงจะเข้าสู่ระบบสำเร็จ.
5. ครูแต่ละคนล็อกอินตรวจด้วยรหัสผ่านเฉพาะบุคคล.

**ข้อจำกัด CSV:** นักเรียนที่ไม่มีในไฟล์ใหม่จะยังอยู่ในฐานข้อมูล, การอัปเดตครอบครัวของนักเรียนอาจทำให้สิทธิ์การเห็นประวัติเก่าต้องตรวจทานเป็นรายกรณี. ควรยืนยันโอนย้ายนักเรียน/ครอบครัวกับฝ่ายกิจการนักเรียนก่อนทำการนำเข้ารอบใหม่.

## 6) โครงสร้างฐานข้อมูล Firestore

```text
users/{firebaseAuthUid}
  name, email, role: 'admin' | 'teacher', active, familyIds: ['F01', ...]
families/{familyId}
  name, active
students/{studentId}
  studentId, name, room, familyId
inspection_rounds/{YYYY-MM}
  name, date: 'YYYY-MM-DD', status: 'open' | 'closed'
inspections/{roundId}__{studentId}
  roundId, studentId, familyId, status: 'pass' | 'issue' | 'not_checked',
  issueTypes: [], note, resolution: 'none' | 'pending' | 'resolved',
  createdBy, updatedBy, createdAt, updatedAt
inspection_events/{autoId}
  inspectionId, roundId, studentId, familyId, actorUid, status, resolution, issueTypes, note, createdAt
```

`not_checked` แปลว่า **ยังไม่ตรวจเครื่องแต่งกาย** ไม่ใช่ `absent` (ขาดเรียน). จำนวน "ตรวจแล้ว" นับเฉพาะ `pass` และ `issue`. `inspection_events` เป็นบันทึกการเปลี่ยนแปลงที่ Client เขียนตามสิทธิ์เท่านั้น; ยังไม่ใช่ audit log ที่ป้องกันการปลอมแปลงได้สมบูรณ์ หากต้องการรับรองทางวินัยควรใช้ backend ที่เชื่อถือได้ในระยะต่อไป.

## 7) ส่งโปรเจกต์ขึ้น GitHub

ถ้าต้องการ Push โค้ดจากเครื่องหลังจากมี Repository `pratpanturat-ui/kp-smart-uniform-inspection` แล้ว ใช้:

```bash
git init
git add .
git commit -m "Initial KP Smart Uniform Inspection MVP"
git branch -M main
git remote add origin https://github.com/pratpanturat-ui/kp-smart-uniform-inspection.git
git push -u origin main
```

`.env`, service account และไฟล์รายชื่อนักเรียนจริงต้องอยู่เฉพาะระบบที่ได้รับอนุญาต **อย่า commit**. หากไฟล์ข้อมูลจริงหลุดเข้า commit ต้องล้างประวัติ Git และประเมินเหตุข้อมูลรั่วไหล.

## 8) Deploy ผ่าน Cloudflare Pages

1. Cloudflare Dashboard > **Workers & Pages** > Create application > Pages > Import existing Git repository > เลือก repo นี้.
2. กำหนด:
   - Production branch: `main`
   - Framework preset: `React (Vite)` หรือ `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. ที่ Environment variables สำหรับ **Production** ใส่ `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` จาก Firebase Web app.
4. Deploy, จากนั้นไปที่ Firebase Console > Authentication > Settings > Authorized domains แล้วเพิ่ม **โดเมนจริงที่ Cloudflare สร้างให้** และโดเมน custom หากใช้.
5. ทดสอบด้วย Admin 1 บัญชีและครูที่มี F01, F02 แยกกัน; ครู F01 ต้องอ่าน/แก้ไข F02 ไม่ได้แม้เปิด Developer Tools.

Cloudflare Pages ใช้ HTTPS และมี build ใหม่เมื่อ push GitHub. ไฟล์ `public/_headers` กำหนด security headers เบื้องต้น. **การกำหนด noindex ไม่ใช่ระบบป้องกันการเข้าถึง** ใช้ Firebase Auth + Rules เสมอ.

## 9) สิ่งที่ควรทดสอบก่อนรับเข้าระบบจริง

- [ ] ครู F01 ไม่เห็น F02 และเขียนผล F02 ไม่ได้
- [ ] ผู้ใช้ที่ไม่มี `users/{uid}` และ active=false เข้าไม่ได้
- [ ] ครูไม่เปลี่ยนสิทธิ์ของตัวเองเป็น admin ผ่าน API
- [ ] ไม่เปิดให้ลงทะเบียนด้วยตนเองผ่านหน้าเว็บ และมีมาตรการจัดการบัญชี Firebase Auth ที่ไม่ได้รับอนุญาต
- [ ] เปิด/ปิดรอบตรวจตามวันที่และทดสอบการแก้ไขภายหลัง
- [ ] ผลตรวจซ้ำไม่ทำให้นักเรียนถูกนับหลายคน
- [ ] CSV นำเข้า/ส่งออกภาษาไทยถูกต้อง และมีแผนสำรองข้อมูล
- [ ] มีแนวปฏิบัติการเก็บและลบข้อมูลนักเรียนอย่างเหมาะสม
- [ ] เกณฑ์ตรวจทรงผม เครื่องแบบ และการช่วยเหลือนักเรียนได้รับความเห็นชอบจากโรงเรียน

## 10) การพัฒนาระยะถัดไป

1. อัปโหลดภาพหลักฐานด้วยที่เก็บไฟล์ที่กำหนดสิทธิ์อย่างรัดกุม (ประเมินราคาและความยินยอมก่อนเปิด)
2. เชื่อม KP Family / ระบบคะแนนพฤติกรรมแบบลดเหตุการณ์ซ้ำ
3. พิมพ์ PDF รายชื่อนักเรียนรายครอบครัวและแบบติดตามผ่านฟังก์ชันเอกสาร
4. เพิ่มการออกบัญชีครูด้วย backend Admin SDK แบบปลอดภัย โดยไม่ส่ง service account ไปยังเว็บ
5. บันทึก audit log โดย backend และรองรับประวัติย้ายครอบครัว

**หมายเหตุ:** การลงชื่อเข้าใช้ด้วย Email/Password ไม่ได้หมายความว่าระบบเก็บรหัสผ่านเป็นข้อความธรรมดา รหัสผ่านจัดการโดย Firebase Authentication. ที่หน้าเว็บไม่มีปุ่มสมัครเอง แต่ Firebase Auth API ของโครงการยังสามารถรองรับการสร้างบัญชีหากไม่ได้จำกัดด้วยมาตรการฝั่ง backend; บัญชีที่ไม่มีโปรไฟล์ role แบบ active จะอ่าน/เขียนข้อมูลภายในไม่ได้ตาม Firestore Rules.

**การคงประวัติข้อบกพร่อง:** หากบันทึกว่า `ต้องแก้ไข` แล้ว ปุ่ม `ผ่าน` และ `ไม่ได้ตรวจ` สำหรับรายชื่อนั้นจะถูกปิดไว้ เพื่อให้แก้ไขผ่านหน้า `ติดตามการแก้ไข` ก่อน ไม่ทำให้ประวัติที่พบหายไปโดยกดผิด. หากบันทึกผิดตั้งแต่แรก ผู้ดูแลระบบต้องตรวจสอบและแก้ไขจากเครื่องมือผู้ดูแลฐานข้อมูลที่ได้รับอนุญาต.

## 11) GitHub Actions CI

เมื่ออัปโหลดไฟล์ขึ้น GitHub จะมีไฟล์ `.github/workflows/verify.yml` รัน `npm install`, `npm test` และ `npm run build` ใน GitHub Actions โดยอัตโนมัติเมื่อ push ไปยัง `main` หรือมี Pull Request. การตรวจสอบนี้ยัง **ไม่รวม** Firestore Emulator/security rules และไม่ถือว่าเป็นการตรวจความปลอดภัย production แบบสมบูรณ์.