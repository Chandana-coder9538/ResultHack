export interface FacultyAssignment {
  id: string;
  facultyName: string;
  section?: string; // e.g. 'A', 'B', 'All'
  batch?: string;   // e.g. 'Batch 1', 'Batch 2', 'All'
  role?: string;
}

export interface SemesterDetails {
  semester?: string;       // e.g. "6th Sem" or "VI Semester"
  semType?: 'Even Semester' | 'Odd Semester' | string;
  examination?: string;    // e.g. "June / July 2026"
  academicYear?: string;   // e.g. "2025 - 2026"
  scheme?: string;        // e.g. "2022", "2021", "2018"
  branch?: string;        // e.g. "Department of Computer Science & Engineering"
  department?: string;    // e.g. "Department of Studies in Computer Science and Engineering"
  college?: string;       // e.g. "University B.D.T. College of Engineering, Davangere"
  university?: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  sections?: string;      // e.g. "A&B" (default all-sections label when single faculty handles whole subject)
}

export interface GradingBandConfig {
  fcdMin: number; // e.g. 70 (Distinction >= 70%)
  fcMin: number;  // e.g. 60
  scMin: number;  // e.g. 50
  passMin: number; // e.g. 40
  roundingTolerance: number; // e.g. 1.0
  requireSeparatePass: boolean; // default false
  minInternalPassPercent?: number; // e.g. 40% if separate pass enabled
  minExternalPassPercent?: number; // e.g. 40% if separate pass enabled
}

export type SubjectBlockType = 'complete' | 'internal_only' | 'incomplete_no_total';

export interface SubjectConfig {
  subjectCode: string; // The original full label / block key from sheet
  displayName?: string; // Real or cleaned subject code (e.g. for combined electives)
  facultyName: string;
  facultyAssignments?: FacultyAssignment[];
  section?: string; // default / primary section if applicable
  batch?: string;   // default / primary batch if applicable
  courseName?: string; // Full subject title e.g. 'CAPACITY PLANNING FOR IT'
  designation?: string; // e.g. 'Assistant Professor(Ad-Hoc)'
  academicYear?: string; // e.g. '2025-2026'
  branchSection?: string; // e.g. "CS&E , 'A' sec"
  scheme?: string; // e.g. '2022'
  semester?: string; // e.g. '4th'
  actionPlan?: string[]; // Custom action plan bullet points
  maxInternal: number; // default 50 or 40 (or 100 for internal-only)
  maxExternal: number; // default 50 or 60 (or 0 for internal-only)
  maxTotal: number;    // default 100
  blockType?: SubjectBlockType;
  autoComputeTotal?: boolean; // For incomplete blocks: compute Total from Internal + External
  excluded?: boolean; // Allow user to exclude incomplete or unwanted subject
  hasAbsentees?: boolean; // User specified whether absentees exist
  absenteeCount?: number; // How many absentees
  absenteeNames?: string[]; // Names or USNs of absentee students
  modulesDetected?: number;
  expectedMarksPerModule?: number;
  formulaCheck?: string;
  hasModuleMismatch?: boolean;
  mismatchWarning?: string;
}

export interface DetectedModuleColumn {
  colIdx: number;
  headerName: string;
  metric: string;
  maxMarks: number;
}

export interface DiscoveredSubjectBlock {
  subjectLabel: string;
  blockType: SubjectBlockType;
  hasInternal: boolean;
  hasExternal: boolean;
  hasTotal: boolean;
  hasResult: boolean;
  internalCol?: number;
  externalCol?: number;
  totalCol?: number;
  resultCol?: number;
  moduleColumns?: DetectedModuleColumn[];
  detectedModuleCount?: number;
  expectedMarksPerModule?: number;
  computedTotalMaxMarks?: number;
  formulaCheck?: string;
  hasModuleMismatch?: boolean;
  mismatchWarning?: string;
}

export type GradeBand = 'FCD' | 'FC' | 'SC' | 'Pass' | 'Fail';

export interface StudentSubjectRecord {
  studentId: string;
  studentName: string;
  subjectCode: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  sheetResult?: string; // 'Pass' | 'Fail' from Excel
  computedResult: 'Pass' | 'Fail';
  gradeBand: GradeBand;
  percentage: number;
  discrepancyNote?: string;
  failReasons: string[];
}

