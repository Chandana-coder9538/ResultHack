import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Users,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Building,
  Eye,
  UserCheck,
  ShieldCheck,
  History,
  UserX,
} from 'lucide-react';
import {
  SemesterDetails,
  SubjectConfig,
  FacultyAssignment,
  GradingBandConfig,
  DiscoveredSubjectBlock,
  AlreadyAnalysedMatch,
} from '../types/analyzer';
import { College, Department } from '../types/auth';

interface UploadWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagedFile: File | null;
  detectedSubjects: string[];
  subjectBlocks?: Record<string, DiscoveredSubjectBlock>;
  initialSemesterDetails?: SemesterDetails;
  initialSubjectsConfig?: Record<string, SubjectConfig>;
  gradingBands: GradingBandConfig;
  initialStep?: 1 | 2 | 3 | 4;
  isEditingFaculty?: boolean;
  onSubmit: (details: {
    semesterDetails: SemesterDetails;
    subjectsConfig: Record<string, SubjectConfig>;
  }) => Promise<void>;
  loading: boolean;
  onLookupExisting?: (match: AlreadyAnalysedMatch) => void;
  token?: string | null;
  college?: College | null;
  department?: Department | null;
}

const RECENT_CYCLES_STORAGE_KEY = 'marks_analyzer_recent_exam_cycles';
const DEFAULT_PRESET_CYCLES = [
  'June/July 2026',
  'Dec 2025/Jan 2026',
  'May/June 2026',
  'Nov/Dec 2025',
  'Jan/Feb 2026',
];

