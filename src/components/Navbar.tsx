import React, { useState } from 'react';
import {
  AlertTriangle,
  Printer,
  ShieldCheck,
  ChevronDown,
  Upload,
  BarChart2,
  Table,
  GraduationCap,
  FileSpreadsheet,
  Download,
  FileText,
  LogOut,
  UserCheck,
  Users,
  Archive,
  Sliders,
  Building2,
  Mail,
} from 'lucide-react';
import { AnalysisPayload } from '../types/analyzer';
import { AuthUser, College, Department } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';
import {
  downloadSemesterSummaryPDF,
  downloadSubjectAnalysisPDF,
  downloadAllOfficialSubjectsPDF,
  downloadOverallRemedialStudentsPDF,
} from '../utils/pdfExportUtils';

interface NavbarProps {
  currentTab: 'upload' | 'subject' | 'summary' | 'print' | 'archive';
  currentSubjectCode: string;
  payload: AnalysisPayload | null;
  user: AuthUser | null;
  college?: College | null;
  department?: Department | null;
  onSwitchDepartment?: () => void;
  onSwitchCollege?: () => void;
  onLogout: () => void;
  onSelectTab: (tab: 'upload' | 'subject' | 'summary' | 'print' | 'archive') => void;
  onNewAnalysis: () => void;
  onSelectSubject: (code: string) => void;
  onOpenWarnings: () => void;
  onOpenTestModal: () => void;
  onOpenSecurityModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  currentSubjectCode,
  payload,
  user,
  college,
  department,
  onSwitchDepartment,
  onSwitchCollege,
  onLogout,
  onSelectTab,
  onNewAnalysis,
  onSelectSubject,
  onOpenWarnings,
  onOpenTestModal,
  onOpenSecurityModal,
}) => {
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const warningsCount = payload?.warnings?.length || 0;
  const subjects = payload?.detectedSubjects || [];

  const handleDownloadSemesterPDF = () => {
    setShowPdfMenu(false);
    if (payload) {
      downloadSemesterSummaryPDF(payload, college, department);
    }
  };

  const handleDownloadAllSubjectsPDF = () => {
    setShowPdfMenu(false);
    if (payload) {
      downloadAllOfficialSubjectsPDF(payload, payload.fileName, college, department);
    }
  };

  const handleDownloadSubjectPDF = (code: string) => {
    setShowPdfMenu(false);
    if (payload && payload.subjectsAnalysis[code]) {
      downloadSubjectAnalysisPDF(payload.subjectsAnalysis[code], payload.config, payload.fileName, college, department);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Dynamic Institutional Logo & Title */}
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => onSelectTab('upload')}>
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                {college?.collegeLogoUrl ? (
                  <img src={college.collegeLogoUrl} alt={college.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 tracking-tight text-xs sm:text-sm truncate max-w-[160px] md:max-w-[220px] lg:max-w-[280px]">
                    {college?.name || 'MarksAnalyzer'}
                  </span>
                </div>
                <div className="text-[11px] text-blue-600 font-semibold truncate max-w-[160px] md:max-w-[220px] lg:max-w-[280px]">
                  {department?.name || user?.department || 'Department Portal'}
                </div>
              </div>
            </div>

            {college?.universityLogoUrl && (
              <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-3 shrink-0" title={`Affiliated / Constituent to: ${college.universityName}`}>
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-1 overflow-hidden shadow-2xs flex items-center justify-center">
                  <img src={college.universityLogoUrl} alt={college.universityName || 'University'} className="w-full h-full object-contain" />
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Affiliated To</div>
                  <div className="text-[11px] font-semibold text-slate-700 truncate max-w-[140px] xl:max-w-[180px]">{college.universityName}</div>
                </div>
              </div>
            )}

            {payload && (
              <div className="hidden 2xl:flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100/80 text-slate-700 text-xs font-mono">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate max-w-[140px] font-medium">{payload.fileName}</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={onNewAnalysis}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                currentTab === 'upload' && !payload
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Start a clean new marksheet analysis (clears previously analyzed data)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>

            {payload && (
              <button
                onClick={() => onSelectTab('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  currentTab === 'upload'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="View and edit configuration for active dataset"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Active Config</span>
              </button>
            )}

            {payload && subjects.length > 0 && (
              <>
                {/* Subject Selector Dropdown */}
                <div className="relative group">
                  <button
                    onClick={() => {
                      if (!subjects.includes(currentSubjectCode) && subjects.length > 0) {
                        onSelectSubject(subjects[0]);
                      }
                      onSelectTab('subject');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      currentTab === 'subject'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Subject: <strong className="font-mono text-slate-900">{currentSubjectCode || subjects[0]}</strong></span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl py-1.5 hidden group-hover:block z-50 shadow-xl">
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Select Subject Code
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {subjects.map((sub) => {
                        const analysis = payload.subjectsAnalysis[sub];
                        const isSelected = currentSubjectCode === sub && currentTab === 'subject';
                        return (
                          <button
                            key={sub}
                            onClick={() => {
                              onSelectSubject(sub);
                              onSelectTab('subject');
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 text-blue-700 font-semibold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <div className="font-mono font-bold text-slate-900">{sub}</div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[130px]">
                                {analysis?.facultyName || 'Unassigned'}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                              {analysis?.gradeSummary.passPercentage}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Semester Summary Tab */}
                <button
                  onClick={() => onSelectTab('summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'summary'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Semester Summary</span>
                </button>
              </>
            )}

            {/* Historical Analysis Retrieval Tab */}
            <button
              onClick={() => onSelectTab('archive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                currentTab === 'archive'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Enter Sem, Academic Year & Exam Cycle to view previously done analysis"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Previous Analysis</span>
            </button>
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* Warnings button */}
            {payload && (
              <button
                onClick={onOpenWarnings}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  warningsCount > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Data Quality & Integrity Warnings"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${warningsCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Warnings</span>
                {warningsCount > 0 && (
                  <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {warningsCount}
                  </span>
                )}
              </button>
            )}

            {/* Security Shield & Encryption Button */}
            <button
              onClick={onOpenSecurityModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-all border border-emerald-300 shadow-xs cursor-pointer"
              title="AES-256 Encrypted Vault & Anti-Scraping Shield Active"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Shield Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>

            {/* Test Suite Runner Button */}
            <button
              onClick={onOpenTestModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-all border border-slate-200 shadow-xs"
              title="Run Automated Backend Test Suite"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Test Suite</span>
            </button>

            {/* PDF Export Dropdown Button */}
            {payload && (
              <div className="relative">
                <button
                  onClick={() => setShowPdfMenu(!showPdfMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
                  title="Download PDF Reports"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download PDF</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {showPdfMenu && (
                  <div
                    className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl py-1.5 shadow-xl z-50 text-xs text-slate-800"
                    onMouseLeave={() => setShowPdfMenu(false)}
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                      <span>Export PDF Reports</span>
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded">PDF</span>
                    </div>

                    {/* Semester Master PDF */}
                    <button
                      onClick={handleDownloadSemesterPDF}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center gap-2.5 text-blue-900 transition-colors border-b border-slate-100"
                    >
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-blue-900">Semester Master Dossier (.PDF)</div>
                        <div className="text-[11px] text-blue-700">Full matrix, overall toppers & backlogs</div>
                      </div>
                    </button>

                    {/* All Subjects Official Analysis PDF */}
                    <button
                      onClick={handleDownloadAllSubjectsPDF}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50/70 flex items-center gap-2.5 text-indigo-900 transition-colors border-b border-slate-100"
                    >
                      <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-indigo-950">All Subjects Official Analysis (.PDF)</div>
                        <div className="text-[11px] text-indigo-700">Official UBDT format for every subject</div>
                      </div>
                    </button>

                    {/* Current Subject PDF */}
                    {currentSubjectCode && payload.subjectsAnalysis[currentSubjectCode] && (
                      <button
                        onClick={() => handleDownloadSubjectPDF(currentSubjectCode)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-800 transition-colors border-b border-slate-100"
                      >
                        <BarChart2 className="w-4 h-4 text-slate-700 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900">
                            Subject Official Analysis ({currentSubjectCode}) (.PDF)
                          </div>
                          <div className="text-[11px] text-slate-500">Official CIE, SEE, Final Marks Analysis</div>
                        </div>
                      </button>
                    )}

                    {/* Overall Remedial Students PDF */}
                    <button
                      onClick={() => {
                        setShowPdfMenu(false);
                        if (payload) downloadOverallRemedialStudentsPDF(payload, college, department);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50/70 flex items-center gap-2.5 text-rose-950 transition-colors border-b border-slate-100 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                          <span>Remedial Students (Overall) (.PDF)</span>
                          <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">HOD Sign</span>
                        </div>
                        <div className="text-[11px] text-rose-700">Official remedial register considering sheet Fail only</div>
                      </div>
                    </button>

                    {/* Print Dialog option */}
                    <button
                      onClick={() => {
                        setShowPdfMenu(false);
                        window.print();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">Native Print (Ctrl+P)</div>
                        <div className="text-[11px] text-slate-500">Open browser print & save as PDF</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Authenticated User Profile & Logout */}
            {user && (
              <div className="relative pl-1 border-l border-slate-200 ml-1">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 pl-2 pr-2.5 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition-all border border-slate-200 text-left cursor-pointer"
                  title={`${college?.name || 'Institutional'} - ${department?.name || 'Department'}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold font-mono">
                    {user.username ? user.username.charAt(0).toUpperCase() : (department?.name ? department.name.charAt(0).toUpperCase() : 'A')}
                  </div>
                  <div className="hidden xl:block">
                    <div className="text-[11px] font-bold text-slate-900 leading-tight flex items-center gap-1">
                      {user.username}
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono truncate max-w-[110px]">
                      {user.email}
                    </div>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-500 opacity-70" />
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl p-2 shadow-xl z-50 text-xs text-slate-800 animate-fadeIn"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold font-mono text-sm">
                          {user.username ? user.username.charAt(0).toUpperCase() : (department?.name ? department.name.charAt(0).toUpperCase() : 'A')}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold text-slate-900 truncate">{user.username}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{user.email}</div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600 space-y-1">
                        <div className="font-semibold text-blue-700 truncate">{department?.name || user.department}</div>
                        <div className="text-slate-400 truncate">{college?.name || user.institution}</div>
                        <div className="pt-1 flex items-center justify-between text-[10px] border-t border-slate-100">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Session:
                          </span>
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Active Session
                          </span>
                        </div>
                      </div>
                    </div>

                    {onSwitchDepartment && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onSwitchDepartment();
                        }}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-xs transition-colors cursor-pointer"
                      >
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Switch Department</span>
                      </button>
                    )}

                    {onSwitchCollege && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onSwitchCollege();
                        }}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-xs transition-colors cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Switch College</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setIsSmtpModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-xs transition-colors cursor-pointer border-t border-slate-100 mt-1"
                    >
                      <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Email & SMTP Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSecurityModal();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 rounded-lg font-semibold text-xs transition-colors cursor-pointer border-t border-slate-100 mt-1"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Security & Encryption Shield</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold text-xs transition-colors cursor-pointer border-t border-slate-100 mt-1"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Sign Out (Lock Department)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SMTP Setup & Live Email Tester Modal */}
      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={user?.email || college?.email}
      />
    </header>
  );
};