export interface ScoreBin {
  rangeLabel: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface TopRankStudent {
  rank: number;
  studentId: string;
  studentName: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  percentage: number;
  gradeBand: GradeBand;
  isTied: boolean;
}

export interface FailedStudentInfo {
  studentId: string;
  studentName: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  percentage: number;
  reasons: string[];
}

export interface SubjectGradeSummary {
  fcdCount: number;
  fcCount: number;
  scCount: number;
  passCount: number;
  failCount: number;
  absentCount?: number;
  totalStudents: number;
  passPercentage: number;
  averageMarks?: number;
  highestMarks: number;
  lowestMarks: number;
  medianMarks: number;
  stdDev?: number;
}

export interface SubjectAnalysis {
  subjectCode: string;
  displayName: string;
  facultyName: string;
  courseName?: string;
  designation?: string;
  academicYear?: string;
  branchSection?: string;
  scheme?: string;
  semester?: string;
  batch?: string;
  actionPlan?: string[];
  maxInternal: number;
  maxExternal: number;
  maxTotal: number;
  blockType: SubjectBlockType;
  isInternalOnly: boolean;
  modulesDetected?: number;
  expectedMarksPerModule?: number;
  formulaCheck?: string; // e.g. "9 modules × 100 marks = 900 total"
  hasModuleMismatch?: boolean;
  mismatchWarning?: string;
  gradeSummary: SubjectGradeSummary;
  internalBins: ScoreBin[];
  externalBins: ScoreBin[];
  totalBins: ScoreBin[];
  top5Students: TopRankStudent[];
  failedStudents: FailedStudentInfo[];
  allStudents: StudentSubjectRecord[];
  hasAbsentees?: boolean;
  absenteeCount?: number;
  absenteeNames?: string[];
}

export interface SemesterTopper {
  rank: number;
  studentId: string;
  studentName: string;
  totalMarksObtained: number;
  maxSemesterMarks: number;
  overallPercentage: number;
  subjectsCount: number;
  allSubjectsPassed: boolean;
  failedSubjectsCount: number;
  isTied: boolean;
  spotCheckVerified?: boolean;
  spotCheckSum?: number;
  positionRoman?: string; // 'I', 'II', 'III', 'IV', 'V', etc.
}

export interface SemesterFailedStudent {
  studentId: string;
  studentName: string;
  failedCount: number;
  totalSubjects: number;
  failedSubjects: {
    subjectCode: string;
    facultyName: string;
    totalMarks: number;
    maxTotal: number;
    reasons: string[];
  }[];
}

export interface SemesterSummary {
  totalUniqueStudents: number;
  totalSubjects: number;
  totalMaximumMarks?: number;
  formulaCheck?: string;
  hasModuleMismatch?: boolean;
  mismatchWarning?: string;
  overallPassCount: number; // Students passing ALL subjects
  overallPassPercentage: number;
  averageSemesterPercentage?: number;
  fcdCount?: number;
  fcCount?: number;
  scCount?: number;
  passClassCount?: number;
  subjectSummaries: {
    subjectCode: string;
    displayName: string;
    facultyName: string;
    fcdCount: number;
    fcCount: number;
    scCount: number;
    passCount: number;
    failCount: number;
    totalStudents: number;
    passPercentage: number;
    averageMarks?: number;
    maxTotal: number;
    isInternalOnly: boolean;
    courseName?: string;
    facultyAssignments?: FacultyAssignment[];
    section?: string;
    absentCount?: number;
    passedStudentsCount?: number;
  }[];
  overallToppers: SemesterTopper[];
  overallFailedStudents: SemesterFailedStudent[];
  backlogDistribution: {
    backlogCount: number; // 0, 1, 2, 3, etc.
    studentCount: number;
    percentage: number;
  }[];
}

export interface DataQualityWarning {
  type: 'mismatch' | 'duplicate' | 'coercion' | 'result_discrepancy' | 'out_of_bounds' | 'incomplete_block' | 'ambiguous_column' | 'internal_only' | 'trailing_junk_dropped';
  severity: 'warning' | 'error' | 'info';
  rowNumber?: number;
  studentId?: string;
  subjectCode?: string;
  message: string;
}

export interface AnalysisConfig {
  gradingBands: GradingBandConfig;
  subjectsConfig: Record<string, SubjectConfig>;
  semesterDetails?: SemesterDetails;
}

export const DEFAULT_SEMESTER_DETAILS: SemesterDetails = {
  semester: '',
  semType: 'Even Semester',
  examination: '',
  academicYear: '',
  branch: '',
  college: '',
};

export function formatFacultyDisplay(config?: {
  facultyName?: string;
  facultyAssignments?: FacultyAssignment[];
  section?: string;
  batch?: string;
}): string {
  if (!config) return 'Unassigned';

  const validAssignments =
    config.facultyAssignments && config.facultyAssignments.length > 0
      ? config.facultyAssignments.filter((f) => f.facultyName && f.facultyName.trim() !== '')
      : [];

  const formatSectionTag = (sec?: string): string => {
    if (!sec || !sec.trim()) return '';
    let s = sec.trim();
    // Normalize: remove leading or trailing "sec" / "section"
    s = s.replace(/^(sec|section)\s*/i, '').trim();
    s = s.replace(/\s*(sec|section)$/i, '').trim();
    if (!s) return '';
    return `${s} Section`;
  };

  // Multiple faculties (2 or more)
  if (validAssignments.length > 1) {
    return validAssignments
      .map((fa) => {
        const name = fa.facultyName.trim();
        const secTag = formatSectionTag(fa.section);
        return secTag ? `${name}(${secTag})` : name;
      })
      .join(' & ');
  }

  // Exactly 1 faculty in assignments -> "otherwise just faculty name"
  if (validAssignments.length === 1) {
    return validAssignments[0].facultyName.trim();
  }

  // Fallback to facultyName string
  if (config.facultyName && config.facultyName.trim()) {
    const raw = config.facultyName.trim();
    // If it already has multiple assignments separated by ';' or '&'
    if (raw.includes(';') || (raw.includes('&') && raw.includes('('))) {
      return raw
        .split(/\s*(?:;|&)\s*/)
        .map((part) => {
          const match = part.match(/^([^(]+)\s*\((?:sec\s*)?([^)]+)\)$/i);
          if (match) {
            const n = match[1].trim();
            const s = formatSectionTag(match[2]);
            return s ? `${n}(${s})` : n;
          }
          return part.trim();
        })
        .filter(Boolean)
        .join(' & ');
    }
    // For single faculty name, remove any extraneous trailing "(Sec ...)" or "(...)"
    const singleCleaned = raw.replace(/\s*\([^)]*\)$/, '').trim();
    return singleCleaned || raw;
  }

