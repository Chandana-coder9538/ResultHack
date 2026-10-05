import React, { useState, useMemo } from 'react';
import { AnalysisPayload, SubjectAnalysis } from '../types/analyzer';
import {
  downloadSemesterSummaryPDF,
  downloadSemesterDossierUptoRemedialPDF,
  downloadAllOfficialSubjectsPDF,
  calculateUBDTOfficialBreakdown,
  generateOfficialUBDTResultChart,
} from '../utils/pdfExportUtils';
import {
  UBDT_OFFICIAL_LOGO_DATAURL,
  VTU_OFFICIAL_LOGO_DATAURL,
} from '../utils/institutionalLogos';
import {
  Printer,
  Download,
  FileText,
  GraduationCap,
  ArrowLeft,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Layers,
  BarChart3,
  Info,
  Award,
  Users,
} from 'lucide-react';
import { College, Department } from '../types/auth';

export interface PrintReportViewProps {
  payload: AnalysisPayload;
  isStandaloneView?: boolean;
  college?: College | null;
  department?: Department | null;
  onClose?: () => void;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  payload,
  isStandaloneView = false,
  college,
  department,
  onClose,
}) => {
  const {
    fileName,
    uploadedAt,
    config,
    subjectsAnalysis,
    semesterSummary,
    detectedSubjects,
  } = payload;

  // Customization Toggles (screen & print)
  const [showCharts, setShowCharts] = useState(true);
  const [showToppers, setShowToppers] = useState(true);
  const [showRemedial, setShowRemedial] = useState(true);
  const [showSubjectPages, setShowSubjectPages] = useState(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Trigger browser-native print
  const handlePrint = () => {
    window.print();
  };

  // Trigger Semester Dossier (Up to Remedial with HOD Signature) PDF download
  const handleExportDossierUptoRemedialPDF = () => {
    setStatusNotice('Generating and downloading Semester Dossier (Up to Remedial) PDF with HOD Signature...');
    try {
      downloadSemesterDossierUptoRemedialPDF(payload, college, department);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err) {
      console.error('Failed to export dossier up to remedial PDF:', err);
      setStatusNotice('Error generating PDF. Please try browser print (Save as PDF).');
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  // Trigger full semester PDF generation via existing jsPDF utility
  const handleExportSemesterPDF = () => {
    setStatusNotice('Generating and downloading Full Semester Master PDF...');
    try {
      downloadSemesterSummaryPDF(payload, college, department);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err) {
      console.error('Failed to export semester PDF:', err);
      setStatusNotice('Error generating PDF. Please try browser print (Save as PDF).');
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  // Trigger all subjects official analysis PDF export
  const handleExportAllSubjectsPDF = () => {
    setStatusNotice('Generating and downloading All Subjects Official PDF...');
    try {
      downloadAllOfficialSubjectsPDF(payload, payload.fileName, college, department);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err) {
      console.error('Failed to export subjects PDF:', err);
      setStatusNotice('Error generating subjects PDF.');
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  // Generate subject result charts safely for print/view
  const subjectChartUrls = useMemo(() => {
    const map: Record<string, string> = {};
    if (typeof document === 'undefined') return map;

    detectedSubjects.forEach((code) => {
      const sub = subjectsAnalysis[code];
      if (sub) {
        try {
          const breakdown = calculateUBDTOfficialBreakdown(sub, config);
          const chartDataUrl = generateOfficialUBDTResultChart(breakdown);
          if (chartDataUrl) {
            map[code] = chartDataUrl;
          }
        } catch (e) {
          console.warn(`Could not generate chart for subject ${code}`, e);
        }
      }
    });
    return map;
  }, [detectedSubjects, subjectsAnalysis, config]);

  // Render spacious, UI-friendly vector chart & clearance metrics for Semester Pass Rate Comparison
  const renderSemesterPassRateChart = () => {
    const subjects = semesterSummary.subjectSummaries;
    if (!subjects || subjects.length === 0) return null;

    const chartWidth = 840;
    const chartHeight = 260;
    const paddingLeft = 52;
    const paddingRight = 24;
    const paddingTop = 32;
    const paddingBottom = 56;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    const barGroupWidth = plotWidth / subjects.length;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.62, 26), 56);

    // Summary Attainment Stats
    const avgPassPct = (
      subjects.reduce((sum, s) => sum + s.passPercentage, 0) / (subjects.length || 1)
    ).toFixed(1);
    const distinctionCount = subjects.filter((s) => s.passPercentage >= 70).length;
    const remedialCount = subjects.filter((s) => s.passPercentage < 40).length;

    return (
      <div className="page-break-inside-avoid print-avoid-break border border-slate-300 print:border-black p-5 sm:p-6 bg-white space-y-5">
        {/* Executive Header & Benchmark Legend */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <BarChart3 className="w-4 h-4 shrink-0" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Subject Clearance & Pass Rate Attainment Analysis
              </h3>
              <span className="hidden sm:inline-flex text-[11px] font-semibold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Avg: {avgPassPct}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Course-wise clearance benchmarks against VTU 40% academic pass cutoff and 70% First Class with Distinction standards.
            </p>
          </div>

          {/* Attainment Legend Pills */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>≥70% Distinction ({distinctionCount})</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>60–69% First Class</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
              <span>40–59% Second/Pass</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>&lt;40% Remedial ({remedialCount})</span>
            </span>
          </div>
        </div>

        {/* High-Resolution SVG Vector Comparison Chart */}
        <div className="w-full overflow-x-auto bg-slate-50/50 p-2 sm:p-3 border border-slate-200 rounded-xl print:bg-white print:border-gray-300">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-h-[220px] max-h-[270px]"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Gridlines */}
            {[0, 20, 40, 60, 80, 100].map((pct) => {
              const y = paddingTop + plotHeight - (pct / 100) * plotHeight;
              return (
                <g key={pct}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke={pct === 0 ? '#94a3b8' : '#e2e8f0'}
                    strokeWidth={pct === 0 ? 1.4 : 0.7}
                    strokeDasharray={pct === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fill="#64748b"
                    fontFamily="monospace"
                    fontWeight="500"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Benchmark Cutoff Line: 40% Passing */}
            {(() => {
              const y40 = paddingTop + plotHeight - (40 / 100) * plotHeight;
              return (
                <g>
                  <line
                    x1={paddingLeft}
                    y1={y40}
                    x2={chartWidth - paddingRight}
                    y2={y40}
                    stroke="#e11d48"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <rect
                    x={chartWidth - paddingRight - 118}
                    y={y40 - 14}
                    width="116"
                    height="12"
                    rx="2"
                    fill="#ffe4e6"
                    stroke="#fecdd3"
                    strokeWidth="0.5"
                  />
                  <text
                    x={chartWidth - paddingRight - 60}
                    y={y40 - 5}
                    textAnchor="middle"
                    fontSize="7.5"
                    fill="#be123c"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    40% Minimum Passing Cutoff
                  </text>
                </g>
              );
            })()}

            {/* Benchmark Cutoff Line: 70% Distinction */}
            {(() => {
              const y70 = paddingTop + plotHeight - (70 / 100) * plotHeight;
              return (
                <g>
                  <line
                    x1={paddingLeft}
                    y1={y70}
                    x2={chartWidth - paddingRight}
                    y2={y70}
                    stroke="#059669"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <rect
                    x={chartWidth - paddingRight - 128}
                    y={y70 - 14}
                    width="126"
                    height="12"
                    rx="2"
                    fill="#d1fae5"
                    stroke="#a7f3d0"
                    strokeWidth="0.5"
                  />
                  <text
                    x={chartWidth - paddingRight - 65}
                    y={y70 - 5}
                    textAnchor="middle"
                    fontSize="7.5"
                    fill="#047857"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    70% Distinction (FCD) Benchmark
                  </text>
                </g>
              );
            })()}

            {/* Subject Bars */}
            {subjects.map((sub, i) => {
              const xCenter = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
              const x = xCenter - barWidth / 2;
              const barH = Math.max((sub.passPercentage / 100) * plotHeight, 4);
              const y = paddingTop + plotHeight - barH;

              let fillColor = '#2563eb';
              if (sub.passPercentage >= 70) fillColor = '#10b981';
              else if (sub.passPercentage >= 60) fillColor = '#2563eb';
              else if (sub.passPercentage >= 40) fillColor = '#f59e0b';
              else fillColor = '#e11d48';

              const passedCount = sub.totalStudents - sub.failCount;

              return (
                <g key={sub.subjectCode}>
                  {/* Bar with subtle top rounded corners */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx="3"
                    ry="3"
                    fill={fillColor}
                  />

                  {/* Percentage Value on top */}
                  <text
                    x={xCenter}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="bold"
                    fill="#0f172a"
                    fontFamily="monospace"
                  >
                    {sub.passPercentage}%
                  </text>

                  {/* Subject Code beneath baseline */}
                  <text
                    x={xCenter}
                    y={paddingTop + plotHeight + 16}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="bold"
                    fill="#0f172a"
                    fontFamily="monospace"
                  >
                    {sub.subjectCode}
                  </text>

                  {/* Enrolled & Pass count */}
                  <text
                    x={xCenter}
                    y={paddingTop + plotHeight + 28}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="#475569"
                    fontWeight="500"
                  >
                    {passedCount} / {sub.totalStudents} passed
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Spacious, Non-Compact Subject Clearance Breakdown Cards Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Detailed Subject Clearance Attainment Profiles</span>
            <span>{subjects.length} Evaluated Courses</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {subjects.map((sub) => {
              const passedStudents = sub.totalStudents - sub.failCount;
              const isDistinction = sub.passPercentage >= 70;
              const isFirstClass = sub.passPercentage >= 60 && sub.passPercentage < 70;
              const isSecondOrPass = sub.passPercentage >= 40 && sub.passPercentage < 60;
              const isRemedial = sub.passPercentage < 40;

              let badgeText = 'Pass Class (40–49%)';
              let badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
              let barColor = 'bg-slate-500';

              if (isDistinction) {
                badgeText = 'Distinction (≥70%)';
                badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                barColor = 'bg-emerald-500';
              } else if (isFirstClass) {
                badgeText = 'First Class (60–69%)';
                badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                barColor = 'bg-blue-600';
              } else if (isSecondOrPass) {
                badgeText = sub.passPercentage >= 50 ? 'Second Class (50–59%)' : 'Pass Class (40–49%)';
                badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                barColor = 'bg-amber-500';
              } else if (isRemedial) {
                badgeText = 'Remedial Support (<40%)';
                badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
                barColor = 'bg-rose-600';
              }

              return (
                <div
                  key={sub.subjectCode}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-white transition-all space-y-3 print:border-gray-300 print:bg-white"
                >
                  {/* Card Header: Subject Code, Name, and Pass Rate Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {sub.subjectCode}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 line-clamp-1">
                        {sub.displayName || sub.subjectName || sub.subjectCode}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Faculty: <strong className="text-slate-700">{sub.facultyName || 'Unassigned'}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold font-mono text-slate-900">
                        {sub.passPercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">Clearance Rate</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(0, sub.passPercentage))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 3 Metrics: Enrolled, Passed, Arrears */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/70 text-center text-xs">
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200/70">
                      <span className="text-[10px] uppercase text-slate-500 block">Enrolled</span>
                      <strong className="text-xs font-mono text-slate-900">{sub.totalStudents}</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200/70">
                      <span className="text-[10px] uppercase text-slate-500 block">Passed</span>
                      <strong className="text-xs font-mono text-emerald-700">{passedStudents}</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200/70">
                      <span className="text-[10px] uppercase text-slate-500 block">Arrears</span>
                      <strong className={`text-xs font-mono ${sub.failCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {sub.failCount}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const formattedDate = new Date(uploadedAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={
        isStandaloneView
          ? 'min-h-screen bg-slate-100 py-6 px-4 sm:px-6 lg:px-8 print:p-0 print:m-0 print:bg-white text-slate-900 font-sans'
          : 'hidden print:block p-0 bg-white text-black font-sans'
      }
    >
      {/* 1. TOP INTERACTIVE TOOLBAR & ACTIONS (Hidden in Native Print) */}
      {isStandaloneView && (
        <div className="max-w-5xl mx-auto mb-6 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs print:hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                  title="Return to Semester Summary"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900">
                    Semester Marks Analysis — Print & PDF Export Hub
                  </h1>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    A4 Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institutional layout with auto-pagination, embedded logos, vector charts, and official endorsement signatures.
                </p>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={handleExportDossierUptoRemedialPDF}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-emerald-500/20 transition-all cursor-pointer"
                title="Download Semester Dossier PDF containing data up to Remedial with HOD of the Department Signature"
              >
                <Download className="w-4 h-4 text-emerald-100" />
                <span>Download Dossier (Up to Remedial)</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
                title="Trigger browser print (Ctrl + P / Cmd + P) to Print or Save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report (Ctrl+P)</span>
              </button>

              <button
                onClick={handleExportSemesterPDF}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Download consolidated semester master dossier PDF"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Export Master PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>

              <button
                onClick={handleExportAllSubjectsPDF}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                title="Download official multi-page PDF analysis for all subjects"
              >
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span className="hidden md:inline">All Subjects PDF</span>
              </button>
            </div>
          </div>

          {/* Customization Options Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Report View Mode:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowSubjectPages(false)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    !showSubjectPages
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show only the Semester Dossier up to Remedial & Signatures"
                >
                  Dossier Only (Up to Remedial)
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubjectPages(true)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    showSubjectPages
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show Semester Dossier plus all individual subject analysis pages"
                >
                  Complete (All Subject Pages)
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCharts}
                  onChange={(e) => setShowCharts(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Analytical Charts</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showToppers}
                  onChange={(e) => setShowToppers(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Top 5 Ranks</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRemedial}
                  onChange={(e) => setShowRemedial(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Remedial List</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSubjectPages}
                  onChange={(e) => setShowSubjectPages(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Per-Subject Detailed Pages ({detectedSubjects.length})</span>
              </label>
            </div>
          </div>

          {/* Quick Notice or Toast */}
          {statusNotice && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}

          {/* Helpful Print Dialog Instructions */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Print & Save as PDF Tips:</strong> In your browser print dialog, select <strong>&quot;Save as PDF&quot;</strong> or your destination printer. Ensure <strong>Paper size</strong> is set to <strong>A4</strong>, and check <strong>&quot;Background graphics&quot;</strong> under More settings so table fills, badges, and college emblem graphics print clearly.
            </div>
          </div>
        </div>
      )}

      {/* 2. PRINTABLE DOCUMENT SHEET CONTAINER */}
      <div
        className={
          isStandaloneView
            ? 'max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 sm:p-10 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:rounded-none space-y-6 text-black'
            : 'p-8 print:p-0 bg-white text-black space-y-6'
        }
      >
        {/* Cover / Header */}
        <div className="border-b-2 border-black pb-4 flex items-center justify-between gap-4 page-break-inside-avoid print-avoid-break">
          <img
            src={college?.collegeLogoUrl || UBDT_OFFICIAL_LOGO_DATAURL}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = UBDT_OFFICIAL_LOGO_DATAURL;
            }}
            alt="College Emblem"
            className="w-16 h-16 object-contain shrink-0"
          />
          <div className="text-center space-y-0.5 flex-1">
            <h1 className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900">
              {college?.name || config?.semesterDetails?.college || 'College of Engineering'}
            </h1>
            <p className="text-xs text-gray-700">
              {college?.universityName ? `(Affiliated to / Constituent of ${college.universityName})` : (config?.semesterDetails?.university ? `(${config.semesterDetails.university})` : '')}
            </p>
            <p className="text-xs font-semibold text-gray-800">
              {department?.name || config?.semesterDetails?.department || config?.semesterDetails?.branch || 'Academic Department'}
            </p>
            <h2 className="text-sm font-bold uppercase tracking-wider mt-1 text-slate-900">
              {config?.semesterDetails?.semester || 'Semester'} ({config?.semesterDetails?.semType || 'Examination'}) Marks Analysis & Performance Report
            </h2>
            <p className="text-[11px] text-gray-700 font-medium">
              Examination: <strong>{config?.semesterDetails?.examination || 'Academic Session'}</strong> | Academic Year: <strong>{config?.semesterDetails?.academicYear || '2025 - 2026'}</strong>
            </p>
            <p className="text-[11px] text-gray-600 font-mono">
              Source: {fileName} | Generated: {formattedDate} | Cohort: {semesterSummary.totalUniqueStudents} Students | Pass: {semesterSummary.overallPassPercentage}%
            </p>
          </div>
          <img
            src={college?.universityLogoUrl || VTU_OFFICIAL_LOGO_DATAURL}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = VTU_OFFICIAL_LOGO_DATAURL;
            }}
            alt="University Emblem"
            className="w-16 h-16 object-contain shrink-0"
          />
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs page-break-inside-avoid print-avoid-break font-mono">
          <div className="border border-gray-300 p-2 text-center rounded">
            <span className="text-[10px] uppercase text-gray-500 block">Total Cohort</span>
            <strong className="text-base text-black">{semesterSummary.totalUniqueStudents}</strong>
            <span className="text-[10px] text-gray-600 block">Students</span>
          </div>
          <div className="border border-gray-300 p-2 text-center rounded">
            <span className="text-[10px] uppercase text-gray-500 block">Cleared All</span>
            <strong className="text-base text-emerald-700">{semesterSummary.overallPassCount}</strong>
            <span className="text-[10px] text-emerald-600 block">Clear Pass</span>
          </div>
          <div className="border border-gray-300 p-2 text-center rounded">
            <span className="text-[10px] uppercase text-gray-500 block">Semester Pass Rate</span>
            <strong className="text-base text-blue-700">{semesterSummary.overallPassPercentage}%</strong>
            <span className="text-[10px] text-blue-600 block">Overall</span>
          </div>
          <div className="border border-gray-300 p-2 text-center rounded">
            <span className="text-[10px] uppercase text-gray-500 block">Arrears / Backlogs</span>
            <strong className="text-base text-rose-700">{semesterSummary.overallFailedStudents.length}</strong>
            <span className="text-[10px] text-rose-600 block">Remedial Needs</span>
          </div>
          <div className="border border-gray-300 p-2 text-center rounded col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase text-gray-500 block">Evaluated</span>
            <strong className="text-base text-black">{semesterSummary.totalSubjects}</strong>
            <span className="text-[10px] text-gray-600 block">Modules</span>
          </div>
        </div>

        {/* Grading Bands Legend */}
        <div className="border border-gray-300 p-2.5 text-xs space-y-1 page-break-inside-avoid print-avoid-break bg-gray-50/50">
          <span className="font-bold uppercase text-slate-800">Grading Criteria Legend:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
            <span>FCD (Distinction): ≥ {config.gradingBands.fcdMin}%</span>
            <span>First Class (FC): ≥ {config.gradingBands.fcMin}%</span>
            <span>Second Class (SC): ≥ {config.gradingBands.scMin}%</span>
            <span>Pass Class: ≥ {config.gradingBands.passMin}%</span>
          </div>
        </div>

        {/* Semester Pass Rate Comparison Chart (Scaled for A4 Page 1) */}
        {showCharts && (
          <div className="page-break-inside-avoid print-avoid-break space-y-1">
            {renderSemesterPassRateChart()}
          </div>
        )}

        {/* 1. Subject-Wise Consolidated Matrix Table */}
        <div className="space-y-2 page-break-inside-avoid print-avoid-break">
          <div className="flex items-center justify-between border-b-2 border-black pb-1">
            <h2 className="text-sm sm:text-base font-bold uppercase">
              1. Subject-Wise Consolidated Matrix
            </h2>
            <span className="text-xs text-gray-600 font-mono">
              {semesterSummary.totalSubjects} Total Modules Evaluated
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-gray-300">
              <thead className="bg-gray-100 font-bold border-b border-gray-300 text-slate-900">
                <tr className="page-break-inside-avoid print-avoid-break">
                  <th className="p-2 border">Subject</th>
                  <th className="p-2 border">Faculty In-Charge</th>
                  <th className="p-2 border text-center">FCD</th>
                  <th className="p-2 border text-center">FC</th>
                  <th className="p-2 border text-center">SC</th>
                  <th className="p-2 border text-center">Pass</th>
                  <th className="p-2 border text-center font-bold">Fail</th>
                  <th className="p-2 border text-center">Enrolled</th>
                  <th className="p-2 border text-center font-bold">Pass %</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {semesterSummary.subjectSummaries.map((sub, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50 page-break-inside-avoid print-avoid-break">
                    <td className="p-2 border font-bold text-slate-900">{sub.subjectCode}</td>
                    <td className="p-2 border font-sans">{sub.facultyName || 'Unassigned'}</td>
                    <td className="p-2 border text-center text-emerald-800 font-semibold">{sub.fcdCount}</td>
                    <td className="p-2 border text-center">{sub.fcCount}</td>
                    <td className="p-2 border text-center">{sub.scCount}</td>
                    <td className="p-2 border text-center">{sub.passCount}</td>
                    <td className="p-2 border text-center font-bold text-red-700">{sub.failCount}</td>
                    <td className="p-2 border text-center">{sub.totalStudents}</td>
                    <td className="p-2 border text-center font-bold text-blue-900">{sub.passPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Overall Semester Toppers (Top 5 Ranks by Total Marks Summed) */}
        {showToppers && semesterSummary.overallToppers.length > 0 && (
          <div className="space-y-2 page-break-inside-avoid print-avoid-break pt-2">
            <div className="flex items-center justify-between border-b-2 border-black pb-1">
              <h2 className="text-sm sm:text-base font-bold uppercase">
                2. Overall Semester Toppers (Top 5 Ranks by Aggregate Marks)
              </h2>
              <span className="text-xs text-gray-600 font-mono">Academic Distinction Ranks</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-300">
                <thead className="bg-gray-100 font-bold border-b border-gray-300 text-slate-900">
                  <tr className="page-break-inside-avoid print-avoid-break">
                    <th className="p-2 border text-center w-12">Rank</th>
                    <th className="p-2 border">Student USN</th>
                    <th className="p-2 border">Student Name</th>
                    <th className="p-2 border text-center">Aggregate Marks</th>
                    <th className="p-2 border text-center font-bold">Percentage</th>
                    <th className="p-2 border text-center">Result Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {semesterSummary.overallToppers.map((st, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50 page-break-inside-avoid print-avoid-break">
                      <td className="p-2 border text-center font-bold">
                        #{st.rank}
                        {st.isTied ? ' (T)' : ''}
                      </td>
                      <td className="p-2 border font-bold text-slate-900">{st.studentId}</td>
                      <td className="p-2 border font-sans font-bold">{st.studentName}</td>
                      <td className="p-2 border text-center font-bold">
                        {st.totalMarksObtained} / {st.maxSemesterMarks}
                      </td>
                      <td className="p-2 border text-center font-bold text-blue-900">
                        {st.overallPercentage}%
                      </td>
                      <td className="p-2 border text-center font-sans font-semibold text-emerald-800">
                        {st.allSubjectsPassed ? 'Passed All' : `${st.failedSubjectsCount} Failed`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Remedial & Backlogs Section */}
        {showRemedial && (
          <div className="space-y-2 page-break-inside-avoid print-avoid-break pt-2">
            <div className="flex items-center justify-between border-b-2 border-red-700 pb-1 text-red-900">
              <h2 className="text-sm sm:text-base font-bold uppercase">
                3. Remedial / Backlog Candidates ({semesterSummary.overallFailedStudents.length} Students)
              </h2>
              <span className="text-xs text-red-700 font-mono">
                {semesterSummary.overallFailedStudents.length > 0
                  ? 'Requires Academic Attention'
                  : 'Zero Backlogs / 100% Clearance'}
              </span>
            </div>

            {semesterSummary.overallFailedStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-red-200">
                  <thead className="bg-red-50 font-bold border-b border-red-200 text-red-900">
                    <tr className="page-break-inside-avoid print-avoid-break">
                      <th className="p-2 border border-red-200 text-center w-12">Sl.</th>
                      <th className="p-2 border border-red-200">Student USN</th>
                      <th className="p-2 border border-red-200">Student Name</th>
                      <th className="p-2 border border-red-200 text-center">Backlogs</th>
                      <th className="p-2 border border-red-200">Failed Subject Code(s)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {semesterSummary.overallFailedStudents.map((st, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-red-100 hover:bg-red-50/50 page-break-inside-avoid print-avoid-break"
                      >
                        <td className="p-2 border border-red-200 text-center">{idx + 1}</td>
                        <td className="p-2 border border-red-200 font-bold text-slate-900">
                          {st.studentId}
                        </td>
                        <td className="p-2 border border-red-200 font-sans font-bold">
                          {st.studentName}
                        </td>
                        <td className="p-2 border border-red-200 text-center font-bold text-red-700">
                          {st.failedCount} / {st.totalSubjects}
                        </td>
                        <td className="p-2 border border-red-200 font-bold text-red-800">
                          {st.failedSubjects.map((s) => s.subjectCode).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    Nil Remedial Backlogs: All enrolled candidates have satisfied VTU passing requirements for all semester subjects.
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-800 text-xs">100% Cohort Clearance</span>
              </div>
            )}
          </div>
        )}

        {/* OFFICIAL INSTITUTIONAL ENDORSEMENT SIGNATURE BLOCK (Placed directly after Remedial details) */}
        <div className="pt-8 pb-4 page-break-inside-avoid print-avoid-break">
          <div className="border-t-2 border-black pt-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-6 text-center print:text-black">
              Official Institutional Endorsement & Result Verification
            </p>
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="space-y-1">
                <div className="h-16 flex items-end justify-center">
                  <div className="w-44 border-b border-black"></div>
                </div>
                <p className="font-bold text-slate-900">Result Analysis Coordinator</p>
                <p className="text-[11px] text-slate-600">
                  {department?.name
                    ? (department.name.toLowerCase().startsWith('department of') ? department.name : `Dept. of ${department.name}`)
                    : (config?.semesterDetails?.department || config?.semesterDetails?.branch || 'Academic Department')}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">Date: ________________</p>
              </div>

              <div className="space-y-1">
                <div className="h-16 flex items-end justify-center">
                  <div className="w-52 border-b-2 border-black"></div>
                </div>
                <p className="font-bold text-slate-900 text-sm">Signature of HOD of the Department</p>
                <p className="text-[11px] font-bold text-slate-700">
                  Head of Department ({department?.code || (department?.name ? department.name.replace(/^department of\s*/i, '') : 'Department')})
                </p>
                <p className="text-[10px] text-slate-500">
                  {college?.name || config?.semesterDetails?.college || 'College of Engineering'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="h-16 flex items-end justify-center">
                  <div className="w-44 border-b border-black"></div>
                </div>
                <p className="font-bold text-slate-900">Principal / Dean Academic</p>
                <p className="text-[11px] text-slate-600">
                  {college?.name || config?.semesterDetails?.college || 'College of Engineering'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">Official Seal & Impression</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. PER-SUBJECT DETAILED PAGES (Each forced to a fresh A4 sheet) */}
        {showSubjectPages &&
          detectedSubjects.map((subCode) => {
            const sub = subjectsAnalysis[subCode];
            if (!sub) return null;
            const chartDataUrl = subjectChartUrls[subCode];
            const breakdown = calculateUBDTOfficialBreakdown(sub, config);

            return (
              <div
                key={subCode}
                className="print-page-break-before break-before-page pt-6 space-y-4 text-black"
              >
                {/* Subject Header Banner */}
                <div className="border-b-2 border-black pb-2 flex justify-between items-end gap-4 page-break-inside-avoid print-avoid-break">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 bg-gray-100 text-gray-800 border border-gray-300 rounded">
                      Detailed Subject Report
                    </span>
                    <h3 className="text-lg font-bold uppercase mt-1 text-slate-900">
                      {subCode} — {sub.subjectName || 'Course Performance Analysis'}
                    </h3>
                    <p className="text-xs text-gray-700 mt-0.5">
                      Faculty In-Charge: <strong>{sub.facultyName || 'Unassigned'}</strong> | Scheme Maximum: {sub.maxTotal} (Internal CIE: {sub.maxInternal}, External SEE: {sub.maxExternal})
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono shrink-0">
                    <p className="font-bold text-blue-900 text-sm">Pass Rate: {sub.gradeSummary.passPercentage}%</p>
                    <p className="text-gray-600">
                      Enrolled: {sub.gradeSummary.totalStudents} | Passed: {sub.gradeSummary.totalStudents - sub.gradeSummary.failCount}
                    </p>
                  </div>
                </div>

                {/* Subject Result Analysis Chart (CIE, SEE and Final Marks in %) */}
                {showCharts && chartDataUrl && (
                  <div className="page-break-inside-avoid print-avoid-break border border-black p-2 bg-white space-y-1">
                    <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide px-1">
                      Official UBDT Result Analysis Chart (CIE, SEE and Final Marks in %)
                    </div>
                    <img
                      src={chartDataUrl}
                      alt={`${subCode} Result Analysis Chart`}
                      className="w-full max-h-48 object-contain mx-auto"
                    />
                  </div>
                )}

                {/* Official UBDT Grade Distribution Table */}
                <div className="page-break-inside-avoid print-avoid-break space-y-2 mt-4">
                  <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wide">
                    Grade Distribution Analysis (CIE vs SEE vs Final)
                  </h4>
                  <table className="w-full text-left text-xs border border-gray-300 font-mono">
                    <thead className="bg-slate-100 font-bold border-b border-gray-300 text-slate-900">
                      <tr>
                        <th className="p-2 border">Evaluation Category</th>
                        <th className="p-2 border text-center">FCD (≥70%)</th>
                        <th className="p-2 border text-center">FC (60–69%)</th>
                        <th className="p-2 border text-center">SC (50–59%)</th>
                        <th className="p-2 border text-center">Pass (40–49%)</th>
                        <th className="p-2 border text-center font-bold">Fail (&lt;40%)</th>
                        <th className="p-2 border text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 border font-bold text-slate-800">Internal (CIE)</td>
                        <td className="p-2 border text-center">{breakdown.intFCD} ({breakdown.intFCDPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.intFC} ({breakdown.intFCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.intSC} ({breakdown.intSCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.intPass} ({breakdown.intPassPct}%)</td>
                        <td className="p-2 border text-center font-bold text-red-700">{breakdown.intFail} ({breakdown.intFailPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totalStudents}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 border font-bold text-slate-800">External (SEE)</td>
                        <td className="p-2 border text-center">{breakdown.extFCD} ({breakdown.extFCDPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.extFC} ({breakdown.extFCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.extSC} ({breakdown.extSCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.extPass} ({breakdown.extPassPct}%)</td>
                        <td className="p-2 border text-center font-bold text-red-700">{breakdown.extFail} ({breakdown.extFailPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totalStudents}</td>
                      </tr>
                      <tr className="border-b bg-indigo-50/50 font-bold">
                        <td className="p-2 border text-slate-900">Final Total Marks</td>
                        <td className="p-2 border text-center text-emerald-800">{breakdown.totFCD} ({breakdown.totFCDPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totFC} ({breakdown.totFCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totSC} ({breakdown.totSCPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totPass} ({breakdown.totPassPct}%)</td>
                        <td className="p-2 border text-center text-red-800">{breakdown.totFail} ({breakdown.totFailPct}%)</td>
                        <td className="p-2 border text-center">{breakdown.totalStudents}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Top 5 in Subject */}
                {showToppers && sub.top5Students.length > 0 && (
                  <div className="page-break-inside-avoid print-avoid-break space-y-2 mt-5">
                    <h4 className="text-xs font-bold uppercase text-gray-800">
                      Subject Top 5 Rank List
                    </h4>
                    <table className="w-full text-left text-xs border border-gray-300 font-mono table-fixed border-collapse">
                      <thead className="bg-gray-100 font-bold border-b border-gray-300 text-slate-900">
                        <tr>
                          <th className="p-2 border border-gray-300 text-center w-14">Rank</th>
                          <th className="p-2 border border-gray-300 w-32">Student USN</th>
                          <th className="p-2 border border-gray-300">Student Name</th>
                          <th className="p-2 border border-gray-300 text-center w-16">Internal</th>
                          <th className="p-2 border border-gray-300 text-center w-16">External</th>
                          <th className="p-2 border border-gray-300 text-center font-bold w-16">Total</th>
                          <th className="p-2 border border-gray-300 text-center w-14">%</th>
                          <th className="p-2 border border-gray-300 text-center w-20">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.top5Students.map((st, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 border border-gray-300 text-center font-bold w-14">
                              #{st.rank}
                              {st.isTied ? ' (T)' : ''}
                            </td>
                            <td className="p-2 border border-gray-300 font-bold text-slate-900 w-32">{st.studentId}</td>
                            <td className="p-2 border border-gray-300 font-sans font-bold">{st.studentName}</td>
                            <td className="p-2 border border-gray-300 text-center w-16">{st.internalMarks}</td>
                            <td className="p-2 border border-gray-300 text-center w-16">{st.externalMarks}</td>
                            <td className="p-2 border border-gray-300 text-center font-bold text-blue-900 w-16">{st.totalMarks}</td>
                            <td className="p-2 border border-gray-300 text-center w-14">{st.percentage}%</td>
                            <td className="p-2 border border-gray-300 text-center font-bold text-emerald-800 w-20">{st.gradeBand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Failed Students in Subject */}
                {showRemedial && sub.failedStudents.length > 0 && (
                  <div className="page-break-inside-avoid print-avoid-break space-y-2 mt-5">
                    <h4 className="text-xs font-bold uppercase text-red-800">
                      Failed Students in {subCode} ({sub.failedStudents.length} Students)
                    </h4>
                    <table className="w-full text-left text-xs border border-red-300 font-mono table-fixed border-collapse">
                      <thead className="bg-red-50 font-bold border-b border-red-300 text-red-900">
                        <tr>
                          <th className="p-2 border border-red-300 text-center w-14">Sl.</th>
                          <th className="p-2 border border-red-300 w-32">Student USN</th>
                          <th className="p-2 border border-red-300">Student Name</th>
                          <th className="p-2 border border-red-300 text-center w-16">Internal</th>
                          <th className="p-2 border border-red-300 text-center w-16">External</th>
                          <th className="p-2 border border-red-300 text-center font-bold w-16">Total</th>
                          <th className="p-2 border border-red-300 text-center font-bold w-14">%</th>
                          <th className="p-2 border border-red-300 text-center font-bold w-20">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.failedStudents.map((st, idx) => (
                          <tr key={idx} className="hover:bg-red-50/50">
                            <td className="p-2 border border-red-300 text-center font-bold text-red-700 w-14">
                              {idx + 1}
                            </td>
                            <td className="p-2 border border-red-300 font-bold text-slate-900 w-32">{st.studentId}</td>
                            <td className="p-2 border border-red-300 font-sans font-bold">{st.studentName}</td>
                            <td className="p-2 border border-red-300 text-center w-16">{st.internalMarks}</td>
                            <td className="p-2 border border-red-300 text-center w-16">{st.externalMarks}</td>
                            <td className="p-2 border border-red-300 text-center font-bold text-red-700 w-16">{st.totalMarks}</td>
                            <td className="p-2 border border-red-300 text-center font-bold text-red-700 w-14">{st.percentage}%</td>
                            <td className="p-2 border border-red-300 text-center font-bold text-red-700 w-20">
                              Fail
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Institutional Endorsement Signatures Block */}
                <div className="page-break-inside-avoid print-avoid-break pt-8 mt-6">
                  <div className="grid grid-cols-3 gap-8 text-center text-xs border-t border-dashed border-gray-400 pt-3">
                    <div>
                      <div className="h-10"></div>
                      <p className="font-bold border-t border-gray-400 pt-1 text-gray-900">
                        Signature of Faculty In-Charge
                      </p>
                      <p className="text-[10px] text-gray-500">{sub.facultyName || 'Course Instructor'}</p>
                    </div>
                    <div>
                      <div className="h-10"></div>
                      <p className="font-bold border-t border-gray-400 pt-1 text-gray-900">
                        Signature of HOD
                      </p>
                      <p className="text-[10px] text-gray-500">Department of Studies in CSE</p>
                    </div>
                    <div>
                      <div className="h-10"></div>
                      <p className="font-bold border-t border-gray-400 pt-1 text-gray-900">
                        Principal / Dean Academic
                      </p>
                      <p className="text-[10px] text-gray-500">UBDT College of Engineering</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
