# KP Smart Uniform Inspection (MVP v0.2)

**ระบบตรวจเครื่องแต่งกาย โรงเรียนคีรีราษฎร์พัฒนา**  
React 19 + Vite 7 + Tailwind CSS 4 + Firebase Authentication (Google สำหรับ Admin / Username+Password สำหรับครู) + Cloud Firestore + Cloudflare Pages + GitHub.

> GitHub และ Cloudflare Workers Deploy แล้ว แต่ **การติดตั้ง Firestore Security Rules และการสร้าง Admin ยังต้องดำเนินการผ่าน Firebase Console**. ห้ามนำข้อมูลนักเรียนจริงเข้าใช้งานก่อนทดสอบ Rules ให้ผ่าน
> **คำเตือน:** Repository ที่สร้างครั้งแรกมีสถานะ Public; ควรเปลี่ยนเป็น **Private** ก่อนนำข้อมูลบุคลากรหรือข้อมูลนักเรียนใด ๆ มาใช้ และห้าม Commit ข้อมูลนักเรียนจริงหรือ service account

## ความสามารถเวอร์ชันนี้

- Admin เข้าผ่าน Google (Gmail) เท่านั้น โดยต้องมีเอกสาร users/{UID} role=admin ใน Firestore
- ครูเข้าสู่ระบบด้วย Username + Password ส่วนบุคคล (ไม่ต้องมี Gmail ของครู) โดยระบบแปลง Username เป็นอีเมลภายในสำหรับ Firebase Auth
- Admin สร้าง Username และรหัสผ่านเริ่มต้นให้ครูผ่านหน้าเว็บ ใช้ Firebase Auth instance แยกจากเซสชัน Admin
- Admin คนแรกหนึ่งบัญชี (Sign in with Google แล้ว bootstrap role ผ่าน Firebase Console) จัดการครู ครอบครัว รอบตรวจ และนำเข้า CSV นักเรียน
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
2. เลือก `Build > Authentication > Sign-in method` แล้วเปิด **Google** สำหรับ Admin และ **Email/Password** สำหรับครู จากนั้น Save. เว็บไซต์ Cloudflare ต้องอยู่ใน Authorized domains ด้วย.
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

1. เปิดเว็บไซต์ แล้วเลือก **ผู้ดูแลระบบ → เข้าสู่ระบบด้วย Google** และลงชื่อเข้าใช้ด้วย Gmail ของคุณ จะได้บัญชี Firebase Auth แต่ยังไม่มีสิทธิ์จนกว่าจะตั้งค่า users/{uid} ใน Firestore.
2. เปิด Firebase Console > Authentication > Users แล้วคัดลอก `User UID` ของบัญชีที่เพิ่งเข้าสู่ระบบด้วย Google (ไม่ใช่อีเมล).
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

1. **KP Family** > ระบบเพิ่มชื่อครอบครัว F01–F21 จากไฟล์ `family_lists_v3(2).xlsx` อัตโนมัติเมื่อ Admin เข้าหน้าระบบครั้งแรกหลัง Deploy. ไม่ต้องพิมพ์รายชื่อเอง; หากบางรายการยังไม่ครบสามารถกด `ตรวจสอบ/เติมชื่อครอบครัว`. ระบบจะสร้างเฉพาะรายการที่ขาด และแก้เฉพาะชื่อชั่วคราวรูปแบบ `ครอบครัว Fxx`; **ไม่เขียนทับชื่อที่ผู้ดูแลตั้งไว้**. รหัส `F13` ใช้ชื่อ `วิชาดี` ตามข้อมูลเดิม.
2. **รอบตรวจ** > เพิ่มรอบ `2026-11`, วันที่ตรวจ (เช่น `2026-11-03`), สถานะ `open`.
3. **ข้อมูลนักเรียน** > `ดาวน์โหลดไฟล์ตัวอย่าง` แล้วจัดข้อมูล CSV UTF-8 ตามรูปแบบ:

```csv
studentId,name,room,familyId
00123,เด็กชาย ก.,ม.3/1,F01
00124,เด็กหญิง ข.,ม.3/1,F13
```

