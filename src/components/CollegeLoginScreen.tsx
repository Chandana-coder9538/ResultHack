import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { College } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';

interface CollegeLoginScreenProps {
  selectedCollege?: College | null;
  initialEmail?: string;
  onLoginSuccess: (college: College, token: string) => void;
  onNavigateRegister: () => void;
  onNavigateBack: () => void;
}

export const CollegeLoginScreen: React.FC<CollegeLoginScreenProps> = ({
  selectedCollege,
  initialEmail = '',
  onLoginSuccess,
  onNavigateRegister,
  onNavigateBack,
}) => {
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [forgotEmailDelivered, setForgotEmailDelivered] = useState(false);
  const [showForgotDemoOtp, setShowForgotDemoOtp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const forgotOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Self-Service Deletion Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'request' | 'verify'>('request');
  const [deleteEmail, setDeleteEmail] = useState(selectedCollege?.email || '');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtp, setDeleteOtp] = useState(['', '', '', '', '', '']);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteDevOtp, setDeleteDevOtp] = useState<string | null>(null);
  const [deleteEmailDelivered, setDeleteEmailDelivered] = useState(false);
  const [showDeleteDemoOtp, setShowDeleteDemoOtp] = useState(false);
  const [deleteTimeLeft, setDeleteTimeLeft] = useState(600);
  const deleteOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot Password Countdown
  useEffect(() => {
    if (!isForgotModalOpen || forgotStep !== 'verify') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isForgotModalOpen, forgotStep]);

  // Delete Countdown
  useEffect(() => {
    if (!isDeleteModalOpen || deleteStep !== 'verify') return;
    const timer = setInterval(() => {
      setDeleteTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isDeleteModalOpen, deleteStep]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/colleges/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          collegeId: selectedCollege?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isLocked) {
          setIsLocked(true);
          setLockoutUntil(data.lockoutUntil);
        }
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        throw new Error(data.error || 'Invalid credentials.');
      }

      // Save college session
      sessionStorage.setItem(
        'marks_analyzer_college_auth',
        JSON.stringify({
          college: data.college,
          token: data.token,
        })
      );

      onLoginSuccess(data.college, data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Initiate Password Reset (Send OTP)
  const handleInitiateForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await fetch('/api/colleges/forgot-password/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset code.');

      setDevOtp(data.devOtp || null);
      setForgotEmailDelivered(Boolean(data.emailDelivered));
      setShowForgotDemoOtp(false);
      setTimeLeft(600);
      setForgotStep('verify');
      setTimeout(() => forgotOtpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setForgotError(err.message || 'Error sending reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Verify OTP and Save New Password
  const handleVerifyForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const code = forgotOtp.join('');
    if (code.length !== 6) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setForgotError('Password must be at least 8 characters long and contain letters and numbers.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch('/api/colleges/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: code,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');

      setForgotSuccess(data.message || 'Password reset successfully!');
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotSuccess(null);
        setForgotStep('request');
        setPassword('');
      }, 1500);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/[^0-9]/g, '');
    const newOtp = [...forgotOtp];
    newOtp[index] = digit;
    setForgotOtp(newOtp);
    if (digit && index < 5) {
      forgotOtpRefs.current[index + 1]?.focus();
    }
  };

  // Self-Service College Deletion Handlers
  const handleInitiateDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteLoading(true);

    try {
      const res = await fetch('/api/colleges/delete-request/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (deleteEmail || email).trim().toLowerCase(),
          password: deletePassword,
          collegeId: selectedCollege?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch deletion authorization code.');

      setDeleteDevOtp(data.devOtp || null);
      setDeleteEmailDelivered(Boolean(data.emailDelivered));
      setShowDeleteDemoOtp(false);
      setDeleteTimeLeft(600);
      setDeleteStep('verify');
      setTimeout(() => deleteOtpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setDeleteError(err.message || 'Error requesting deletion code.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = deleteOtp.join('');
    if (code.length !== 6) {
      setDeleteError('Please enter all 6 digits of the deletion authorization code.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/colleges/delete-request/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (deleteEmail || email).trim().toLowerCase(),
          otp: code,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion verification failed.');

      setDeleteSuccess(data.message || 'College account deleted successfully.');
      setTimeout(() => {
        setIsDeleteModalOpen(false);
        onNavigateBack(); // Return to college selection screen
      }, 1500);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to execute college deletion.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteOtpChange = (index: number, val: string) => {
    const digit = val.replace(/[^0-9]/g, '');
    const newOtp = [...deleteOtp];
    newOtp[index] = digit;
    setDeleteOtp(newOtp);
    if (digit && index < 5) {
      deleteOtpRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950/65 backdrop-blur-xs text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center shadow-inner overflow-hidden p-1.5 shrink-0">
              {selectedCollege?.collegeLogoUrl ? (
                <img src={selectedCollege.collegeLogoUrl} alt={selectedCollege.name} className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Level 1 Access</span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">College Login</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSmtpModalOpen(true)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
              title="Configure real SMTP email verification"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">SMTP</span>
            </button>
            <button
              onClick={onNavigateBack}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Colleges</span>
            </button>
          </div>
        </div>

        {/* Selected College Branding Banner */}
        {selectedCollege && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 line-clamp-1">{selectedCollege.name}</div>
              <div className="text-[11px] text-slate-500 line-clamp-1">{selectedCollege.universityName}</div>
            </div>
            {selectedCollege.universityLogoUrl && (
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-1 shrink-0 overflow-hidden ml-2 shadow-xs">
                <img src={selectedCollege.universityLogoUrl} alt="University" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        )}

        {/* Lockout Banner */}
        {isLocked && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">College Account Temporarily Locked</span>
              <p className="text-slate-600 leading-relaxed">
                Maximum login attempts exceeded. For security, access is temporarily locked. You may reset your password below or wait 15 minutes.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && !isLocked && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              College Official Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. principal@ubdtce.ac.in"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotError(null);
                  setForgotStep('request');
                  setIsForgotModalOpen(true);
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter college account password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {attemptsRemaining !== null && attemptsRemaining > 0 && (
            <p className="text-[11px] text-amber-600 font-medium">
              ⚠️ {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before temporary lockout.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating College...</span>
              </>
            ) : (
              <>
                <span>Sign In to College</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <button
            type="button"
            onClick={onNavigateRegister}
            className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Register new college account
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setDeleteEmail(selectedCollege?.email || email || '');
                setDeletePassword('');
                setDeleteError(null);
                setDeleteStep('request');
                setIsDeleteModalOpen(true);
              }}
              className="text-rose-500 hover:text-rose-700 transition-colors inline-flex items-center gap-1 font-medium"
              title="Permanently delete this college account"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete college</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={onNavigateBack}
              className="hover:text-slate-800 transition-colors"
            >
              Switch college
            </button>
          </div>
        </div>
      </div>

      {/* DELETE COLLEGE MODAL (Dual email verification required) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Delete College Account</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deleteStep === 'request'
                  ? 'Confirm your credentials. A 6-digit authorization code will be sent to the official college email before permanent deletion.'
                  : `Enter the 6-digit deletion code dispatched to ${deleteEmail || 'official college email'}.`}
              </p>
            </div>

            {deleteSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{deleteSuccess}</span>
              </div>
            )}

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {deleteStep === 'verify' && (
              deleteEmailDelivered ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-950">Real Deletion Code Dispatched!</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Sent to <strong className="text-slate-900">{deleteEmail}</strong> via SMTP. Check your inbox or spam.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Live code not delivered: SMTP server is not connected.</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSmtpModalOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Connect SMTP
                    </button>
                    {deleteDevOtp && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteDemoOtp(!showDeleteDemoOtp)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                      >
                        {showDeleteDemoOtp ? 'Hide Dev Code' : 'Show Dev Code'}
                      </button>
                    )}
                  </div>
                  {showDeleteDemoOtp && deleteDevOtp && (
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-2 rounded-xl text-xs">
                      <span>Dev Code: <strong className="font-mono">{deleteDevOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setDeleteOtp(deleteDevOtp.split(''))}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px]"
                      >
                        Quick Fill
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {deleteStep === 'request' ? (
              <form onSubmit={handleInitiateDelete} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official College Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    placeholder="official-email@college.edu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    College Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password to authorize request"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ <strong>Irreversible Action:</strong> Deleting this college will purge all associated departments, student records, and marks analysis data permanently.
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteLoading}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-2"
                  >
                    {deleteLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Send Deletion Code</span>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyDelete} className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  {deleteOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (deleteOtpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDeleteOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && idx > 0) {
                          deleteOtpRefs.current[idx - 1]?.focus();
                        }
                      }}
                      className="w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50"
                    />
                  ))}
                </div>

                <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Code expires in {Math.floor(deleteTimeLeft / 60)}:{(deleteTimeLeft % 60).toString().padStart(2, '0')}</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteStep('request')}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={deleteLoading || deleteOtp.join('').length !== 6}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-2"
                  >
                    {deleteLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Confirm & Permanently Delete</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SMTP SETUP MODAL */}
      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={email || selectedCollege?.email || 'chethankg350@gmail.com'}
      />

      {/* FORGOT PASSWORD MODAL */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Reset College Password</h3>
              <p className="text-xs text-slate-500">
                {forgotStep === 'request'
                  ? 'Enter the college official email to receive a 6-digit verification code.'
                  : `Enter the 6-digit code sent to ${forgotEmail} and your new password.`}
              </p>
            </div>

            {forgotSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 'verify' && (
              forgotEmailDelivered ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-950">Real Reset Code Dispatched!</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Sent to <strong className="text-slate-900">{forgotEmail}</strong> via SMTP. Check your inbox or spam.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Live reset email not delivered: SMTP is not connected.</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsSmtpModalOpen(true)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Connect SMTP
                    </button>
                    {devOtp && (
                      <button
                        type="button"
                        onClick={() => setShowForgotDemoOtp(!showForgotDemoOtp)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                      >
                        {showForgotDemoOtp ? 'Hide Dev Code' : 'Show Dev Code'}
                      </button>
                    )}
                  </div>
                  {showForgotDemoOtp && devOtp && (
                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-2 rounded-xl text-xs">
                      <span>Dev Code: <strong className="font-mono">{devOtp}</strong></span>
                      <button
                        type="button"
                        onClick={() => setForgotOtp(devOtp.split(''))}
                        className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px]"
                      >
                        Quick Fill
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleInitiateForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. principal@ubdtce.ac.in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Send OTP</span>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyForgot} className="space-y-4">
                {/* 6 Digit Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">6-Digit OTP</label>
                  <div className="flex items-center justify-center gap-2">
                    {forgotOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (forgotOtpRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        className="w-10 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, letter & number"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || forgotOtp.join('').length !== 6}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Reset Password</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
