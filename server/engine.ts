import {
  AnalysisPayload,
  DataQualityWarning,
  FailedStudentInfo,
  GradeBand,
  GradingBandConfig,
  ScoreBin,
  SemesterFailedStudent,
  SemesterSummary,
  SemesterTopper,
  StudentSubjectRecord,
  SubjectAnalysis,
  SubjectBlockType,
  SubjectConfig,
  SubjectGradeSummary,
  TopRankStudent,
  SemesterDetails,
  formatFacultyDisplay,
} from '../src/types/analyzer.js';
import { RawParsedRow } from './parser.js';

export const DEFAULT_GRADING_BANDS: GradingBandConfig = {
  fcdMin: 70, // >= 70% as required
  fcMin: 60,
  scMin: 50,
  passMin: 40,
  roundingTolerance: 1.0,
  requireSeparatePass: false,
  minInternalPassPercent: 40,
  minExternalPassPercent: 40,
};

export const DEFAULT_SUBJECT_CONFIG: (subjectCode: string, blockType?: SubjectBlockType) => SubjectConfig = (code, blockType = 'complete') => {
  const isInternal = blockType === 'internal_only';
  return {
    subjectCode: code,
    displayName: code,
    facultyName: `Faculty (${code})`,
    facultyAssignments: [
      {
        id: `fa_1`,
        facultyName: '',
        section: '',
        batch: '',
      },
    ],
    maxInternal: isInternal ? 100 : 50,
    maxExternal: isInternal ? 0 : 50,
    maxTotal: 100, // Every module carries 100 max marks (9 modules = 900 marks total)
    blockType,
    autoComputeTotal: true,
    excluded: false,
    hasAbsentees: false,
    absenteeCount: 0,
    absenteeNames: [],
  };
};

/**
 * Generate adaptive bins for score distribution
 */
export function generateBins(maxMarks: number, scores: number[], targetBinCount: number = 10): ScoreBin[] {
  const max = Math.max(1, maxMarks);
  let step = Math.ceil(max / targetBinCount);
  
  // Nice round numbers for step: 5, 10, 15, 20, 25
  if (max <= 25) step = 5;
  else if (max <= 50) step = 5;
  else if (max <= 75) step = 10;
  else if (max <= 100) step = 10;
  else if (max <= 150) step = 15;
  else step = Math.ceil(max / 10);

  const bins: ScoreBin[] = [];
  const totalScoresCount = scores.length || 1;

  for (let lower = 0; lower < max; lower += step) {
    const upper = Math.min(lower + step, max);
    bins.push({
      rangeLabel: `${lower}–${upper}`,
      min: lower,
      max: upper,
      count: 0,
      percentage: 0,
    });
  }

  // Ensure last bin reaches max
  if (bins.length > 0 && bins[bins.length - 1].max < max) {
    const lower = bins[bins.length - 1].max;
    bins.push({
      rangeLabel: `${lower}–${max}`,
      min: lower,
      max: max,
      count: 0,
      percentage: 0,
    });
  }

  // Populate counts
  scores.forEach((score) => {
    const clampedScore = Math.max(0, Math.min(score, max));
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const isLast = i === bins.length - 1;
      if (isLast ? (clampedScore >= b.min && clampedScore <= b.max) : (clampedScore >= b.min && clampedScore < b.max)) {
        b.count++;
        break;
      }
    }
  });

  // Calculate percentages
  bins.forEach((b) => {
    b.percentage = Number(((b.count / totalScoresCount) * 100).toFixed(1));
  });

  return bins;
}

/**
 * Calculate statistical measures
 */