สามารถแปลง Excel เป็น CSV UTF-8 โดยใช้ Excel > Save As > `CSV UTF-8` (รักษาศูนย์นำหน้ารหัสนักเรียนโดยตั้งคอลัมน์เป็น Text ก่อนเปิด/แก้ไขไฟล์). อย่าใช้ข้อมูลจริงใน source code หรือ public repository.

4. **สิทธิ์ครู** > กรอกชื่อครู, Username เช่น `f01.teacher`, รหัสผ่านเริ่มต้น (อย่างน้อย 10 ตัว), เลือก KP Family แล้วกด **สร้าง Username และ Password ให้ครู**. การสร้างใช้ Firebase Authentication instance แยก ไม่ทำให้ Admin หลุดจากระบบ. เมื่อครูมีบัญชีแล้ว Admin สามารถแก้ครอบครัวและระงับสิทธิ์ใน Firestore ได้.
5. ครูแต่ละคนเลือกแท็บ “ครูผู้บันทึก” กรอก Username และรหัสผ่านเฉพาะบุคคล ไม่ต้องใช้ Gmail. เมื่อปิดสิทธิ์ `active=false` จะอ่าน/เขียนข้อมูลไม่ได้ แม้ Firebase Auth จะยังมีบัญชีอยู่.

**ข้อจำกัดสำคัญ v0.2:** Firebase Auth Web API อนุญาตสร้างบัญชี Email/Password จาก Client ได้โดยธรรมชาติ ถึงแม้หน้าเว็บไม่มีปุ่มสมัครเอง บุคคลภายนอกอาจสร้างบัญชี Auth ที่ **ไม่มีสิทธิ์** ได้ แต่ Firestore Rules จะป้องกันไม่ให้เข้าถึงข้อมูลนักเรียนจนกว่า Admin จะสร้างเอกสาร `users/{uid}`. หากต้องการบังคับว่าเฉพาะ Admin เท่านั้นที่สร้าง/รีเซ็ตบัญชี Auth ได้จริง ต้องพัฒนา Backend ที่เชื่อถือได้ด้วย Admin SDK (เช่น Cloudflare Worker ที่ตรวจ Firebase ID token และเก็บ Service Account ใน Secret). ยังไม่ได้ทำใน v0.2. การเปลี่ยนรหัสผ่านเดิมต้องทำผ่านกระบวนการผู้ดูแลที่ปลอดภัย ไม่สามารถส่งอีเมลรีเซ็ตไปยังอีเมลภายใน `.invalid` ได้.

**ข้อสำคัญ:** Username ครูถูกแปลงเป็น `username@staff.kp-uniform.invalid` เพื่อใช้ Firebase Email/Password เท่านั้น ไม่ใช่กล่องจดหมายที่ใช้งานได้. ไม่ให้ครูนำอีเมลนี้ไปใช้กู้รหัสผ่าน.

**ข้อจำกัด CSV:** นักเรียนที่ไม่มีในไฟล์ใหม่จะยังอยู่ในฐานข้อมูล, การอัปเดตครอบครัวของนักเรียนอาจทำให้สิทธิ์การเห็นประวัติเก่าต้องตรวจทานเป็นรายกรณี. ควรยืนยันโอนย้ายนักเรียน/ครอบครัวกับฝ่ายกิจการนักเรียนก่อนทำการนำเข้ารอบใหม่.

## 6) โครงสร้างฐานข้อมูล Firestore

