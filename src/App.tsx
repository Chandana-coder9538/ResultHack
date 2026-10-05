/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { UploadConfigView } from './components/UploadConfigView';
import { SubjectAnalysisView } from './components/SubjectAnalysisView';
import { SemesterSummaryView } from './components/SemesterSummaryView';
import { DataQualityDrawer } from './components/DataQualityDrawer';
import { TestRunnerModal } from './components/TestRunnerModal';
import { SecurityShieldModal } from './components/SecurityShieldModal';
import { PrintReportView } from './components/PrintReportView';
import { HistoryArchiveView } from './components/HistoryArchiveView';
import { AlreadyAnalysedModal } from './components/AlreadyAnalysedModal';
import { CollegeSelectionScreen } from './components/CollegeSelectionScreen';
import { CollegeRegisterScreen } from './components/CollegeRegisterScreen';
import { CollegeOtpVerifyScreen } from './components/CollegeOtpVerifyScreen';
import { CollegeLoginScreen } from './components/CollegeLoginScreen';
import { DepartmentSelectionScreen } from './components/DepartmentSelectionScreen';
import { DepartmentRegisterScreen } from './components/DepartmentRegisterScreen';
import { DepartmentOtpVerifyScreen } from './components/DepartmentOtpVerifyScreen';
import { DepartmentLoginScreen } from './components/DepartmentLoginScreen';
import { SmtpSetupModal } from './components/SmtpSetupModal';
import { BackgroundScene } from './components/BackgroundScene';
import { TechieProvider, TechieRouteWatcher } from './context/TechieContext';
import { TechieGuide } from './components/TechieGuide';
import { BeeProvider } from './context/BeeContext';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck, AlertCircle, X, Building2, Layers, Mail } from 'lucide-react';
import {
  AnalysisPayload,
  GradingBandConfig,
  SubjectConfig,
  SemesterDetails,
  AlreadyAnalysedMatch,
} from './types/analyzer';
import { College, Department } from './types/auth';
import { parseExcelBuffer } from '../server/parser';
import {
  aggregateSemesterData,
  DEFAULT_GRADING_BANDS,
  DEFAULT_SUBJECT_CONFIG,
} from '../server/engine';

// =========================================================================
// DASHBOARD VIEW (Protected: Authorized Department Session)
// =========================================================================

