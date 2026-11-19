import { ISSUE_TYPES } from './domain.js';
import { thaiMonthLabel } from './inspection-flow.js';

/** Report all students recorded as "issue" in one exact inspection phase/month.
 *  Never filter by the currently selected KP Family and never treat absence as failure.
 *  A historical inspection must remain visible even when the student is now inactive.
 */
export function failedReportRows(students = [], families = [], inspections = []) {
  const studentById = new Map(students.map(student => [String(student.studentId), student]));
  const familyById = new Map(families.map(family => [String(family.id), family.name]));
  const issueById = new Map(ISSUE_TYPES.map(type => [type.id, type.label]));
  const failures = inspections.filter(record => record?.status === 'issue');
  const rows = failures.map(record => {
    const studentId = String(record.studentId ?? '');
    const student = studentById.get(studentId);
    const familyId = String(record.familyId || student?.familyId || '');
    return {
      studentId,
      name: student?.name?.trim() || 'ไม่พบข้อมูลนักเรียน',
      room: student?.room || '-',
      familyId,
      familyName: familyById.get(familyId) || familyId || '-',
      reasons: Array.isArray(record.issueTypes) && record.issueTypes.length
        ? record.issueTypes.map(id => issueById.get(id) || id).join(', ')
        : 'ไม่ระบุสาเหตุ',
      note: typeof record.note === 'string' ? record.note.trim() : '',
      hasStudent: Boolean(student),
    };
  });
  return rows.sort((a,b) => a.room.localeCompare(b.room,'th',{numeric:true})
    || a.name.localeCompare(b.name,'th')
    || a.studentId.localeCompare(b.studentId,'th',{numeric:true}));
}

export function inspectionPhaseLabel(phase) {
  if (phase === 1) return 'รอบที่ 1';
  if (phase === 2) return 'รอบที่ 2';
  if (phase === 3) return 'รอบสุดท้าย';
  throw new Error('ไม่พบรอบตรวจสำหรับออกรายงาน PDF');
}

export function failedReportFileName(monthId, phase) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthId || '')) throw new Error('เลือกเดือนตรวจไม่ถูกต้อง');
  const phaseSlug = phase === 3 ? 'Final' : `Round${phase}`;
  inspectionPhaseLabel(phase);
  return `KP-Uniform-Failed-${monthId}-${phaseSlug}.pdf`;
}

/** pdfmake does not auto-fallback missing glyphs across fonts.
 * Embedded Noto Sans Thai supports Thai glyphs but not ASCII digits / punctuation.
 * Give each consecutive Unicode run its font so years, counts, codes, slashes,
 * quotation marks, and Thai names render correctly in the same cell.
 */
export function thaiPdfRuns(value) {
  const chars = Array.from(String(value ?? ''));
  if (!chars.length) return [{ text: '', font: 'NotoSansThai' }];
  const runs = [];
  for (const char of chars) {
    const font = /[\u0E00-\u0E7F]/u.test(char) ? 'NotoSansThai' : 'NotoSansLatin';
    if (runs.length && runs[runs.length - 1].font === font) runs[runs.length - 1].text += char;
    else runs.push({ text: char, font });
  }
  return runs;
}

export function summarizeInspectionRecords(inspections = []) {
  const counts = { total: 0, pass: 0, issue: 0, not_checked: 0 };
  for (const record of inspections) {
    if (!record || !['pass', 'issue', 'not_checked'].includes(record.status)) continue;
    counts.total++;
    counts[record.status]++;
  }
  return counts;
}

const pdfCell = (text, options = {}) => ({
  text: thaiPdfRuns(text),
  margin: [3, 5, 3, 5],
  fontSize: 8.3,
  color: '#243247',
  ...options,
});

