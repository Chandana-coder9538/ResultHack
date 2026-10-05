import {
  AnalysisPayload,
  SubjectAnalysis,
  SemesterSummary,
  StudentSubjectRecord,
} from '../types/analyzer';

/**
 * Escapes CSV field value handling quotes, commas, and newlines
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Initiates browser download of generated CSV content with UTF-8 BOM
 */
function downloadCSV(csvContent: string, fileName: string) {
  // \uFEFF is UTF-8 Byte Order Mark for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export Subject Full Student Roster (.CSV)
 */
export function exportSubjectRosterCSV(analysis: SubjectAnalysis) {
  const headers = [
    'Student ID (USN)',
    'Student Name',
    'Subject Code',
    'Faculty In-Charge',
    `Internal Marks (Max ${analysis.maxInternal})`,
    `External Marks (Max ${analysis.maxExternal})`,
    `Total Marks (Max ${analysis.maxTotal})`,
    'Score Percentage (%)',
    'Computed Result',
    'Grade Band',
    'Sheet Result (Excel)',
    'Failure / Remedial Reasons',
  ];

  const rows = analysis.allStudents.map((st) => [
    escapeCSV(st.studentId),
    escapeCSV(st.studentName),
    escapeCSV(analysis.subjectCode),
    escapeCSV(analysis.facultyName || 'Unassigned'),
    escapeCSV(st.internalMarks),
    escapeCSV(st.externalMarks),
    escapeCSV(st.totalMarks),
    escapeCSV(`${st.percentage}%`),
    escapeCSV(st.computedResult),
    escapeCSV(st.gradeBand),
    escapeCSV(st.sheetResult || 'N/A'),
    escapeCSV(st.failReasons && st.failReasons.length > 0 ? st.failReasons.join('; ') : 'None'),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, `${analysis.subjectCode}_Full_Student_Roster.csv`);
}

/**
 * 2. Export Subject Top 5 Merit Leaderboard (.CSV)
 */
export function exportSubjectTop5CSV(analysis: SubjectAnalysis) {
  const headers = [
    'Rank',
    'Tied Status',
    'Student ID (USN)',
    'Student Name',
    'Subject Code',
    'Faculty In-Charge',
    `Internal (${analysis.maxInternal})`,
    `External (${analysis.maxExternal})`,
    `Total Marks (${analysis.maxTotal})`,
    'Percentage (%)',
    'Grade Band',
  ];

  const rows = analysis.top5Students.map((st) => [
    escapeCSV(`#${st.rank}`),
    escapeCSV(st.isTied ? 'TIED' : 'UNIQUE'),
    escapeCSV(st.studentId),
    escapeCSV(st.studentName),
    escapeCSV(analysis.subjectCode),
    escapeCSV(analysis.facultyName || 'Unassigned'),
    escapeCSV(st.internalMarks),
    escapeCSV(st.externalMarks),
    escapeCSV(st.totalMarks),
    escapeCSV(`${st.percentage}%`),
    escapeCSV(st.gradeBand),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, `${analysis.subjectCode}_Top_5_Merit_List.csv`);
}

/**
 * 3. Export Subject Failed Students Remedial List (.CSV)
 */
export function exportSubjectFailedStudentsCSV(analysis: SubjectAnalysis) {
  const headers = [
    'Student ID (USN)',
    'Student Name',
    'Subject Code',
    'Faculty In-Charge',
    `Internal Marks (${analysis.maxInternal})`,
    `External Marks (${analysis.maxExternal})`,
    `Total Marks (${analysis.maxTotal})`,
    'Score Percentage (%)',
    'Failure / Remedial Reasons',
  ];

  const rows = analysis.failedStudents.map((st) => [
    escapeCSV(st.studentId),
    escapeCSV(st.studentName),
    escapeCSV(analysis.subjectCode),
    escapeCSV(analysis.facultyName || 'Unassigned'),
    escapeCSV(st.internalMarks),
    escapeCSV(st.externalMarks),
    escapeCSV(st.totalMarks),
    escapeCSV(`${st.percentage}%`),
    escapeCSV(st.reasons.join('; ')),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, `${analysis.subjectCode}_Failed_Students_Roster.csv`);
}

/**
 * 4. Export Subject Grade Distribution & Statistical Summary (.CSV)
 */
export function exportSubjectSummaryCSV(analysis: SubjectAnalysis) {
  const gs = analysis.gradeSummary;
  const lines = [
    ['ACADEMIC SUBJECT EVALUATION SUMMARY', analysis.subjectCode].map(escapeCSV).join(','),
    ['Faculty In-Charge', analysis.facultyName || 'Unassigned'].map(escapeCSV).join(','),
    ['Max Marks Allocation', `Total: ${analysis.maxTotal} (Internal: ${analysis.maxInternal} + External: ${analysis.maxExternal})`].map(escapeCSV).join(','),
    ['Enrolled Candidates', gs.totalStudents].map(escapeCSV).join(','),
    ['Pass Percentage', `${gs.passPercentage}%`].map(escapeCSV).join(','),
    ['Highest Score', gs.highestMarks].map(escapeCSV).join(','),
    ['Lowest Score', gs.lowestMarks].map(escapeCSV).join(','),
    ['Median Score', gs.medianMarks].map(escapeCSV).join(','),
    '',
    ['GRADE BAND CLASSIFICATION', 'STUDENT COUNT', 'COHORT PERCENTAGE (%)'].map(escapeCSV).join(','),
    ['First Class with Distinction (FCD >= 70%)', gs.fcdCount, `${gs.totalStudents ? ((gs.fcdCount / gs.totalStudents) * 100).toFixed(1) : 0}%`].map(escapeCSV).join(','),
    ['First Class (FC 60-69%)', gs.fcCount, `${gs.totalStudents ? ((gs.fcCount / gs.totalStudents) * 100).toFixed(1) : 0}%`].map(escapeCSV).join(','),
    ['Second Class (SC 50-59%)', gs.scCount, `${gs.totalStudents ? ((gs.scCount / gs.totalStudents) * 100).toFixed(1) : 0}%`].map(escapeCSV).join(','),
    ['Pass Class (Pass 40-49%)', gs.passCount, `${gs.totalStudents ? ((gs.passCount / gs.totalStudents) * 100).toFixed(1) : 0}%`].map(escapeCSV).join(','),
    ['Fail Class (Fail < 40%)', gs.failCount, `${gs.totalStudents ? ((gs.failCount / gs.totalStudents) * 100).toFixed(1) : 0}%`].map(escapeCSV).join(','),
  ];

  downloadCSV(lines.join('\r\n'), `${analysis.subjectCode}_Grade_Summary_Statistics.csv`);
}

/**
 * 5. Export Semester Consolidated Subject Matrix (.CSV)
 */
export function exportSemesterSubjectMatrixCSV(summary: SemesterSummary) {
  const headers = [
    'Subject Code',
    'Faculty In-Charge',
    'FCD (>=70%)',
    'FC (60-69%)',
    'SC (50-59%)',
    'Pass (<50%)',
    'Fail',
    'Enrolled Cohort',
    'Pass Percentage (%)',
    'Max Total Marks',
  ];

  const rows = summary.subjectSummaries.map((sub) => [
    escapeCSV(sub.subjectCode),
    escapeCSV(sub.facultyName || 'Unassigned'),
    escapeCSV(sub.fcdCount),
    escapeCSV(sub.fcCount),
    escapeCSV(sub.scCount),
    escapeCSV(sub.passCount),
    escapeCSV(sub.failCount),
    escapeCSV(sub.totalStudents),
    escapeCSV(`${sub.passPercentage}%`),
    escapeCSV(sub.maxTotal),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, 'Semester_Subject_Performance_Matrix.csv');
}

/**
 * 6. Export Overall Semester Top 5 Rank List (.CSV)
 */
export function exportSemesterToppersCSV(summary: SemesterSummary) {
  const headers = [
    'Overall Rank',
    'Tied Status',
    'Student ID (USN)',
    'Student Name',
    'Aggregate Marks Obtained',
    'Max Semester Total Marks',
    'Overall Percentage (%)',
    'Subjects Evaluated',
    'Academic Status',
    'Backlog / Arrears Count',
  ];

  const rows = summary.overallToppers.map((st) => [
    escapeCSV(`#${st.rank}`),
    escapeCSV(st.isTied ? 'TIED' : 'UNIQUE'),
    escapeCSV(st.studentId),
    escapeCSV(st.studentName),
    escapeCSV(st.totalMarksObtained),
    escapeCSV(st.maxSemesterMarks),
    escapeCSV(`${st.overallPercentage}%`),
    escapeCSV(st.subjectsCount),
    escapeCSV(st.allSubjectsPassed ? 'ALL CLEARED' : 'HAS ARREARS'),
    escapeCSV(st.failedSubjectsCount),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, 'Semester_Overall_Toppers_Rank_List.csv');
}

/**
 * 7. Export Semester Backlog / Failed Students Breakdown (.CSV)
 */
export function exportSemesterFailedStudentsCSV(summary: SemesterSummary) {
  const headers = [
    'Student ID (USN)',
    'Student Name',
    'Backlog Count',
    'Total Enrolled Subjects',
    'Failed Subject Codes',
    'Detailed Arrears Breakdown',
  ];

  const rows = summary.overallFailedStudents.map((st) => {
    const codes = st.failedSubjects.map((s) => s.subjectCode).join('; ');
    const breakdown = st.failedSubjects
      .map((s) => `${s.subjectCode} (${s.totalMarks}/${s.maxTotal} marks: ${s.reasons.join(', ')})`)
      .join(' | ');

    return [
      escapeCSV(st.studentId),
      escapeCSV(st.studentName),
      escapeCSV(st.failedCount),
      escapeCSV(st.totalSubjects),
      escapeCSV(codes),
      escapeCSV(breakdown),
    ];
  });

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, 'Semester_Backlog_Students_Roster.csv');
}

/**
 * 7b. Export Semester Overall Remedial Students Register (.CSV)
 * Considers overall cohort; candidate included only when result in the sheet was provided as Fail.
 */
export function exportOverallRemedialStudentsCSV(payload: AnalysisPayload) {
  const summary = payload.semesterSummary;
  const semDetails = payload.config?.semesterDetails;
  const semPrefix = semDetails?.semester
    ? `${semDetails.semester.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';
  const baseName = payload.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

  const headers = [
    'Sl. No',
    'Student ID (USN)',
    'Student Name',
    'Backlog Count',
    'Total Enrolled Subjects',
    'Failed Subject Codes',
    'Detailed Remedial Breakdown',
    'Remedial Status',
  ];

  const rows = summary.overallFailedStudents.map((st, idx) => {
    const codes = st.failedSubjects.map((s) => s.subjectCode).join('; ');
    const breakdown = st.failedSubjects
      .map((s) => `${s.subjectCode} (${s.totalMarks}/${s.maxTotal} marks: ${s.reasons.join(', ')})`)
      .join(' | ');

    return [
      escapeCSV(idx + 1),
      escapeCSV(st.studentId),
      escapeCSV(st.studentName),
      escapeCSV(st.failedCount),
      escapeCSV(st.totalSubjects),
      escapeCSV(codes),
      escapeCSV(breakdown),
      escapeCSV('REMEDIAL REQUIRED'),
    ];
  });

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSV(csv, `${semPrefix}${baseName}_Overall_Remedial_Students.csv`);
}

/**
 * 8. Export Complete Semester Master Ledger (All Students × All Subjects) (.CSV)
 */
export function exportCompleteSemesterMasterCSV(payload: AnalysisPayload) {
  const subjects = payload.detectedSubjects;
  const headers = [
    'Student ID (USN)',
    'Student Name',
    ...subjects.flatMap((sub) => [
      `${sub} Internal`,
      `${sub} External`,
      `${sub} Total`,
      `${sub} Grade`,
      `${sub} Result`,
    ]),
    'Semester Aggregate Marks',
    'Max Possible Marks',
    'Overall Percentage (%)',
    'Cleared All Subjects',
    'Backlogs Count',
  ];

  // Map student ID to their records
  const studentMap = new Map<string, { name: string; subjects: Record<string, StudentSubjectRecord> }>();

  subjects.forEach((sub) => {
    const analysis = payload.subjectsAnalysis[sub];
    if (!analysis) return;
    analysis.allStudents.forEach((st) => {
      if (!studentMap.has(st.studentId)) {
        studentMap.set(st.studentId, { name: st.studentName, subjects: {} });
      }
      studentMap.get(st.studentId)!.subjects[sub] = st;
    });
  });

  const rows = Array.from(studentMap.entries()).map(([studentId, data]) => {
    let totalObtained = 0;
    let maxPossible = 0;
    let failedCount = 0;

    const subjectCols = subjects.flatMap((sub) => {
      const rec = data.subjects[sub];
      const cfg = payload.config.subjectsConfig[sub] || { maxTotal: 100 };
      maxPossible += cfg.maxTotal;

      if (rec) {
        totalObtained += rec.totalMarks;
        if (rec.computedResult === 'Fail') {
          failedCount++;
        }
        return [
          escapeCSV(rec.internalMarks),
          escapeCSV(rec.externalMarks),
          escapeCSV(rec.totalMarks),
          escapeCSV(rec.gradeBand),
          escapeCSV(rec.computedResult),
        ];
      } else {
        return [escapeCSV('N/A'), escapeCSV('N/A'), escapeCSV('N/A'), escapeCSV('N/A'), escapeCSV('Absent')];
      }
    });

    const overallPct = maxPossible > 0 ? ((totalObtained / maxPossible) * 100).toFixed(2) : '0';

    return [
      escapeCSV(studentId),
      escapeCSV(data.name),
      ...subjectCols,
      escapeCSV(totalObtained),
      escapeCSV(maxPossible),
      escapeCSV(`${overallPct}%`),
      escapeCSV(failedCount === 0 ? 'YES' : 'NO'),
      escapeCSV(failedCount),
    ];
  });

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const baseName = payload.fileName.replace(/\.[^/.]+$/, '');
  downloadCSV(csv, `${baseName}_Complete_Semester_Master_Ledger.csv`);
}