interface DashboardViewProps {
  currentTab: 'upload' | 'subject' | 'summary' | 'print' | 'archive';
  setCurrentTab: (tab: 'upload' | 'subject' | 'summary' | 'print' | 'archive') => void;
  currentSubjectCode: string;
  setCurrentSubjectCode: (code: string) => void;
  payload: AnalysisPayload | null;
  setPayload: React.Dispatch<React.SetStateAction<AnalysisPayload | null>>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  onOpenWarnings: () => void;
  onOpenTestModal: () => void;
  onOpenSecurityModal: () => void;
  editFacultyNotice: { fileName: string; uploadId: string } | null;
  setEditFacultyNotice: (n: { fileName: string; uploadId: string } | null) => void;
  justClearedNotice: string | null;
  setJustClearedNotice: (s: string | null) => void;
  onUploadFile: (
    file: File,
    configOverrides?: {
      gradingBands?: GradingBandConfig;
      subjectsConfig?: Record<string, SubjectConfig>;
      semesterDetails?: SemesterDetails;
    }
  ) => Promise<void>;
  onReanalyze: (
    gradingBands: GradingBandConfig,
    subjectsConfig: Record<string, SubjectConfig>,
    semesterDetails?: SemesterDetails
  ) => Promise<void>;
  onLoadSession: (payload: AnalysisPayload) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  currentTab,
  setCurrentTab,
  currentSubjectCode,
  setCurrentSubjectCode,
  payload,
  setPayload,
  loading,
  setLoading,
  onOpenWarnings,
  onOpenTestModal,
  onOpenSecurityModal,
  editFacultyNotice,
  setEditFacultyNotice,
  justClearedNotice,
  setJustClearedNotice,
  onUploadFile,
  onReanalyze,
  onLoadSession,
}) => {
  const { college, department, token, user } = useAuth();
  const [selectedDeptForLogin, setSelectedDeptForLogin] = useState<Department | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'upload' && (
          <UploadConfigView
            payload={payload}
            existingPayload={payload}
            loading={loading}
            isLoading={loading}
            token={token}
            college={college}
            department={department}
            onUploadFile={onUploadFile}
            onUpload={onUploadFile}
            onReanalyze={onReanalyze}
            onLoadSession={onLoadSession}
            onNavigateToFirstSubject={() => {
              if (payload?.detectedSubjects?.length) {
                setCurrentSubjectCode(payload.detectedSubjects[0]);
                setCurrentTab('subject');
              }
            }}
            onNavigateToSummary={() => setCurrentTab('summary')}
            onOpenWarnings={onOpenWarnings}
            onNavigateToArchive={() => setCurrentTab('archive')}
            editFacultyNotice={editFacultyNotice}
            onDismissFacultyNotice={() => setEditFacultyNotice(null)}
            onDismissEditFacultyNotice={() => setEditFacultyNotice(null)}
            justClearedNotice={justClearedNotice}
            onDismissNotice={() => setJustClearedNotice(null)}
            onDismissJustClearedNotice={() => setJustClearedNotice(null)}
            onNewAnalysis={() => {
              setPayload(null);
              setCurrentTab('upload');
            }}
          />
        )}

        {currentTab === 'subject' && (
          <SubjectAnalysisView
            payload={payload}
            currentSubjectCode={currentSubjectCode}
            selectedSubjectCode={currentSubjectCode}
            onSelectSubject={setCurrentSubjectCode}
            onNavigateToSummary={() => setCurrentTab('summary')}
            onNavigateUpload={() => setCurrentTab('upload')}
            onReanalyze={onReanalyze}
            college={college}
            department={department}
          />
        )}

        {currentTab === 'summary' && (
          <SemesterSummaryView
            payload={payload}
            summary={payload?.semesterSummary}
            fileName={payload?.fileName}
            onSelectSubject={(code) => {
              setCurrentSubjectCode(code);
              setCurrentTab('subject');
            }}
            onReanalyze={onReanalyze}
            onNavigateToUpload={() => setCurrentTab('upload')}
            onNavigateToPrint={() => setCurrentTab('print')}
            college={college}
            department={department}
          />
        )}

        {currentTab === 'print' && (
          <PrintReportView
            payload={payload || undefined as any}
            college={college}
            department={department}
            onNavigateBack={() => setCurrentTab('summary')}
          />
        )}

        {currentTab === 'archive' && (
          <HistoryArchiveView
            onLoadSession={onLoadSession}
            activeUploadId={payload?.uploadId}
            collegeId={college?.id}
            departmentId={department?.id}
            department={department}
            college={college}
            token={token}
          />
        )}
      </main>
    </div>
  );
};

