import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Mail,
  Lock,
  LogOut,
  RefreshCw,
  BookOpen,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Layers,
  Trash2,
  AlertTriangle,
  Sliders,
  Send,
} from 'lucide-react';
import { College, Department } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';
import { useTechie } from '../context/TechieContext';
import { useAuth } from '../context/AuthContext';

interface DepartmentSelectionScreenProps {
  college: College;
  collegeToken: string;
  onSelectDepartment: (dept: Department) => void;
  onCollegeLogout: () => void;
}

export const DepartmentSelectionScreen: React.FC<DepartmentSelectionScreenProps> = ({
  college,
  collegeToken,
  onSelectDepartment,
  onCollegeLogout,
}) => {
  const navigate = useNavigate();
  const techie = useTechie();
  const { loginDepartment } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // SMTP Setup Modal State
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Add Department Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modalStep, setModalStep] = useState<'form' | 'otp'>('form');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Add Department OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [addDeptEmailDelivered, setAddDeptEmailDelivered] = useState(false);
  const [showAddDeptDemoOtp, setShowAddDeptDemoOtp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Department Deletion State
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isDeleteDeptModalOpen, setIsDeleteDeptModalOpen] = useState(false);
  const [deleteDeptStep, setDeleteDeptStep] = useState<'confirm' | 'otp'>('confirm');
  const [deleteDeptOtp, setDeleteDeptOtp] = useState(['', '', '', '', '', '']);
  const [deleteDeptDevOtp, setDeleteDeptDevOtp] = useState<string | null>(null);
  const [deleteDeptLoading, setDeleteDeptLoading] = useState(false);
  const [deleteDeptError, setDeleteDeptError] = useState<string | null>(null);
  const [deleteDeptConfirmName, setDeleteDeptConfirmName] = useState('');
  const [deleteDeptTimeLeft, setDeleteDeptTimeLeft] = useState(300);
  const deleteDeptOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // College Deletion State
  const [isDeleteCollegeModalOpen, setIsDeleteCollegeModalOpen] = useState(false);
  const [deleteCollegeStep, setDeleteCollegeStep] = useState<'confirm' | 'otp'>('confirm');
  const [deleteCollegeOtp, setDeleteCollegeOtp] = useState(['', '', '', '', '', '']);
  const [deleteCollegeDevOtp, setDeleteCollegeDevOtp] = useState<string | null>(null);
  const [deleteCollegeConfirmName, setDeleteCollegeConfirmName] = useState('');
  const [deleteCollegeLoading, setDeleteCollegeLoading] = useState(false);
  const [deleteCollegeError, setDeleteCollegeError] = useState<string | null>(null);
  const [deleteCollegeTimeLeft, setDeleteCollegeTimeLeft] = useState(300);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const deleteCollegeOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/colleges/${college.id}/departments`, {
        headers: { Authorization: `Bearer ${collegeToken}` },
      });
      if (!res.ok) throw new Error('Failed to load departments');
      const data = await res.json();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || 'Error loading departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [college.id]);

  // Timers for Add Department OTP
  useEffect(() => {
    if (!isAddModalOpen || modalStep !== 'otp') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAddModalOpen, modalStep]);

  useEffect(() => {
    if (!isAddModalOpen || modalStep !== 'otp') return;
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    setCanResend(false);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAddModalOpen, modalStep, resendCooldown]);

  // Timers for Delete Department OTP
  useEffect(() => {
    if (!isDeleteDeptModalOpen || deleteDeptStep !== 'otp') return;
    const timer = setInterval(() => {
      setDeleteDeptTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isDeleteDeptModalOpen, deleteDeptStep]);

  // Timers for Delete College OTP
  useEffect(() => {
    if (!isDeleteCollegeModalOpen || deleteCollegeStep !== 'otp') return;
    const timer = setInterval(() => {
      setDeleteCollegeTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isDeleteCollegeModalOpen, deleteCollegeStep]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(null), 4500);
    return () => clearTimeout(t);
  }, [successToast]);

  // -------------------------------------------------------------
  // ADD DEPARTMENT HANDLERS
  // -------------------------------------------------------------
  const handleInitiateAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setFormError('Department name, email, and password are required.');
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setFormError('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    // Client-side anti-duplication pre-check
    const duplicateName = departments.find(
      (d) => d.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicateName) {
      setFormError(`A department named "${cleanName}" already exists in this college.`);
      return;
    }

    if (cleanCode) {
      const duplicateCode = departments.find(
        (d) => d.code && d.code.trim().toUpperCase() === cleanCode
      );
      if (duplicateCode) {
        setFormError(`A department with code "${cleanCode}" already exists in this college.`);
        return;
      }
    }

    const duplicateEmail = departments.find(
      (d) => d.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setFormError(`Department email "${cleanEmail}" is already registered.`);
      return;
    }

    if (cleanEmail === college.email.trim().toLowerCase()) {
      setFormError('Department email cannot be identical to the college official email.');
      return;
    }

    setFormLoading(true);

    try {
      const res = await fetch(`/api/colleges/${college.id}/departments/register/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          name: cleanName,
          code: cleanCode || cleanName.slice(0, 4).toUpperCase(),
          email: cleanEmail,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate department creation.');

      setDevOtp(data.devOtp || null);
      setAddDeptEmailDelivered(Boolean(data.emailDelivered));
      setShowAddDeptDemoOtp(false);
      setTimeLeft(600);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setModalStep('otp');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setFormError(err.message || 'Error initiating department registration.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerifyDeptOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setOtpError('Please enter all 6 digits of the OTP code.');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch(`/api/colleges/${college.id}/departments/register/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: fullCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      setIsAddModalOpen(false);
      setModalStep('form');
      setName('');
      setCode('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSuccessToast(`Department "${data.department?.name || 'New'}" successfully registered!`);

      if (data.department && data.token) {
        loginDepartment(data.department, college, data.token);
        navigate('/department/dashboard');
        return;
      }

      fetchDepartments();
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  // -------------------------------------------------------------
  // DEPARTMENT DELETION HANDLERS (2-Way Email Verification)
  // -------------------------------------------------------------
  const handleOpenDeleteDept = (dept: Department, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeptToDelete(dept);
    setDeleteDeptStep('confirm');
    setDeleteDeptError(null);
    setDeleteDeptDevOtp(null);
    setDeleteDeptOtp(['', '', '', '', '', '']);
    setIsDeleteDeptModalOpen(true);
    techie.play('delete_confirm', 'Please enter the code sent to your email to confirm department deletion.');
  };

  const handleInitiateDeptDelete = async () => {
    if (!deptToDelete) return;
    setDeleteDeptLoading(true);
    setDeleteDeptError(null);

    try {
      const res = await fetch(
        `/api/colleges/${college.id}/departments/${deptToDelete.id}/delete/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${collegeToken}`,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch deletion authorization code.');

      setDeleteDeptDevOtp(data.devOtp || null);
      setDeleteDeptTimeLeft(600);
      setDeleteDeptStep('otp');
      setTimeout(() => deleteDeptOtpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setDeleteDeptError(err.message || 'Error requesting deletion code.');
    } finally {
      setDeleteDeptLoading(false);
    }
  };

  const handleVerifyDeptDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptToDelete) return;

    if (deleteDeptConfirmName.trim().toLowerCase() !== deptToDelete.name.trim().toLowerCase()) {
      setDeleteDeptError(`Please type "${deptToDelete.name}" exactly to confirm deletion.`);
      return;
    }

    const fullCode = deleteDeptOtp.join('');
    if (fullCode.length !== 6) {
      setDeleteDeptError('Please enter all 6 digits of the deletion authorization code.');
      return;
    }

    setDeleteDeptLoading(true);
    setDeleteDeptError(null);

    try {
      // 1. Verify OTP and get short-lived verificationToken
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: deptToDelete.email,
          purpose: 'dept_delete',
          otp: fullCode,
          targetId: deptToDelete.id,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Deletion authorization failed.');

      // 2. Execute deletion
      const res = await fetch(`/api/department/${deptToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          verificationToken: verifyData.verificationToken,
          confirmationName: deleteDeptConfirmName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion execution failed.');

      setIsDeleteDeptModalOpen(false);
      setSuccessToast(`Department "${deptToDelete.name}" and all its marksheets have been permanently erased.`);
      setDeptToDelete(null);
      setDeleteDeptConfirmName('');
      fetchDepartments();
    } catch (err: any) {
      setDeleteDeptError(err.message || 'Failed to execute deletion.');
    } finally {
      setDeleteDeptLoading(false);
    }
  };

  // -------------------------------------------------------------
  // COLLEGE DELETION HANDLERS (Official Email Verification)
  // -------------------------------------------------------------
  const handleOpenDeleteCollege = () => {
    setDeleteCollegeStep('confirm');
    setDeleteCollegeError(null);
    setDeleteCollegeDevOtp(null);
    setDeleteCollegeOtp(['', '', '', '', '', '']);
    setDeleteCollegeConfirmName('');
    setIsDeleteCollegeModalOpen(true);
  };

  const handleRemoveAllDepartments = async () => {
    if (!window.confirm(`Are you sure you want to remove all ${departments.length} department(s) to start fresh? This cannot be undone.`)) {
      return;
    }
    setPurgeLoading(true);
    setDeleteCollegeError(null);
    try {
      const res = await fetch(`/api/colleges/${college.id}/departments/remove-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove departments.');
      setSuccessToast(`All ${data.removedCount || departments.length} department(s) have been permanently removed. College now has 0 departments.`);
      await fetchDepartments();
    } catch (err: any) {
      setDeleteCollegeError(err.message || 'Error removing all departments.');
    } finally {
      setPurgeLoading(false);
    }
  };

  const handleInitiateCollegeDelete = async () => {
    // Strict requirement: all departments must be deleted first
    if (departments.length > 0) {
      setDeleteCollegeError(
        `Cannot delete college: All departments must be deleted first. There are still ${departments.length} active department(s) registered under "${college.name}". Please delete all departments first before proceeding.`
      );
      return;
    }

    setDeleteCollegeLoading(true);
    setDeleteCollegeError(null);

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          email: college.email,
          purpose: 'college_delete',
          targetId: college.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch college deletion code.');

      setDeleteCollegeDevOtp(data.devOtp || null);
      setDeleteCollegeTimeLeft(300);
      setDeleteCollegeStep('otp');
      setTimeout(() => deleteCollegeOtpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setDeleteCollegeError(err.message || 'Error requesting college deletion code.');
    } finally {
      setDeleteCollegeLoading(false);
    }
  };

  const handleVerifyCollegeDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteCollegeConfirmName.trim().toLowerCase() !== college.name.trim().toLowerCase()) {
      setDeleteCollegeError(`Please type "${college.name}" exactly to confirm deletion.`);
      return;
    }

    const fullCode = deleteCollegeOtp.join('');
    if (fullCode.length !== 6) {
      setDeleteCollegeError('Please enter all 6 digits of the deletion authorization code.');
      return;
    }

    setDeleteCollegeLoading(true);
    setDeleteCollegeError(null);

    try {
      // 1. Verify OTP and get short-lived verificationToken
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: college.email,
          purpose: 'college_delete',
          otp: fullCode,
          targetId: college.id,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'College deletion authorization failed.');

      // 2. Execute deletion
      const res = await fetch(`/api/college/${college.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          verificationToken: verifyData.verificationToken,
          confirmationName: deleteCollegeConfirmName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'College deletion failed.');

      setIsDeleteCollegeModalOpen(false);
      sessionStorage.removeItem('marks_analyzer_college_auth');
      sessionStorage.removeItem('marks_analyzer_dept_auth');
      sessionStorage.removeItem('marks_analyzer_selected_college');
      onCollegeLogout();
    } catch (err: any) {
      setDeleteCollegeError(err.message || 'Failed to execute college deletion.');
    } finally {
      setDeleteCollegeLoading(false);
    }
  };

  // OTP Helper for 6-box input
  const handleDigitChange = (
    index: number,
    value: string,
    state: string[],
    setState: (val: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (value.length > 1) {
      const digits = value.replace(/[^0-9]/g, '').slice(0, 6).split('');
      const newState = [...state];
      digits.forEach((d, idx) => {
        newState[idx] = d;
      });
      setState(newState);
      const nextIdx = Math.min(digits.length, 5);
      refs.current[nextIdx]?.focus();
      return;
    }

    const digit = value.replace(/[^0-9]/g, '');
    const newState = [...state];
    newState[index] = digit;
    setState(newState);

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    state: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !state[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950/65 backdrop-blur-xs text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background Glow Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 p-4 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* College Identity */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-slate-700 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
              {college.collegeLogoUrl ? (
                <img
                  src={college.collegeLogoUrl}
                  alt={college.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                  {college.name}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  AUTHENTICATED
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <span>{college.universityName}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono text-[11px]">{college.email}</span>
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* SMTP Settings Button */}
            <button
              onClick={() => setIsSmtpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title="Configure real SMTP email delivery and test live emails"
            >
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Email & SMTP</span>
            </button>

            {/* Add Department Button */}
            <button
              onClick={() => {
                setModalStep('form');
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Department</span>
            </button>

            {/* Delete College Button */}
            <button
              onClick={handleOpenDeleteCollege}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-xs font-medium border border-slate-700/80 hover:border-rose-800/60 transition-colors cursor-pointer"
              title="Permanently Delete College Account"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden lg:inline text-rose-300">Delete College</span>
            </button>

            {/* Switch / Logout College */}
            <button
              onClick={onCollegeLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="Logout from College Session"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Switch College</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 flex flex-col">
        {/* Banner Section */}
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
            <Layers className="w-4 h-4" />
            <span>Academic Department Vaults</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Select Department
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Each academic department operates with strict tenant isolation. Authenticate with the department credentials to access its marks analysis, rank lists, and official reports.
          </p>
        </div>

        {/* Loading / Error / Empty States / Department Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-4">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading college departments...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center space-y-3">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchDepartments}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : departments.length === 0 ? (
          /* Zero Default Departments: Clean, welcoming empty state */
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Departments Registered Yet</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              This college starts completely clean with no pre-configured default departments. Register your official departments (e.g. CSE, Mechanical, ECE) with 6-digit email OTP verification.
            </p>
            <button
              onClick={() => {
                setModalStep('form');
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xl shadow-blue-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add First Department</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <div
                key={dept.id}
                onClick={() => onSelectDepartment(dept)}
                className="group cursor-pointer bg-slate-900/60 hover:bg-slate-900/80 border border-slate-700/60 hover:border-blue-500/60 rounded-3xl p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-blue-500/20 flex flex-col justify-between relative overflow-hidden backdrop-blur-md btn-tilt-3d"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
                      {dept?.code || (dept?.name ? dept.name.slice(0, 3).toUpperCase() : 'DEP')}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        ISOLATED
                      </span>

                      {/* Delete Department Trigger */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteDept(dept, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Department (Requires verification code)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors line-clamp-2">
                      {dept?.name}
                    </h3>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-400 font-medium">
                      {dept?.code && (
                        <span className="text-blue-400/90 font-mono">Code: {dept.code}</span>
                      )}
                      <span className="text-slate-400 text-[11px] truncate flex items-center gap-1 font-mono">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        {dept.email}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Department Auth Required</span>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1 transition-all">
                    <span>Enter Portal</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}

            {/* "Add Department" Card */}
            <div
              onClick={() => {
                setModalStep('form');
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-800/30 hover:bg-blue-600/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group min-h-[220px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-800 group-hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 flex items-center justify-center mb-3 transition-colors">
                <PlusCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors">
                Add New Department
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Register a new academic department with email OTP verification.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ADD DEPARTMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {modalStep === 'form' ? 'Add College Department' : 'Verify Department Email'}
              </h3>
              <p className="text-xs text-slate-500">
                {modalStep === 'form'
                  ? `Registering under ${college.name}`
                  : `Enter the 6-digit OTP code sent to ${email}`}
              </p>
            </div>

            {formError && modalStep === 'form' && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {otpError && modalStep === 'otp' && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {modalStep === 'otp' && (
              addDeptEmailDelivered ? (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Real-Time Verification Code Dispatched!</span>
                    <p className="text-[11px] text-slate-600">Delivered to {email} via SMTP. Check your inbox.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Live code not delivered: SMTP mail dispatcher not configured.</span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsSmtpModalOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Connect SMTP / Gmail
                    </button>
                    {devOtp && (
                      <button
                        type="button"
                        onClick={() => setShowAddDeptDemoOtp(!showAddDeptDemoOtp)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs"
                      >
                        {showAddDeptDemoOtp ? 'Hide Dev Code' : 'Show Dev Code'}
                      </button>
                    )}
                  </div>
                  {showAddDeptDemoOtp && devOtp && (
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-2 rounded-xl text-xs">
                      <span>Dev Code: <strong className="font-mono">{devOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setOtp(devOtp.split(''))}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px]"
                      >
                        Quick Fill
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {modalStep === 'form' ? (
              <form onSubmit={handleInitiateAddDept} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Department of Mechanical Engineering"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Code <span className="text-slate-400 font-normal">(e.g. ME, CSE, ISE)</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ME"
                    maxLength={8}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Department Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. hod.mech@ubdt.ac.in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department Access Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters (letters & numbers)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {formLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Verification OTP'}
                  </button>
                </div>
              </form>
            ) : (
              /* OTP Verification Step */
              <form onSubmit={handleVerifyDeptOtp} className="space-y-5">
                <div className="flex justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) =>
                        handleDigitChange(idx, e.target.value, otp, setOtp, otpInputRefs)
                      }
                      onKeyDown={(e) => handleDigitKeyDown(idx, e, otp, otpInputRefs)}
                      className="w-11 h-13 text-center text-xl font-bold font-mono border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Expires in: <strong className="font-mono text-slate-700">{formatTimer(timeLeft)}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={!canResend}
                    onClick={handleInitiateAddDept}
                    className="text-blue-600 hover:underline font-semibold disabled:text-slate-400"
                  >
                    {canResend ? 'Resend Code' : `Resend in ${resendCooldown}s`}
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalStep('form')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {otpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE DEPARTMENT MODAL (Two-Way Email Verification) */}
      {isDeleteDeptModalOpen && deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-rose-950 tracking-tight">
                {deleteDeptStep === 'confirm' ? 'Delete Department' : 'Verify Deletion Authorization'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deleteDeptStep === 'confirm'
                  ? `Permanently delete ${deptToDelete?.name || 'Department'} (${deptToDelete?.code || ''})`
                  : `Enter the 6-digit code sent to ${deptToDelete?.email || ''} and ${college?.email || ''}`}
              </p>
            </div>

            {deleteDeptError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteDeptError}</span>
              </div>
            )}

            {deleteDeptDevOtp && deleteDeptStep === 'otp' && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Dev Deletion Code: <strong className="font-mono text-sm font-bold">{deleteDeptDevOtp}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteDeptOtp(deleteDeptDevOtp.split(''))}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold"
                >
                  Quick Fill
                </button>
              </div>
            )}

            {deleteDeptStep === 'confirm' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-950 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Irreversible Permanent Action</span>
                  </div>
                  <p className="leading-relaxed text-slate-600">
                    Deleting this department will permanently wipe all its uploaded marksheets, analytics, pass statistics, and faculty mappings.
                  </p>
                  <p className="leading-relaxed font-semibold text-rose-900 pt-1">
                    Security Requirement: A 6-digit deletion code will be dispatched to <strong>BOTH</strong> the official department email (<span className="font-mono">{deptToDelete.email}</span>) and college email (<span className="font-mono">{college.email}</span>).
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteDeptModalOpen(false);
                      setDeptToDelete(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInitiateDeptDelete}
                    disabled={deleteDeptLoading}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deleteDeptLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Deletion Code'}
                  </button>
                </div>
              </div>
            ) : (
              /* OTP Confirmation Step */
              <form onSubmit={handleVerifyDeptDelete} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700">
                    Type exact department name <span className="font-mono text-rose-600 font-bold">"{deptToDelete.name}"</span> to confirm:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={deptToDelete.name}
                    value={deleteDeptConfirmName}
                    onChange={(e) => setDeleteDeptConfirmName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono bg-white text-slate-900"
                  />
                </div>

                <div className="flex justify-center gap-2">
                  {deleteDeptOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (deleteDeptOtpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) =>
                        handleDigitChange(
                          idx,
                          e.target.value,
                          deleteDeptOtp,
                          setDeleteDeptOtp,
                          deleteDeptOtpRefs
                        )
                      }
                      onKeyDown={(e) =>
                        handleDigitKeyDown(idx, e, deleteDeptOtp, deleteDeptOtpRefs)
                      }
                      className="w-11 h-13 text-center text-xl font-bold font-mono border-2 border-rose-300 rounded-xl focus:border-rose-600 focus:outline-none"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Expires in: <strong className="font-mono text-slate-700">{formatTimer(deleteDeptTimeLeft)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleInitiateDeptDelete}
                    disabled={deleteDeptLoading}
                    className="text-rose-600 hover:underline font-semibold"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteDeptStep('confirm')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={deleteDeptLoading}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deleteDeptLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Delete'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE COLLEGE MODAL (Official Email Verification) */}
      {isDeleteCollegeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-rose-950 tracking-tight">
                {deleteCollegeStep === 'confirm' ? 'Delete College Institution' : 'Verify College Deletion'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deleteCollegeStep === 'confirm'
                  ? `Permanently destroy college account for ${college.name}`
                  : `Enter the 6-digit confirmation code sent to ${college.email}`}
              </p>
            </div>

            {deleteCollegeError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteCollegeError}</span>
              </div>
            )}

            {deleteCollegeDevOtp && deleteCollegeStep === 'otp' && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Dev College Deletion Code: <strong className="font-mono text-sm font-bold">{deleteCollegeDevOtp}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteCollegeOtp(deleteCollegeDevOtp.split(''))}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold"
                >
                  Quick Fill
                </button>
              </div>
            )}

            {deleteCollegeStep === 'confirm' ? (
              departments.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>All Departments Must Be Deleted First</span>
                    </div>
                    <p className="leading-relaxed text-slate-700">
                      Before deleting <strong>{college.name}</strong>, all departments registered under it must be deleted first.
                      There are currently <strong>{departments.length} active department(s)</strong> registered.
                    </p>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Please delete each department below or use the one-click purge to clear all departments and start fresh.
                    </p>
                  </div>

                  {/* List of remaining departments with direct delete shortcuts */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Departments Remaining to Delete ({departments.length})
                    </div>
                    {departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">
                            {dept?.name} {dept?.code ? `(${dept.code})` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate font-mono">{dept.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            setIsDeleteCollegeModalOpen(false);
                            handleOpenDeleteDept(dept, e);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] border border-rose-200 shrink-0 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Delete Dept</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Shortcut to remove all departments at once */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleRemoveAllDepartments}
                      disabled={purgeLoading}
                      className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {purgeLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Remove All {departments.length} Departments (Start Fresh)</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsDeleteCollegeModalOpen(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Close & Delete Departments First
                    </button>
                  </div>
                </div>
              ) : (
                /* 0 Departments: College Deletion Allowed */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>All Departments Cleared (0 Active Departments)</span>
                    </div>
                    <p className="leading-relaxed text-slate-700">
                      All departments under <strong>{college.name}</strong> have been removed. You can now proceed to authorize permanent deletion of this college institution.
                    </p>
                    <p className="leading-relaxed font-semibold text-rose-900 pt-1">
                      To authorize deletion, a 6-digit authorization code will be sent to the official college email: <span className="font-mono">{college.email}</span>.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsDeleteCollegeModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleInitiateCollegeDelete}
                      disabled={deleteCollegeLoading}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {deleteCollegeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send College Deletion Code'}
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* OTP Confirmation Step */
              <form onSubmit={handleVerifyCollegeDelete} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700">
                    Type exact college name <span className="font-mono text-rose-600 font-bold">"{college.name}"</span> to confirm:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={college.name}
                    value={deleteCollegeConfirmName}
                    onChange={(e) => setDeleteCollegeConfirmName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono bg-white text-slate-900"
                  />
                </div>

                <div className="flex justify-center gap-2">
                  {deleteCollegeOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (deleteCollegeOtpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) =>
                        handleDigitChange(
                          idx,
                          e.target.value,
                          deleteCollegeOtp,
                          setDeleteCollegeOtp,
                          deleteCollegeOtpRefs
                        )
                      }
                      onKeyDown={(e) =>
                        handleDigitKeyDown(idx, e, deleteCollegeOtp, deleteCollegeOtpRefs)
                      }
                      className="w-11 h-13 text-center text-xl font-bold font-mono border-2 border-rose-300 rounded-xl focus:border-rose-600 focus:outline-none"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Expires in: <strong className="font-mono text-slate-700">{formatTimer(deleteCollegeTimeLeft)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleInitiateCollegeDelete}
                    disabled={deleteCollegeLoading}
                    className="text-rose-600 hover:underline font-semibold"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteCollegeStep('confirm')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={deleteCollegeLoading}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deleteCollegeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Destroy College'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SMTP Setup Modal */}
      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={email || college.email}
        resendPurpose="dept_register"
        onSmtpSaved={() => {
          setIsSmtpModalOpen(false);
          if (modalStep === 'otp') {
            handleInitiateAddDept({ preventDefault: () => {} } as any);
          }
        }}
      />
    </div>
  );
};
