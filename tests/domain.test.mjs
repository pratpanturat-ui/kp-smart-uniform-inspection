import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionId,normalizeStudent,validateStudent,summarize} from '../src/utils/domain.js';
import {parseCSV,toCSV} from '../src/utils/csv.js';

test('one record per round and student',()=>{
  assert.equal(inspectionId('2026-11','000123'),'2026-11__000123');
});
test('normalize and validate student',()=>{
  const s=normalizeStudent({studentId:' 001 ',name:' กานต์ ',room:'ม.3/1',familyId:'f13 '});
  assert.deepEqual(s,{studentId:'001',name:'กานต์',room:'ม.3/1',familyId:'F13'});
  assert.equal(validateStudent(s,['F13']),null);
  assert.match(validateStudent({...s,familyId:'F99'},['F13']),/ไม่พบครอบครัว/);
  assert.match(validateStudent({...s,studentId:'a/b'},['F13']),/รหัสนักเรียน/);
});
test('stats count pending, resolved, and uninspected correctly',()=>{
  const students=[{studentId:'1'},{studentId:'2'},{studentId:'3'},{studentId:'4'},{studentId:'5'}];
  const records=[{studentId:'1',status:'pass'}, {studentId:'2',status:'issue',resolution:'pending'}, {studentId:'3',status:'issue',resolution:'resolved'}, {studentId:'4',status:'not_checked'}];
  assert.deepEqual(summarize(students,records), {total:5,inspected:3,pass:1,issue:2,pending:1,fixed:1,notInspected:2});
});
test('CSV parse handles UTF8 BOM, CRLF, quoted commas and escaped quotes',()=>{
  const rows=parseCSV('\uFEFFstudentId,name,room,familyId\r\n001,"เด็กหญิง บี, เอ",ม.1/1,F01\r\n002,"ชื่อ""ทดสอบ",ม.2/1,F02\r\n');
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,'เด็กหญิง บี, เอ');
  assert.equal(rows[1].name,'ชื่อ"ทดสอบ');
});
test('CSV export protects formula injection',()=>{
  const txt=toCSV(['studentId','name','room','familyId'],[{studentId:'101',name:'=HYPERLINK("https://example.org")',room:'ม.3/1',familyId:'F01'}]);
  assert.match(txt,/'=HYPERLINK/);
  assert.deepEqual(parseCSV(txt)[0].name,'\'=HYPERLINK("https://example.org")');
});
test('CSV parser rejects malformed input',()=>{
  assert.throws(()=>parseCSV('studentId,name,room,familyId\n1,"abc,F01'),/อัญประกาศ/);
  assert.throws(()=>parseCSV('a,b\n1,2'),/หัวคอลัมน์/);
});