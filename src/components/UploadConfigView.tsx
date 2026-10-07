import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  X,
  CheckCircle2,
  Download,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Award,
  Sliders,
  Users,
  Database,
  Trash2,
  FolderOpen,
  GraduationCap,
  Calendar,
  Archive,
  UserCheck,
} from 'lucide-react';
import {
  AnalysisPayload,
  GradingBandConfig,
  SubjectConfig,
  SemesterDetails,
  DiscoveredSubjectBlock,
} from '../types/analyzer';
import { parseExcelBuffer } from '../../server/parser';
import {
  generateNormalFixture,
  generateEdgeCaseTiesFixture,
  generateGoogleFormsWideFixture,
  generateStrictSplitFixture,
} from '../../server/fixtures';
import { downloadSemesterSummaryPDF } from '../utils/pdfExportUtils';
import { UploadWizardModal } from './UploadWizardModal';
import { College, Department } from '../types/auth';

interface UploadConfigViewProps {
  payload?: AnalysisPayload | null;
  existingPayload?: AnalysisPayload | null;
  loading?: boolean;
  isLoading?: boolean;
  token?: string | null;
  justClearedNotice?: string | null;
  editFacultyNotice?: {
    fileName: string;
    uploadId: string;
  } | null;
  onDismissNotice?: () => void;
  onDismissJustClearedNotice?: () => void;
  onDismissFacultyNotice?: () => void;
  onDismissEditFacultyNotice?: () => void;
  onRestoreSession?: () => void;
  onNewAnalysis?: () => void;
  onUploadFile?: (
    file: File,
    configOverrides?: {
      gradingBands?: GradingBandConfig;
      subjectsConfig?: Record<string, SubjectConfig>;
      semesterDetails?: SemesterDetails;
    },
    forceOverwrite?: boolean
  ) => Promise<void>;
  onUpload?: (
    file: File,
    configOverrides?: {
      gradingBands?: GradingBandConfig;
      subjectsConfig?: Record<string, SubjectConfig>;
      semesterDetails?: SemesterDetails;
    },
    forceOverwrite?: boolean
  ) => Promise<void>;
  onReanalyze: (
    gradingBands: GradingBandConfig,
    subjectsConfig: Record<string, SubjectConfig>,
    semesterDetails?: SemesterDetails
  ) => Promise<void>;
  onLoadSession?: (sessionId: string) => Promise<void>;
  onNavigateToFirstSubject: () => void;
  onNavigateToSummary: () => void;
  onOpenWarnings: () => void;
  onNavigateToArchive?: () => void;
  college?: College | null;
  department?: Department | null;
}

interface SavedSessionItem {
  id?: string;
  uploadId?: string;
  file_name?: string;
  fileName?: string;
  created_at?: string;
  createdAt?: string;
  uploaded_at?: string;
  uploadedAt?: string;
  total_students?: number;
  totalStudents?: number;
  total_subjects?: number;
  totalSubjects?: number;
  overall_pass_percentage?: number;
  overallPassPercentage?: number;
}

