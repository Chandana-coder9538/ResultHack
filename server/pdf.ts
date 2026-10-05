import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisPayload } from '../src/types/analyzer.js';

export interface PdfBrandingInfo {
  collegeName?: string;
  universityName?: string;
  departmentName?: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
}

/**
 * Server-Side Official PDF Report Generator
 * Generates official institutional consolidated examination dossier with dynamic multi-tenant branding
 */
export function generateConsolidatedReportPDF(payload: AnalysisPayload, branding?: PdfBrandingInfo): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const semDetails = payload.config?.semesterDetails || {
    semester: '4th Sem',
    academicYear: '2025-26',
    examination: 'June / July 2025',
    department: 'Academic Department',
    college: 'University B.D.T. College of Engineering, Davangere',
  };

  const collegeTitle = (branding?.collegeName || semDetails.college || 'University B.D.T. College of Engineering, Davangere').toUpperCase();
  const univTitle = branding?.universityName
    ? `Affiliated to / Constituent of ${branding.universityName}`
    : 'A Constituent College of Visvesvaraya Technological University (VTU), Belagavi';
  const rawDept = branding?.departmentName || semDetails.department || 'Academic Department';
  const deptTitle = (rawDept.toLowerCase().startsWith('department of') ? rawDept : `DEPARTMENT OF ${rawDept}`).toUpperCase();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper: Draw Institutional Header Banner on page
  const drawHeader = (pageNumber: number, totalPages: number) => {
    // Dark Navy Top Banner
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Accent line
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 24, pageWidth, 1.2, 'F');

    // Attempt to draw logos if provided as PNG base64
    if (branding?.collegeLogoUrl && branding.collegeLogoUrl.startsWith('data:image/png;base64,')) {
      try {
        doc.addImage(branding.collegeLogoUrl, 'PNG', 8, 3, 18, 18);
      } catch {}
    }
    if (branding?.universityLogoUrl && branding.universityLogoUrl.startsWith('data:image/png;base64,')) {
      try {
        doc.addImage(branding.universityLogoUrl, 'PNG', pageWidth - 26, 3, 18, 18);
      } catch {}
    }

    // Header Titles
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(collegeTitle, pageWidth / 2, 7, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // Slate-300
    doc.text(univTitle, pageWidth / 2, 11.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(248, 250, 252);
    doc.text(deptTitle, pageWidth / 2, 16.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    const subHeader = `${semDetails.semester || 'Semester'} • Academic Year: ${semDetails.academicYear || '2025-26'} • Exam Cycle: ${semDetails.examination || 'Annual'}`;
    doc.text(subHeader, pageWidth / 2, 21, { align: 'center' });

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Confidential Departmental Examination Dossier • ${collegeTitle}`, 14, pageHeight - 7);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  };

  // ----------------------------------------------------
  // PAGE 1: EXECUTIVE COHORT & SUBJECT PERFORMANCE
  // ----------------------------------------------------
  let currentY = 32;

  // Title Box
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CONSOLIDATED SEMESTER MARKS PERFORMANCE REPORT', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Source File: ${payload.fileName} • Processed: ${new Date(payload.uploadedAt).toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 7;

  // Executive KPI Summary Table
  const summary = payload.semesterSummary;
  const totalAppeared = summary.totalUniqueStudents || 0;
  const totalPassed = summary.overallPassCount ?? (summary as any).overallPassedStudents ?? 0;
  const totalFailed = summary.overallFailedStudents?.length ?? ((summary as any).overallFailedStudentsCount ?? (totalAppeared - totalPassed));
  const passPct = summary.overallPassPercentage ?? (totalAppeared > 0 ? Number(((totalPassed / totalAppeared) * 100).toFixed(2)) : 0);
  const failPct = Number((100 - passPct).toFixed(2));
  
  const fcd = summary.fcdCount ?? (summary as any).gradeDistribution?.fcd ?? 0;
  const fc = summary.fcCount ?? (summary as any).gradeDistribution?.fc ?? 0;
  const sc = summary.scCount ?? (summary as any).gradeDistribution?.sc ?? 0;
  const passClass = summary.passClassCount ?? (summary as any).gradeDistribution?.pass ?? 0;

  const topPct = summary.overallToppers?.[0]?.overallPercentage ?? (summary as any).toppers?.[0]?.percentage ?? 0;
  const meanPct = (summary as any).averageSemesterPercentage ?? (totalAppeared > 0 ? passPct : 0);

  const kpiData = [
    [
      { content: 'Total Appeared', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${totalAppeared} Students`,
      { content: 'Overall Pass %', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${passPct}%`,
    ],
    [
      { content: 'Total Passed', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${totalPassed} (${passPct}%)`,
      { content: 'Total Failed', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${totalFailed} (${failPct}%)`,
    ],
    [
      { content: 'Cohort Mean %', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${meanPct}%`,
      { content: 'Highest Semester %', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${topPct}%`,
    ],
    [
      { content: 'Grade Distribution', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `FCD: ${fcd} | FC: ${fc} | SC: ${sc} | Pass: ${passClass}`,
      { content: 'Total Backlogs Logged', styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] } },
      `${summary.backlogDistribution?.reduce((acc: number, b: any) => acc + (b.backlogCount * b.studentCount), 0) ?? 0}`,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'INSTITUTIONAL COHORT PERFORMANCE OVERVIEW', colSpan: 4, styles: { halign: 'center', fillColor: [30, 58, 138], textColor: [255, 255, 255] } }]],
    body: kpiData as any,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.2 },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Subject-wise performance summary table
  const subjectRows = (summary.subjectSummaries || []).map((sub: any, idx: number) => [
    idx + 1,
    sub.subjectCode,
    sub.facultyName || 'Unassigned',
    sub.totalStudents ?? sub.appeared ?? 0,
    sub.passedStudentsCount ?? sub.passed ?? (sub.totalStudents - (sub.failCount || 0)),
    sub.failCount ?? sub.failed ?? 0,
    `${sub.passPercentage}%`,
    sub.averageScore ? `${sub.averageScore}` : 'N/A',
    sub.highestScore ? `${sub.highestScore}` : 'N/A',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[
      '#',
      'Subject Code',
      'Faculty In-Charge',
      'Appeared',
      'Passed',
      'Failed',
      'Pass %',
      'Avg Score',
      'Topper Score',
    ]],
    body: subjectRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    columnStyles: {
      1: { fontStyle: 'bold', halign: 'left' },
      2: { halign: 'left' },
      6: { fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  // ----------------------------------------------------
  // PAGE 2: COHORT TOPPERS & REMEDIAL / FAIL TRACKING
  // ----------------------------------------------------
  doc.addPage();
  currentY = 32;

  // Cohort Top Rankers
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('COHORT MERIT TOPPERS (ACADEMIC RANK LIST)', 14, currentY);
  currentY += 3;

  const rawToppers = summary.overallToppers || (summary as any).toppers || [];
  const topperRows = rawToppers.slice(0, 10).map((t: any, idx: number) => [
    t.positionRoman || t.rank || `Rank ${idx + 1}`,
    t.studentId || t.usn || '-',
    t.studentName || t.name || 'Candidate',
    t.totalMarks ?? t.totalObtained ?? '-',
    `${t.overallPercentage ?? t.percentage ?? 0}%`,
    t.allSubjectsPassed !== false ? 'Pass' : 'Fail',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Student USN', 'Student Name', 'Total Marks', 'Percentage %', 'Status']],
    body: topperRows.length > 0 ? topperRows : [['-', 'No Rankers Found', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 15 },
      1: { fontStyle: 'bold', cellWidth: 35 },
      2: { halign: 'left' },
      4: { fontStyle: 'bold', cellWidth: 25 },
      5: { fontStyle: 'bold', cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Remedial / Failed Candidates Tracking
  doc.setTextColor(185, 28, 28); // Rose-700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('REMEDIAL & ARREAR STUDENT MONITORING (ACTION REQUIRED)', 14, currentY);
  currentY += 3;

  const rawFailed = summary.overallFailedStudents || (summary as any).failedStudents || [];
  const failedStudents = rawFailed.slice(0, 25).map((f: any, idx: number) => [
    idx + 1,
    f.studentId || f.usn || '-',
    f.studentName || f.name || 'Candidate',
    (f.failedSubjects ? f.failedSubjects.map((s: any) => s.subjectCode).join(', ') : (f.failedSubjectCodes?.join(', ') || 'Backlog')),
    f.failedCount ?? f.backlogCount ?? (f.failedSubjects?.length || 1),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Student USN', 'Student Name', 'Failed Subject Code(s)', 'Backlog Count']],
    body: failedStudents.length > 0 ? failedStudents : [['-', '-', 'No failed students recorded - 100% Pass Cohort', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 35 },
      2: { halign: 'left' },
      3: { fontStyle: 'bold', textColor: [185, 28, 28], halign: 'left' },
      4: { fontStyle: 'bold', cellWidth: 25 },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Ensure room for official signature block
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 40;
  }

  // Official Institutional Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  doc.text('____________________________________', 18, currentY);
  doc.text('Result Analysis Coordinator', 18, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(semDetails.department ? `Dept. of ${semDetails.department}` : 'Department Examination Committee', 18, currentY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('____________________________________', pageWidth - 18, currentY, { align: 'right' });
  doc.text('Head of the Department (HOD)', pageWidth - 18, currentY + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(semDetails.department || 'Department Head / Chairperson', pageWidth - 18, currentY + 9, { align: 'right' });

  // Post-process all pages with header and footer numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawHeader(i, totalPages);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
