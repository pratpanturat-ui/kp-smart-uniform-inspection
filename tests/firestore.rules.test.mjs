// Run only through: npm run rules:test (requires Java and Firebase emulator download).
import test, {before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp} from 'firebase/firestore';

let env;
const projectId='kp-uniform-rules-test';
const path='firestore.rules';
const now=new Date('2026-11-03T02:00:00.000Z');
const adminUser={name:'Administrator',email:'admin@example.test',role:'admin',active:true,familyIds:[]};
const teacher1={name:'Teacher F01',email:'t1@example.test',role:'teacher',active:true,familyIds:['F01']};
const teacher2={name:'Teacher F02',email:'t2@example.test',role:'teacher',active:true,familyIds:['F02']};
const student = (id,fid)=>({studentId:id,name:`Student ${id}`,room:'ม.3/1',familyId:fid});

before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:await readFile(path,'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{
 const db=ctx.firestore();
 await Promise.all([
  setDoc(doc(db,'users/admin'),adminUser),setDoc(doc(db,'users/t1'),teacher1),setDoc(doc(db,'users/t2'),teacher2),
  setDoc(doc(db,'families/F01'),{name:'F01',active:true}),setDoc(doc(db,'families/F02'),{name:'F02',active:true}),
  setDoc(doc(db,'students/01'),student('01','F01')),setDoc(doc(db,'students/02'),student('02','F02')),
  setDoc(doc(db,'inspection_rounds/2026-11'),{name:'พฤศจิกายน 2569',date:'2026-11-03',status:'open'}),
 ]);
});});
function as(uid, provider = uid === 'admin' ? 'google.com' : 'password'){
  return env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
}
function inspection(studentId, familyId, uid){return {roundId:'2026-11',studentId,familyId,status:'pass',issueTypes:[],note:'',resolution:'none',createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()};}

// The tests explicitly verify data isolation even if someone changes a URL or query.
test('guest cannot access students',async()=>{await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'students','01')));});
test('teacher can read own family, not another family',async()=>{
  await assertSucceeds(getDoc(doc(as('t1'),'students','01')));
  await assertFails(getDoc(doc(as('t1'),'students','02')));
  await assertSucceeds(getDocs(query(collection(as('t1'),'students'),where('familyId','==','F01'))));
  await assertFails(getDocs(collection(as('t1'),'students')));
});
test('teacher cannot add admin or change any user profile',async()=>{
  await assertFails(setDoc(doc(as('t1'),'users','t1'),{...teacher1,role:'admin'}));
  await assertFails(setDoc(doc(as('t1'),'users','evil'),{...teacher1,role:'admin'}));
  await assertSucceeds(setDoc(doc(as('admin'),'users','new_teacher'),{...teacher2,email:'new@example.test'}));
  await assertFails(setDoc(doc(as('admin'),'users','new_admin'),{...adminUser,active:true}));
});
test('teacher can save inspection and event only for assigned family',async()=>{
  const db=as('t1');
  const ref=doc(db,'inspections','2026-11__01'); const batch=writeBatch(db);
  batch.set(ref,inspection('01','F01','t1'));
  batch.set(doc(collection(db,'inspection_events')),{inspectionId:'2026-11__01',roundId:'2026-11',studentId:'01',familyId:'F01',actorUid:'t1',status:'pass',resolution:'none',issueTypes:[],note:'',createdAt:serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(as('t2'),'inspections','2026-11__01')));
  await assertFails(setDoc(doc(db,'inspections','2026-11__02'),inspection('02','F02','t1')));
});
test('teacher cannot inspect a mismatched student or spoof creator',async()=>{
  await assertFails(setDoc(doc(as('t1'),'inspections','2026-11__02'),inspection('02','F01','t1')));
  await assertFails(setDoc(doc(as('t1'),'inspections','2026-11__01'),inspection('01','F01','t2')));
});
test('closed rounds block teachers',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'inspection_rounds/2026-11'),{name:'Closed',date:'2026-11-03',status:'closed'}));
  await assertFails(setDoc(doc(as('t1'),'inspections','2026-11__01'),inspection('01','F01','t1')));
});
test('inactive teacher has no access',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'users/t1'),{...teacher1,active:false}));
  await assertFails(getDoc(doc(as('t1'),'students','01')));
});

test('admin must authenticate with Google, and teachers with password',async()=>{
  await assertSucceeds(getDoc(doc(as('admin','google.com'),'students','01')));
  await assertFails(getDoc(doc(as('admin','password'),'students','01')));
  await assertSucceeds(getDoc(doc(as('t1','password'),'students','01')));
  await assertFails(getDoc(doc(as('t1','google.com'),'students','01')));
});
test('staff username metadata may be set only by admin',async()=>{
  await assertSucceeds(setDoc(doc(as('admin'),'users','new_staff'),{...teacher1,username:'f01.teacher'}));
  await assertFails(setDoc(doc(as('t1'),'users','new_staff'),{...teacher1,username:'f02.teacher'}));
  await assertFails(setDoc(doc(as('admin'),'users','invalid_user'),{...teacher1,username:'n@x'}));
});