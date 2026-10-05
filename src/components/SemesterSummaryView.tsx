import React, { useState } from 'react';
import {
  Trophy,
  AlertTriangle,
  GraduationCap,
  Users,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Download,
  Table,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { SemesterSummary, AnalysisPayload } from '../types/analyzer';
import {
  exportSemesterSubjectMatrixCSV,
  exportSemesterToppersCSV,
  exportSemesterFailedStudentsCSV,
  exportOverallRemedialStudentsCSV,
  exportCompleteSemesterMasterCSV,
} from '../utils/exportUtils';
import {
  downloadSemesterSummaryPDF,
  downloadVTUSemesterSummaryPDF,
  downloadSemesterDossierUptoRemedialPDF,
  downloadOverallRemedialStudentsPDF,
} from '../utils/pdfExportUtils';
import { OfficialSemesterSummaryTemplate } from './OfficialSemesterSummaryTemplate';
import { College, Department } from '../types/auth';

interface SemesterSummaryViewProps {
  summary?: SemesterSummary;
  fileName?: string;
  payload?: AnalysisPayload | null;
  onSelectSubject: (code: string) => void;
  onNavigateToUpload?: () => void;
  onNavigateToPrint?: () => void;
  onReanalyze?: (
    gradingBands: any,
    subjectsConfig: any,
    semesterDetails?: any
  ) => Promise<void>;
  college?: College | null;
  department?: Department | null;
}

export const SemesterSummaryView: React.FC<SemesterSummaryViewProps> = (props) => {
  const { onSelectSubject, onNavigateToUpload, onNavigateToPrint } = props;
  const summary = props.summary || props.payload?.semesterSummary;
  const fileName = props.fileName || props.payload?.fileName || 'Semester_Marks';
  const payload = props.payload;

  const [viewMode, setViewMode] = useState<'official' | 'analytical'>('official');
  const [filterBacklog, setFilterBacklog] = useState<number | 'all'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRemedialMenu, setShowRemedialMenu] = useState(false);

  const handleDownloadPDF = () => {
    setShowExportMenu(false);
    if (payload) {
      if (viewMode === 'official') {
        downloadVTUSemesterSummaryPDF(payload);
      } else {
        downloadSemesterSummaryPDF(payload);
      }
    } else {
      window.print();
    }
  };

  if (!summary || !payload) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <div className="text-4xl">📋</div>
          <h2 className="text-lg font-bold text-slate-800">
            No Semester Analysis Loaded
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Please upload a semester result sheet to view consolidated semester performance, toppers, and remedial registers.
          </p>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Go to Upload Sheet
            </button>
          )}
        </div>
      </div>
    );
  }

  const {
    totalUniqueStudents,
    totalSubjects,
    totalMaximumMarks,
    formulaCheck,
    hasModuleMismatch,
    mismatchWarning,
    overallPassCount,
    overallPassPercentage,
    averageSemesterPercentage,
    subjectSummaries,
    overallToppers,
    overallFailedStudents,
    backlogDistribution,
  } = summary;

  const filteredFailedStudents = filterBacklog === 'all'
    ? overallFailedStudents
    : overallFailedStudents.filter((s) => s.failedCount === filterBacklog);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header & Overall Semester KPIs */}
      <div className="bg-slate-900 text-white p-7 sm:p-8 rounded-2xl shadow-md border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-md">
                Aggregated Semester Report
              </span>
              {payload?.config?.semesterDetails && (
                <>
                  <span className="text-[11px] font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded-md">
                    {payload.config.semesterDetails.semester} ({payload.config.semesterDetails.semType})
                  </span>
                  <span className="text-[11px] font-mono font-semibold bg-slate-800 text-blue-300 border border-slate-700 px-2.5 py-0.5 rounded-md">
                    Exam: {payload.config.semesterDetails.examination}
                  </span>
                  <span className="text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-md">
                    AY: {payload.config.semesterDetails.academicYear}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {payload?.config?.semesterDetails?.semester ? `${payload.config.semesterDetails.semester} Academic Matrix` : 'Semester Academic Matrix'}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Consolidated evaluation across <strong className="text-white">{totalSubjects} subjects</strong> for <strong className="text-white">{totalUniqueStudents} students</strong> ({fileName})
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Direct PDF Download Button */}
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
              title="Download Full Semester Performance Dossier (.PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            {/* Download Remedial Students Dedicated Action */}
            <div className="relative">
              <button
                id="download-remedial-students-btn"
                onClick={() => setShowRemedialMenu(!showRemedialMenu)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl border border-rose-600 shadow-xs transition-all cursor-pointer"
                title="Download Remedial Students List (Overall Semester - Evaluated by Sheet Result)"
              >
                <Users className="w-3.5 h-3.5 text-rose-200" />
                <span>Download Remedial Students</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {showRemedialMenu && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl py-2 shadow-xl z-50 text-xs text-slate-800"
                  onMouseLeave={() => setShowRemedialMenu(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>Overall Remedial Students</span>
                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-mono font-bold">
                      {overallFailedStudents.length} Students
                    </span>
                  </div>

                  {/* Official PDF with HOD Signature */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowRemedialMenu(false);
                        downloadOverallRemedialStudentsPDF(payload);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-rose-50/70 flex items-center gap-2.5 text-rose-950 transition-colors border-b border-slate-100 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                          <span>Remedial Register (.PDF)</span>
                          <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">
                            HOD Sign
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Official institutional register with HOD & Coordinator signatures
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Excel / CSV Download */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowRemedialMenu(false);
                        exportOverallRemedialStudentsCSV(payload);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-800 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>Export Remedial List (.CSV)</span>
                          <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">
                            Excel Ready
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Raw spreadsheet format with student USN, subject codes & marks
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Main Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 shadow-xs transition-all cursor-pointer"
                title="Export Semester Reports & Data (PDF / CSV)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSVs</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-76 bg-white border border-slate-200 rounded-xl py-2 shadow-xl z-50 text-xs text-slate-800"
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>Semester Reports & Data Export</span>
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-mono">PDF & CSV</span>
                  </div>

                  {/* Official Remedial Students PDF Download */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        downloadOverallRemedialStudentsPDF(payload);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50/70 flex items-center gap-2.5 text-rose-950 transition-colors border-b border-slate-100 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                          <span>Subject-Wise Remedial Register (.PDF)</span>
                          <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">Coordinator & HOD</span>
                        </div>
                        <div className="text-[11px] text-rose-700">Single minimal table with subject-wise fail student records</div>
                      </div>
                    </button>
                  )}

                  {/* Official VTU 2-Page PDF Download Option */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        downloadVTUSemesterSummaryPDF(payload);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center gap-2.5 text-blue-900 transition-colors border-b border-slate-100 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                          <span>Official VTU 2-Page PDF</span>
                          <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">VTU/UBDT</span>
                        </div>
                        <div className="text-[11px] text-blue-700">Exact 2-page template with logos & signatures</div>
                      </div>
                    </button>
                  )}

                  {/* Download Dossier Up to Remedial with HOD Signature Option */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        downloadSemesterDossierUptoRemedialPDF(payload);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50/70 flex items-center gap-2.5 text-emerald-900 transition-colors border-b border-slate-100 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                          <span>Dossier (Up to Remedial)</span>
                          <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">HOD Sign</span>
                        </div>
                        <div className="text-[11px] text-emerald-700">Data up to remedial list with HOD signature</div>
                      </div>
                    </button>
                  )}

                  {/* Direct Master PDF Download Option */}
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-800 transition-colors border-b border-slate-100 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Download Full Dossier (.PDF)</span>
                        <span className="text-[9px] bg-slate-700 text-white font-bold px-1.5 py-0.2 rounded uppercase">Complete</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Consolidated matrix, toppers & backlogs</div>
                    </div>
                  </button>

                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Data Sheets (.CSV)
                  </div>

                  {/* Remedial Students CSV */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        exportOverallRemedialStudentsCSV(payload);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50/60 flex items-center gap-2.5 text-rose-900 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-900">Remedial Students List (.CSV)</div>
                        <div className="text-[11px] text-slate-500">Only students marked Fail in sheet</div>
                      </div>
                    </button>
                  )}

                  {/* Native Print Dialog Option */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      window.print();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                  >
                    <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">Native Print (Ctrl+P)</div>
                      <div className="text-[11px] text-slate-500">Browser print & Save as PDF</div>
                    </div>
                  </button>

                  {/* CSV Master Ledger (if payload available) */}
                  {payload && (
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        exportCompleteSemesterMasterCSV(payload);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                    >
                      <Table className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Complete Master Ledger (.CSV)</div>
                        <div className="text-[11px] text-slate-500">All students × All subjects matrix</div>
                      </div>
                    </button>
                  )}

                  {/* CSV Subject Performance Matrix */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      exportSemesterSubjectMatrixCSV(summary);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Subject Matrix Summary (.CSV)</div>
                      <div className="text-[11px] text-slate-500">FCD/FC/SC/Pass/Fail & averages</div>
                    </div>
                  </button>

                  {/* CSV Semester Toppers */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      exportSemesterToppersCSV(summary);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors border-b border-slate-100"
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="font-semibold text-slate-900">Semester Toppers List (.CSV)</div>
                      <div className="text-[11px] text-slate-500">Overall Top 5 aggregated ranks</div>
                    </div>
                  </button>

                  {/* CSV Backlog Roster */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      exportSemesterFailedStudentsCSV(summary);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <div>
                      <div className="font-semibold text-slate-900">Backlogs & Arrears Roster (.CSV)</div>
                      <div className="text-[11px] text-slate-500">{overallFailedStudents.length} candidates with breakdown</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800 font-mono">
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Cohort Size
            </span>
            <p className="text-2xl font-bold text-white mt-1">
              {totalUniqueStudents}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Distinct Candidates</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Pass Rate (All Clear)
            </span>
            <p className={`text-2xl font-bold mt-1 ${overallPassPercentage >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {overallPassPercentage}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {overallPassCount} Passed All
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Backlog Students
            </span>
            <p className={`text-2xl font-bold mt-1 ${overallFailedStudents.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {overallFailedStudents.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Needs Remedial Support</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
              Evaluated Modules
            </span>
            <p className="text-2xl font-bold text-white mt-1">
              {totalSubjects}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Subject Modules</p>
          </div>
        </div>

        {/* Visible Self-Check Calculation Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold border border-blue-500/30">
              Module Self-Check
            </span>
            <span className="text-slate-300 font-mono">
              {formulaCheck || `${totalSubjects} modules × 100 marks = ${totalMaximumMarks || totalSubjects * 100} total`}
            </span>
          </div>

          {hasModuleMismatch && (
            <div className="flex items-center gap-1.5 text-rose-300 bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span className="font-semibold">{mismatchWarning || 'Maximum marks mismatch detected!'}</span>
            </div>
          )}
        </div>
      </div>

      {/* View Mode Segmented Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2.5 border border-slate-200 rounded-2xl shadow-xs print:hidden">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setViewMode('official')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'official'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Official VTU Template (2-Page PDF)</span>
          </button>
          <button
            onClick={() => setViewMode('analytical')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'analytical'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Interactive Analytical Dashboard</span>
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 pr-2">
          <span>Active View: <strong className="text-slate-900">{viewMode === 'official' ? 'Official VTU Result Analysis Format' : 'Analytical Dashboard'}</strong></span>
        </div>
      </div>

      {viewMode === 'official' && payload ? (
        <OfficialSemesterSummaryTemplate
          payload={payload}
          summary={summary}
          onSwitchToAnalytics={() => setViewMode('analytical')}
        />
      ) : (
        <>
      {/* 2. Consolidated Subject Matrix Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="col-header text-slate-400">Comparative Subject Index</div>
              <h2 className="text-base font-bold text-slate-900">Subject-Wise Performance Matrix</h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportSemesterSubjectMatrixCSV(summary)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              title="Download Subject Matrix as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Matrix (.CSV)</span>
            </button>
            <span className="font-mono text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg">
              {totalSubjects} Total Modules
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-50/80 text-slate-500 font-mono text-[11px] border-b border-slate-200/80 uppercase">
              <tr>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Faculty In-Charge</th>
                <th className="py-3 px-4 text-center">FCD (≥70%)</th>
                <th className="py-3 px-4 text-center">FC (60–69%)</th>
                <th className="py-3 px-4 text-center">SC (50–59%)</th>
                <th className="py-3 px-4 text-center">Pass (&lt;50%)</th>
                <th className="py-3 px-4 text-center">Fail</th>
                <th className="py-3 px-4 text-center">Enrolled</th>
                <th className="py-3 px-4 text-center">Pass %</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {subjectSummaries.map((sub, idx) => {
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-600 bg-blue-50/30">
                      <div>{sub.displayName || sub.subjectCode}</div>
                      {sub.displayName && sub.displayName !== sub.subjectCode && (
                        <div className="text-[10px] text-slate-400 font-normal">{sub.subjectCode}</div>
                      )}
                      {sub.isInternalOnly && (
                        <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold">
                          Internal Only
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      {sub.facultyName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-indigo-700">
                      {sub.fcdCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-blue-700">
                      {sub.fcCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-sky-700">
                      {sub.scCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {sub.passCount}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">
                      {sub.failCount}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700">
                      {sub.totalStudents}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${
                        sub.passPercentage >= 75
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {sub.passPercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectSubject(sub.subjectCode)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition-colors"
                      >
                        <span>Charts</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Overall Semester Toppers (Top 5 Summed Across All Subjects) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="col-header text-slate-400">Semester Rank Honors</div>
              <h2 className="text-base font-bold text-slate-900">
                Overall Semester Top Rank List
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportSemesterToppersCSV(summary)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              title="Download Semester Toppers as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Toppers (.CSV)</span>
            </button>
            <span className="font-mono text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg">
              Summed Across {totalSubjects} Subjects
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
                <th className="py-3 px-4 text-center">Aggregate Marks</th>
                <th className="py-3 px-4 text-center">Semester %</th>
                <th className="py-3 px-4 text-center">Modules</th>
                <th className="py-3 px-4 text-center">Spot-Check</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {overallToppers.map((st, idx) => {
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
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {st.totalMarksObtained} <span className="text-xs text-slate-400 font-normal">/ {st.maxSemesterMarks}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-blue-600 bg-blue-50/50">
                      {st.overallPercentage}%
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">{st.subjectsCount} Modules</td>
                    <td className="py-3 px-4 text-center">
                      {st.spotCheckVerified !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700" title={`Subject marks sum: ${st.spotCheckSum ?? st.totalMarksObtained}`}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sum Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-rose-200 bg-rose-50 text-rose-700" title={`Subject marks sum (${st.spotCheckSum}) differs from calculated total (${st.totalMarksObtained})`}>
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Mismatch ({st.spotCheckSum})</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {st.allSubjectsPassed ? (
                        <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                          All Cleared
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                          {st.failedSubjectsCount} Backlogs
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Backlog Distribution & Overall Failed Students Table */}
      <div className="space-y-5">
        {/* Backlog Summary Cards */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="col-header text-slate-400">Remedial Load Distribution</div>
              <h3 className="text-base font-bold text-slate-900">Backlog Cohort Breakdown</h3>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <button
                onClick={() => setFilterBacklog('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  filterBacklog === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Failed ({overallFailedStudents.length})
              </button>
              {backlogDistribution.filter((b) => b.backlogCount > 0).map((b) => (
                <button
                  key={b.backlogCount}
                  onClick={() => setFilterBacklog(b.backlogCount)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    filterBacklog === b.backlogCount
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {b.backlogCount} Backlog ({b.studentCount})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {backlogDistribution.map((b) => (
              <div
                key={b.backlogCount}
                className={`p-4 rounded-xl border text-center ${
                  b.backlogCount === 0
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : b.backlogCount === 1
                    ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                    : 'bg-rose-50/60 border-rose-200 text-rose-950'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold block opacity-75">
                  {b.backlogCount === 0 ? '0 Backlogs (Passed)' : `${b.backlogCount} Subject Backlog`}
                </span>
                <p className="text-2xl font-black mt-1">{b.studentCount}</p>
                <p className="text-[11px] font-semibold mt-0.5 opacity-75">{b.percentage}% of Cohort</p>
              </div>
            ))}
          </div>
        </div>

        {/* Overall Failed Students Table (Sorted by Most Subjects Failed First) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="col-header text-slate-400">Arrears Roster</div>
                <h2 className="text-base font-bold text-slate-900">
                  Students with Backlogs ({filteredFailedStudents.length} Students)
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {overallFailedStudents.length > 0 && payload && (
                <button
                  onClick={() => downloadOverallRemedialStudentsPDF(payload)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  title="Download Official Remedial Register PDF with HOD & Coordinator Signatures"
                >
                  <Download className="w-3.5 h-3.5 text-rose-600" />
                  <span>Download Remedial Register (.PDF)</span>
                </button>
              )}
              {overallFailedStudents.length > 0 && (
                <button
                  onClick={() => {
                    if (payload) {
                      exportOverallRemedialStudentsCSV(payload);
                    } else {
                      exportSemesterFailedStudentsCSV(summary);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  title="Download Remedial Students List as CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export Remedial (.CSV)</span>
                </button>
              )}
              <span className="font-mono text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg">
                Evaluated by Sheet Result
              </span>
            </div>
          </div>

          {filteredFailedStudents.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/40 font-mono text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-emerald-950 text-sm">Zero Backlogs in Filter Group</h4>
              <p className="text-xs text-emerald-700 mt-1 font-sans">
                All candidates in this category cleared all semester subjects.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-50/80 text-slate-500 font-mono text-[11px] border-b border-slate-200/80 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-center w-28">Arrears</th>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Failed Subjects & Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredFailedStudents.map((st, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs">
                          {st.failedCount} Sub{st.failedCount > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{st.studentId}</td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900">{st.studentName}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {st.failedSubjects.map((sub, sIdx) => (
                            <div
                              key={sIdx}
                              className="bg-white border border-rose-200 rounded-lg p-2 text-xs space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                                <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px]">
                                  {sub.subjectCode}
                                </span>
                                <span>{sub.totalMarks}/{sub.maxTotal} marks</span>
                              </div>
                              <p className="text-[11px] text-slate-600 font-sans">
                                {sub.reasons.join(', ')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};



