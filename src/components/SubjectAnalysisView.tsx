import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  Trophy,
  AlertCircle,
  BarChart3,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Search,
  Users,
  Download,
  Printer,
  FileSpreadsheet,
  Medal,
  ChevronDown,
  UserX,
  X,
  Plus,
  Check,
} from 'lucide-react';
import {
  SubjectAnalysis,
  AnalysisConfig,
  AnalysisPayload,
  SubjectConfig,
  GradingBandConfig,
  SemesterDetails,
} from '../types/analyzer';
import { ScoreChart } from './ScoreChart';
import {
  exportSubjectRosterCSV,
  exportSubjectTop5CSV,
  exportSubjectFailedStudentsCSV,
  exportSubjectSummaryCSV,
} from '../utils/exportUtils';
import { downloadSubjectAnalysisPDF } from '../utils/pdfExportUtils';
import { College, Department } from '../types/auth';

interface SubjectAnalysisViewProps {
  analysis?: SubjectAnalysis;
  payload?: AnalysisPayload | null;
  allSubjects?: string[];
  currentSubjectCode?: string;
  selectedSubjectCode?: string;
  config?: AnalysisConfig;
  fileName?: string;
  onSelectSubject: (code: string) => void;
  onNavigateToSummary?: () => void;
  onNavigateUpload?: () => void;
  onReanalyze?: (
    gradingBands: GradingBandConfig,
    subjectsConfig: Record<string, SubjectConfig>,
    semesterDetails?: SemesterDetails
  ) => Promise<void>;
  college?: College | null;
  department?: Department | null;
}

