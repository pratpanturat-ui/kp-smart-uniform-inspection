import test from 'node:test';
import assert from 'node:assert/strict';
import pdfMake from 'pdfmake/build/pdfmake.js';
import {THAI_PDF_FONTS} from '../src/data/noto-thai-pdf-fonts.js';
import {LATIN_PDF_FONTS} from '../src/data/noto-latin-pdf-fonts.js';
import {failedReportDocument, failedReportRows} from '../src/utils/failed-report.js';

const fonts = {NotoSansThai:{
  normal:'NotoSansThai-Regular.ttf', bold:'NotoSansThai-Bold.ttf',
  italics:'NotoSansThai-Regular.ttf', bolditalics:'NotoSansThai-Bold.ttf',
},NotoSansLatin:{
  normal:'NotoSansLatin-Regular.ttf', bold:'NotoSansLatin-Bold.ttf',
  italics:'NotoSansLatin-Regular.ttf', bolditalics:'NotoSansLatin-Bold.ttf',
}};

test('creates a real downloadable PDF containing Thai names with embedded fonts', {timeout:30000}, async () => {
  const students=[{studentId:'1002',name:'นางสาวสมใจ ใจดี',room:'ม.2/1',familyId:'F01'}];
  const inspections=[{studentId:'1002',familyId:'F01',status:'issue',issueTypes:['hair','shoes'],note:'ทรงผมไม่ถูกระเบียบ'}];
  const rows=failedReportRows(students,[{id:'F01',name:'เพ็ชรคล้าย'}],inspections);
  const doc=failedReportDocument({monthId:'2026-11',phase:1,rows,summary:{total:1,pass:0,issue:1,not_checked:0}});
  const buffer=await new Promise((resolve,reject)=>{
    try { pdfMake.createPdf(doc,undefined,fonts,{...THAI_PDF_FONTS,...LATIN_PDF_FONTS}).getBuffer(resolve); }
    catch(error) {reject(error);}
  });
  assert.equal(Buffer.from(buffer).subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(buffer.length>3000);
});