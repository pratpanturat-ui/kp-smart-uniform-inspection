import test from 'node:test';
import assert from 'node:assert/strict';
import { failedReportRows, failedReportDocument, failedReportFileName, inspectionPhaseLabel } from '../src/utils/failed-report.js';

const students = [
  {studentId:'a2',name:'นางสาว กวาง',room:'ม.2/1',familyId:'F21',active:false},
  {studentId:'a1',name:'นาย ช้าง',room:'ม.1/1',familyId:'F01'},
  {studentId:'a3',name:'นาย ขาว',room:'ม.1/2',familyId:'F17'},
];
const families = [ {id:'F01',name:'เพ็ชรคล้าย'}, {id:'F21',name:'สายวิจิตรธิขัติ'}, {id:'F17',name:'สตารัตน์'} ];

test('report contains ONLY issue results from the chosen phase across different families',()=>{
  const primary=[
    {studentId:'a2',familyId:'F21',status:'issue',issueTypes:['shoes'],note:'รองเท้าผิดระเบียบ'},
    {studentId:'a1',familyId:'F01',status:'issue',issueTypes:['hair','shirt'],note:''},
    {studentId:'a3',familyId:'F17',status:'not_checked',issueTypes:[],note:''},
  ];
  const rows=failedReportRows(students,families,primary);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.studentId),['a1','a2']);
  assert.equal(rows[0].reasons,'ทรงผม, เสื้อ / เครื่องหมาย');
  assert.equal(rows[1].familyId,'F21');
  assert.equal(rows[1].note,'รองเท้าผิดระเบียบ');
  assert.equal(rows[1].hasStudent,true);
});

test('second and final round reports never accidentally include prior round failures',()=>{
  const second=[{studentId:'a1',familyId:'F01',status:'pass'}, {studentId:'a2',familyId:'F21',status:'issue',issueTypes:['nails']}];
  const last=[{studentId:'a2',familyId:'F21',status:'pass'}];
  assert.deepEqual(failedReportRows(students,families,second).map(r=>r.studentId),['a2']);
  assert.deepEqual(failedReportRows(students,families,last),[]);
});

test('historical issue still appears if student is archived or no longer in roster',()=>{
  const records=[{studentId:'no-longer',familyId:'F01',status:'issue',issueTypes:['other']}];
  const [row]=failedReportRows(students,families,records);
  assert.equal(row.name,'ไม่พบข้อมูลนักเรียน');
  assert.equal(row.hasStudent,false);
  const def=failedReportDocument({monthId:'2026-11',phase:2,rows:[row],generatedAt:new Date('2026-11-19T13:00:00Z')});
  assert.equal(def.pageSize,'A4');
  assert.equal(def.pageOrientation,'landscape');
  assert.equal(def.content[1].text.includes('1 รายการ'),true);
});

test('PDF definition uses Thai labels, total, repeatable header and page count',()=>{
  const rows=failedReportRows(students,families,[{studentId:'a1',status:'issue',familyId:'F01',issueTypes:['hair']}]);
  const def=failedReportDocument({monthId:'2026-11',phase:3,rows,generatedAt:new Date('2026-11-19T13:00:00Z')});
  assert.match(def.header.stack[1].text,/พฤศจิกายน 2569/);
  assert.match(def.header.stack[1].text,/รอบสุดท้าย/);
  assert.match(def.content[0].columns[0].text,/1 คน/);
  assert.equal(def.content[1].table.headerRows,1);
  assert.equal(def.content[1].table.body.length,2);
  assert.match(def.footer(2,5).columns[1].text,/2 \/ 5/);
  assert.equal(def.defaultStyle.font,'NotoSansThai');
});

test('no failures creates a valid zero-record PDF instead of an error',()=>{
  const def=failedReportDocument({monthId:'2026-11',phase:1,rows:[]});
  assert.match(def.content[1].text,/ไม่มีนักเรียน/);
});

test('safe stable filenames and clear round descriptions',()=>{
  assert.equal(failedReportFileName('2026-11',1),'KP-Uniform-Failed-2026-11-Round1.pdf');
  assert.equal(failedReportFileName('2026-11',2),'KP-Uniform-Failed-2026-11-Round2.pdf');
  assert.equal(failedReportFileName('2026-11',3),'KP-Uniform-Failed-2026-11-Final.pdf');
  assert.equal(inspectionPhaseLabel(3),'รอบสุดท้าย');
  assert.throws(()=>failedReportFileName('../not-a-month',1));
  assert.throws(()=>inspectionPhaseLabel(4));
});