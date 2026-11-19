import { failedReportDocument, failedReportFileName, failedReportRows } from '../utils/failed-report.js';

/** Client-only PDF: Firebase data is never uploaded to a PDF conversion service. */
export async function downloadFailedStudentsPdf({monthId, phase, students, families, inspections}) {
  const [pdfModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('../data/noto-thai-pdf-fonts.js'),
  ]);
  const pdfMake = pdfModule.default?.createPdf ? pdfModule.default : pdfModule;
  if (typeof pdfMake.createPdf !== 'function') throw new Error('ไม่สามารถเปิดระบบสร้าง PDF ได้');
  const pdfFonts = {NotoSansThai: {
    normal:'NotoSansThai-Regular.ttf', bold:'NotoSansThai-Bold.ttf',
    italics:'NotoSansThai-Regular.ttf', bolditalics:'NotoSansThai-Bold.ttf',
  }};
  const rows = failedReportRows(students,families,inspections);
  const definition = failedReportDocument({monthId,phase,rows});
  const filename = failedReportFileName(monthId,phase);
  // pdfmake 0.2 accepts local font mappings and VFS per generated document.
  // No external stylesheet, CDN or font host is needed.
  await new Promise((resolve,reject)=>{
    try {
      pdfMake.createPdf(definition, undefined, pdfFonts, fontModule.THAI_PDF_FONTS)
        .getBlob(blob => {
          try {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = filename;
            document.body.appendChild(link); link.click(); link.remove();
            window.setTimeout(()=>URL.revokeObjectURL(url), 30000);
            resolve();
          } catch (error) { reject(error); }
        });
    } catch(error) { reject(error); }
  });
  return rows.length;
}