/** An independent pdfmake definition (safe for unit tests without browser globals). */
export function failedReportDocument({ monthId, phase, rows, summary, generatedAt = new Date() }) {
  const totals = summary || { total: rows.length, pass: 0, issue: rows.length, not_checked: 0 };
  const phaseLabel = inspectionPhaseLabel(phase);
  const monthLabel = thaiMonthLabel(monthId);
  const nowLabel = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  }).format(generatedAt);
  const missingCount = rows.filter(row => !row.hasStudent).length;
  const tableBody = [[
    'ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น/ห้อง', 'ครอบครัว KP', 'สาเหตุที่ไม่ผ่าน', 'หมายเหตุ',
  ].map(text => pdfCell(text, { bold: true, color: '#ffffff', fillColor: '#185A45', alignment: text === 'ลำดับ' ? 'center' : 'left', margin: [3, 6, 3, 6] }))];
  rows.forEach((row, index) => tableBody.push([
    pdfCell(index + 1, {alignment:'center'}),
    pdfCell(row.studentId),
    pdfCell(row.name, { bold:true }),
    pdfCell(row.room, {alignment:'center'}),
    pdfCell(`${row.familyId} ${row.familyName}`),
    pdfCell(row.reasons),
    pdfCell(row.note || '-', {color: '#53647a'}),
  ].map(cell=>({...cell, fillColor: index % 2 ? '#F5F8F6' : '#FFFFFF'}))));
  const content = [
    { columns: [
      { text: thaiPdfRuns(`จำนวนผู้ไม่ผ่าน ${rows.length} คน`), bold:true, color:'#185A45', fontSize:12 },
      { text: thaiPdfRuns(`บันทึกผลตรวจ ${totals.total} คน · ผ่าน ${totals.pass} · ไม่ผ่าน ${totals.issue} · ไม่มา ${totals.not_checked}`), alignment:'right', color:'#53647a', fontSize:9 },
    ], margin:[0,0,0,8] },
    ...(missingCount ? [{ text:thaiPdfRuns(`หมายเหตุ: มี ${missingCount} รายการที่ไม่พบชื่อในฐานนักเรียนปัจจุบัน กรุณาตรวจสอบรหัสนักเรียน`),fontSize:9,color:'#9B5D0B',margin:[0,0,0,6] }] : []),
    ...(rows.length ? [{
      table: { headerRows:1, widths:[29,67,138,54,119,150,'*'], body:tableBody, dontBreakRows:true, keepWithHeaderRows:1 },
      layout: {
        hLineWidth:(i)=>i===0?0:0.45,
        vLineWidth:()=>0,
        hLineColor:()=> '#D8E4DC',
        paddingTop:()=>0, paddingBottom:()=>0,
        paddingLeft:()=>0, paddingRight:()=>0,
      },
    }] : [{ text:thaiPdfRuns(totals.total === 0 ? 'ยังไม่มีการบันทึกผลตรวจในเดือนและรอบที่เลือก' : 'ตรวจแล้ว แต่ไม่มีนักเรียนที่มีผลตรวจ “ไม่ผ่าน” ในเดือนและรอบที่เลือก'), alignment:'center', fontSize:13, color:'#596679', margin:[0,45,0,45] }]),
    {text:thaiPdfRuns(`ออกรายงานเมื่อ ${nowLabel}`),fontSize:8,color:'#607183', margin:[0,12,0,0]},
  ];
  return {
    pageSize:'A4', pageOrientation:'landscape', pageMargins:[32,78,32,44],
    info:{title:`รายชื่อนักเรียนไม่ผ่านการตรวจเครื่องแต่งกาย ${monthLabel} ${phaseLabel}`,author:'โรงเรียนคีรีราษฎร์พัฒนา',subject:'รายงานตรวจเครื่องแต่งกาย KP Family'},
    header: {stack:[
      {text:thaiPdfRuns('โรงเรียนคีรีราษฎร์พัฒนา'),fontSize:14,bold:true,color:'#185A45'},
      {text:thaiPdfRuns(`รายชื่อนักเรียนไม่ผ่านการตรวจเครื่องแต่งกาย  |  ${monthLabel}  |  ${phaseLabel}`),fontSize:11,color:'#213849',margin:[0,3,0,0]},
    ],margin:[32,17,32,0]},
    content,
    footer:(page,pageCount)=>({columns:[
      {text:thaiPdfRuns('งานกิจการนักเรียน · KP Smart Uniform Inspection'),alignment:'left'},
      {text:thaiPdfRuns(`หน้า ${page} / ${pageCount}`),alignment:'right'},
    ],margin:[32,10,32,0],fontSize:8,color:'#607183'}),
    defaultStyle:{font:'NotoSansThai',fontSize:9,lineHeight:1.16},
  };
}