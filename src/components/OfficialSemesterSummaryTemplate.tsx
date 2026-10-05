import React from 'react';
import { Download, Printer, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnalysisPayload, SemesterSummary } from '../types/analyzer';
import {
  downloadVTUSemesterSummaryPDF,
  downloadSemesterSummaryPDF,
  downloadOverallRemedialStudentsPDF,
  getEffectiveBranding,
} from '../utils/pdfExportUtils';
import {
  VTU_OFFICIAL_LOGO_DATAURL,
  IQAC_OFFICIAL_LOGO_DATAURL,
  UBDT_OFFICIAL_LOGO_DATAURL,
} from '../utils/institutionalLogos';

interface OfficialSemesterSummaryTemplateProps {
  payload: AnalysisPayload;
  summary: SemesterSummary;
  onSwitchToAnalytics?: () => void;
}

export const OfficialSemesterSummaryTemplate: React.FC<OfficialSemesterSummaryTemplateProps> = ({
  payload,
  summary,
  onSwitchToAnalytics,
}) => {
  const { config, fileName, subjectsAnalysis } = payload;
  const branding = getEffectiveBranding(payload);
  const semDetails = config?.semesterDetails;

  const semText = semDetails?.semester ? semDetails.semester.toUpperCase() : '4th SEMESTER';
  const examText = semDetails?.examination ? semDetails.examination.toUpperCase() : 'MAY/JUNE-2026';
  const ayText = semDetails?.academicYear || '2025-2026';
  const semTypeText = semDetails?.semType ? semDetails.semType.toUpperCase() : 'EVEN';
  const deptText = branding.departmentName.toUpperCase().startsWith('DEPARTMENT OF')
    ? branding.departmentName.toUpperCase()
    : `DEPARTMENT OF ${branding.departmentName.toUpperCase()}`;

  // Fallback division calculations if not provided directly
  const fcdFallback =
    summary.fcdCount ??
    (summary.overallToppers
      ? summary.overallToppers.filter((t) => t.overallPercentage >= 70 && t.allSubjectsPassed).length
      : 0);
  const fcFallback =
    summary.fcCount ??
    (summary.overallToppers
      ? summary.overallToppers.filter(
          (t) => t.overallPercentage >= 60 && t.overallPercentage < 70 && t.allSubjectsPassed
        ).length
      : 0);
  const scFallback =
    summary.scCount ??
    (summary.overallToppers
      ? summary.overallToppers.filter(
          (t) => t.overallPercentage >= 50 && t.overallPercentage < 60 && t.allSubjectsPassed
        ).length
      : 0);

  const romanNumeralList = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  const handleDownloadOfficialPDF = () => {
    downloadVTUSemesterSummaryPDF(payload);
  };

  const handleDownloadRemedialPDF = () => {
    downloadOverallRemedialStudentsPDF(payload);
  };

  const handleDownloadMasterPDF = () => {
    downloadSemesterSummaryPDF(payload);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Control & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
              Official VTU Institutional Format
            </span>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Exact 2-Page Layout</span>
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {semText} ({semTypeText}) Official Semester Result Analysis Template
          </h2>
          <p className="text-xs text-slate-500">
            Page 1: Subject-Wise Performance Matrix | Page 2: Class Performance & Toppers Details (I–V)
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleDownloadOfficialPDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Download official 2-page landscape PDF report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Official PDF</span>
          </button>

          <button
            onClick={handleDownloadRemedialPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Download Subject-Wise Remedial / Fail Candidates PDF (Single Table)"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Remedial PDF</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Print or Save as PDF in A4 Landscape"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Official Template</span>
          </button>

          <button
            onClick={handleDownloadMasterPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            title="Download full candidate master dossier"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Full Master PDF</span>
          </button>

          {onSwitchToAnalytics && (
            <button
              onClick={onSwitchToAnalytics}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Switch to interactive analytics, charts, and backlog tracker"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Interactive Analytics</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* PAGE 1: MASTER SUBJECT-WISE RESULT ANALYSIS TABLE       */}
      {/* ======================================================== */}
      <div className="bg-white border border-slate-300 shadow-md rounded-xl p-8 sm:p-10 font-serif text-black print:p-0 print:border-none print:shadow-none print:rounded-none page-break-after-always">
        {/* Header Band */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-gray-400">
          <img
            src={branding.collegeLogoUrl || '/images/ubdt_logo.png'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = UBDT_OFFICIAL_LOGO_DATAURL;
            }}
            alt="College Emblem"
            className="w-20 h-20 object-contain shrink-0"
          />
          <div className="text-center flex-1 px-4 space-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-blue-900 uppercase">
              {branding.universityName}
            </h1>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 uppercase">
              {branding.collegeName}
            </h2>
            <p className="text-xs italic text-gray-600">
              (A Constituent College of {branding.universityName} | Recognized by AICTE)
            </p>
            <p className="text-xs sm:text-sm font-bold text-black uppercase tracking-wide pt-0.5">
              {deptText}
            </p>
          </div>
          <img
            src={branding.universityLogoUrl || '/images/vtu_logo.png'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = VTU_OFFICIAL_LOGO_DATAURL;
            }}
            alt="University Logo"
            className="w-20 h-20 object-contain shrink-0"
          />
        </div>

        {/* Subheadings */}
        <div className="text-center my-4 space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-black uppercase">
            RESULT ANALYSIS OF {semText} ( {examText} EXAMINATION)
          </h2>
          <h3 className="text-xs sm:text-sm font-bold text-black uppercase underline decoration-1 underline-offset-2">
            ACADEMIC YEAR – {ayText} ({semTypeText})
          </h3>
        </div>

        {/* 10-Column Result Analysis Table */}
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-black text-xs text-black">
            <thead>
              <tr className="bg-white text-black font-bold text-center border-b border-black">
                <th className="border border-black px-1.5 py-2 w-10">Sl.<br />NO</th>
                <th className="border border-black px-2 py-2 w-24">SUBJECT<br />CODE</th>
                <th className="border border-black px-3 py-2 text-left">SUBJECT NAME</th>
                <th className="border border-black px-2.5 py-2 text-left w-52">FACULTY</th>
                <th className="border border-black px-1.5 py-2 w-12">Sec</th>
                <th className="border border-black px-1.5 py-2 w-16">Total No.<br />Students</th>
                <th className="border border-black px-1.5 py-2 w-16">No. of<br />Absentees</th>
                <th className="border border-black px-1.5 py-2 w-20">No. of Students<br />Passed</th>
                <th className="border border-black px-1.5 py-2 w-20">No. of Students<br />Failed</th>
                <th className="border border-black px-2 py-2 w-20">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {summary.subjectSummaries.map((sub, idx) => {
                const semSections = config?.semesterDetails?.sections?.trim() || 'A&B';
                const cfg = config?.subjectsConfig?.[sub.subjectCode];
                const assignments =
                  cfg?.facultyAssignments && cfg.facultyAssignments.length > 0
                    ? cfg.facultyAssignments
                    : [{ facultyName: sub.facultyName || 'Staff', section: cfg?.section || semSections }];

                const absenteesCount = subjectsAnalysis[sub.subjectCode]?.gradeSummary?.absentCount || 0;
                const span = assignments.length;
                const passedStudentsCount = sub.passedStudentsCount ?? Math.max(0, sub.totalStudents - sub.failCount);

                return assignments.map((assignment, aIdx) => {
                  let sectionText = assignment.section?.trim() || cfg?.section?.trim() || '';
                  if (span <= 1) {
                    if (!sectionText || sectionText.toUpperCase() === 'A' || sectionText.toUpperCase() === 'ALL') {
                      sectionText = semSections;
                    }
                  } else if (!sectionText) {
                    sectionText = aIdx === 0 ? 'A' : aIdx === 1 ? 'B' : String.fromCharCode(65 + aIdx);
                  }

                  return (
                  <tr key={`${sub.subjectCode}-${aIdx}`} className="border-b border-black text-center">
                    {aIdx === 0 && (
                      <>
                        <td
                          rowSpan={span}
                          className="border border-black px-1 py-2 font-mono font-semibold align-middle"
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-2 py-2 font-mono font-bold align-middle"
                        >
                          {sub.displayName || sub.subjectCode}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-3 py-2 text-left font-sans font-semibold align-middle"
                        >
                          {cfg?.courseName || sub.displayName || sub.subjectCode}
                        </td>
                      </>
                    )}
                    <td className="border border-black px-2.5 py-1.5 text-left font-sans text-[11px] align-middle">
                      {assignment.facultyName}
                    </td>
                    <td className="border border-black px-1 py-1.5 font-mono text-[11px] align-middle">
                      {sectionText}
                    </td>
                    {aIdx === 0 && (
                      <>
                        <td
                          rowSpan={span}
                          className="border border-black px-1 py-2 font-mono align-middle"
                        >
                          {sub.totalStudents}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-1 py-2 font-mono align-middle"
                        >
                          {absenteesCount}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-1 py-2 font-mono font-semibold align-middle"
                        >
                          {passedStudentsCount}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-1 py-2 font-mono font-bold text-rose-700 align-middle"
                        >
                          {sub.failCount}
                        </td>
                        <td
                          rowSpan={span}
                          className="border border-black px-2 py-2 font-mono font-bold align-middle"
                        >
                          {sub.passPercentage.toFixed(2)}%
                        </td>
                      </>
                    )}
                  </tr>
                );
              });
            })}
            </tbody>
          </table>
        </div>

        {/* Page 1 Tri-Signatory Line */}
        <div className="pt-16 pb-4 flex items-center justify-between text-xs font-bold text-black">
          <div className="text-left w-1/3">
            <span>Result Analysis Coordinator</span>
          </div>
          <div className="text-center w-1/3">
            <span>Programm Coordinator</span>
          </div>
          <div className="text-right w-1/3">
            <span>Chairperson</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PAGE 2: TOPPERS DETAILS & CLASS PERFORMANCE SUMMARY     */}
      {/* ======================================================== */}
      <div className="bg-white border border-slate-300 shadow-md rounded-xl p-8 sm:p-10 font-serif text-black print:p-0 print:border-none print:shadow-none print:rounded-none">
        {/* Header Band */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-gray-400">
          <img
            src={branding.collegeLogoUrl || '/images/ubdt_logo.png'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = UBDT_OFFICIAL_LOGO_DATAURL;
            }}
            alt="College Emblem"
            className="w-20 h-20 object-contain shrink-0"
          />
          <div className="text-center flex-1 px-4 space-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-blue-900 uppercase">
              {branding.universityName}
            </h1>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 uppercase">
              {branding.collegeName}
            </h2>
            <p className="text-xs italic text-gray-600">
              (A Constituent College of {branding.universityName} | Recognized by AICTE)
            </p>
            <p className="text-xs sm:text-sm font-bold text-black uppercase tracking-wide pt-0.5">
              {deptText}
            </p>
          </div>
          <img
            src={branding.universityLogoUrl || '/images/vtu_logo.png'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = VTU_OFFICIAL_LOGO_DATAURL;
            }}
            alt="University Logo"
            className="w-20 h-20 object-contain shrink-0"
          />
        </div>

        {/* Subheading */}
        <div className="text-center my-4">
          <h2 className="text-base sm:text-lg font-bold text-black">
            Toppers Details
          </h2>
        </div>

        {/* Side-by-Side Dual Analysis Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 items-start">
          {/* Left Table: Overall Class Performance / Result Summary */}
          <div className="lg:col-span-4">
            <table className="w-full border-collapse border border-black text-xs text-black">
              <tbody>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">STRENGTH</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold">
                    {summary.totalUniqueStudents}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">PASSED</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold text-emerald-800">
                    {summary.overallPassCount}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">FCD</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold">
                    {summary.fcdCount ?? fcdFallback}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">FC</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold">
                    {summary.fcCount ?? fcFallback}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">SC</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold">
                    {summary.scCount ?? scFallback}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black px-3 py-2 font-bold bg-gray-50/50">FAIL</td>
                  <td className="border border-black px-3 py-2 text-center font-mono font-bold text-rose-700">
                    {summary.overallFailedStudents.length}
                  </td>
                </tr>
                <tr className="border-b border-black bg-blue-50/20">
                  <td className="border border-black px-3 py-2.5 font-bold">PERCENTAGE OF PASSING</td>
                  <td className="border border-black px-3 py-2.5 text-center font-mono font-bold text-blue-900">
                    {summary.overallPassPercentage.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Table: Toppers Details Table (Ranks I - V+) */}
          <div className="lg:col-span-8 overflow-x-auto">
            <table className="w-full border-collapse border border-black text-xs text-black">
              <thead>
                <tr className="bg-white text-black font-bold text-center border-b border-black">
                  <th className="border border-black px-2 py-2 w-12">Sl. No</th>
                  <th className="border border-black px-3 py-2 w-28">USN</th>
                  <th className="border border-black px-3 py-2 text-left">Name</th>
                  <th className="border border-black px-2 py-2 w-28">Obtained Marks</th>
                  <th className="border border-black px-2 py-2 w-24">Percentage</th>
                  <th className="border border-black px-2 py-2 w-28">Position Obtained</th>
                </tr>
              </thead>
              <tbody>
                {(summary.overallToppers || []).slice(0, 5).map((topper, idx) => (
                  <tr key={topper.studentId} className="border-b border-black text-center">
                    <td className="border border-black px-2 py-2 font-mono">
                      {idx + 1}
                    </td>
                    <td className="border border-black px-3 py-2 font-mono font-bold text-slate-900">
                      {topper.studentId}
                    </td>
                    <td className="border border-black px-3 py-2 text-left font-sans font-semibold uppercase">
                      {topper.studentName}
                    </td>
                    <td className="border border-black px-2 py-2 font-mono font-semibold">
                      {topper.totalMarksObtained} / {topper.maxSemesterMarks}
                    </td>
                    <td className="border border-black px-2 py-2 font-mono font-bold text-blue-900">
                      {topper.overallPercentage.toFixed(2)}%
                    </td>
                    <td className="border border-black px-2 py-2 font-serif font-bold text-amber-900 text-sm">
                      {topper.positionRoman || romanNumeralList[idx] || String(idx + 1)}
                    </td>
                  </tr>
                ))}
                {(!summary.overallToppers || summary.overallToppers.length === 0) && (
                  <tr>
                    <td colSpan={6} className="border border-black p-4 text-center text-gray-500 italic">
                      No candidate topper data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Page 2 Tri-Signatory Line */}
        <div className="pt-16 pb-4 flex items-center justify-between text-xs font-bold text-black">
          <div className="text-left w-1/3">
            <span>Result Analysis Coordinator</span>
          </div>
          <div className="text-center w-1/3">
            <span>Programm Coordinator</span>
          </div>
          <div className="text-right w-1/3">
            <span>Chairperson</span>
          </div>
        </div>
      </div>
    </div>
  );
};