```text
users/{firebaseAuthUid}
  name, email, role: 'admin' | 'teacher', active, familyIds: ['F01', ...]
  username: 'f01.teacher' (เฉพาะครูที่สร้างด้วยระบบใหม่)
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

### การนำเข้าครอบครัว 21 รายการอัตโนมัติ (v0.3)

- รายชื่อ F01–F21 อยู่ใน `src/data/family-config.js` ซึ่งจัดทำจาก `family_lists_v3(2).xlsx` ที่ผู้ดูแลให้ไว้ (ไม่มีข้อมูลนักเรียนหรือรหัสผ่านในซอร์สโค้ด)
- เมื่อผู้ดูแลที่มีสิทธิ์ `admin` เข้าระบบและอ่านรายการ `families` ได้สำเร็จ แอปจะตรวจรายการที่ไม่มีอยู่และชื่อชั่วคราว แล้วบันทึกผ่าน Firestore transaction แบ่งชุดละ 7 รายการ
- เขียนรายการที่ขาดหรือชื่อชั่วคราวเท่านั้น ไม่แก้ชื่อที่ผู้ดูแลตั้งเอง ไม่ลบข้อมูลเก่า ไม่เขียนซ้ำทุกครั้งที่โหลดหน้า
- การเพิ่มข้อมูลจริงเกิดเมื่อ Admin ที่ล็อกอินอย่างถูกต้องเปิดเว็บไซต์หลัง Cloudflare Deploy โค้ดใหม่; การ Push GitHub เพียงอย่างเดียวไม่ได้เขียน Firebase โดยตรง
- ระบบนี้ยังไม่ได้นำเข้ารายชื่อนักเรียน เพราะไฟล์ต้นทางที่มีตอนนี้ยังไม่มีรหัสประจำตัวนักเรียนที่เชื่อถือได้

## 10) การพัฒนาระยะถัดไป

1. อัปโหลดภาพหลักฐานด้วยที่เก็บไฟล์ที่กำหนดสิทธิ์อย่างรัดกุม (ประเมินราคาและความยินยอมก่อนเปิด)
2. เชื่อม KP Family / ระบบคะแนนพฤติกรรมแบบลดเหตุการณ์ซ้ำ
3. พิมพ์ PDF รายชื่อนักเรียนรายครอบครัวและแบบติดตามผ่านฟังก์ชันเอกสาร
4. เพิ่มการออกบัญชีครูด้วย backend Admin SDK แบบปลอดภัย โดยไม่ส่ง service account ไปยังเว็บ
5. บันทึก audit log โดย backend และรองรับประวัติย้ายครอบครัว

**หมายเหตุ:** การลงชื่อเข้าใช้ด้วย Email/Password ไม่ได้หมายความว่าระบบเก็บรหัสผ่านเป็นข้อความธรรมดา รหัสผ่านจัดการโดย Firebase Authentication. ที่หน้าเว็บไม่มีปุ่มสมัครเอง แต่ Firebase Auth API ของโครงการยังรองรับการสร้างบัญชีแบบไม่มีสิทธิ์หากไม่ได้จำกัดด้วยมาตรการฝั่ง backend; บัญชีที่ไม่มีโปรไฟล์ role แบบ active จะอ่าน/เขียนข้อมูลภายในไม่ได้ตาม Firestore Rules.

**การคงประวัติข้อบกพร่อง:** หากบันทึกว่า `ต้องแก้ไข` แล้ว ปุ่ม `ผ่าน` และ `ไม่ได้ตรวจ` สำหรับรายชื่อนั้นจะถูกปิดไว้ เพื่อให้แก้ไขผ่านหน้า `ติดตามการแก้ไข` ก่อน ไม่ทำให้ประวัติที่พบหายไปโดยกดผิด. หากบันทึกผิดตั้งแต่แรก ผู้ดูแลระบบต้องตรวจสอบและแก้ไขจากเครื่องมือผู้ดูแลฐานข้อมูลที่ได้รับอนุญาต.

## 11) GitHub Actions CI

เมื่ออัปโหลดไฟล์ขึ้น GitHub จะมีไฟล์ `.github/workflows/verify.yml` รัน `npm install`, `npm test` และ `npm run build` ใน GitHub Actions โดยอัตโนมัติเมื่อ push ไปยัง `main` หรือมี Pull Request. การตรวจสอบนี้ยัง **ไม่รวม** Firestore Emulator/security rules และไม่ถือว่าเป็นการตรวจความปลอดภัย production แบบสมบูรณ์.

## 12) อัปเกรดจาก v0.1 เป็น v0.2 — Admin Google และ Username ครู

1. Firebase Authentication > Sign-in method: เปิด **Google** และ **Email/Password**
2. Firebase Authentication > Settings > Authorized domains: เพิ่มโดเมน Cloudflare Workers หากยังไม่ได้เพิ่ม
3. ติดตั้งไฟล์ **firestore.rules เวอร์ชันใหม่**: Rules ใหม่กำหนด Admin ต้อง sign-in provider `google.com` และครูต้อง `password` จึงเข้า Firestore ได้. **ห้ามอาศัยแค่เปลี่ยนหน้าเว็บ**
4. ไปที่หน้าเว็บ เลือกแท็บผู้ดูแลระบบและเข้าสู่ระบบด้วย Gmail จริงของ Admin. จากนั้นใน Firebase Console > Authentication > Users คัดลอก UID ของบัญชีนั้น แล้วตั้ง Firestore `users/{UID}` ด้วย role `admin`, active `true`, familyIds `[]`
5. กลับไป Login อีกครั้ง จากหน้า Admin > สิทธิ์ครู สร้าง username/password และกำหนด KP Family
6. ทดสอบครู F01 ว่าเห็น F01 เท่านั้น ทดสอบ Google อื่นที่ไม่มี role admin ว่าเข้า Admin ไม่ได้ และทดสอบรหัสผ่านครูผิด/บัญชีที่ถูกระงับ

รหัสผ่านและ Gmail ส่วนตัว **ห้ามใส่ในโค้ด, GitHub หรือข้อความแชต**.

## 12) เวอร์ชัน 0.3 — หน้าตรวจแบบมือถือและตรวจรอบ 2

- หน้า **ตรวจรอบที่ 1** เริ่มจากปุ่มสี่เหลี่ยม KP Family F01–F21 (ครูเห็นเฉพาะครอบครัวที่ได้รับสิทธิ์); แตะชื่อครอบครัวเพื่อแสดงรายชื่อนักเรียนและปุ่ม **ผ่าน / ไม่ผ่าน / ไม่มา** ใต้ชื่อ
- **ไม่ผ่าน** เปิดกล่องให้เลือกสาเหตุหลายข้อและเพิ่มหมายเหตุ ก่อนบันทึกเป็น `issue` พร้อมสถานะติดตาม `pending`
- **ไม่มา** บันทึก `not_checked` ใน `inspections/{YYYY-MM}__{studentId}`; **ไม่ถือเป็นสถานะขาดเรียน** ของระบบเข้าเรียน
- หน้า **ตรวจรอบที่ 2** จะเลือกเฉพาะรายชื่อที่มีผลรอบแรกเป็น `not_checked` ของเดือนเดียวกัน และเก็บผลแยกไว้ที่ `inspection_round2/{YYYY-MM}__{studentId}` พร้อมประวัติใน `inspection_round2_events` แยกจากผลรอบแรก
- เฉพาะ **Admin** มีเมนู **จัดการรายชื่อนักเรียน** เพื่อเพิ่ม แก้ไข ลบออกจากรายชื่อ และกู้คืน; รหัสนักเรียน (document ID) เปลี่ยนไม่ได้เพราะใช้เชื่อมประวัติ
- การกด **ลบ** เป็น soft delete (`students/{id}.active=false`) เพื่อไม่ทำลายประวัติ การนำเข้า CSV ภายหลังสามารถเปิดรายการที่รหัสตรงกันกลับมาได้
- จำเป็นต้อง Deploy **Firestore Rules เวอร์ชันใหม่** และ **firestore.indexes.json** โดยใช้ `npx firebase deploy --only firestore:rules,firestore:indexes` ก่อนเริ่มใช้งานรอบ 2 หรือจัดการรายชื่อบนเว็บไซต์จริง; การ Push GitHub ไม่ได้ Deploy Firestore Rules ให้เอง
- ตรวจรอบสองต้องทำในขณะที่รอบประจำเดือนยังอยู่สถานะ `open`; ไม่มีการสร้างรอบตรวจเดือนใหม่เพื่อรองรับรอบ 2
- ไม่เพิ่มรูปหลักฐานในเวอร์ชันนี้ตามแผนระยะต่อไป