export function calculateStats(scores: number[]): {
  highestMarks: number;
  lowestMarks: number;
  medianMarks: number;
} {
  if (scores.length === 0) {
    return { highestMarks: 0, lowestMarks: 0, medianMarks: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const highest = sorted[sorted.length - 1];
  const lowest = sorted[0];

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    highestMarks: Number(highest.toFixed(2)),
    lowestMarks: Number(lowest.toFixed(2)),
    medianMarks: Number(median.toFixed(2)),
  };
}

/**
 * Perform full analysis of raw parsed rows with given config
 */
export function aggregateSemesterData(
  rawRows: RawParsedRow[],
  gradingBands: GradingBandConfig,
  subjectsConfig: Record<string, SubjectConfig>,
  existingWarnings: DataQualityWarning[] = [],
  uploadId: string = 'session-1',
  fileName: string = 'marks.xlsx',
  semesterDetails?: SemesterDetails
): AnalysisPayload {
  const warnings: DataQualityWarning[] = [...existingWarnings];
  const detectedSubjectsSet = new Set<string>();

  // Group rows by subject
  const subjectRowsMap = new Map<string, RawParsedRow[]>();
  rawRows.forEach((row) => {
    detectedSubjectsSet.add(row.subjectCode);
    if (!subjectRowsMap.has(row.subjectCode)) {
      subjectRowsMap.set(row.subjectCode, []);
    }
    subjectRowsMap.get(row.subjectCode)!.push(row);
  });

  const detectedSubjects = Array.from(detectedSubjectsSet).sort();
  const subjectsAnalysis: Record<string, SubjectAnalysis> = {};

  // For semester aggregated calculations
  interface StudentSemesterAccumulator {
    studentId: string;
    studentName: string;
    totalMarks: number;
    maxPossibleMarks: number;
    subjectsTaken: number;
    passedSubjects: number;
    failedSubjects: {
      subjectCode: string;
      facultyName: string;
      totalMarks: number;
      maxTotal: number;
      reasons: string[];
    }[];
  }

  const studentSemesterMap = new Map<string, StudentSemesterAccumulator>();

  // Filter out excluded subjects
  const activeSubjects = detectedSubjects.filter((code) => {
    const cfg = subjectsConfig[code];
    return !cfg || !cfg.excluded;
  });

  activeSubjects.forEach((subCode) => {
    const subConfig: SubjectConfig = subjectsConfig[subCode] || DEFAULT_SUBJECT_CONFIG(subCode);
    const rows = subjectRowsMap.get(subCode) || [];

    const displayName = subConfig.displayName || subCode;
    const blockType = subConfig.blockType || 'complete';
    const isInternalOnly = blockType === 'internal_only' || subConfig.maxExternal === 0;

    // Differentiate internal-only vs. internal+external subjects:
    // For internal-only subjects:
    //   - internal max marks = 100 (or configured value, not 200)
    //   - external max marks = 0
    //   - total max marks = internal max marks = 100 (NEVER 200!)
    //   - percentage = (marks obtained / internal max marks) * 100
    // For subjects with both internal and external:
    //   - total max marks = internal max + external max (e.g. 50 + 50 = 100, or 100 + 100 = 200)
    //   - percentage = (total marks obtained / total max marks) * 100
    let maxInternal: number;
    let maxExternal: number;
    let maxTotal: number;

    if (isInternalOnly) {
      maxInternal = (subConfig.maxInternal && subConfig.maxInternal > 0 && subConfig.maxInternal !== 50)
        ? subConfig.maxInternal
        : 100;
      maxExternal = 0;
      maxTotal = maxInternal; // Exactly 100, never 200!
    } else {
      maxInternal = (subConfig.maxInternal && subConfig.maxInternal > 0) ? subConfig.maxInternal : 50;
      maxExternal = (subConfig.maxExternal && subConfig.maxExternal > 0) ? subConfig.maxExternal : 50;
      maxTotal = (subConfig.maxTotal && subConfig.maxTotal > 0 && subConfig.maxTotal !== 50)
        ? subConfig.maxTotal
        : (maxInternal + maxExternal);
    }

    const facultyName = formatFacultyDisplay(subConfig) || subConfig.facultyName || `Faculty (${displayName})`;

    // Dynamic module column detection and self-check
    const modulesDetected = subConfig.modulesDetected || 1;
    const expectedMarksPerModule = subConfig.expectedMarksPerModule || 100;
    const formulaCheck = subConfig.formulaCheck || `${modulesDetected} module${modulesDetected > 1 ? 's' : ''} × ${expectedMarksPerModule} marks = ${maxTotal} total`;
    const hasModuleMismatch = subConfig.hasModuleMismatch || false;
    const mismatchWarning = subConfig.mismatchWarning;

    const internalScores: number[] = [];
    const externalScores: number[] = [];
    const totalScores: number[] = [];

    const evaluatedStudents: StudentSubjectRecord[] = [];
    const failedStudents: FailedStudentInfo[] = [];

    let fcdCount = 0;
    let fcCount = 0;
    let scCount = 0;
    let passCount = 0;
    let failCount = 0;
    let absentCount = 0;

    // Extract configured absentees for this subject from user input
    const rawAbsentees: string[] = Array.isArray(subConfig.absenteeNames)
      ? subConfig.absenteeNames
      : typeof (subConfig as any).absenteeNames === 'string'
      ? String((subConfig as any).absenteeNames).split(/[,;\n]+/)
      : [];
    const configuredAbsentees = rawAbsentees
      .map((name) => String(name).trim())
      .filter((name) => name.length > 0);

    rows.forEach((row) => {
      // Check if student was matched in subject absentees input
      const studentNameLower = String(row.studentName || '').trim().toLowerCase();
      const studentIdLower = String(row.studentId || '').trim().toLowerCase();

      const isMatchedAbsentee = configuredAbsentees.some((abs) => {
        const a = abs.toLowerCase();
        if (studentIdLower && studentIdLower === a) return true;
        if (studentNameLower && studentNameLower === a) return true;
        if (a.length >= 3 && studentNameLower.includes(a)) return true;
        if (studentNameLower.length >= 3 && a.includes(studentNameLower)) return true;
        const aToks = a.split(/\s+/).filter((t) => t.length > 1);
        const sToks = studentNameLower.split(/\s+/).filter((t) => t.length > 1);
        if (aToks.length > 1 && aToks.every((t) => sToks.includes(t))) return true;
        return false;
      });

      // Check if student was absent in sheet
      const sheetResultNormalized = String(row.sheetResult || '').trim().toLowerCase();
      const isAbsentInSheet = ['ab', 'absent'].includes(sheetResultNormalized);
      const isAbsent = isAbsentInSheet || isMatchedAbsentee;
      if (isAbsent) {
        absentCount++;
      }

      // For internal-only subjects, row total marks must strictly equal internal marks
      const rowTotal = isInternalOnly ? row.internalMarks : row.totalMarks;
      row.totalMarks = rowTotal;

      internalScores.push(row.internalMarks);
      externalScores.push(isInternalOnly ? 0 : row.externalMarks);
      totalScores.push(rowTotal);

      // Percentage calculation: Denominator is maxTotal (which is 100 for internal-only, never 200!)
      const percentage = Number(((rowTotal / maxTotal) * 100).toFixed(2));
      
      // Determine Pass / Fail:
      // STRICT USER MANDATE:
      // 1. Absentees entered at the time of input: The name should be looked and ignored for subject analysis and considered as fail.
      // 2. Do NOT consider 40% minimum for passing. Just consider Fail as result, then only fail.
      const sheetVal = String(row.sheetResult || '').trim();
      const sheetNormalized = sheetVal.toLowerCase();
      const hasSheetResult = sheetVal.length > 0 && !['n/a', 'na', '-', 'none', 'null'].includes(sheetNormalized);

      let isFailed = false;
      const failReasons: string[] = [];

      // Check if candidate is marked absentee in input OR sheet recorded Fail / Absent
      const isFailInSheet = [
        'fail', 'f', 'failed', 'ab', 'absent', 'detained', 'atkt', 'arrear', 'arrears', 'ra', 'reappear', 'wh', 'withheld', 'nc'
      ].includes(sheetNormalized) || sheetNormalized.startsWith('fail');

      if (isMatchedAbsentee) {
        // Matched absentee from user input: looked and ignored for subject analysis, considered as fail
        isFailed = true;
        failReasons.push(`Marked as Absentee in Subject Analysis input (${row.studentName || row.studentId})`);
      } else if (isFailInSheet) {
        isFailed = true;
        failReasons.push(
          isAbsentInSheet
            ? `Marked as 'Absent' in result record`
            : `Result recorded as '${sheetVal}' (Fail)`
        );
      } else {
        // Result was NOT recorded as Fail (e.g. 'Pass', 'P', 'Passed', letter grades, or blank/no fail).
        // STRICT USER MANDATE: Do NOT consider 40% minimum for passing. Just consider Fail as result, then only fail.
        // Candidate is PASS!
        if (!hasSheetResult && gradingBands.requireSeparatePass) {
          // Only if separate component pass criteria is explicitly enabled
          const minIntPct = gradingBands.minInternalPassPercent ?? 40;
          const minExtPct = gradingBands.minExternalPassPercent ?? 40;
          const intPct = maxInternal > 0 ? (row.internalMarks / maxInternal) * 100 : 100;
          const extPct = maxExternal > 0 ? (row.externalMarks / maxExternal) * 100 : 100;

          if (intPct < minIntPct) {
            failReasons.push(`Internal score ${row.internalMarks}/${maxInternal} (${intPct.toFixed(1)}%) is below separate internal cutoff of ${minIntPct}%`);
          }
          if (!isInternalOnly && maxExternal > 0 && extPct < minExtPct) {
            failReasons.push(`External score ${row.externalMarks}/${maxExternal} (${extPct.toFixed(1)}%) is below separate external cutoff of ${minExtPct}%`);
          }
          isFailed = failReasons.length > 0;
        } else {
          isFailed = false;
        }
      }

      const computedResult: 'Pass' | 'Fail' = isFailed ? 'Fail' : 'Pass';

      // Informational note if candidate passed with score below 40%
      if (!isFailed && percentage < 40) {
        warnings.push({
          type: 'result_discrepancy',
          severity: 'info',
          rowNumber: row.rowNumber,
          studentId: row.studentId,
          subjectCode: row.subjectCode,
          message: `Row ${row.rowNumber} (${row.studentName} - ${row.subjectCode}): Total marks is ${row.totalMarks}/${maxTotal} (${percentage}%). Evaluated as Pass per result record (not marked as Fail).`,
        });
      }

      // Assign Grade Band
      let gradeBand: GradeBand;
      if (computedResult === 'Fail') {
        gradeBand = 'Fail';
        failCount++;
      } else if (percentage >= gradingBands.fcdMin) {
        gradeBand = 'FCD';
        fcdCount++;
      } else if (percentage >= gradingBands.fcMin) {
        gradeBand = 'FC';
        fcCount++;
      } else if (percentage >= gradingBands.scMin) {
        gradeBand = 'SC';
        scCount++;
      } else {
        gradeBand = 'Pass';
        passCount++;
      }

      const evaluatedRecord: StudentSubjectRecord = {
        studentId: row.studentId,
        studentName: row.studentName,
        subjectCode: row.subjectCode,
        internalMarks: row.internalMarks,
        externalMarks: row.externalMarks,
        totalMarks: row.totalMarks,
        sheetResult: row.sheetResult,
        computedResult,
        gradeBand,
        percentage,
        failReasons,
      };

      evaluatedStudents.push(evaluatedRecord);

      if (computedResult === 'Fail') {
        failedStudents.push({
          studentId: row.studentId,
          studentName: row.studentName,
          internalMarks: row.internalMarks,
          externalMarks: row.externalMarks,
          totalMarks: row.totalMarks,
          percentage,
          reasons: failReasons,
        });
      }

      // Aggregate into student semester tracker
      if (!studentSemesterMap.has(row.studentId)) {
        studentSemesterMap.set(row.studentId, {
          studentId: row.studentId,
          studentName: row.studentName,
          totalMarks: 0,
          maxPossibleMarks: 0,
          subjectsTaken: 0,
          passedSubjects: 0,
          failedSubjects: [],
        });
      }

      const semAcc = studentSemesterMap.get(row.studentId)!;
      semAcc.totalMarks += row.totalMarks;
      semAcc.maxPossibleMarks += maxTotal;
      semAcc.subjectsTaken += 1;
      if (computedResult === 'Pass') {
        semAcc.passedSubjects += 1;
      } else {
        semAcc.failedSubjects.push({
          subjectCode: row.subjectCode,
          facultyName,
          totalMarks: row.totalMarks,
          maxTotal,
          reasons: failReasons,
        });
      }
    });

    // Sort students by total marks descending for ranking, strictly ignoring absentee and failed students
    const sortedForRank = [...evaluatedStudents]
      .filter((s) => s.computedResult === 'Pass' && !s.failReasons.some((r) => r.toLowerCase().includes('absent')))
      .sort((a, b) => b.totalMarks - a.totalMarks);

    // Compute top 5 with dense ranking (1, 2, 2, 3, 4, 5...)
    // If two students tie at rank 2, the next student receives rank 3 (not 4).
    // Include all students up to rank <= 5 so no one tied at rank 5 is omitted
    const top5Students: TopRankStudent[] = [];
    let currentRank = 0;
    let prevMarks: number | null = null;

    for (let i = 0; i < sortedForRank.length; i++) {
      const student = sortedForRank[i];
      if (prevMarks === null || student.totalMarks !== prevMarks) {
        currentRank++;
        prevMarks = student.totalMarks;
      }

      if (currentRank > 5) {
        break; // Stop after rank 5 (all tied rank 5s will have been included)
      }

      // Check if this student is tied with anyone
      const isTied = sortedForRank.some(
        (other, otherIdx) => otherIdx !== i && other.totalMarks === student.totalMarks
      );

      top5Students.push({
        rank: currentRank,
        studentId: student.studentId,
        studentName: student.studentName,
        internalMarks: student.internalMarks,
        externalMarks: student.externalMarks,
        totalMarks: student.totalMarks,
        percentage: student.percentage,
        gradeBand: student.gradeBand,
        isTied,
      });
    }

    // Sort failed students by total marks ascending (most critically failing first)
    failedStudents.sort((a, b) => a.totalMarks - b.totalMarks);

    const stats = calculateStats(totalScores);
    const totalStudents = rows.length;
    const passPercentage = totalStudents > 0 ? Number((((totalStudents - failCount) / totalStudents) * 100).toFixed(2)) : 0;

    const gradeSummary: SubjectGradeSummary = {
      fcdCount,
      fcCount,
      scCount,
      passCount,
      failCount,
      absentCount,
      totalStudents,
      passPercentage,
      highestMarks: stats.highestMarks,
      lowestMarks: stats.lowestMarks,
      medianMarks: stats.medianMarks,
    };

    subjectsAnalysis[subCode] = {
      subjectCode: subCode,
      displayName,
      facultyName,
      courseName: subConfig.courseName,
      designation: subConfig.designation,
      academicYear: subConfig.academicYear,
      branchSection: subConfig.branchSection,
      scheme: subConfig.scheme,
      semester: subConfig.semester,
      batch: subConfig.batch,
      actionPlan: subConfig.actionPlan,
      maxInternal,
      maxExternal,
      maxTotal,
      blockType,
      isInternalOnly,
      gradeSummary,
      internalBins: generateBins(maxInternal, internalScores, 10),
      externalBins: isInternalOnly ? [] : generateBins(maxExternal, externalScores, 10),
      totalBins: generateBins(maxTotal, totalScores, 10),
      top5Students,
      failedStudents,
      allStudents: evaluatedStudents,
      hasAbsentees: subConfig.hasAbsentees || absentCount > 0,
      absenteeCount: Math.max(absentCount, subConfig.absenteeCount || 0),
      absenteeNames: subConfig.absenteeNames || (configuredAbsentees.length > 0 ? configuredAbsentees : undefined),
      modulesDetected,
      expectedMarksPerModule,
      formulaCheck,
      hasModuleMismatch,
      mismatchWarning,
    };
  });

  // Recompute student semester records from the corrected per-subject records.
  // For every student, total marks = sum of that student's marks across ALL active subjects,
  // using the corrected per-subject totals from Fix #2 & Fix #3.
  const studentEvaluatedData = new Map<string, {
    studentId: string;
    studentName: string;
    totalMarks: number;
    maxPossibleMarks: number;
    subjectsTaken: number;
    passedSubjects: number;
    failedSubjects: {
      subjectCode: string;
      facultyName: string;
      totalMarks: number;
      maxTotal: number;
      reasons: string[];
    }[];
    subjectWiseMarks: Record<string, number>;
  }>();

  activeSubjects.forEach((subCode) => {
    const subAnalysis = subjectsAnalysis[subCode];
    subAnalysis.allStudents.forEach((st) => {
      if (!studentEvaluatedData.has(st.studentId)) {
        studentEvaluatedData.set(st.studentId, {
          studentId: st.studentId,
          studentName: st.studentName,
          totalMarks: 0,
          maxPossibleMarks: 0,
          subjectsTaken: 0,
          passedSubjects: 0,
          failedSubjects: [],
          subjectWiseMarks: {},
        });
      }

      const acc = studentEvaluatedData.get(st.studentId)!;
      acc.totalMarks += st.totalMarks; // Freshly evaluated per-subject total marks!
      acc.maxPossibleMarks += subAnalysis.maxTotal;
      acc.subjectsTaken += 1;
      acc.subjectWiseMarks[subCode] = st.totalMarks;

      if (st.computedResult === 'Pass') {
        acc.passedSubjects += 1;
      } else {
        acc.failedSubjects.push({
          subjectCode: subCode,
          facultyName: subAnalysis.facultyName,
          totalMarks: st.totalMarks,
          maxTotal: subAnalysis.maxTotal,
          reasons: st.failReasons || [],
        });
      }
    });
  });

  const allSemesterStudents = Array.from(studentEvaluatedData.values());
  const totalUniqueStudents = allSemesterStudents.length;

  // Internal spot-check that recomputes a student's total from their subject-wise marks
  // and flags any mismatch with what the rank list is showing.
  allSemesterStudents.forEach((st) => {
    const spotCheckSum = Object.values(st.subjectWiseMarks).reduce((a, b) => a + b, 0);
    if (spotCheckSum !== st.totalMarks) {
      warnings.push({
        type: 'mismatch',
        severity: 'warning',
        studentId: st.studentId,
        message: `Student ${st.studentId} (${st.studentName}): Internal spot-check mismatch! Sum of subject marks (${spotCheckSum}) differs from calculated total (${st.totalMarks}). Corrected to ${spotCheckSum}.`,
      });
      st.totalMarks = spotCheckSum;
    }
  });

  let overallPassCount = 0;
  let totalSemesterPercentagesSum = 0;
  let semesterFcdCount = 0;
  let semesterFcCount = 0;
  let semesterScCount = 0;
  let semesterPassClassCount = 0;

  const overallFailedStudents: SemesterFailedStudent[] = [];

  allSemesterStudents.forEach((st) => {
    const isFullPass = st.failedSubjects.length === 0;
    const pct = st.maxPossibleMarks > 0 ? (st.totalMarks / st.maxPossibleMarks) * 100 : 0;
    if (isFullPass) {
      overallPassCount++;
      if (pct >= gradingBands.fcdMin) {
        semesterFcdCount++;
      } else if (pct >= gradingBands.fcMin) {
        semesterFcCount++;
      } else if (pct >= gradingBands.scMin) {
        semesterScCount++;
      } else {
        semesterPassClassCount++;
      }
    } else {
      overallFailedStudents.push({
        studentId: st.studentId,
        studentName: st.studentName,
        failedCount: st.failedSubjects.length,
        totalSubjects: st.subjectsTaken,
        failedSubjects: st.failedSubjects,
      });
    }

    totalSemesterPercentagesSum += pct;
  });

  // Sort overall failed students by most subjects failed first
  overallFailedStudents.sort((a, b) => b.failedCount - a.failedCount);

  // Compute Overall Toppers by freshly computed total marks summed across all active subjects
  // Make sure the rank list both sorts by and displays this freshly computed total — not a stale/cached field
  const sortedSemesterStudents = [...allSemesterStudents].sort((a, b) => b.totalMarks - a.totalMarks);
  const overallToppers: SemesterTopper[] = [];
  let semRank = 0;
  let prevSemMarks: number | null = null;

  for (let i = 0; i < sortedSemesterStudents.length; i++) {
    const st = sortedSemesterStudents[i];
    if (prevSemMarks === null || st.totalMarks !== prevSemMarks) {
      semRank++;
      prevSemMarks = st.totalMarks;
    }

    if (semRank > 5) {
      break;
    }

    const isTied = sortedSemesterStudents.some(
      (other, otherIdx) => otherIdx !== i && other.totalMarks === st.totalMarks
    );

    const overallPct = st.maxPossibleMarks > 0 ? Number(((st.totalMarks / st.maxPossibleMarks) * 100).toFixed(2)) : 0;
    const spotCheckSum = Object.values(st.subjectWiseMarks).reduce((a, b) => a + b, 0);

    const toRomanRank = (num: number): string => {
      const romanMap: [number, string][] = [
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
      ];
      let res = '';
      let n = num;
      for (const [v, r] of romanMap) {
        while (n >= v) {
          res += r;
          n -= v;
        }
      }
      return res || String(num);
    };

    overallToppers.push({
      rank: semRank,
      studentId: st.studentId,
      studentName: st.studentName,
      totalMarksObtained: st.totalMarks,
      maxSemesterMarks: st.maxPossibleMarks,
      overallPercentage: overallPct,
      subjectsCount: st.subjectsTaken,
      allSubjectsPassed: st.failedSubjects.length === 0,
      failedSubjectsCount: st.failedSubjects.length,
      isTied,
      spotCheckVerified: spotCheckSum === st.totalMarks,
      spotCheckSum,
      positionRoman: toRomanRank(semRank),
    });
  }

  // Backlog distribution (0, 1, 2, 3+ backlogs)
  const backlogCountsMap = new Map<number, number>();
  allSemesterStudents.forEach((st) => {
    const count = st.failedSubjects.length;
    backlogCountsMap.set(count, (backlogCountsMap.get(count) || 0) + 1);
  });

  const maxBacklogFound = Math.max(0, ...Array.from(backlogCountsMap.keys()));
  const backlogDistribution: { backlogCount: number; studentCount: number; percentage: number }[] = [];

  for (let count = 0; count <= Math.max(3, maxBacklogFound); count++) {
    const sCount = backlogCountsMap.get(count) || 0;
    backlogDistribution.push({
      backlogCount: count,
      studentCount: sCount,
      percentage: totalUniqueStudents > 0 ? Number(((sCount / totalUniqueStudents) * 100).toFixed(1)) : 0,
    });
  }

  const overallPassPercentage = totalUniqueStudents > 0 ? Number(((overallPassCount / totalUniqueStudents) * 100).toFixed(2)) : 0;
  const averageSemesterPercentage = totalUniqueStudents > 0 ? Number((totalSemesterPercentagesSum / totalUniqueStudents).toFixed(2)) : 0;

  // Dynamic Semester Modules Self-Check (e.g. 9 modules × 100 = 900)
  const totalModulesCount = activeSubjects.length;
  const totalSemesterMaxMarks = activeSubjects.reduce((sum, code) => sum + subjectsAnalysis[code].maxTotal, 0);
  const expectedSemesterMax = totalModulesCount * 100;
  const semesterFormulaCheck = `${totalModulesCount} modules × 100 marks = ${totalSemesterMaxMarks} total`;
  const hasSemesterModuleMismatch = totalSemesterMaxMarks !== expectedSemesterMax;
  let semesterMismatchWarning: string | undefined = undefined;

  if (hasSemesterModuleMismatch) {
    semesterMismatchWarning = `Total maximum marks mismatch: Detected ${totalModulesCount} modules totaling ${totalSemesterMaxMarks} marks, but expected ${expectedSemesterMax} marks (${totalModulesCount} × 100).`;
    warnings.push({
      type: 'mismatch',
      severity: 'warning',
      message: semesterMismatchWarning,
    });
  }

  const subjectSummaries = activeSubjects.map((code) => {
    const sub = subjectsAnalysis[code];
    const subConfig = subjectsConfig[code];
    return {
      subjectCode: code,
      displayName: sub.displayName,
      facultyName: sub.facultyName,
      fcdCount: sub.gradeSummary.fcdCount,
      fcCount: sub.gradeSummary.fcCount,
      scCount: sub.gradeSummary.scCount,
      passCount: sub.gradeSummary.passCount,
      failCount: sub.gradeSummary.failCount,
      totalStudents: sub.gradeSummary.totalStudents,
      passPercentage: sub.gradeSummary.passPercentage,
      maxTotal: sub.maxTotal,
      isInternalOnly: sub.isInternalOnly,
      courseName: subConfig?.courseName || sub.displayName,
      facultyAssignments: subConfig?.facultyAssignments,
      section: subConfig?.section || 'A&B',
      absentCount: sub.gradeSummary.absentCount || 0,
      passedStudentsCount: sub.gradeSummary.totalStudents - sub.gradeSummary.failCount,
    };
  });

  const semesterSummary: SemesterSummary = {
    totalUniqueStudents,
    totalSubjects: activeSubjects.length,
    totalMaximumMarks: totalSemesterMaxMarks,
    formulaCheck: semesterFormulaCheck,
    hasModuleMismatch: hasSemesterModuleMismatch,
    mismatchWarning: semesterMismatchWarning,
    overallPassCount,
    overallPassPercentage,
    fcdCount: semesterFcdCount,
    fcCount: semesterFcCount,
    scCount: semesterScCount,
    passClassCount: semesterPassClassCount,
    subjectSummaries,
    overallToppers,
    overallFailedStudents,
    backlogDistribution,
  };

  return {
    uploadId,
    fileName,
    uploadedAt: new Date().toISOString(),
    config: {
      gradingBands,
      subjectsConfig,
      semesterDetails,
    },
    warnings,
    detectedSubjects: activeSubjects,
    subjectsAnalysis,
    semesterSummary,
    totalRowsProcessed: rawRows.length,
    validRowsCount: rawRows.length,
  };
}