  return 'Unassigned';
}

export interface AnalysisPayload {
  uploadId: string;
  fileName: string;
  uploadedAt: string;
  config: AnalysisConfig;
  warnings: DataQualityWarning[];
  detectedSubjects: string[];
  subjectsAnalysis: Record<string, SubjectAnalysis>;
  semesterSummary: SemesterSummary;
  totalRowsProcessed: number;
  validRowsCount: number;
}

export interface UploadHistoryItem {
  id: string;
  uploadId: string;
  analysisResultId: string;
  semester: string;
  academicYear: string;
  examCycle: string;
  scheme?: string;
  department: string;
  uploadedAt: string;
  originalFilename: string;
  fileName: string;
  totalStudents: number;
  totalSubjects: number;
  overallPassPercentage: number;
  cohortMeanPercentage: number;
  hasExcelBlob: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryFilterParams {
  semester?: string;
  academic_year?: string;
  academicYear?: string;
  exam_cycle?: string;
  examCycle?: string;
  scheme?: string;
  department?: string;
  search?: string;
}

export interface AlreadyAnalysedMatch {
  alreadyAnalysed: boolean;
  message?: string;
  recommendation?: string;
  uploadId: string;
  uploadedAt: string;
  fileName: string;
  totalStudents: number;
  totalSubjects: number;
  overallPassPercentage: number;
  cohortMeanPercentage: number;
  semesterDetails?: SemesterDetails;
  subjectsConfig?: Record<string, SubjectConfig>;
  gradingBands?: GradingBandConfig;
  existingPayload: AnalysisPayload;
}