export const UploadConfigView: React.FC<UploadConfigViewProps> = (props) => {
  const payload = props.payload ?? props.existingPayload ?? null;
  const loading = props.loading ?? props.isLoading ?? false;
  const {
    token,
    justClearedNotice,
    editFacultyNotice,
    onDismissNotice,
    onDismissJustClearedNotice,
    onDismissFacultyNotice,
    onDismissEditFacultyNotice,
    onRestoreSession,
    onNewAnalysis,
    onUploadFile,
    onUpload,
    onReanalyze,
    onLoadSession,
    onNavigateToFirstSubject,
    onNavigateToSummary,
    onOpenWarnings,
    onNavigateToArchive,
    college,
    department,
  } = props;
  const uploadHandler = onUploadFile || onUpload;
  const handleDismissNotice = onDismissNotice || onDismissJustClearedNotice;
  const handleDismissFacultyNotice = onDismissFacultyNotice || onDismissEditFacultyNotice;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [historySessions, setHistorySessions] = useState<SavedSessionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Ingestion Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<1 | 2 | 3 | 4>(1);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [detectedSubjectsList, setDetectedSubjectsList] = useState<string[]>([]);
  const [detectedSubjectBlocks, setDetectedSubjectBlocks] = useState<Record<string, DiscoveredSubjectBlock>>({});
  const [isDetecting, setIsDetecting] = useState(false);

  // Fetch persisted history from SQLite database
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const q = new URLSearchParams();
      if (college?.id) q.set('collegeId', college.id);
      if (department?.id) q.set('departmentId', department.id);
      const url = `/api/history${q.toString() ? `?${q.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const filtered = (data || []).filter((item: any) => {
          const itemCol = item.collegeId || item.college_id;
          const itemDept = item.departmentId || item.department_id;
          if (college?.id && itemCol !== college.id) return false;
          if (department?.id && itemDept !== department.id) return false;
          return true;
        });
        setHistorySessions(filtered);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [payload, college?.id, department?.id]);

  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string;
    name: string;
    details?: string;
  } | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState<boolean>(false);

  const handlePromptDeleteSession = (
    e: React.MouseEvent,
    id: string,
    name: string,
    details?: string
  ) => {
    e.stopPropagation();
    setSessionToDelete({ id, name, details });
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      await fetch(`/api/analysis/${sessionToDelete.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      await loadHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingSession(false);
      setSessionToDelete(null);
    }
  };

  const DEFAULT_GRADING_BANDS: GradingBandConfig = {
    fcdMin: 70,
    fcMin: 60,
    scMin: 50,
    passMin: 40,
    roundingTolerance: 1.0,
    requireSeparatePass: false,
    minInternalPassPercent: 40,
    minExternalPassPercent: 40,
  };

  const DEFAULT_SEMESTER_DETAILS: SemesterDetails = {
    semester: '',
    semType: 'Even Semester',
    examination: '',
    academicYear: '',
    scheme: '2022',
    sections: 'A&B',
    department: department?.name || '',
    college: college?.name || '',
  };

  // Local state for grading band config (FCD cutoff changed to 70% as requested)
  const [gradingBands, setGradingBands] = useState<GradingBandConfig>(
    payload?.config?.gradingBands || DEFAULT_GRADING_BANDS
  );

  // Local state for subject faculty & max marks
  const [subjectsConfig, setSubjectsConfig] = useState<Record<string, SubjectConfig>>(
    payload?.config?.subjectsConfig || {}
  );

  // Local state for primary semester details (entered firstly)
  const [semesterDetails, setSemesterDetails] = useState<SemesterDetails>(
    payload?.config?.semesterDetails || DEFAULT_SEMESTER_DETAILS
  );

  // Sync state if payload changes or reset cleanly if payload is cleared
  React.useEffect(() => {
    if (payload?.config) {
      setGradingBands(payload.config.gradingBands);
      setSubjectsConfig(payload.config.subjectsConfig || {});
      if (payload.config.semesterDetails) {
        setSemesterDetails(payload.config.semesterDetails);
      }
    } else {
      // Clean slate when payload is null - remove all previous analysis remnants
      setGradingBands(DEFAULT_GRADING_BANDS);
      setSubjectsConfig({});
      setSemesterDetails(DEFAULT_SEMESTER_DETAILS);
      setStagedFile(null);
      setDetectedSubjectsList([]);
      setDetectedSubjectBlocks({});
      setUploadError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [payload]);

  // When edit faculty notice is passed from duplicate prompt, open wizard at Step 4
  React.useEffect(() => {
    if (editFacultyNotice && payload) {
      setWizardInitialStep(4);
      if (payload.detectedSubjects && payload.detectedSubjects.length > 0) {
        setDetectedSubjectsList(payload.detectedSubjects);
      }
      setIsWizardOpen(true);
    }
  }, [editFacultyNotice]);

  // Trigger subject detection and open interactive 4-step wizard
  const triggerSubjectDetectionAndOpenWizard = async (file: File) => {
    setUploadError(null);
    setStagedFile(file);
    setIsDetecting(true);

    try {
      let detectedSubjects: string[] = [];
      let subjectBlocks: Record<string, DiscoveredSubjectBlock> = {};

      // 1. Instant client-side detection (0ms network latency, 100% reliable)
      try {
        const arrayBuffer = await file.arrayBuffer();
        const clientParsed = parseExcelBuffer(arrayBuffer);
        if (clientParsed.error) {
          throw new Error(clientParsed.error);
        }
        detectedSubjects = clientParsed.detectedSubjects || [];
        subjectBlocks = (clientParsed.subjectBlocks || {}) as Record<string, DiscoveredSubjectBlock>;
      } catch (clientErr: any) {
        // Fallback to server endpoint if client parsing had an issue
        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/detect-subjects', {
            method: 'POST',
            body: formData,
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || clientErr.message || `Subject detection failed (${res.status})`);
          }

          const data = await res.json();
          detectedSubjects = data.detectedSubjects || [];
          subjectBlocks = data.subjectBlocks || {};
        } catch (serverErr: any) {
          throw new Error(clientErr.message || serverErr.message || 'Unable to detect subjects from Excel file.');
        }
      }

      setDetectedSubjectsList(detectedSubjects);
      setDetectedSubjectBlocks(subjectBlocks);
      setWizardInitialStep(1);
      setIsWizardOpen(true);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to detect subjects from spreadsheet. Please verify the file format.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await triggerSubjectDetectionAndOpenWizard(files[0]);
    // reset input value so re-uploading same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    await triggerSubjectDetectionAndOpenWizard(files[0]);
  };

  const loadSampleFixture = async (type: 'google_forms' | 'normal' | 'edge_ties' | 'strict_split') => {
    setUploadError(null);
    try {
      let blob: Blob | null = null;
      try {
        const res = await fetch(`/api/sample-excel/${type}`);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch {
        // Network/server offline fallback
      }

      if (!blob) {
        let buffer: any;
        if (type === 'google_forms') {
          buffer = generateGoogleFormsWideFixture();
        } else if (type === 'normal') {
          buffer = generateNormalFixture();
        } else if (type === 'edge_ties') {
          buffer = generateEdgeCaseTiesFixture();
        } else {
          buffer = generateStrictSplitFixture();
        }
        blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }

      const filename =
        type === 'google_forms'
          ? 'Semester_Marks_Google_Forms_Responses.xlsx'
          : type === 'normal'
          ? 'Semester_Marks_Standard_Cohort.xlsx'
          : type === 'edge_ties'
          ? 'Semester_Marks_Edge_Cases_Ties.xlsx'
          : 'Semester_Marks_Strict_40_60_Split.xlsx';

      const file = new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await triggerSubjectDetectionAndOpenWizard(file);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to load sample dataset.');
    }
  };

  const handleWizardSubmit = async (details: {
    semesterDetails: SemesterDetails;
    subjectsConfig: Record<string, SubjectConfig>;
  }) => {
    setSubjectsConfig(details.subjectsConfig);
    if (stagedFile) {
      if (uploadHandler) {
        await uploadHandler(stagedFile, {
          gradingBands,
          subjectsConfig: details.subjectsConfig,
          semesterDetails: details.semesterDetails,
        });
      }
    } else if (payload && onReanalyze) {
      await onReanalyze(gradingBands, details.subjectsConfig, details.semesterDetails);
    }
  };

  const handleDisplayNameChange = (subCode: string, name: string) => {
    setSubjectsConfig((prev) => {
      const current = prev[subCode] || {
        subjectCode: subCode,
        displayName: name,
        facultyName: `Faculty (${subCode})`,
        maxInternal: 50,
        maxExternal: 50,
        maxTotal: 100,
      };
      return {
        ...prev,
        [subCode]: { ...current, displayName: name },
      };
    });
  };

  const handleFacultyNameChange = (subCode: string, name: string) => {
    setSubjectsConfig((prev) => {
      const current = prev[subCode] || {
        subjectCode: subCode,
        displayName: subCode,
        facultyName: name,
        maxInternal: 50,
        maxExternal: 50,
        maxTotal: 100,
      };
      return {
        ...prev,
        [subCode]: { ...current, facultyName: name },
      };
    });
  };

  const handleSectionChange = (subCode: string, section: string) => {
    setSubjectsConfig((prev) => {
      const current = prev[subCode] || {
        subjectCode: subCode,
        displayName: subCode,
        facultyName: `Faculty (${subCode})`,
        maxInternal: 50,
        maxExternal: 50,
        maxTotal: 100,
      };
      const assignments = current.facultyAssignments ? [...current.facultyAssignments] : [];
      if (assignments.length > 0) {
        assignments[0] = { ...assignments[0], section };
      } else {
        assignments.push({
          id: `fac_${subCode}_1`,
          facultyName: current.facultyName || 'Staff',
          section,
        });
      }
      return {
        ...prev,
        [subCode]: {
          ...current,
          section,
          facultyAssignments: assignments,
        },
      };
    });
  };

  const handleToggleExcludeSubject = (subCode: string, excluded: boolean) => {
    setSubjectsConfig((prev) => {
      const current = prev[subCode] || {
        subjectCode: subCode,
        displayName: subCode,
        facultyName: `Faculty (${subCode})`,
        maxInternal: 50,
        maxExternal: 50,
        maxTotal: 100,
      };
      return {
        ...prev,
        [subCode]: { ...current, excluded },
      };
    });
  };

  const handleSubjectMarksChange = (
    subCode: string,
    field: 'maxInternal' | 'maxExternal' | 'maxTotal',
    val: number
  ) => {
    setSubjectsConfig((prev) => {
      const current = prev[subCode] || {
        subjectCode: subCode,
        facultyName: `Faculty (${subCode})`,
        maxInternal: 50,
        maxExternal: 50,
        maxTotal: 100,
      };
      const updated = { ...current, [field]: Number(val) || 0 };
      if (field === 'maxInternal' || field === 'maxExternal') {
        updated.maxTotal = updated.maxInternal + updated.maxExternal;
      }
      return {
        ...prev,
        [subCode]: updated,
      };
    });
  };

  const handleApplyConfig = async () => {
    if (!payload) return;
    try {
      const syncedSubjectsConfig = { ...subjectsConfig };
      const defaultSec = semesterDetails.sections?.trim() || 'A&B';
      Object.keys(syncedSubjectsConfig).forEach((code) => {
        const cfg = syncedSubjectsConfig[code];
        const sec = cfg.section?.trim() || defaultSec;
        const assignments = cfg.facultyAssignments && cfg.facultyAssignments.length > 0
          ? cfg.facultyAssignments
          : [{ id: `fac_${code}_1`, facultyName: cfg.facultyName || 'Staff', section: sec }];
        if (assignments.length <= 1) {
          assignments[0] = { ...assignments[0], section: sec };
        }
        syncedSubjectsConfig[code] = {
          ...cfg,
          section: sec,
          facultyAssignments: assignments,
        };
      });
      await onReanalyze(gradingBands, syncedSubjectsConfig, semesterDetails);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to update analysis configuration.');
    }
  };

  const detectedSubs = payload?.detectedSubjects || Object.keys(subjectsConfig);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Session Cleared Notice */}
      {justClearedNotice && (
        <div className="p-3.5 bg-blue-50/90 border border-blue-200/90 rounded-2xl text-xs text-blue-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">{justClearedNotice}</span>
          </div>
          <div className="flex items-center gap-3">
            {onRestoreSession && (
              <button
                type="button"
                onClick={onRestoreSession}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                Undo / Restore
              </button>
            )}
            {handleDismissNotice && (
              <button
                type="button"
                onClick={handleDismissNotice}
                className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Faculty for Existing Analysis Notice */}
      {editFacultyNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300/80 rounded-2xl text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-900">
                Editing Faculty Assignments
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                Loaded existing analysis for <span className="font-semibold">{editFacultyNotice.fileName}</span>. You can modify faculty names, designations, and sections below or directly in the wizard.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setWizardInitialStep(4);
                if (payload) {
                  setDetectedSubjectsList(payload.detectedSubjects);
                }
                setIsWizardOpen(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Open Wizard (Step 4)
            </button>
            {handleDismissFacultyNotice && (
              <button
                type="button"
                onClick={handleDismissFacultyNotice}
                className="p-1 text-emerald-600 hover:text-emerald-900 rounded-lg hover:bg-emerald-100/60 cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner / Heading */}
      <div className="bg-slate-900 text-white p-7 sm:p-8 rounded-2xl shadow-md border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-4xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-md">
              System Console
            </span>
            <span className="text-xs text-slate-400 font-medium">Academic Excel Analyzer & Classification Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Semester Marks Analyzer
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-3xl">
            Ingest semester marks spreadsheets, configure faculty in-charge mappings, compute independent score distributions (internal / external / total), rank top-5 students with mathematical tie handling, and compile consolidated semester pass matrices.
          </p>

          {payload && (
            <div className="pt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setDetectedSubjectsList(payload.detectedSubjects);
                  setIsWizardOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <span>Edit Semester & Faculty Mapping</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNavigateToFirstSubject}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <span>Subject View [{payload.detectedSubjects[0]}]</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNavigateToSummary}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <span>Consolidated Summary</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => downloadSemesterSummaryPDF(payload)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Semester PDF</span>
              </button>
              {onNewAnalysis && (
                <button
                  onClick={onNewAnalysis}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  title="Start a clean new marksheet analysis (clears current dataset)"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Start New Analysis (Clean)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid Layout: Upload Box (Left) & Configuration / Presets (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Upload Dropzone & Quick Samples (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Dropzone Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="col-header text-slate-400">Data Source Ingestion</div>
              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">.XLSX FORMAT</span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-200/60 shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-900">
                {loading ? 'Processing Excel Data...' : 'Click to Browse or Drag Spreadsheet'}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Standard columns: student_id, student_name, subject_code, internal_marks, external_marks, total_marks
              </p>
              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 font-mono text-xs font-semibold text-blue-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Parsing & computing metrics...</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-3 font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold uppercase text-[11px]">Ingestion Error</p>
                  <p className="text-xs font-sans mt-0.5 text-rose-800">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Quick Sample Ingestion */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="col-header text-slate-400">Synthetic Test Benchmarks</div>
                <span className="text-[10px] font-mono text-blue-600 font-semibold">Instant Ingest</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                <button
                  onClick={() => loadSampleFixture('google_forms')}
                  disabled={loading}
                  className="px-3 py-2.5 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl font-bold transition-all text-left flex flex-col justify-center disabled:opacity-50 shadow-xs"
                >
                  <span className="flex items-center justify-between">
                    <span>Google Forms (Wide)</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-blue-600 text-white rounded uppercase font-bold">New</span>
                  </span>
                  <span className="text-[10px] font-sans font-normal text-blue-700 mt-0.5">Regex header discovery & junk dropping</span>
                </button>
                <button
                  onClick={() => loadSampleFixture('normal')}
                  disabled={loading}
                  className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold transition-all text-left flex flex-col justify-center disabled:opacity-50"
                >
                  <span>Standard Cohort</span>
                  <span className="text-[10px] font-sans font-normal text-slate-500 mt-0.5">25 students × 6 subjects</span>
                </button>
                <button
                  onClick={() => loadSampleFixture('edge_ties')}
                  disabled={loading}
                  className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold transition-all text-left flex flex-col justify-center disabled:opacity-50"
                >
                  <span>Ties & Discrepancies</span>
                  <span className="text-[10px] font-sans font-normal text-slate-500 mt-0.5">Rank 5 ties & sum mismatches</span>
                </button>
                <button
                  onClick={() => loadSampleFixture('strict_split')}
                  disabled={loading}
                  className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold transition-all text-left flex flex-col justify-center disabled:opacity-50"
                >
                  <span>40/60 Separate Pass</span>
                  <span className="text-[10px] font-sans font-normal text-slate-500 mt-0.5">Theory + continuous cutoffs</span>
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <a
                  href="/api/sample-excel/google_forms"
                  download
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Google Forms Template (.XLSX)
                </a>
              </div>
            </div>
          </div>

          {/* Clean Previous Analysis Access Banner (Database hidden on home page per requirements) */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Access Previous Analysis Records</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lookup and inspect prior cohort sessions by Semester, Academic Year, and Curriculum Scheme.
                </p>
              </div>
            </div>

            {onNavigateToArchive && (
              <button
                type="button"
                onClick={onNavigateToArchive}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Archive className="w-4 h-4 text-blue-200" />
                <span>Open Previous Analysis Search →</span>
              </button>
            )}
          </div>

          {/* Expected Input Contract Info Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-xs text-slate-800 space-y-3 shadow-xs">
            <div className="col-header text-slate-400">Spreadsheet Input Contract Schema</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                    <th className="py-2">Field</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2 font-bold text-slate-900">student_id</td>
                    <td>string</td>
                    <td className="font-sans text-xs">USN / Roll Number (Key)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-900">student_name</td>
                    <td>string</td>
                    <td className="font-sans text-xs">Student full name</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-900">subject_code</td>
                    <td>string</td>
                    <td className="font-sans text-xs">e.g. 21CS51 / MATH301</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-900">internal_marks</td>
                    <td>number</td>
                    <td className="font-sans text-xs">Continuous evaluation</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-900">external_marks</td>
                    <td>number</td>
                    <td className="font-sans text-xs">Semester exam score</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-900">total_marks</td>
                    <td>number</td>
                    <td className="font-sans text-xs">Reconciled aggregate</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Primary Semester Details & Faculty Mapping (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Primary Semester (Sem) Entry Section - Priority 1 */}
          <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  1
                </div>
                <div>
                  <div className="col-header text-blue-600 font-bold">Primary Entry (Enter Firstly)</div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Semester (Sem) & Examination Details
                  </h3>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                Active Sem: {semesterDetails.semester || 'Not set'}
              </span>
            </div>

            {/* Quick Sem Selector Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Quick Select Semester (Sem):
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-xs">
                {['1st Sem', '2nd Sem', '3rd Sem', '4th Sem', '5th Sem', '6th Sem', '7th Sem', '8th Sem'].map((s) => {
                  const isSelected = semesterDetails.semester === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSemesterDetails((prev) => ({ ...prev, semester: s }))}
                      className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Semester Name / Label:
                </label>
                <input
                  type="text"
                  value={semesterDetails.semester}
                  onChange={(e) => setSemesterDetails((prev) => ({ ...prev, semester: e.target.value }))}
                  placeholder="e.g. 6th Sem, VI Semester"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Semester Cycle / Type:
                </label>
                <select
                  value={semesterDetails.semType}
                  onChange={(e) => setSemesterDetails((prev) => ({ ...prev, semType: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Even Semester">Even Semester</option>
                  <option value="Odd Semester">Odd Semester</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Examination Session:
                </label>
                <input
                  type="text"
                  value={semesterDetails.examination}
                  onChange={(e) => setSemesterDetails((prev) => ({ ...prev, examination: e.target.value }))}
                  placeholder="e.g. June / July 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Academic Year (AY):
                </label>
                <input
                  type="text"
                  value={semesterDetails.academicYear}
                  onChange={(e) => setSemesterDetails((prev) => ({ ...prev, academicYear: e.target.value }))}
                  placeholder="e.g. 2025 - 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Curriculum Scheme:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={semesterDetails.scheme || '2022'}
                    onChange={(e) => setSemesterDetails((prev) => ({ ...prev, scheme: e.target.value }))}
                    placeholder="e.g. 2022"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {['2022', '2021', '2018'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSemesterDetails((prev) => ({ ...prev, scheme: s }))}
                      className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg border transition-colors cursor-pointer shrink-0 ${
                        (semesterDetails.scheme || '2022') === s
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semester Sections (Default for Whole Subject) */}
              <div className="space-y-1 sm:col-span-2 p-3 bg-slate-100/70 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    Semester Sections (Default for Whole-Subject Faculty):
                  </label>
                  <span className="text-[10px] text-blue-600 font-mono font-bold">e.g. A&B</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={semesterDetails.sections || 'A&B'}
                    onChange={(e) => setSemesterDetails((prev) => ({ ...prev, sections: e.target.value }))}
                    placeholder="e.g. A&B"
                    className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                    {['A&B', 'A, B', 'A', 'B', 'A, B, C'].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSemesterDetails((prev) => ({ ...prev, sections: sec }))}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer ${
                          (semesterDetails.sections || 'A&B').trim() === sec
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  If 1 faculty is handling the whole subject, the Section (Sec) column in the semester summary PDF will display this combined section name (e.g. <strong>A&B</strong>).
                </p>
              </div>
            </div>

            {/* Sync Notice */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Primary Semester Binding:</strong> Whatever semester is entered firstly here is automatically reflected and locked into the <strong>PDF dossiers</strong>, <strong>consoles</strong>, and <strong>subject metadata tables</strong>.
              </div>
            </div>

            {payload && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleApplyConfig}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Update & Apply Semester to Active Dataset</span>
                </button>
              </div>
            )}
          </div>

          {/* Faculty Assignment Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <div className="col-header text-slate-400">Faculty & Subject Mapping</div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Instructor In-Charge & Max Allocations
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {detectedSubs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedSubjectsList(detectedSubs);
                      setIsWizardOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>Multi-Faculty / Section Wizard</span>
                  </button>
                )}
                {detectedSubs.length > 0 && (
                  <span className="font-mono text-xs font-semibold bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                    {detectedSubs.length} Subjects
                  </span>
                )}
              </div>
            </div>

            {detectedSubs.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl font-mono text-xs text-slate-500">
                Awaiting spreadsheet upload to detect subject modules
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {detectedSubs.map((subCode, idx) => {
                  const cfg = subjectsConfig[subCode] || {
                    subjectCode: subCode,
                    displayName: subCode,
                    facultyName: '',
                    maxInternal: 50,
                    maxExternal: 50,
                    maxTotal: 100,
                  };
                  const isInternal = cfg.blockType === 'internal_only' || cfg.maxExternal === 0;

                  return (
                    <div
                      key={`${subCode}_${idx}`}
                      className={`p-4 rounded-xl border space-y-3 transition-all ${
                        cfg.excluded
                          ? 'bg-slate-100/60 border-slate-200 opacity-60'
                          : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md max-w-xs truncate" title={subCode}>
                            {cfg.displayName || subCode}
                          </span>
                          {cfg.blockType === 'internal_only' && (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Internal Only
                            </span>
                          )}
                          {cfg.blockType === 'incomplete_no_total' && (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Auto-Total
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={!!cfg.excluded}
                              onChange={(e) => handleToggleExcludeSubject(subCode, e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            <span>Exclude</span>
                          </label>

                          <div className="flex items-center gap-1 font-mono text-xs">
                            <input
                              type="number"
                              value={cfg.maxInternal}
                              onChange={(e) => handleSubjectMarksChange(subCode, 'maxInternal', Number(e.target.value))}
                              className="w-11 px-1 py-0.5 bg-white border border-slate-200 rounded text-center font-mono text-xs text-slate-900"
                              title="Max Internal"
                            />
                            {!isInternal && (
                              <>
                                <span className="text-slate-400">+</span>
                                <input
                                  type="number"
                                  value={cfg.maxExternal}
                                  onChange={(e) => handleSubjectMarksChange(subCode, 'maxExternal', Number(e.target.value))}
                                  className="w-11 px-1 py-0.5 bg-white border border-slate-200 rounded text-center font-mono text-xs text-slate-900"
                                  title="Max External"
                                />
                              </>
                            )}
                            <span className="text-slate-400">=</span>
                            <span className="font-bold bg-slate-200 text-slate-900 px-2 py-0.5 rounded">
                              {cfg.maxTotal}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="col-header text-slate-500 text-[10px]">
                            Clean Display Name:
                          </label>
                          <input
                            type="text"
                            value={cfg.displayName || subCode}
                            placeholder="e.g. 21CS51 or Core Elective"
                            onChange={(e) => handleDisplayNameChange(subCode, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="col-header text-slate-500 text-[10px]">
                            Faculty In-Charge:
                          </label>
                          <input
                            type="text"
                            value={cfg.facultyName || ''}
                            placeholder="e.g. Prof. Arvind Sharma"
                            onChange={(e) => handleFacultyNameChange(subCode, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <label className="col-header text-slate-500 text-[10px]">
                              Section (Sec):
                            </label>
                            <span className="text-[9px] text-blue-600 font-mono font-bold">
                              Single: {semesterDetails.sections || 'A&B'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={cfg.section ?? (semesterDetails.sections || 'A&B')}
                            placeholder={semesterDetails.sections || 'A&B'}
                            onChange={(e) => handleSectionChange(subCode, e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                          <span className="text-[9px] text-slate-400">
                            Single faculty: enter all sections e.g. A&B
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grading Band Configuration */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="col-header text-slate-400">Classification Rules</div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Grading Bands & Pass Criteria Thresholds
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setGradingBands({
                    fcdMin: 70,
                    fcMin: 60,
                    scMin: 50,
                    passMin: 40,
                    roundingTolerance: 1.0,
                    requireSeparatePass: false,
                    minInternalPassPercent: 40,
                    minExternalPassPercent: 40,
                  })
                }
                className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline uppercase"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="col-header text-slate-500 text-[10px]">FCD Cutoff</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="font-mono text-xs font-bold text-slate-600">≥</span>
                  <input
                    type="number"
                    value={gradingBands.fcdMin}
                    onChange={(e) => setGradingBands({ ...gradingBands, fcdMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold font-mono text-center text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="font-mono text-xs font-bold text-slate-600">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">≥ 70% (Distinction)</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="col-header text-slate-500 text-[10px]">First Class (FC)</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="font-mono text-xs font-bold text-slate-600">≥</span>
                  <input
                    type="number"
                    value={gradingBands.fcMin}
                    onChange={(e) => setGradingBands({ ...gradingBands, fcMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold font-mono text-center text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="font-mono text-xs font-bold text-slate-600">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">60% – 69.99%</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="col-header text-slate-500 text-[10px]">Second Class (SC)</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="font-mono text-xs font-bold text-slate-600">≥</span>
                  <input
                    type="number"
                    value={gradingBands.scMin}
                    onChange={(e) => setGradingBands({ ...gradingBands, scMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold font-mono text-center text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="font-mono text-xs font-bold text-slate-600">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">50% – 59.99%</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="col-header text-slate-500 text-[10px]">Pass Threshold</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="font-mono text-xs font-bold text-slate-600">≥</span>
                  <input
                    type="number"
                    value={gradingBands.passMin}
                    onChange={(e) => setGradingBands({ ...gradingBands, passMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold font-mono text-center text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="font-mono text-xs font-bold text-slate-600">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">40% – 49.99%</p>
              </div>
            </div>

            {/* Separate Component Pass Requirement Toggle */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Separate Component Pass Requirement
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Candidate must independently satisfy minimum cutoffs in both internal and external exams.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={gradingBands.requireSeparatePass}
                  onChange={(e) =>
                    setGradingBands({ ...gradingBands, requireSeparatePass: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-600 cursor-pointer rounded"
                />
              </div>

              {gradingBands.requireSeparatePass && (
                <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                  <div>
                    <label className="col-header text-slate-500 text-[11px] block">
                      Min Internal Pass %:
                    </label>
                    <input
                      type="number"
                      value={gradingBands.minInternalPassPercent || 40}
                      onChange={(e) =>
                        setGradingBands({ ...gradingBands, minInternalPassPercent: Number(e.target.value) })
                      }
                      className="w-full mt-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="col-header text-slate-500 text-[11px] block">
                      Min External Pass %:
                    </label>
                    <input
                      type="number"
                      value={gradingBands.minExternalPassPercent || 40}
                      onChange={(e) =>
                        setGradingBands({ ...gradingBands, minExternalPassPercent: Number(e.target.value) })
                      }
                      className="w-full mt-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Apply Changes Button */}
            {payload && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyConfig}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Re-Calculate Data Grids</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warnings & Integrity Bar (if payload loaded) */}
      {payload && (
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="font-mono font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">
              Status: Ready
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-slate-900">
                {payload.validRowsCount} Records Parsed across {payload.detectedSubjects.length} Subject Modules
              </p>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                {payload.warnings.length === 0
                  ? 'All scores reconciled with zero data discrepancies.'
                  : `${payload.warnings.length} data quality / reconciliation warnings flagged.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {payload.warnings.length > 0 && (
              <button
                onClick={onOpenWarnings}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-mono text-xs font-semibold transition-colors"
              >
                Review Warns ({payload.warnings.length})
              </button>
            )}
            <button
              onClick={onNavigateToFirstSubject}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <span>Enter Subject Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive 4-Step Setup & Faculty Mapping Wizard */}
      <UploadWizardModal
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setStagedFile(null);
          setWizardInitialStep(1);
        }}
        stagedFile={stagedFile}
        detectedSubjects={detectedSubjectsList.length > 0 ? detectedSubjectsList : (payload?.detectedSubjects || Object.keys(subjectsConfig))}
        subjectBlocks={detectedSubjectBlocks}
        initialSemesterDetails={payload?.config?.semesterDetails}
        initialSubjectsConfig={subjectsConfig}
        gradingBands={gradingBands}
        initialStep={wizardInitialStep}
        isEditingFaculty={wizardInitialStep === 4 || !!editFacultyNotice}
        onSubmit={handleWizardSubmit}
        loading={loading || isDetecting}
        college={college}
        department={department}
      />

      {/* TWO-STEP CONFIRMATION MODAL: ASK ONCE AGAIN BEFORE DELETING */}
      {sessionToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-dialog-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="delete-session-dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
                    Delete Previously Done Analysis?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Please confirm before permanently deleting this record
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeletingSession && setSessionToDelete(null)}
                disabled={isDeletingSession}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Spreadsheet:</span>
                <span className="font-bold text-slate-900 font-mono truncate max-w-[220px]" title={sessionToDelete.name}>
                  {sessionToDelete.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Record ID:</span>
                <span className="font-mono text-slate-600 text-[11px] truncate max-w-[220px]">
                  {sessionToDelete.id}
                </span>
              </div>
              {sessionToDelete.details && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-[11px]">
                  <span className="font-semibold text-slate-500">Cohort:</span>
                  <span className="text-slate-700 font-medium">{sessionToDelete.details}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Warning:</strong> This permanently deletes the encrypted original Excel spreadsheet and all computed analysis metrics. This action cannot be undone.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={isDeletingSession}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                disabled={isDeletingSession}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingSession ? (
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

