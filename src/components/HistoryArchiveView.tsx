import React, { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  RefreshCw,
  GraduationCap,
  ShieldCheck,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Clock,
  Lock,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { UploadHistoryItem, AnalysisPayload } from '../types/analyzer';
import { College, Department } from '../types/auth';

interface HistoryArchiveViewProps {
  token: string | null;
  onSelectAnalysis?: (payload: AnalysisPayload) => void;
  onLoadSession?: (session: any) => void;
  activeUploadId?: string;
  collegeId?: string;
  departmentId?: string;
  department?: Department | null;
  college?: College | null;
  onNavigateUpload?: () => void;
  onSessionDeleted?: (deletedId: string) => void;
  watermarkEnabled?: boolean;
}

const COMMON_SEMESTERS = [
  '1st Sem',
  '2nd Sem',
  '3rd Sem',
  '4th Sem',
  '5th Sem',
  '6th Sem',
  '7th Sem',
  '8th Sem',
];

const COMMON_YEARS = [
  '2025-26',
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
];

const COMMON_SCHEMES = [
  '2022',
  '2021',
  '2018',
  '2017',
];

export const HistoryArchiveView: React.FC<HistoryArchiveViewProps> = ({
  token,
  onSelectAnalysis,
  onLoadSession,
  onNavigateUpload,
  onSessionDeleted,
  collegeId,
  departmentId,
  department,
  college,
}) => {
  // Controlled inputs for the Analyzer to enter: Sem, Academic Year, and Scheme
  const [inputSemester, setInputSemester] = useState<string>('4th Sem');
  const [inputAcademicYear, setInputAcademicYear] = useState<string>('2025-26');
  const [inputScheme, setInputScheme] = useState<string>('2022');

  // Selected Exam Cycle state
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Background fetch of available history
  const [allHistoryItems, setAllHistoryItems] = useState<UploadHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Action loading states
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [activeActionType, setActiveActionType] = useState<'view' | 'pdf' | 'excel' | 'delete' | null>(null);

  // Delete Confirmation Modal State (Asking once again before deleting)
  const [itemToDelete, setItemToDelete] = useState<UploadHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch available history records from database (strictly filtered for this department of the college)
  const fetchAvailableRecords = async () => {
    setHistoryLoading(true);
    try {
      const q = new URLSearchParams();
      if (collegeId) q.set('collegeId', collegeId);
      if (departmentId) q.set('departmentId', departmentId);
      const url = `/api/history${q.toString() ? `?${q.toString()}` : ''}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (res.ok) {
        const data: UploadHistoryItem[] = await res.json();
        // Client-side safeguard: strictly filter to active college & department
        const filtered = (data || []).filter((item: any) => {
          if (collegeId && item.collegeId && item.collegeId !== collegeId) return false;
          if (departmentId && item.departmentId && item.departmentId !== departmentId) return false;
          return true;
        });
        setAllHistoryItems(filtered);
      }
    } catch (err) {
      console.warn('Background archive sync skipped:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableRecords();
  }, [token, collegeId, departmentId]);

  // Autopopulate Examination Cycles based on user input: Semester, Academic Year, and Scheme
  const autopopulatedExamCycles = useMemo(() => {
    const semNorm = (inputSemester || '').toLowerCase().replace(/[\s\-_]/g, '');
    const yearNorm = (inputAcademicYear || '').toLowerCase().replace(/[\s\-_]/g, '');
    const schemeNorm = (inputScheme || '').toLowerCase().replace(/[\s\-_]/g, '');

    if (!semNorm && !yearNorm && !schemeNorm) return [];

    // Filter items matching the input criteria
    const exactMatches = allHistoryItems.filter((item) => {
      const itemSem = (item.semester || '').toLowerCase().replace(/[\s\-_]/g, '');
      const itemYear = (item.academicYear || '').toLowerCase().replace(/[\s\-_]/g, '');
      const itemScheme = (item.scheme || '').toLowerCase().replace(/[\s\-_]/g, '');

      const matchSem = !semNorm || itemSem.includes(semNorm) || semNorm.includes(itemSem);
      const matchYear = !yearNorm || itemYear.includes(yearNorm) || yearNorm.includes(itemYear);
      const matchScheme = !schemeNorm || !itemScheme || itemScheme === schemeNorm;

      return matchSem && matchYear && matchScheme;
    });

    if (exactMatches.length > 0) return exactMatches;

    // Fallback: match Semester and Academic Year if Scheme not explicitly set on legacy records
    if (semNorm || yearNorm) {
      return allHistoryItems.filter((item) => {
        const itemSem = (item.semester || '').toLowerCase().replace(/[\s\-_]/g, '');
        const itemYear = (item.academicYear || '').toLowerCase().replace(/[\s\-_]/g, '');
        const matchSem = !semNorm || itemSem.includes(semNorm) || semNorm.includes(itemSem);
        const matchYear = !yearNorm || itemYear.includes(yearNorm) || yearNorm.includes(itemYear);
        return matchSem && matchYear;
      });
    }

    return [];
  }, [allHistoryItems, inputSemester, inputAcademicYear, inputScheme]);

  // Sync selectedCycleId when autopopulatedExamCycles changes
  useEffect(() => {
    if (autopopulatedExamCycles.length > 0) {
      // If current selectedCycleId is not in the list, default to first match
      if (!selectedCycleId || !autopopulatedExamCycles.some((c) => c.id === selectedCycleId)) {
        setSelectedCycleId(autopopulatedExamCycles[0].id);
      }
    } else {
      setSelectedCycleId(null);
    }
  }, [autopopulatedExamCycles, selectedCycleId]);

  // Selected Analysis Record based on user's particular cycle choice
  const selectedAnalysisRecord = useMemo(() => {
    if (!selectedCycleId) return autopopulatedExamCycles[0] || null;
    return autopopulatedExamCycles.find((c) => c.id === selectedCycleId) || null;
  }, [autopopulatedExamCycles, selectedCycleId]);

  // Quick suggestions of available cohorts in database for 1-click populating
  const availableCohortPresets = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ sem: string; year: string; scheme: string; cycle: string; count: number }> = [];

    allHistoryItems.forEach((item) => {
      const key = `${item.semester}::${item.academicYear}::${item.scheme || '2022'}::${item.examCycle}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          sem: item.semester || '4th Sem',
          year: item.academicYear || '2025-26',
          scheme: item.scheme || '2022',
          cycle: item.examCycle || 'June / July 2025',
          count: 1,
        });
      }
    });

    return list.slice(0, 4);
  }, [allHistoryItems]);

  // Action 1: View full analysis session in interactive app
  const handleViewAnalysis = async (item: UploadHistoryItem) => {
    setLoadingActionId(item.id);
    setActiveActionType('view');
    try {
      const q = new URLSearchParams();
      if (collegeId) q.set('collegeId', collegeId);
      if (departmentId) q.set('departmentId', departmentId);
      const queryStr = q.toString() ? `?${q.toString()}` : '';

      const targetId = item.analysisResultId || item.uploadId || item.id;
      let res = await fetch(`/api/analysis/${encodeURIComponent(targetId)}${queryStr}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      // Fallback: If 404 and item.id is different from targetId, try item.id
      if (!res.ok && res.status === 404 && item.id && item.id !== targetId) {
        res = await fetch(`/api/analysis/${encodeURIComponent(item.id)}${queryStr}`, {
          headers: {
            Authorization: `Bearer ${token || ''}`,
          },
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to load analysis record (HTTP ${res.status})`);
      }

      const payload: AnalysisPayload = await res.json();
      setActionNotice({
        type: 'success',
        message: `Successfully loaded analysis dashboard for ${item.semester} (${item.academicYear}, ${item.examCycle}).`,
      });
      onSelectAnalysis(payload);
    } catch (err: any) {
      console.error('Error opening analysis:', err);
      setActionNotice({
        type: 'error',
        message: `Unable to open analysis: ${err.message}`,
      });
    } finally {
      setLoadingActionId(null);
      setActiveActionType(null);
    }
  };

  // Action 2: Download original decrypted Excel file
  const handleDownloadExcel = async (item: UploadHistoryItem) => {
    setLoadingActionId(item.id);
    setActiveActionType('excel');
    try {
      const q = new URLSearchParams();
      if (collegeId) q.set('collegeId', collegeId);
      if (departmentId) q.set('departmentId', departmentId);
      const queryStr = q.toString() ? `?${q.toString()}` : '';

      const targetId = item.id || item.analysisResultId || item.uploadId;
      const res = await fetch(`/api/download/excel/${targetId}${queryStr}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.originalFilename || `${item.semester}_${item.academicYear}_Marks.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setActionNotice({
        type: 'success',
        message: `Downloaded original Excel spreadsheet: ${item.originalFilename}`,
      });
    } catch (err: any) {
      console.error('Error downloading Excel file:', err);
      setActionNotice({
        type: 'error',
        message: `Failed to download Excel file: ${err.message}`,
      });
    } finally {
      setLoadingActionId(null);
      setActiveActionType(null);
    }
  };

  // Action 3: Download official consolidated PDF dossier
  const handleDownloadPDF = async (item: UploadHistoryItem) => {
    setLoadingActionId(item.id);
    setActiveActionType('pdf');
    try {
      const q = new URLSearchParams();
      if (collegeId) q.set('collegeId', collegeId);
      if (departmentId) q.set('departmentId', departmentId);
      const queryStr = q.toString() ? `?${q.toString()}` : '';

      const targetId = item.analysisResultId || item.uploadId || item.id;
      const res = await fetch(`/api/download/pdf/${targetId}${queryStr}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `PDF generation failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanSem = (item.semester || 'Semester').replace(/[^\w.-]/g, '_');
      const baseName = (item.originalFilename || 'Report').replace(/\.[^/.]+$/, '').replace(/[^\w.-]/g, '_');
      a.download = `${cleanSem}_${baseName}_Consolidated_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setActionNotice({
        type: 'success',
        message: `Downloaded official PDF report for ${item.semester} (${item.examCycle}).`,
      });
    } catch (err: any) {
      console.error('Error downloading PDF report:', err);
      setActionNotice({
        type: 'error',
        message: `Failed to download PDF report: ${err.message}`,
      });
    } finally {
      setLoadingActionId(null);
      setActiveActionType(null);
    }
  };

  // Step 1 of Delete: Prompt with custom modal (asking once again before deleting)
  const promptDeleteRecord = (item: UploadHistoryItem) => {
    setItemToDelete(item);
  };

  // Step 2 of Delete: Confirmed by user in modal
  const confirmDeleteRecord = async () => {
    if (!itemToDelete) return;
    const item = itemToDelete;
    setIsDeleting(true);
    setLoadingActionId(item.id);
    setActiveActionType('delete');

    try {
      const q = new URLSearchParams();
      if (collegeId) q.set('collegeId', collegeId);
      if (departmentId) q.set('departmentId', departmentId);
      const queryStr = q.toString() ? `?${q.toString()}` : '';

      const targetId = item.analysisResultId || item.uploadId || item.id;
      const res = await fetch(`/api/history/${targetId}${queryStr}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to delete record (HTTP ${res.status})`);
      }

      setActionNotice({
        type: 'success',
        message: `Archived examination analysis for "${item.semester}" (${item.academicYear}, ${item.examCycle}) was successfully deleted.`,
      });

      // Update state locally
      setAllHistoryItems((prev) =>
        prev.filter((r) => r.id !== item.id && r.analysisResultId !== item.id && r.uploadId !== item.id)
      );

      if (selectedCycleId === item.id) {
        setSelectedCycleId(null);
      }

      if (onSessionDeleted) {
        onSessionDeleted(targetId);
      }
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setActionNotice({
        type: 'error',
        message: `Failed to delete record: ${err.message}`,
      });
    } finally {
      setIsDeleting(false);
      setLoadingActionId(null);
      setActiveActionType(null);
      setItemToDelete(null);
    }
  };

  const handleSelectPreset = (preset: { sem: string; year: string; scheme: string }) => {
    setInputSemester(preset.sem);
    setInputAcademicYear(preset.year);
    setInputScheme(preset.scheme);
  };

  return (
    <div id="historical-archive-container" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Previously Done Examination Analysis
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="w-3 h-3" />
                  AES-256-GCM Vault
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Clock className="w-3 h-3" />
                  Instant Retrieval
                </span>
                {(department?.name || college?.name) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{department?.name || 'Department Vault'}</span>
                    {college?.name && <span className="text-indigo-400 font-normal">• {college.name}</span>}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Archived records are stored specifically for <strong className="text-slate-800 font-semibold">{department?.name || 'your department'}</strong> ({college?.name || 'your institution'}). Enter your Semester, Academic Year, and Scheme to instantly reopen, compare, download, or manage past analyses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onNavigateUpload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between transition-all border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* STEP 1: ENTER SEMESTER, ACADEMIC YEAR & SCHEME */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Search className="w-4 h-4" />
              <span>Step 1: Enter Academic Parameters</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Specify Semester, Academic Year & Scheme
            </h2>
          </div>
          <button
            type="button"
            onClick={fetchAvailableRecords}
            disabled={historyLoading}
            className="font-mono text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            title="Refresh database index"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            <span>Sync Vault</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Semester Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              1. Semester <span className="text-blue-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputSemester}
                onChange={(e) => setInputSemester(e.target.value)}
                placeholder="e.g. 4th Sem"
                list="semester-options"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
              <datalist id="semester-options">
                {COMMON_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {['3rd Sem', '4th Sem', '5th Sem', '6th Sem'].map((quickSem) => (
                <button
                  key={quickSem}
                  type="button"
                  onClick={() => setInputSemester(quickSem)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium border transition-colors cursor-pointer ${
                    inputSemester.toLowerCase() === quickSem.toLowerCase()
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {quickSem}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Academic Year Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              2. Academic Year <span className="text-blue-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputAcademicYear}
                onChange={(e) => setInputAcademicYear(e.target.value)}
                placeholder="e.g. 2025-26"
                list="year-options"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
              <datalist id="year-options">
                {COMMON_YEARS.map((yr) => (
                  <option key={yr} value={yr} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {['2025-26', '2024-25', '2023-24'].map((quickYr) => (
                <button
                  key={quickYr}
                  type="button"
                  onClick={() => setInputAcademicYear(quickYr)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium border transition-colors cursor-pointer ${
                    inputAcademicYear === quickYr
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {quickYr}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Scheme Input (e.g. 2022) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              3. Curriculum Scheme <span className="text-blue-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputScheme}
                onChange={(e) => setInputScheme(e.target.value)}
                placeholder="e.g. 2022"
                list="scheme-options"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
              <datalist id="scheme-options">
                {COMMON_SCHEMES.map((sch) => (
                  <option key={sch} value={sch} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {COMMON_SCHEMES.map((quickSch) => (
                <button
                  key={quickSch}
                  type="button"
                  onClick={() => setInputScheme(quickSch)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium border transition-colors cursor-pointer ${
                    inputScheme === quickSch
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {quickSch} Scheme
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Presets from Vault */}
        {availableCohortPresets.length > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Available Archives in Vault:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {availableCohortPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <span className="font-bold text-blue-700">{preset.sem}</span>
                  <span className="text-slate-300">•</span>
                  <span>{preset.year}</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-1 py-0.2 bg-slate-100 rounded text-[10px] font-mono text-slate-600">Scheme {preset.scheme}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: AUTOPOPULATED EXAM CYCLES & SELECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Autopopulated Examination Cycle(s) for {inputSemester || 'Semester'} • {inputAcademicYear || 'Year'} (Scheme {inputScheme || '2022'})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {autopopulatedExamCycles.length} {autopopulatedExamCycles.length === 1 ? 'Cycle Found' : 'Cycles Found'}
          </span>
        </div>

        {autopopulatedExamCycles.length === 0 ? (
          /* Empty Results Prompt */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                No Examination Cycle Autopopulated
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                No archived examination analysis was found matching{' '}
                <strong className="text-slate-800">{inputSemester}</strong>,{' '}
                <strong className="text-slate-800">{inputAcademicYear}</strong>, and{' '}
                <strong className="text-slate-800">Scheme {inputScheme}</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateUpload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Start New Analysis for this Cycle</span>
              </button>
            </div>
          </div>
        ) : (
          /* Examination Cycle Selector Cards */
          <div className="space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Autopopulation Complete:</strong> Please select a particular examination cycle below to inspect its detailed analysis, download PDF/Excel reports, or delete it:
                </span>
              </div>
            </div>

            {/* Cycle Selection Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {autopopulatedExamCycles.map((cycleItem) => {
                const isSelected = selectedCycleId === cycleItem.id;
                const uploadDate = new Date(cycleItem.uploadedAt || cycleItem.createdAt);
                const dateStr = !isNaN(uploadDate.getTime()) ? uploadDate.toLocaleDateString() : '';

                return (
                  <div
                    key={cycleItem.id}
                    onClick={() => setSelectedCycleId(cycleItem.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {cycleItem.examCycle}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Scheme {cycleItem.scheme || inputScheme}
                        </span>
                      </div>

                      <div className="pt-1">
                        <h4 className="text-sm font-bold text-slate-900 truncate" title={cycleItem.originalFilename}>
                          {cycleItem.originalFilename}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {cycleItem.semester} • {cycleItem.academicYear} {dateStr ? `• ${dateStr}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase">Students</span>
                          <span className="text-xs font-bold text-slate-800 font-mono">{cycleItem.totalStudents}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase">Subjects</span>
                          <span className="text-xs font-bold text-slate-800 font-mono">{cycleItem.totalSubjects}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block uppercase">Pass %</span>
                          <span className="text-xs font-bold text-emerald-700 font-mono">{cycleItem.overallPassPercentage}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCycleId(cycleItem.id);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            <span>Selected Cycle</span>
                          </>
                        ) : (
                          <>
                            <span>Select this Cycle</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* STEP 3: SELECTED PARTICULAR EXAM CYCLE ANALYSIS DETAILS */}
            {selectedAnalysisRecord && (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6 mt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
                  {/* Metadata Header */}
                  <div className="space-y-2.5 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-600 text-white">
                        {selectedAnalysisRecord.semester || inputSemester}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-white font-mono">
                        {selectedAnalysisRecord.academicYear || inputAcademicYear}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {selectedAnalysisRecord.examCycle}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        Scheme {selectedAnalysisRecord.scheme || inputScheme}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" />
                        AES-256 Vault
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{selectedAnalysisRecord.department || department?.name || 'Academic Department'}</span>
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                        <span className="flex items-center gap-1 truncate max-w-sm">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <strong className="text-slate-700">{selectedAnalysisRecord.originalFilename}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Metrics Badges */}
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs">
                        <span className="text-slate-500">Appeared: </span>
                        <strong className="text-slate-900 font-mono">{selectedAnalysisRecord.totalStudents}</strong>
                      </div>
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs">
                        <span className="text-slate-500">Passed: </span>
                        <strong className="text-emerald-700 font-mono">{selectedAnalysisRecord.passedStudents}</strong>
                      </div>
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs">
                        <span className="text-slate-500">Overall Pass: </span>
                        <strong className="text-blue-700 font-mono">{selectedAnalysisRecord.overallPassPercentage}%</strong>
                      </div>
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs">
                        <span className="text-slate-500">Total Subjects: </span>
                        <strong className="text-slate-900 font-mono">{selectedAnalysisRecord.totalSubjects}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Selected Analysis */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 lg:w-64">
                    {/* View Analysis */}
                    <button
                      onClick={() => handleViewAnalysis(selectedAnalysisRecord)}
                      disabled={loadingActionId === selectedAnalysisRecord.id}
                      className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loadingActionId === selectedAnalysisRecord.id && activeActionType === 'view' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading Session...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Analysis Dashboard</span>
                        </>
                      )}
                    </button>

                    {/* Download Official Consolidated PDF */}
                    <button
                      onClick={() => handleDownloadPDF(selectedAnalysisRecord)}
                      disabled={loadingActionId === selectedAnalysisRecord.id}
                      className="w-full px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold rounded-xl border border-purple-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loadingActionId === selectedAnalysisRecord.id && activeActionType === 'pdf' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>Download PDF Dossier</span>
                        </>
                      )}
                    </button>

                    {/* Download Original Decrypted Spreadsheet */}
                    <button
                      onClick={() => handleDownloadExcel(selectedAnalysisRecord)}
                      disabled={loadingActionId === selectedAnalysisRecord.id}
                      className="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loadingActionId === selectedAnalysisRecord.id && activeActionType === 'excel' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Decrypting Excel...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Download Excel (.xlsx)</span>
                        </>
                      )}
                    </button>

                    {/* Delete Analysis Record (Prompts Two-Step Confirmation) */}
                    <button
                      onClick={() => promptDeleteRecord(selectedAnalysisRecord)}
                      disabled={loadingActionId === selectedAnalysisRecord.id}
                      className="w-full px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete this Analysis</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security & Cryptographic Guarantee Footer */}
      <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 text-[11px] text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Cryptographic Guarantee:</strong> Historical analyses and raw Excel spreadsheets are stored in an encrypted SQLite vault with AES-256-GCM authentication tags.
          </span>
        </div>
        <div className="font-mono text-slate-400 text-[10px]">
          UBDT-VAULT-v2.6
        </div>
      </div>

      {/* TWO-STEP CONFIRMATION MODAL: ASKS ONCE AGAIN BEFORE DELETING */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirmation-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-confirmation-title" className="text-base font-bold text-slate-900 tracking-tight">
                    Delete Previously Done Analysis?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Please confirm before permanently deleting this record
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setItemToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Analysis Record Summary to Delete */}
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Semester:</span>
                <span className="font-bold text-slate-900">{itemToDelete.semester}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Academic Year:</span>
                <span className="font-bold text-slate-900">{itemToDelete.academicYear}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Exam Cycle:</span>
                <span className="font-medium text-slate-800">{itemToDelete.examCycle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Scheme:</span>
                <span className="font-bold text-purple-700 font-mono">Scheme {itemToDelete.scheme || '2022'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Spreadsheet File:</span>
                <span
                  className="font-mono text-slate-800 truncate max-w-[200px]"
                  title={itemToDelete.originalFilename}
                >
                  {itemToDelete.originalFilename || itemToDelete.fileName}
                </span>
              </div>
              {itemToDelete.totalStudents > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-[11px]">
                  <span className="font-semibold text-slate-500">Cohort Summary:</span>
                  <span className="text-slate-700 font-medium">
                    {itemToDelete.totalStudents} students • {itemToDelete.totalSubjects} subjects • {itemToDelete.overallPassPercentage}% pass
                  </span>
                </div>
              )}
            </div>

            {/* Warning Message */}
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Warning:</strong> This action permanently purges the AES-256 encrypted original Excel file, computed student grades, rankers, and consolidated PDF reports from the database. This action cannot be undone.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Analysis...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Analysis</span>
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