// =========================================================================
// ROUTER & NAVIGATION CONTROLLER
// =========================================================================

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    authType,
    college,
    department,
    token,
    collegeToken,
    user,
    authNotice,
    setAuthNotice,
    loginCollege,
    loginDepartment,
    logoutCollege,
    logoutDepartment,
    logoutAll,
    selectCollegeForBrowsing,
  } = useAuth();

  // Analysis State (scoped to authenticated department)
  const [payload, setPayload] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'upload' | 'subject' | 'summary' | 'print' | 'archive'>('upload');
  const [currentSubjectCode, setCurrentSubjectCode] = useState<string>('');
  const [isWarningsDrawerOpen, setIsWarningsDrawerOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Duplicate / Already Analysed Ingestion State
  const [alreadyAnalysedMatch, setAlreadyAnalysedMatch] = useState<AlreadyAnalysedMatch | null>(null);
  const [isAlreadyAnalysedModalOpen, setIsAlreadyAnalysedModalOpen] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<{
    file: File;
    configOverrides?: {
      gradingBands?: GradingBandConfig;
      subjectsConfig?: Record<string, SubjectConfig>;
      semesterDetails?: SemesterDetails;
    };
  } | null>(null);
  const [editFacultyNotice, setEditFacultyNotice] = useState<{
    fileName: string;
    uploadId: string;
  } | null>(null);

  const rawRowsRef = useRef<any[]>([]);
  const cachedFileRef = useRef<File | null>(null);
  const previousPayloadRef = useRef<AnalysisPayload | null>(null);
  const [justClearedNotice, setJustClearedNotice] = useState<string | null>(null);

  // Auto-dismiss auth notice after 6 seconds
  useEffect(() => {
    if (!authNotice) return;
    const t = setTimeout(() => setAuthNotice(null), 6000);
    return () => clearTimeout(t);
  }, [authNotice, setAuthNotice]);

  // Upload handler with tenant scope
  const handleUploadFile = async (
    file: File,
    configOverrides?: {
      gradingBands?: GradingBandConfig;
      subjectsConfig?: Record<string, SubjectConfig>;
      semesterDetails?: SemesterDetails;
    }
  ) => {
    setLoading(true);
    cachedFileRef.current = file;

    const mergedDetails: SemesterDetails = {
      ...(configOverrides?.semesterDetails || {}),
      college: college?.name || 'College',
      department: department?.name || 'Department',
    };

    try {
      let data: AnalysisPayload | null = null;

      // 1. Try Backend API Ingestion
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (configOverrides?.gradingBands) {
          formData.append('gradingBands', JSON.stringify(configOverrides.gradingBands));
        }
        if (configOverrides?.subjectsConfig) {
          formData.append('subjectsConfig', JSON.stringify(configOverrides.subjectsConfig));
        }
        formData.append('semesterDetails', JSON.stringify(mergedDetails));

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.alreadyAnalysed) {
            setPendingUploadData({ file, configOverrides: { ...configOverrides, semesterDetails: mergedDetails } });
            setAlreadyAnalysedMatch(resData);
            setIsAlreadyAnalysedModalOpen(true);
            setLoading(false);
            return;
          }
          data = resData;
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.warn('Backend upload non-200:', errorData.error);
        }
      } catch (netErr: any) {
        console.warn('Backend upload unreachable, fallback to client-side:', netErr.message);
      }

      // 2. Client-side fallback if server unreachable
      if (!data) {
        const arrayBuffer = await file.arrayBuffer();
        const userGradingBands = configOverrides?.gradingBands || DEFAULT_GRADING_BANDS;
        const parseResult = parseExcelBuffer(arrayBuffer, {
          roundingTolerance: userGradingBands.roundingTolerance,
        });

        if (parseResult.error) {
          throw new Error(parseResult.error);
        }

        rawRowsRef.current = parseResult.validRows;

        const completeSubjectsConfig: Record<string, SubjectConfig> = {};
        parseResult.detectedSubjects.forEach((subCode) => {
          const blk = parseResult.subjectBlocks[subCode];
          const blockType = blk?.blockType || 'complete';
          const defaultConfig = DEFAULT_SUBJECT_CONFIG(subCode, blockType);
          if (blk) {
            (defaultConfig as any).modulesDetected = blk.detectedModuleCount;
            (defaultConfig as any).expectedMarksPerModule = blk.expectedMarksPerModule;
            (defaultConfig as any).formulaCheck = blk.formulaCheck;
            (defaultConfig as any).hasModuleMismatch = blk.hasModuleMismatch;
            (defaultConfig as any).mismatchWarning = blk.mismatchWarning;
            if (blk.computedTotalMaxMarks && blk.computedTotalMaxMarks > 0) {
              defaultConfig.maxTotal = blk.computedTotalMaxMarks;
            }
          }
          completeSubjectsConfig[subCode] = configOverrides?.subjectsConfig?.[subCode]
            ? { ...defaultConfig, ...configOverrides.subjectsConfig[subCode] }
            : defaultConfig;
        });

        const uploadId = `upload_${Date.now()}`;
        data = aggregateSemesterData(
          parseResult.validRows,
          userGradingBands,
          completeSubjectsConfig,
          parseResult.warnings,
          uploadId,
          file.name,
          mergedDetails
        );
      }

      setPayload(data);
      if (data.detectedSubjects.length > 0) {
        setCurrentSubjectCode(data.detectedSubjects[0]);
      }
      setCurrentTab('summary');
    } catch (err: any) {
      alert(`Error processing file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Re-analyze active session
  const handleReanalyze = async (
    gradingBands: GradingBandConfig,
    subjectsConfig: Record<string, SubjectConfig>,
    semesterDetails?: SemesterDetails
  ) => {
    if (!payload) return;
    setLoading(true);

    const mergedDetails: SemesterDetails = {
      ...(semesterDetails || payload.config.semesterDetails || {}),
      college: college?.name || 'College',
      department: department?.name || 'Department',
    };

    try {
      let data: AnalysisPayload | null = null;
      try {
        const res = await fetch(`/api/reanalyze/${payload.uploadId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            gradingBands,
            subjectsConfig,
            semesterDetails: mergedDetails,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn('Server re-analysis unavailable, recalculating locally:', err);
      }

      if (!data) {
        data = aggregateSemesterData(
          rawRowsRef.current.length > 0 ? rawRowsRef.current : (payload as any).rawRows || [],
          gradingBands,
          subjectsConfig,
          payload.warnings,
          payload.uploadId,
          payload.fileName,
          mergedDetails
        );
      }

      setPayload(data);
      setCurrentTab('summary');
    } catch (err: any) {
      alert(`Re-analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = (loadedPayload: AnalysisPayload) => {
    setPayload(loadedPayload);
    if (loadedPayload.detectedSubjects.length > 0) {
      setCurrentSubjectCode(loadedPayload.detectedSubjects[0]);
    }
    setCurrentTab('summary');
  };

  const handleLookupExisting = () => {
    if (alreadyAnalysedMatch?.existingPayload) {
      setPayload(alreadyAnalysedMatch.existingPayload);
      if (alreadyAnalysedMatch.existingPayload.detectedSubjects?.length > 0) {
        setCurrentSubjectCode(alreadyAnalysedMatch.existingPayload.detectedSubjects[0]);
      }
      setIsAlreadyAnalysedModalOpen(false);
      setPendingUploadData(null);
      setAlreadyAnalysedMatch(null);
      setCurrentTab('summary');
    }
  };

  const handleEditFacultyFromExisting = () => {
    if (alreadyAnalysedMatch?.existingPayload) {
      setPayload(alreadyAnalysedMatch.existingPayload);
      setEditFacultyNotice({
        fileName: alreadyAnalysedMatch.fileName,
        uploadId: alreadyAnalysedMatch.uploadId,
      });
      setIsAlreadyAnalysedModalOpen(false);
      setPendingUploadData(null);
      setAlreadyAnalysedMatch(null);
      setCurrentTab('upload');
    }
  };

  const handleForceReanalyze = () => {
    if (pendingUploadData) {
      setIsAlreadyAnalysedModalOpen(false);
      const { file, configOverrides } = pendingUploadData;
      setPendingUploadData(null);
      setAlreadyAnalysedMatch(null);
      handleUploadFile(file, configOverrides);
    }
  };

  const isDashboardRoute = location.pathname === '/department/dashboard';

  return (
    <div className={`min-h-screen flex flex-col relative ${isDashboardRoute ? 'bg-slate-50/95 text-slate-900' : 'bg-transparent text-white'}`}>
      {/* 3D Animated Background: Campus of Results (Wireframe Globe, Graduation Caps, Books, Diplomas, Bar Charts) */}
      <BackgroundScene />

      {/* Techie Guide Character Stage & Route/Tab Observer */}
      <TechieRouteWatcher currentTab={currentTab} />
      <TechieGuide />
      {/* Navbar rendered ONLY on the authorized Analysis Dashboard */}
      {isDashboardRoute && authType === 'department' && (
        <Navbar
          currentTab={currentTab}
          currentSubjectCode={currentSubjectCode}
          payload={payload}
          user={user}
          college={college}
          department={department}
          onSwitchDepartment={() => {
            logoutDepartment();
            navigate('/college/departments');
          }}
          onSwitchCollege={() => {
            logoutAll();
            navigate('/');
          }}
          onLogout={() => {
            logoutAll();
            navigate('/');
          }}
          onSelectTab={setCurrentTab}
          onNewAnalysis={() => {
            previousPayloadRef.current = payload;
            setPayload(null);
            setCurrentTab('upload');
            setJustClearedNotice('Previous analysis cleared. Ready for fresh marks upload.');
          }}
          onSelectSubject={(code) => {
            setCurrentSubjectCode(code);
            setCurrentTab('subject');
          }}
          onOpenWarnings={() => setIsWarningsDrawerOpen(true)}
          onOpenTestModal={() => setIsTestRunnerOpen(true)}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        />
      )}

      {/* Auth & Notification Banner */}
      {authNotice && (
        <div
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            authNotice.type === 'warning'
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-blue-600 text-white border-blue-700'
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authNotice.message}</span>
            </div>
            <button
              onClick={() => setAuthNotice(null)}
              className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Application Route Engine with Smooth Page Transitions */}
      <div className="flex-1 flex flex-col relative z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 flex flex-col"
          >
            <Routes location={location}>
          {/* 1. College Selection / Landing */}
          <Route
            path="/"
            element={
              <CollegeSelectionScreen
                onSelectCollege={(col) => {
                  selectCollegeForBrowsing(col);
                  if (authType === 'college' && college?.id === col.id) {
                    navigate('/college/departments');
                  } else {
                    navigate('/college/login');
                  }
                }}
                onNavigateRegister={() => navigate('/college/register')}
              />
            }
          />

          {/* 2. College Register Form (Step 1) */}
          <Route
            path="/college/register"
            element={
              <CollegeRegisterScreen
                onRegisterSuccess={(col, tok) => {
                  loginCollege(col, tok);
                  navigate('/college/departments');
                }}
                onNavigateLogin={(prefillEmail) => {
                  navigate('/college/login');
                }}
                onNavigateBack={() => navigate('/')}
              />
            }
          />

          {/* 3. College OTP Verification (Step 2 of State Machine) */}
          <Route path="/college/verify-otp" element={<CollegeOtpVerifyScreen />} />

          {/* 4. College Administrator Login */}
          <Route
            path="/college/login"
            element={
              <CollegeLoginScreen
                selectedCollege={college}
                onLoginSuccess={(col, tok) => {
                  loginCollege(col, tok);
                  navigate('/college/departments');
                }}
                onNavigateRegister={() => navigate('/college/register')}
                onNavigateBack={() => navigate('/')}
              />
            }
          />

          {/* 5. College Departments List (Protected: College Session) */}
          <Route
            path="/college/departments"
            element={
              <ProtectedRoute requiredType="college">
                {college ? (
                  <DepartmentSelectionScreen
                    college={college}
                    collegeToken={collegeToken || ''}
                    onSelectDepartment={(dept) => {
                      if (authType === 'department' && department?.id === dept.id) {
                        navigate('/department/dashboard');
                      } else {
                        navigate('/department/login');
                      }
                    }}
                    onCollegeLogout={() => {
                      logoutAll();
                      navigate('/');
                    }}
                  />
                ) : (
                  <Navigate to="/college/login" replace />
                )}
              </ProtectedRoute>
            }
          />

          {/* 6. Department Register Form (Step 1) */}
          <Route
            path="/department/register"
            element={
              <ProtectedRoute requiredType="college">
                <DepartmentRegisterScreen />
              </ProtectedRoute>
            }
          />

          {/* 7. Department OTP Verification (Step 2 of State Machine) */}
          <Route
            path="/department/verify-otp"
            element={
              <ProtectedRoute requiredType="college">
                <DepartmentOtpVerifyScreen />
              </ProtectedRoute>
            }
          />

          {/* 8. Department Faculty Login */}
          <Route
            path="/department/login"
            element={
              <DepartmentLoginScreen
                college={college}
                department={department}
                onLoginSuccess={(dept, authUser, tok) => {
                  if (college) {
                    loginDepartment(dept, college, tok);
                  }
                  navigate('/department/dashboard');
                }}
                onBackToDepartments={() => navigate('/college/departments')}
                onBackToColleges={() => {
                  logoutAll();
                  navigate('/');
                }}
              />
            }
          />

          {/* 9. Department Examination Marks Dashboard (Protected: Department Session) */}
          <Route
            path="/department/dashboard"
            element={
              <ProtectedRoute requiredType="department">
                <DashboardView
                  currentTab={currentTab}
                  setCurrentTab={setCurrentTab}
                  currentSubjectCode={currentSubjectCode}
                  setCurrentSubjectCode={setCurrentSubjectCode}
                  payload={payload}
                  setPayload={setPayload}
                  loading={loading}
                  setLoading={setLoading}
                  onOpenWarnings={() => setIsWarningsDrawerOpen(true)}
                  onOpenTestModal={() => setIsTestRunnerOpen(true)}
                  onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
                  editFacultyNotice={editFacultyNotice}
                  setEditFacultyNotice={setEditFacultyNotice}
                  justClearedNotice={justClearedNotice}
                  setJustClearedNotice={setJustClearedNotice}
                  onUploadFile={handleUploadFile}
                  onReanalyze={handleReanalyze}
                  onLoadSession={handleLoadSession}
                />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  </div>

      {/* Global Modals & Drawers */}
      <DataQualityDrawer
        isOpen={isWarningsDrawerOpen}
        onClose={() => setIsWarningsDrawerOpen(false)}
        warnings={payload?.warnings || []}
      />

      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
      />

      <SecurityShieldModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      {alreadyAnalysedMatch && (
        <AlreadyAnalysedModal
          isOpen={isAlreadyAnalysedModalOpen}
          onClose={() => {
            setIsAlreadyAnalysedModalOpen(false);
            setPendingUploadData(null);
            setAlreadyAnalysedMatch(null);
          }}
          match={alreadyAnalysedMatch}
          onLookupExisting={handleLookupExisting}
          onEditFaculty={handleEditFacultyFromExisting}
          onForceReanalyze={handleForceReanalyze}
        />
      )}

      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TechieProvider>
          <BeeProvider>
            <AppRoutes />
          </BeeProvider>
        </TechieProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