export const UploadWizardModal: React.FC<UploadWizardModalProps> = ({
  isOpen,
  onClose,
  stagedFile,
  detectedSubjects,
  subjectBlocks = {},
  initialSemesterDetails,
  initialSubjectsConfig = {},
  gradingBands,
  initialStep,
  isEditingFaculty,
  onSubmit,
  loading,
  onLookupExisting,
  token,
  college,
  department,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(initialStep || (isEditingFaculty ? 4 : 1));

  // Reset or adjust current step when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialStep) {
        setCurrentStep(initialStep);
      } else if (isEditingFaculty) {
        setCurrentStep(4);
      } else {
        setCurrentStep(1);
      }
    }
  }, [isOpen, initialStep, isEditingFaculty]);

  // Step 1: Semester Type & Number
  const [semType, setSemType] = useState<'Odd Semester' | 'Even Semester'>(
    initialSemesterDetails?.semType || 'Even Semester'
  );
  const [semesterNumber, setSemesterNumber] = useState<string>(
    initialSemesterDetails?.semester || (semType === 'Even Semester' ? '6th Sem' : '5th Sem')
  );
  const [semesterSections, setSemesterSections] = useState<string>(
    initialSemesterDetails?.sections || 'A&B'
  );
  const [scheme, setScheme] = useState<string>(
    initialSemesterDetails?.scheme || '2022'
  );

  // Step 2: Examination cycle
  const [examination, setExamination] = useState<string>(
    initialSemesterDetails?.examination || 'June/July 2026'
  );
  const [academicYear, setAcademicYear] = useState<string>(
    initialSemesterDetails?.academicYear || '2025 - 2026'
  );

  // Existing analysis detection and recommendation
  const [existingMatch, setExistingMatch] = useState<AlreadyAnalysedMatch | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [dismissedMatchId, setDismissedMatchId] = useState<string | null>(null);
  const [preFilledNotice, setPreFilledNotice] = useState<string | null>(null);

  // Check if input details match an already analysed session
  useEffect(() => {
    if (!isOpen || isEditingFaculty) return;

    if (!semesterNumber && !academicYear && !examination) {
      setExistingMatch(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingExisting(true);
      try {
        const queryParams = new URLSearchParams({
          semester: semesterNumber || '',
          academicYear: academicYear || '',
          examination: examination || '',
          scheme: scheme || '',
          fileName: stagedFile?.name || '',
        });
        if (college?.id) queryParams.set('collegeId', college.id);
        if (department?.id) queryParams.set('departmentId', department.id);

        const res = await fetch(`/api/check-input-details?${queryParams.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const data = await res.json();
          if (data.alreadyAnalysed) {
            setExistingMatch(data);
          } else {
            setExistingMatch(null);
          }
        }
      } catch (err) {
        console.warn('Failed to check input details:', err);
      } finally {
        setIsCheckingExisting(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, isEditingFaculty, semesterNumber, academicYear, examination, scheme, stagedFile, token]);

  useEffect(() => {
    if (isOpen && initialSemesterDetails) {
      if (initialSemesterDetails.semType) setSemType(initialSemesterDetails.semType);
      if (initialSemesterDetails.semester) setSemesterNumber(initialSemesterDetails.semester);
      if (initialSemesterDetails.sections) setSemesterSections(initialSemesterDetails.sections);
      if (initialSemesterDetails.scheme) setScheme(initialSemesterDetails.scheme);
      if (initialSemesterDetails.examination) setExamination(initialSemesterDetails.examination);
      if (initialSemesterDetails.academicYear) setAcademicYear(initialSemesterDetails.academicYear);
    }
  }, [isOpen, initialSemesterDetails]);
  const [recentCycles, setRecentCycles] = useState<string[]>(DEFAULT_PRESET_CYCLES);

  // Load recently used examination cycles from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_CYCLES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const combined = Array.from(new Set([...parsed, ...DEFAULT_PRESET_CYCLES]));
          setRecentCycles(combined);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Step 3 & 4: Subject Configuration & Faculty Assignments
  // Internal state for subject configs
  const [localSubjectsConfig, setLocalSubjectsConfig] = useState<Record<string, SubjectConfig>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize subject configs when detectedSubjects change or modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initialMap: Record<string, SubjectConfig> = {};
    detectedSubjects.forEach((subCode) => {
      const blk = subjectBlocks[subCode];
      const existing = initialSubjectsConfig[subCode];
      const blockType = blk?.blockType || existing?.blockType || 'complete';
      const isInternalOnly = blockType === 'internal_only';

      const initialMaxInternal = isInternalOnly ? 100 : (blk?.computedTotalMaxMarks ? Math.round(blk.computedTotalMaxMarks / 2) : 50);
      const initialMaxExternal = isInternalOnly ? 0 : 50;
      const initialMaxTotal = isInternalOnly ? 100 : (blk?.computedTotalMaxMarks || 100);

      // Existing assignments or default 1 assignment
      const defaultSecForSingle = existing?.section || initialSemesterDetails?.sections || 'A&B';
      const existingAssignments = existing?.facultyAssignments && existing.facultyAssignments.length > 0
        ? existing.facultyAssignments.map((a) => ({
            ...a,
            section: a.section || (existing.facultyAssignments!.length === 1 ? defaultSecForSingle : 'A'),
          }))
        : [
            {
              id: `fac_${subCode}_${Date.now()}_1`,
              facultyName: existing?.facultyName || '',
              section: defaultSecForSingle,
              batch: existing?.batch || '',
            },
          ];

      initialMap[subCode] = {
        subjectCode: subCode,
        displayName: existing?.displayName || subCode,
        facultyName: existing?.facultyName || '',
        facultyAssignments: existingAssignments,
        section: defaultSecForSingle,
        batch: existing?.batch || '',
        maxInternal: existing?.maxInternal ?? initialMaxInternal,
        maxExternal: existing?.maxExternal ?? initialMaxExternal,
        maxTotal: existing?.maxTotal ?? initialMaxTotal,
        blockType,
        excluded: existing?.excluded || false,
        hasAbsentees: existing?.hasAbsentees || false,
        absenteeCount: existing?.absenteeCount || 0,
        absenteeNames: existing?.absenteeNames || [],
        modulesDetected: blk?.detectedModuleCount || 1,
        expectedMarksPerModule: blk?.expectedMarksPerModule || 100,
        formulaCheck: blk?.formulaCheck || `1 module × 100 marks = ${initialMaxTotal} total`,
        hasModuleMismatch: blk?.hasModuleMismatch || false,
        mismatchWarning: blk?.mismatchWarning,
      };
    });

    setLocalSubjectsConfig(initialMap);
    setCurrentStep(initialStep || (isEditingFaculty ? 4 : 1));
    setValidationErrors({});
  }, [isOpen, detectedSubjects, subjectBlocks, initialStep, isEditingFaculty]);

  if (!isOpen) return null;

  // Active (non-excluded) subjects
  const activeSubjectCodes = detectedSubjects.filter((c) => !localSubjectsConfig[c]?.excluded);

  // Self-check calculation across all active subjects
  const totalActiveModules = activeSubjectCodes.length;
  const totalComputedMaxMarks = activeSubjectCodes.reduce(
    (acc, code) => acc + (localSubjectsConfig[code]?.maxTotal || 100),
    0
  );
  const expectedTotalMaxMarks = totalActiveModules * 100;
  const hasTotalMismatch = totalComputedMaxMarks !== expectedTotalMaxMarks;

  // Step 4 Handlers: Faculty assignment management
  const handleAddFacultyAssignment = (subCode: string) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      const assignments = current.facultyAssignments ? [...current.facultyAssignments] : [];
      // If expanding from 1 faculty (who handled whole subject e.g. A&B), split to section A and section B
      if (assignments.length === 1 && (!assignments[0].section || assignments[0].section === semesterSections || assignments[0].section === 'A&B')) {
        assignments[0] = { ...assignments[0], section: 'A' };
      }
      assignments.push({
        id: `fac_${subCode}_${Date.now()}_${assignments.length + 1}`,
        facultyName: '',
        section: assignments.length === 1 ? 'B' : String.fromCharCode(65 + assignments.length),
        batch: '',
      });
      return {
        ...prev,
        [subCode]: {
          ...current,
          facultyAssignments: assignments,
        },
      };
    });

    // Clear validation error if any
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[subCode];
      return next;
    });
  };

  const handleRemoveFacultyAssignment = (subCode: string, id: string) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current || !current.facultyAssignments) return prev;
      // Do not remove if only 1 assignment exists
      if (current.facultyAssignments.length <= 1) return prev;
      const filtered = current.facultyAssignments.filter((a) => a.id !== id);
      // If reduced back down to 1 faculty, revert section to whole subject combined sections (e.g. A&B)
      if (filtered.length === 1 && (!filtered[0].section || filtered[0].section === 'A')) {
        filtered[0] = { ...filtered[0], section: semesterSections || 'A&B' };
      }
      return {
        ...prev,
        [subCode]: {
          ...current,
          facultyAssignments: filtered,
        },
      };
    });
  };

  const handleUpdateFacultyAssignment = (
    subCode: string,
    id: string,
    field: 'facultyName' | 'section' | 'batch',
    value: string
  ) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current || !current.facultyAssignments) return prev;
      const updated = current.facultyAssignments.map((a) => (a.id === id ? { ...a, [field]: value } : a));
      return {
        ...prev,
        [subCode]: {
          ...current,
          facultyAssignments: updated,
        },
      };
    });

    if (field === 'facultyName' && value.trim()) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[subCode];
        return next;
      });
    }
  };

  const handleDisplayNameChange = (subCode: string, name: string) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      return {
        ...prev,
        [subCode]: { ...current, displayName: name },
      };
    });
  };

  const handleToggleExclude = (subCode: string, excluded: boolean) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      return {
        ...prev,
        [subCode]: { ...current, excluded },
      };
    });
  };

  const handleToggleAbsentees = (subCode: string, hasAbsentees: boolean) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      return {
        ...prev,
        [subCode]: {
          ...current,
          hasAbsentees,
          absenteeCount: hasAbsentees ? (current.absenteeCount && current.absenteeCount > 0 ? current.absenteeCount : 1) : 0,
          absenteeNames: hasAbsentees ? (current.absenteeNames || []) : [],
        },
      };
    });
  };

  const handleUpdateAbsenteeCount = (subCode: string, count: number) => {
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      return {
        ...prev,
        [subCode]: {
          ...current,
          absenteeCount: Math.max(1, count),
        },
      };
    });
  };

  const handleUpdateAbsenteeNames = (subCode: string, namesStr: string) => {
    const parsed = namesStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    setLocalSubjectsConfig((prev) => {
      const current = prev[subCode];
      if (!current) return prev;
      return {
        ...prev,
        [subCode]: {
          ...current,
          absenteeNames: parsed,
          absenteeCount: Math.max(parsed.length, current.absenteeCount || 1),
        },
      };
    });
  };

  // Step 4 Validation & Submission
  const handleFinalSubmit = async () => {
    // Validate that every active subject has at least one valid faculty name
    const errors: Record<string, string> = {};
    activeSubjectCodes.forEach((code) => {
      const cfg = localSubjectsConfig[code];
      const validNames = (cfg?.facultyAssignments || []).filter((a) => a.facultyName && a.facultyName.trim().length > 0);
      if (validNames.length === 0) {
        errors[code] = 'Faculty name is required for this subject.';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Persist examination cycle to recent list in localStorage
    try {
      const updatedList = Array.from(new Set([examination.trim(), ...recentCycles])).slice(0, 8);
      localStorage.setItem(RECENT_CYCLES_STORAGE_KEY, JSON.stringify(updatedList));
      setRecentCycles(updatedList);
    } catch {
      // ignore
    }

    // Build finalized subject configs with formatted combined facultyName
    const finalizedSubjectsConfig: Record<string, SubjectConfig> = {};
    Object.keys(localSubjectsConfig).forEach((code) => {
      const cfg = localSubjectsConfig[code];
      const assignments = cfg.facultyAssignments ? [...cfg.facultyAssignments] : [];
      const primary = assignments[0];

      // If one faculty is handling the whole subject, ensure Section is all sections name like 'A&B'
      let finalSection = primary?.section?.trim() || cfg.section?.trim() || '';
      if (assignments.length <= 1) {
        if (!finalSection || finalSection.toUpperCase() === 'A' || finalSection.toUpperCase() === 'ALL') {
          finalSection = semesterSections.trim() || 'A&B';
        }
        if (assignments[0]) {
          assignments[0] = { ...assignments[0], section: finalSection };
        }
      }

      // Format combined faculty display string e.g. "Prof. A (Sec A) / Prof. B (Sec B)"
      let combinedFacultyString = '';
      if (assignments.length > 0) {
        combinedFacultyString = assignments
          .filter((a) => a.facultyName.trim())
          .map((a) => {
            let label = a.facultyName.trim();
            const tags: string[] = [];
            if (a.section?.trim()) tags.push(`Sec ${a.section.trim()}`);
            if (a.batch?.trim()) tags.push(a.batch.trim());
            if (tags.length > 0) label += ` (${tags.join(', ')})`;
            return label;
          })
          .join(' / ');
      }

      finalizedSubjectsConfig[code] = {
        ...cfg,
        facultyAssignments: assignments,
        facultyName: combinedFacultyString || cfg.facultyName || 'Faculty In-Charge',
        section: finalSection || (assignments.length === 1 ? (semesterSections.trim() || 'A&B') : 'A'),
        batch: primary?.batch || cfg.batch || '',
      };
    });

    const semesterDetails: SemesterDetails = {
      semester: semesterNumber,
      semType,
      examination: examination.trim() || 'June/July 2026',
      academicYear: academicYear.trim() || '2025 - 2026',
      scheme: scheme.trim() || '2022',
      sections: semesterSections.trim() || 'A&B',
      department: department?.name || '',
      branch: department?.name || '',
      college: college?.name || '',
    };

    await onSubmit({
      semesterDetails,
      subjectsConfig: finalizedSubjectsConfig,
    });

    onClose();
  };

  // Pre-fill faculty assignments, sections, and subject configs from already analysed record
  const handleApplyExistingFacultyAndConfig = (match: AlreadyAnalysedMatch) => {
    const existingConfigs = match.subjectsConfig || match.existingPayload?.config?.subjectsConfig;
    if (existingConfigs) {
      setLocalSubjectsConfig((prev) => {
        const next = { ...prev };
        Object.keys(existingConfigs).forEach((subCode) => {
          const ex = existingConfigs[subCode];
          if (next[subCode]) {
            next[subCode] = {
              ...next[subCode],
              displayName: ex.displayName || next[subCode].displayName,
              facultyName: ex.facultyName || next[subCode].facultyName,
              facultyAssignments: ex.facultyAssignments && ex.facultyAssignments.length > 0
                ? ex.facultyAssignments
                : next[subCode].facultyAssignments,
              section: ex.section || next[subCode].section,
              batch: ex.batch || next[subCode].batch,
              maxInternal: ex.maxInternal ?? next[subCode].maxInternal,
              maxExternal: ex.maxExternal ?? next[subCode].maxExternal,
              maxTotal: ex.maxTotal ?? next[subCode].maxTotal,
              excluded: ex.excluded ?? next[subCode].excluded,
            };
          } else {
            next[subCode] = ex;
          }
        });
        return next;
      });
    }

    if (match.semesterDetails) {
      if (match.semesterDetails.semType) setSemType(match.semesterDetails.semType);
      if (match.semesterDetails.semester) setSemesterNumber(match.semesterDetails.semester);
      if (match.semesterDetails.sections) setSemesterSections(match.semesterDetails.sections);
      if (match.semesterDetails.scheme) setScheme(match.semesterDetails.scheme);
      if (match.semesterDetails.examination) setExamination(match.semesterDetails.examination);
      if (match.semesterDetails.academicYear) setAcademicYear(match.semesterDetails.academicYear);
    }

    // Direct user to Step 4: Faculty Assignments
    setCurrentStep(4);
    setPreFilledNotice(
      `Loaded saved faculty assignments and subject settings from previous analysis (${match.fileName}). You can now edit faculty names, section assignments, or subject properties below.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded">
                  Interactive Ingestion Wizard
                </span>
                {department?.name && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded">
                    Concerned Dept: {department.name}
                  </span>
                )}
                {stagedFile && (
                  <span className="text-xs text-slate-400 font-mono truncate max-w-xs">
                    {stagedFile.name}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                Semester Setup & Faculty Mapping
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            title="Cancel and close wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Progress Indicator (Steps 1 → 2 → 3 → 4) */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto font-mono text-xs">
            {/* Step 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  currentStep === 1
                    ? 'bg-blue-600 text-white shadow-xs'
                    : currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`font-semibold ${currentStep === 1 ? 'text-blue-600' : 'text-slate-700'}`}>
                  Semester
                </p>
                <p className="text-[10px] text-slate-400">Odd / Even</p>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-3 ${currentStep > 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Step 2 */}
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  currentStep === 2
                    ? 'bg-blue-600 text-white shadow-xs'
                    : currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`font-semibold ${currentStep === 2 ? 'text-blue-600' : 'text-slate-700'}`}>
                  Exam Cycle
                </p>
                <p className="text-[10px] text-slate-400">Term & Year</p>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-3 ${currentStep > 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Step 3 */}
            <button
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  currentStep === 3
                    ? 'bg-blue-600 text-white shadow-xs'
                    : currentStep > 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 3 ? <CheckCircle2 className="w-4 h-4" /> : '3'}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`font-semibold ${currentStep === 3 ? 'text-blue-600' : 'text-slate-700'}`}>
                  Subjects
                </p>
                <p className="text-[10px] text-slate-400">Confirm Modules</p>
              </div>
            </button>

            <div className={`h-0.5 flex-1 mx-3 ${currentStep > 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Step 4 */}
            <button
              onClick={() => setCurrentStep(4)}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  currentStep === 4
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                4
              </div>
              <div className="text-left hidden sm:block">
                <p className={`font-semibold ${currentStep === 4 ? 'text-blue-600' : 'text-slate-700'}`}>
                  Faculty Mapping
                </p>
                <p className="text-[10px] text-slate-400">Instructors & Sec</p>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Body / Steps Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Suggestion: Already Analysed Record Found Banner */}
          {existingMatch && existingMatch.uploadId !== dismissedMatchId && (
            <div
              id="wizard-already-analysed-suggestion"
              className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-indigo-50/70 to-blue-50/70 border-2 border-amber-300 shadow-sm space-y-3 animate-in fade-in duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 shrink-0 mt-0.5 shadow-2xs">
                    <History className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 border border-amber-300/80">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
                        Already Analysed Record Found
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Analysed on {existingMatch.uploadedAt ? new Date(existingMatch.uploadedAt).toLocaleDateString() : 'earlier'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">
                      Semester {existingMatch.semesterDetails?.semester || semesterNumber} ({existingMatch.semesterDetails?.academicYear || academicYear} • {existingMatch.semesterDetails?.examination || examination}) is already analyzed in {department?.name || 'this department'}{college?.name ? ` (${college.name})` : ''}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Spreadsheet: <span className="font-semibold text-slate-800">{existingMatch.fileName}</span> • {existingMatch.totalStudents} students • {existingMatch.overallPassPercentage?.toFixed(1)}% pass rate • Scheme {existingMatch.semesterDetails?.scheme || scheme}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedMatchId(existingMatch.uploadId)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer"
                  title="Dismiss suggestion"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recommendation Box */}
              <div className="bg-white/95 border border-amber-200 rounded-lg p-3 text-xs text-slate-800 space-y-1 shadow-2xs">
                <div className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Recommendation:</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {existingMatch.recommendation ||
                    'This semester has already been analyzed and verified. We recommend checking the existing analysis first to view complete student reports, ranks, and charts without duplicate calculation. If faculty assignments, sections, or subject settings need updating, select "Want to Edit Faculty & Other Things".'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {onLookupExisting && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLookupExisting(existingMatch);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-white" />
                    <span>Check / View Already Analysed (Recommended)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleApplyExistingFacultyAndConfig(existingMatch)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-white" />
                  <span>Want to Edit Faculty & Other Things</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDismissedMatchId(existingMatch.uploadId)}
                  className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-2 rounded-lg hover:bg-white/60 transition-colors font-medium ml-auto cursor-pointer"
                >
                  Keep custom input & continue
                </button>
              </div>
            </div>
          )}

          {/* Pre-fill Notification if user chose to edit faculty from existing */}
          {preFilledNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300/80 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{preFilledNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreFilledNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md hover:bg-emerald-100 transition-colors ml-2 cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STEP 1: Select Semester Type */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  Select Semester Cycle
                </h3>
                <p className="text-xs text-slate-500">
                  Choose whether this spreadsheet belongs to an Odd or Even semester cycle.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Odd Semester Card */}
                <button
                  type="button"
                  onClick={() => {
                    setSemType('Odd Semester');
                    if (semesterNumber.includes('6th') || semesterNumber.includes('4th') || semesterNumber.includes('2nd') || semesterNumber.includes('8th')) {
                      setSemesterNumber('5th Sem');
                    }
                  }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    semType === 'Odd Semester'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      ODD
                    </span>
                    {semType === 'Odd Semester' && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Odd Semester</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Semesters 1, 3, 5, or 7 (Autumn / Winter cycle)
                    </p>
                  </div>
                </button>

                {/* Even Semester Card */}
                <button
                  type="button"
                  onClick={() => {
                    setSemType('Even Semester');
                    if (semesterNumber.includes('5th') || semesterNumber.includes('3rd') || semesterNumber.includes('1st') || semesterNumber.includes('7th')) {
                      setSemesterNumber('6th Sem');
                    }
                  }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    semType === 'Even Semester'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      EVEN
                    </span>
                    {semType === 'Even Semester' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Even Semester</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Semesters 2, 4, 6, or 8 (Spring / Summer cycle)
                    </p>
                  </div>
                </button>
              </div>

              {/* Semester Specific Designation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="col-header text-slate-600 text-xs">
                  Specific Semester Designation:
                </label>
                <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                  {(semType === 'Even Semester' ? ['2nd Sem', '4th Sem', '6th Sem', '8th Sem'] : ['1st Sem', '3rd Sem', '5th Sem', '7th Sem']).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSemesterNumber(s)}
                      className={`py-2 px-2 rounded-lg font-bold border transition-all text-center ${
                        semesterNumber === s
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Semester Sections Input */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="col-header text-slate-700 text-xs font-semibold">
                    Semester Sections (Default for Whole-Subject Faculty):
                  </label>
                  <span className="text-[10px] text-blue-600 font-mono font-semibold">e.g. A&B</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={semesterSections}
                    onChange={(e) => setSemesterSections(e.target.value)}
                    placeholder="e.g. A&B"
                    className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                    {['A&B', 'A, B', 'A', 'B', 'A, B, C'].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSemesterSections(sec)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer ${
                          semesterSections.trim() === sec
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  When 1 faculty handles the whole subject, the summary PDF's Section (Sec) column displays this combined section name (e.g. <strong>A&B</strong>).
                </p>
              </div>

              {/* Curriculum Scheme Input */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="col-header text-slate-700 text-xs font-semibold">
                    Curriculum Scheme:
                  </label>
                  <span className="text-[10px] text-blue-600 font-mono font-semibold">Individual Subject PDF Header</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={scheme}
                    onChange={(e) => setScheme(e.target.value)}
                    placeholder="e.g. 2022"
                    className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                    {['2022', '2021', '2018', '2017'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScheme(s)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer ${
                          scheme.trim() === s
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s} Scheme
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Curriculum scheme (e.g. <strong>2022</strong>) is taken and rendered in the individual subject analysis PDF dossier header and records.
                </p>
              </div>

              {/* Primary Sem Notification Banner */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Primary Semester Entry:</span> Selected semester, scheme ({scheme || '2022'}) & sections are locked in firstly and propagated into the official PDF dossiers, analytical tables, and system console.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Examination Cycle & Academic Year */}
          {currentStep === 2 && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  Examination Cycle & Session
                </h3>
                <p className="text-xs text-slate-500">
                  Specify the exam cycle (e.g. "June/July 2026") printed on institutional dossiers.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="col-header text-slate-700 text-xs font-semibold">
                    Examination Cycle (Free Text):
                  </label>
                  <input
                    type="text"
                    value={examination}
                    onChange={(e) => setExamination(e.target.value)}
                    placeholder="e.g. June/July 2026"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Quick-Select Chips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase font-semibold text-slate-500">
                      Quick-Select Common Cycles:
                    </span>
                    <span className="text-[10px] text-slate-400">Click to populate</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentCycles.map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setExamination(cycle)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                          examination.trim().toLowerCase() === cycle.toLowerCase()
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {cycle}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Academic Year & Scheme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="col-header text-slate-700 text-xs font-semibold">
                      Academic Year:
                    </label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="e.g. 2025 - 2026"
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="col-header text-slate-700 text-xs font-semibold">
                      Scheme:
                    </label>
                    <input
                      type="text"
                      value={scheme}
                      onChange={(e) => setScheme(e.target.value)}
                      placeholder="e.g. 2022"
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Auto-Detected Subjects Confirmation */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Confirm Detected Subjects
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify all subject modules discovered from column headers before configuring instructors.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold px-3 py-1 bg-slate-900 text-white rounded-lg self-start sm:self-auto">
                  {detectedSubjects.length} Modules Auto-Detected
                </span>
              </div>

              {/* Self-Check Banner: e.g. 9 modules × 100 marks = 900 total */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono ${
                  hasTotalMismatch
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-blue-50/70 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${hasTotalMismatch ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold">Dynamic Self-Check: </span>
                    <span>
                      {totalActiveModules} modules × 100 marks = {totalComputedMaxMarks} total marks
                    </span>
                  </div>
                </div>

                {hasTotalMismatch && (
                  <span className="font-semibold text-amber-800 text-[11px] bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    Module total ({totalComputedMaxMarks}) differs from expected ({expectedTotalMaxMarks})
                  </span>
                )}
              </div>

              {/* Detected Subjects Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {detectedSubjects.map((subCode) => {
                  const cfg = localSubjectsConfig[subCode] || {
                    subjectCode: subCode,
                    displayName: subCode,
                    facultyName: '',
                    maxInternal: 50,
                    maxExternal: 50,
                    maxTotal: 100,
                  };
                  const isInternalOnly = cfg.blockType === 'internal_only';

                  return (
                    <div
                      key={subCode}
                      className={`p-3.5 rounded-xl border transition-all ${
                        cfg.excluded
                          ? 'bg-slate-100 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200/80 shadow-2xs hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md">
                            {cfg.displayName || subCode}
                          </span>
                          {isInternalOnly ? (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              Internal Only (100)
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              IA ({cfg.maxInternal}) + SEE ({cfg.maxExternal})
                            </span>
                          )}
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-slate-500 shrink-0">
                          <input
                            type="checkbox"
                            checked={!cfg.excluded}
                            onChange={(e) => handleToggleExclude(subCode, !e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span>Include</span>
                        </label>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between">
                        <span>Max Total: {cfg.maxTotal}</span>
                        {cfg.formulaCheck && (
                          <span className="text-[10px] text-slate-400">{cfg.formulaCheck}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Faculty Name, Section, Batch & "+ Add another faculty" */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Assign Faculty In-Charge, Sections & Batches
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  For each detected subject, enter the required Faculty Name. Use <strong className="text-slate-800">+ Add another faculty</strong> to allocate team-taught subjects or multiple sections/batches.
                </p>
              </div>

              {/* Subjects List with Faculty Assignments */}
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {activeSubjectCodes.map((subCode) => {
                  const cfg = localSubjectsConfig[subCode];
                  const hasError = !!validationErrors[subCode];
                  const assignments = cfg?.facultyAssignments || [];

                  return (
                    <div
                      key={subCode}
                      className={`p-4 rounded-xl border transition-all ${
                        hasError
                          ? 'border-rose-300 bg-rose-50/40'
                          : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      {/* Subject Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-md">
                            {cfg?.displayName || subCode}
                          </span>
                          {cfg?.displayName !== subCode && (
                            <span className="text-xs font-mono text-slate-500">
                              (Code: {subCode})
                            </span>
                          )}
                          {cfg?.blockType === 'internal_only' ? (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Coursework / Internal Only (100 Marks)
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                              Max: {cfg?.maxTotal} (IA: {cfg?.maxInternal} + SEE: {cfg?.maxExternal})
                            </span>
                          )}
                        </div>

                        {/* Editable Display Name */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase text-slate-400">Display:</span>
                          <input
                            type="text"
                            value={cfg?.displayName || subCode}
                            onChange={(e) => handleDisplayNameChange(subCode, e.target.value)}
                            placeholder={subCode}
                            className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 w-36 font-mono"
                          />
                        </div>
                      </div>

                      {hasError && (
                        <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold font-mono mt-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{validationErrors[subCode]}</span>
                        </div>
                      )}

                      {/* Faculty Assignment Rows */}
                      <div className="space-y-3 mt-3">
                        {assignments.map((assignment, aIdx) => (
                          <div
                            key={assignment.id}
                            className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>Faculty Allocation #{aIdx + 1}</span>
                              </span>
                              {assignments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFacultyAssignment(subCode, assignment.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Remove this faculty assignment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                              {/* Faculty Name (Required) */}
                              <div className="sm:col-span-6 space-y-1">
                                <label className="text-[10px] font-mono uppercase font-semibold text-slate-600 flex items-center gap-1">
                                  <span>Faculty Name</span>
                                  <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={assignment.facultyName}
                                  onChange={(e) =>
                                    handleUpdateFacultyAssignment(
                                      subCode,
                                      assignment.id,
                                      'facultyName',
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. Dr. K. M. Kumar"
                                  className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                                    !assignment.facultyName.trim() && hasError
                                      ? 'border-rose-400 bg-rose-50/20'
                                      : 'border-slate-200'
                                  }`}
                                />
                              </div>

                              {/* Section (Sec) */}
                              <div className="sm:col-span-3 space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-mono uppercase font-semibold text-slate-600">
                                    Section (Sec)
                                  </label>
                                  {assignments.length === 1 && (
                                    <span className="text-[9px] text-blue-600 font-mono font-bold">
                                      Whole: {semesterSections || 'A&B'}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={assignment.section || ''}
                                  onChange={(e) =>
                                    handleUpdateFacultyAssignment(
                                      subCode,
                                      assignment.id,
                                      'section',
                                      e.target.value
                                    )
                                  }
                                  placeholder={assignments.length === 1 ? (semesterSections || 'A&B') : 'e.g. A'}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <span className="text-[9px] text-slate-400 font-sans block truncate">
                                  {assignments.length === 1 ? '1 faculty: enter all sections e.g. A&B' : 'Section name e.g. A'}
                                </span>
                              </div>

                              {/* Batch (Optional) */}
                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-mono uppercase font-semibold text-slate-500">
                                  Batch (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={assignment.batch || ''}
                                  onChange={(e) =>
                                    handleUpdateFacultyAssignment(
                                      subCode,
                                      assignment.id,
                                      'batch',
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. Batch 1"
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* "+ Add another faculty for this subject" Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleAddFacultyAssignment(subCode)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add another faculty for this subject</span>
                          </button>
                        </div>

                        {/* Interactive Absentees Inquiry & Input Section */}
                        <div className="mt-3.5 p-3.5 bg-white border border-amber-200/80 rounded-xl space-y-2.5 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 font-mono">
                                <UserX className="w-3.5 h-3.5 text-amber-600" />
                                <span>Are there any absentees in this subject?</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Specified absentees are looked up, ignored for positive subject analysis, and evaluated as Fail.
                              </p>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleAbsentees(subCode, false)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                                  !cfg?.hasAbsentees
                                    ? 'bg-white text-slate-800 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                No
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAbsentees(subCode, true)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-all cursor-pointer ${
                                  cfg?.hasAbsentees
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Yes
                              </button>
                            </div>
                          </div>

                          {cfg?.hasAbsentees && (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2.5 border-t border-slate-100">
                              <div className="sm:col-span-4 space-y-1">
                                <label className="text-[10px] font-mono uppercase font-semibold text-slate-600">
                                  How many absentees?
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={cfg.absenteeCount || 1}
                                  onChange={(e) => handleUpdateAbsenteeCount(subCode, parseInt(e.target.value) || 1)}
                                  className="w-full px-3 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                              </div>
                              <div className="sm:col-span-8 space-y-1">
                                <label className="text-[10px] font-mono uppercase font-semibold text-slate-600">
                                  Absentee Names or USNs:
                                </label>
                                <input
                                  type="text"
                                  value={(cfg.absenteeNames || []).join(', ')}
                                  onChange={(e) => handleUpdateAbsenteeNames(subCode, e.target.value)}
                                  placeholder="e.g. 4BD22CS045, Rahul Sharma, Pooja M (comma separated)"
                                  className="w-full px-3 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                                <span className="text-[9px] text-amber-700/80 block">
                                  Names are matched in the subject sheet, excluded from pass ranks, and recorded as Fail.
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as any) : 1))}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev < 4 ? ((prev + 1) as any) : 4))}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Analysis...</span>
                  </>
                ) : (
                  <>
                    <span>{isEditingFaculty ? 'Update Faculty & Recalculate' : 'Generate Analysis Dossier'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