export const SubjectAnalysisView: React.FC<SubjectAnalysisViewProps> = (props) => {
  const {
    onSelectSubject,
    onNavigateToSummary,
    onNavigateUpload,
    college,
    department,
  } = props;

  const currentSubjectCode =
    props.currentSubjectCode ||
    props.selectedSubjectCode ||
    (props.payload?.detectedSubjects?.[0] ?? '');

  const analysis =
    props.analysis ||
    (props.payload && currentSubjectCode
      ? props.payload.subjectsAnalysis[currentSubjectCode]
      : undefined);

  const allSubjects =
    props.allSubjects || props.payload?.detectedSubjects || [];

  const config = props.config || props.payload?.config;
  const fileName = props.fileName || props.payload?.fileName || 'Spreadsheet';

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRoster, setShowAllRoster] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <div className="text-4xl">📊</div>
          <h2 className="text-lg font-bold text-slate-800">
            No Subject Analysis Selected
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Please upload a semester result sheet to generate and view subject-wise performance metrics, pass rates, and grade distribution charts.
          </p>
          {onNavigateUpload && (
            <button
              onClick={onNavigateUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Go to Upload Sheet
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentIndex = allSubjects.indexOf(currentSubjectCode);
  const prevSubject = currentIndex > 0 ? allSubjects[currentIndex - 1] : null;
  const nextSubject = currentIndex < allSubjects.length - 1 ? allSubjects[currentIndex + 1] : null;

  const {
    subjectCode,
    displayName,
    isInternalOnly,
    facultyName,
    maxInternal,
    maxExternal,
    maxTotal,
    gradeSummary,
    internalBins,
    externalBins,
    totalBins,
    top5Students,
    failedStudents,
    allStudents,
  } = analysis;

  const currentTitle = displayName || subjectCode;

  const filteredAllStudents = allStudents.filter(
    (s) =>
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const effectiveConfig: AnalysisConfig = config || {
    gradingBands: {
      fcdMin: 70,
      fcMin: 60,
      scMin: 50,
      passMin: 40,
      roundingTolerance: 1.0,
      requireSeparatePass: false,
    },
    subjectsConfig: {},
  };

  const handleDownloadPDF = () => {
    setShowExportMenu(false);
    downloadSubjectAnalysisPDF(analysis, effectiveConfig, fileName, college, department);
  };

  // Absentees Management Modal State
  const [isAbsenteeModalOpen, setIsAbsenteeModalOpen] = useState(false);
  const currentSubCfg = effectiveConfig.subjectsConfig[currentSubjectCode];
  const initialHasAbsentees = !!(
    currentSubCfg?.hasAbsentees ||
    analysis.hasAbsentees ||
    (analysis.gradeSummary.absentCount && analysis.gradeSummary.absentCount > 0)
  );
  const initialAbsenteeCount =
    currentSubCfg?.absenteeCount ||
    analysis.absenteeCount ||
    analysis.gradeSummary.absentCount ||
    1;
  const initialAbsenteeNames =
    (currentSubCfg?.absenteeNames && currentSubCfg.absenteeNames.length > 0)
      ? currentSubCfg.absenteeNames
      : (analysis.absenteeNames || []);

  const [absenteeHas, setAbsenteeHas] = useState<boolean>(initialHasAbsentees);
  const [absenteeCount, setAbsenteeCount] = useState<number>(initialAbsenteeCount);
  const [absenteeNamesStr, setAbsenteeNamesStr] = useState<string>(initialAbsenteeNames.join(', '));
  const [absenteeSaving, setAbsenteeSaving] = useState(false);
  const [absenteeRosterSearch, setAbsenteeRosterSearch] = useState('');

  // Sync state when subject changes
  useEffect(() => {
    const cfg = effectiveConfig.subjectsConfig[currentSubjectCode];
    const has = !!(cfg?.hasAbsentees || analysis.hasAbsentees || (analysis.gradeSummary.absentCount && analysis.gradeSummary.absentCount > 0));
    setAbsenteeHas(has);
    setAbsenteeCount(cfg?.absenteeCount || analysis.absenteeCount || analysis.gradeSummary.absentCount || 1);
    const names = (cfg?.absenteeNames && cfg.absenteeNames.length > 0) ? cfg.absenteeNames : (analysis.absenteeNames || []);
    setAbsenteeNamesStr(names.join(', '));
  }, [currentSubjectCode, analysis, effectiveConfig.subjectsConfig]);

  const handleToggleStudentAbsentee = (studentNameOrId: string) => {
    const currentList = absenteeNamesStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    const exists = currentList.some((n) => n.toLowerCase() === studentNameOrId.toLowerCase());
    let nextList: string[];
    if (exists) {
      nextList = currentList.filter((n) => n.toLowerCase() !== studentNameOrId.toLowerCase());
    } else {
      nextList = [...currentList, studentNameOrId];
    }
    setAbsenteeNamesStr(nextList.join(', '));
    setAbsenteeCount(Math.max(1, nextList.length));
    if (!absenteeHas) setAbsenteeHas(true);
  };

  const handleSaveAbsentees = async () => {
    if (!props.onReanalyze) return;
    setAbsenteeSaving(true);
    try {
      const namesList = absenteeNamesStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      const subCfg: SubjectConfig = effectiveConfig.subjectsConfig[currentSubjectCode] || {
        subjectCode: currentSubjectCode,
        displayName: currentTitle,
        facultyName: analysis.facultyName,
        maxInternal: analysis.maxInternal,
        maxExternal: analysis.maxExternal,
        maxTotal: analysis.maxTotal,
      };

      const updatedSubjectsConfig: Record<string, SubjectConfig> = {
        ...effectiveConfig.subjectsConfig,
        [currentSubjectCode]: {
          ...subCfg,
          hasAbsentees: absenteeHas,
          absenteeCount: absenteeHas ? Math.max(namesList.length, absenteeCount || 1) : 0,
          absenteeNames: absenteeHas ? namesList : [],
        },
      };

      await props.onReanalyze(
        effectiveConfig.gradingBands,
        updatedSubjectsConfig,
        effectiveConfig.semesterDetails
      );
      setIsAbsenteeModalOpen(false);
    } catch (err) {
      console.error('Failed to save absentees:', err);
    } finally {
      setAbsenteeSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Official Institutional Header Card with Verified College Logos */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 border border-blue-900/30">
        <div className="flex items-center gap-4 text-center md:text-left">
          <img
            src={college?.collegeLogoUrl || '/images/ubdt_logo.png'}
            alt="College Seal"
            className="w-14 h-14 object-contain rounded-full bg-white/10 p-1 shadow-xs border border-white/20 shrink-0"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/30">
                Official Institutional Format
              </span>
              <span className="text-xs text-slate-300">
                {college?.universityName || config?.semesterDetails?.university || 'Academic Examination Vault'}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {college?.name || config?.semesterDetails?.college || 'Institutional Examination Portal'}
            </h2>
            <p className="text-xs text-blue-200/80 font-medium">
              {department?.name || config?.semesterDetails?.department || config?.semesterDetails?.branch || 'Academic Department'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer border border-blue-400/30"
            title="Download exact institutional PDF report with verified college seals"
          >
            <Download className="w-4 h-4" />
            <span>Download Official PDF</span>
          </button>
          <img
            src={college?.universityLogoUrl || '/images/vtu_logo.png'}
            alt="University Seal"
            className="w-14 h-14 object-contain rounded-full bg-white/10 p-1 shadow-xs border border-white/20 shrink-0"
          />
        </div>
      </div>

      {/* 1. Header: Subject Code + Faculty Name + Navigation & Export Actions */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 bg-blue-600 text-white font-mono font-bold text-xs sm:text-sm rounded-lg shadow-xs shadow-blue-500/20">
              {currentTitle}
            </span>
            {displayName && displayName !== subjectCode && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Code: {subjectCode}
              </span>
            )}
            {isInternalOnly ? (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                Coursework / Internal Only (Max: {maxTotal})
              </span>
            ) : (
              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                Max Total: {maxTotal} (IA: {maxInternal} + SEE: {maxExternal})
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {currentTitle} Performance Evaluation
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-500">Faculty In-Charge:</span>
              <strong className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                {facultyName || 'Unassigned'}
              </strong>
            </div>

            {effectiveConfig.semesterDetails && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {effectiveConfig.semesterDetails.semester} ({effectiveConfig.semesterDetails.semType})
                </span>
                <span className="font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Exam: {effectiveConfig.semesterDetails.examination}
                </span>
                <span className="font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  AY: {effectiveConfig.semesterDetails.academicYear}
                </span>
                <span className="font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                  Scheme: {effectiveConfig.semesterDetails.scheme || '2022'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Navigation, Stats Badges & Export Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 divide-x divide-slate-200 text-center font-mono">
            <div className="px-3.5 py-2">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Pass Rate</p>
              <p className={`text-sm font-bold ${gradeSummary.passPercentage >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {gradeSummary.passPercentage}%
              </p>
            </div>
            <div className="px-3.5 py-2">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Passed</p>
              <p className="text-sm font-bold text-slate-900">
                {gradeSummary.passCount}
              </p>
            </div>
            <div className="px-3.5 py-2">
              <p className="text-[10px] uppercase font-semibold text-slate-500">Cohort</p>
              <p className="text-sm font-bold text-slate-900">
                {gradeSummary.totalStudents}
              </p>
            </div>
          </div>

          {/* Absentees Input & Management Button */}
          <button
            onClick={() => setIsAbsenteeModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer font-mono ${
              (gradeSummary.absentCount || 0) > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Configure or mark absentees for this subject"
          >
            <UserX className={`w-3.5 h-3.5 ${(gradeSummary.absentCount || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Absentees: {gradeSummary.absentCount || 0}</span>
          </button>

          {/* Direct PDF Download Button */}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
            title="Download Subject Performance Dossier as PDF file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          {/* Export Dropdown for Subject */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Export Subject Data (PDF / CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showExportMenu && (
              <div
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl py-2 shadow-xl z-50 text-xs"
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Export {currentTitle} Data</span>
                  <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-mono">PDF & CSV</span>
                </div>

                {/* Direct PDF Download Option */}
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center gap-2.5 text-blue-900 transition-colors border-b border-slate-100"
                >
                  <Download className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                      <span>Official Subject Analysis (.PDF)</span>
                      <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">UBDT</span>
                    </div>
                    <div className="text-[11px] text-blue-700">Official 2-page report: Page 1 official analysis & Page 2 distribution charts, Top 5 & remedial list</div>
                  </div>
                </button>

                {/* PDF Print Option */}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    window.print();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                >
                  <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Print Dialog (Ctrl+P)</div>
                    <div className="text-[11px] text-slate-500">Browser print layout view</div>
                  </div>
                </button>

                {/* CSV Full Roster */}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    exportSubjectRosterCSV(analysis);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Complete Student Roster (.CSV)</div>
                    <div className="text-[11px] text-slate-500">All {allStudents.length} student scores & results</div>
                  </div>
                </button>

                {/* CSV Top 5 */}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    exportSubjectTop5CSV(analysis);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                >
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Top 5 Merit List (.CSV)</div>
                    <div className="text-[11px] text-slate-500">Rank honors with tie preservation</div>
                  </div>
                </button>

                {/* CSV Failed Students */}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    exportSubjectFailedStudentsCSV(analysis);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Remedial / Failed List (.CSV)</div>
                    <div className="text-[11px] text-slate-500">{failedStudents.length} candidates with reasons</div>
                  </div>
                </button>

                {/* CSV Grade Summary */}
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    exportSubjectSummaryCSV(analysis);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">Grade Distribution Stats (.CSV)</div>
                    <div className="text-[11px] text-slate-500">FCD/FC/SC/Pass/Fail & High/Low Scores</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Prev / Next Subject Switchers */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => prevSubject && onSelectSubject(prevSubject)}
              disabled={!prevSubject}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-bold transition-all disabled:opacity-30 disabled:pointer-events-none shadow-2xs"
              title="Previous Subject"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextSubject && onSelectSubject(nextSubject)}
              disabled={!nextSubject}
              className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-bold transition-all disabled:opacity-30 disabled:pointer-events-none shadow-2xs"
              title="Next Subject"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Separate Distribution Bar Charts (Internal, External, Total) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="col-header text-slate-400 font-semibold">Score Distribution Histograms (Adaptive Bins)</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportSubjectSummaryCSV(analysis)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 font-mono"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Stats</span>
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isInternalOnly ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-5`}>
          {/* Chart 1: Internal Marks */}
          <ScoreChart
            title="Internal Evaluation (IA)"
            subtitle="Continuous internal assessment frequency"
            bins={internalBins}
            maxMarks={maxInternal}
            colorScheme="emerald"
          />

          {/* Chart 2: External Marks (Only if not internal only) */}
          {!isInternalOnly && (
            <ScoreChart
              title="External Examination (SEE)"
              subtitle="Semester end exam theory distribution"
              bins={externalBins}
              maxMarks={maxExternal}
              colorScheme="amber"
            />
          )}

          {/* Chart 3: Total Marks */}
          <ScoreChart
            title="Total Aggregate Distribution"
            subtitle="Reconciled total mark frequency"
            bins={totalBins}
            maxMarks={maxTotal}
            colorScheme="purple"
          />
        </div>
      </div>

      {/* 3. Top 5 Table (Highest Ranked Students with Tie Handling) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="col-header text-slate-400">Merit Leaderboard</div>
              <h2 className="text-base font-bold text-slate-900">
                Top Ranked Students in {subjectCode}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportSubjectTop5CSV(analysis)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              title="Download Top 5 Merit List as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Top 5 (.CSV)</span>
            </button>
            <span className="font-mono text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg">
              {top5Students.length} Candidates Recorded
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-50/80 text-slate-500 font-mono text-[11px] border-b border-slate-200/80 uppercase">
              <tr>
                <th className="py-3 px-4 text-center w-20">Rank</th>
                <th className="py-3 px-4">Student ID (USN)</th>
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4 text-center">IA ({maxInternal})</th>
                <th className="py-3 px-4 text-center">SEE ({maxExternal})</th>
                <th className="py-3 px-4 text-center">Total ({maxTotal})</th>
                <th className="py-3 px-4 text-center">%</th>
                <th className="py-3 px-4 text-center">Grade Band</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {top5Students.map((st, idx) => {
                const getRankBadge = (rank: number) => {
                  if (rank === 1) return 'bg-amber-100 text-amber-800 border-amber-300';
                  if (rank === 2) return 'bg-slate-200 text-slate-800 border-slate-300';
                  if (rank === 3) return 'bg-amber-700/10 text-amber-900 border-amber-700/30';
                  return 'bg-slate-100 text-slate-700 border-slate-200';
                };

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${getRankBadge(st.rank)}`}>
                          #{st.rank}
                        </span>
                        {st.isTied && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                            Tied
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{st.studentId}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{st.studentName}</td>
                    <td className="py-3 px-4 text-center">{st.internalMarks}</td>
                    <td className="py-3 px-4 text-center">{st.externalMarks}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-600 bg-blue-50/50">
                      {st.totalMarks}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">{st.percentage}%</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full border border-blue-200 text-[11px] font-semibold bg-blue-50 text-blue-700">
                        {st.gradeBand}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Failed Students Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs ${
              failedStudents.length === 0 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' 
                : 'bg-rose-50 text-rose-600 border-rose-200/60'
            }`}>
              {failedStudents.length === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="col-header text-slate-400">Remedial Tracking</div>
              <h2 className="text-base font-bold text-slate-900">
                Failed Students Roster ({subjectCode})
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {failedStudents.length > 0 && (
              <button
                onClick={() => exportSubjectFailedStudentsCSV(analysis)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                title="Download Failed Students Roster as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Failed List (.CSV)</span>
              </button>
            )}
            <span className={`font-mono text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              failedStudents.length === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {failedStudents.length} Candidates Failed
            </span>
          </div>
        </div>

        {failedStudents.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50/40">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-bold text-emerald-950 text-sm">100% Pass Rate in {subjectCode}</h4>
            <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
              All enrolled candidates successfully met the continuous internal assessment and semester-end exam thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-50/80 text-slate-500 font-mono text-[11px] border-b border-slate-200/80 uppercase">
                <tr>
                  <th className="py-3 px-4">Student ID (USN)</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 text-center">IA</th>
                  <th className="py-3 px-4 text-center">SEE</th>
                  <th className="py-3 px-4 text-center">Total Marks</th>
                  <th className="py-3 px-4 text-center">Score %</th>
                  <th className="py-3 px-4 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {failedStudents.map((st, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{st.studentId}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{st.studentName}</td>
                    <td className="py-3 px-4 text-center">{st.internalMarks}</td>
                    <td className="py-3 px-4 text-center">{st.externalMarks}</td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">{st.totalMarks}</td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">{st.percentage}%</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs uppercase bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold">
                        Fail
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Grade-Band Summary (FCD / FC / SC / Pass / Fail) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <div className="col-header text-slate-400">Classification Breakdown</div>
            <h2 className="text-base font-bold text-slate-900">
              Grade-Band Classification Summary
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportSubjectSummaryCSV(analysis)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Stats (.CSV)</span>
            </button>
            <span className="font-mono text-xs text-slate-500">
              Total Cohort: <strong className="text-slate-900">{gradeSummary.totalStudents}</strong>
            </span>
          </div>
        </div>

        {/* Grade band cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-center">
            <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider block">FCD (≥70%)</span>
            <p className="text-2xl font-black text-indigo-900 mt-1">{gradeSummary.fcdCount}</p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
              {gradeSummary.totalStudents > 0 ? ((gradeSummary.fcdCount / gradeSummary.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider block">FC (60–69%)</span>
            <p className="text-2xl font-black text-blue-900 mt-1">{gradeSummary.fcCount}</p>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">
              {gradeSummary.totalStudents > 0 ? ((gradeSummary.fcCount / gradeSummary.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 text-center">
            <span className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider block">SC (50–59%)</span>
            <p className="text-2xl font-black text-sky-900 mt-1">{gradeSummary.scCount}</p>
            <p className="text-[11px] text-sky-600 font-medium mt-0.5">
              {gradeSummary.totalStudents > 0 ? ((gradeSummary.scCount / gradeSummary.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block">Pass (40–49%)</span>
            <p className="text-2xl font-black text-slate-800 mt-1">{gradeSummary.passCount}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {gradeSummary.totalStudents > 0 ? ((gradeSummary.passCount / gradeSummary.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block">Fail</span>
            <p className="text-2xl font-black text-rose-700 mt-1">{gradeSummary.failCount}</p>
            <p className="text-[11px] text-rose-600 font-medium mt-0.5">
              {gradeSummary.totalStudents > 0 ? ((gradeSummary.failCount / gradeSummary.totalStudents) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Searchable Full Student Roster Accordion */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="col-header text-slate-400">Audit Records</div>
            <h3 className="text-base font-bold text-slate-900">
              Full Enrolled Student Roster ({allStudents.length} Records)
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportSubjectRosterCSV(analysis)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              title="Download Full Roster as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Roster (.CSV)</span>
            </button>
            <button
              onClick={() => setShowAllRoster(!showAllRoster)}
              className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-2xs"
            >
              {showAllRoster ? 'Collapse Roster' : 'Expand Roster'}
            </button>
          </div>
        </div>

        {showAllRoster && (
          <div className="space-y-4 pt-2">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by USN or Student Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-800 font-mono">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3 text-center">IA</th>
                    <th className="py-2.5 px-3 text-center">SEE</th>
                    <th className="py-2.5 px-3 text-center">Total</th>
                    <th className="py-2.5 px-3 text-center">%</th>
                    <th className="py-2.5 px-3 text-center">Result</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllStudents.map((st, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.studentId}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">{st.studentName}</td>
                      <td className="py-2.5 px-3 text-center">{st.internalMarks}</td>
                      <td className="py-2.5 px-3 text-center">{st.externalMarks}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{st.totalMarks}</td>
                      <td className="py-2.5 px-3 text-center">{st.percentage}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          st.computedResult === 'Pass'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {st.computedResult}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[11px]">
                        {st.gradeBand}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action / Jump to Semester Summary */}
      <div className="flex justify-between items-center pt-2">
        {prevSubject ? (
          <button
            onClick={() => onSelectSubject(prevSubject)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev [{prevSubject}]</span>
          </button>
        ) : <div />}

        <button
          onClick={onNavigateToSummary}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all"
        >
          <span>Consolidated Semester Report</span>
          <TrendingUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subject Absentees Management Modal */}
      {isAbsenteeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-400/30">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Subject Absentees Configuration
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {currentTitle} ({analysis.facultyName})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAbsenteeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prompt: Are there any absentees? */}
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 font-mono block">
                    Are there any absentees in this subject?
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Absentees will be looked up, ignored for positive analysis, and evaluated as Fail.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAbsenteeHas(false);
                      setAbsenteeNamesStr('');
                      setAbsenteeCount(0);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                      !absenteeHas
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAbsenteeHas(true);
                      if (absenteeCount <= 0) setAbsenteeCount(1);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                      absenteeHas
                        ? 'bg-amber-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {absenteeHas && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-xs font-mono font-semibold text-slate-700">
                        How many absentees?
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={absenteeCount}
                        onChange={(e) => setAbsenteeCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-xs font-mono font-semibold text-slate-700">
                        Absentee Names or USNs:
                      </label>
                      <input
                        type="text"
                        value={absenteeNamesStr}
                        onChange={(e) => setAbsenteeNamesStr(e.target.value)}
                        placeholder="e.g. 4BD22CS045, Rahul Sharma, Pooja M"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Quick-Pick Candidate Roster from Subject */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 font-mono">
                        Quick-Select from Subject Roster ({allStudents.length} students):
                      </span>
                      <input
                        type="text"
                        value={absenteeRosterSearch}
                        onChange={(e) => setAbsenteeRosterSearch(e.target.value)}
                        placeholder="Filter students..."
                        className="px-2 py-0.5 text-[11px] font-mono border border-slate-200 rounded-md w-36"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-1.5 divide-y divide-slate-100 bg-slate-50/50">
                      {allStudents
                        .filter((st) =>
                          !absenteeRosterSearch ||
                          st.studentName.toLowerCase().includes(absenteeRosterSearch.toLowerCase()) ||
                          st.studentId.toLowerCase().includes(absenteeRosterSearch.toLowerCase())
                        )
                        .slice(0, 50)
                        .map((st) => {
                          const isSelected = absenteeNamesStr
                            .split(/[,;\n]+/)
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean)
                            .some(
                              (n) =>
                                n === st.studentId.toLowerCase() ||
                                n === st.studentName.toLowerCase() ||
                                st.studentName.toLowerCase().includes(n)
                            );

                          return (
                            <button
                              key={st.studentId}
                              type="button"
                              onClick={() => handleToggleStudentAbsentee(st.studentName)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-100/90 text-amber-950 font-bold'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[11px] text-slate-500">{st.studentId}</span>
                                <span className="truncate">{st.studentName}</span>
                              </div>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                  isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isSelected ? 'Absent' : '+ Mark Absent'}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Strict Analysis Rule:</strong> Any student specified above is excluded from top rankers, ignored for pass percentages, and recorded as Fail in official PDF dossiers.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsAbsenteeModalOpen(false)}
                disabled={absenteeSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAbsentees}
                disabled={absenteeSaving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {absenteeSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Recalculating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Recalculate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



