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
  Layers,
} from 'lucide-react';
import { College, Department, AuthUser } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';

interface DepartmentLoginScreenProps {
  college?: College | null;
  department?: Department | null;
  onLoginSuccess: (dept: Department, user: AuthUser, token: string) => void;
  onBackToDepartments: () => void;
  onBackToColleges: () => void;
}

export const DepartmentLoginScreen: React.FC<DepartmentLoginScreenProps> = ({
  college,
  department,
  onLoginSuccess,
  onBackToDepartments,
  onBackToColleges,
}) => {
  const [email, setEmail] = useState(department?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Forgot Password State
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
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [showDemoOtp, setShowDemoOtp] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const forgotOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/departments/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          departmentId: department?.id,
          collegeId: college?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isLocked) {
          setIsLocked(true);
        }
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        throw new Error(data.error || 'Invalid credentials.');
      }

      // Save department session
      sessionStorage.setItem(
        'marks_analyzer_dept_auth',
        JSON.stringify({
          department: data.department,
          college: data.college,
          user: data.user,
          token: data.token,
        })
      );

      // Also set primary auth for analysis portal compatibility
      localStorage.setItem(
        'ubdt_marks_analyzer_auth',
        JSON.stringify({
          user: data.user,
          token: data.token,
        })
      );

      onLoginSuccess(data.department, data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Department authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password OTP request
  const handleInitiateForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await fetch('/api/departments/forgot-password/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch reset OTP.');

      setDevOtp(data.devOtp || null);
      setEmailDelivered(Boolean(data.emailDelivered));
      setShowDemoOtp(false);
      setTimeLeft(600);
      setForgotStep('verify');
      setTimeout(() => forgotOtpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setForgotError(err.message || 'Error requesting reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Verify OTP and reset password
  const handleVerifyForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const code = forgotOtp.join('');
    if (code.length !== 6) {
      setForgotError('Please enter all 6 digits.');
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
      const res = await fetch('/api/departments/forgot-password/verify', {
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

      setForgotSuccess(data.message || 'Department password reset successfully!');
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotSuccess(null);
        setForgotStep('request');
        setPassword('');
      }, 1500);
    } catch (err: any) {
      setForgotError(err.message || 'Error resetting password.');
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

  return (
    <div className="min-h-screen bg-slate-950/65 backdrop-blur-xs text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
              {department?.code || (department?.name ? department.name.slice(0, 3).toUpperCase() : 'DEP')}
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Level 2 Access</span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Department Login</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onBackToColleges}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title="Switch to another college"
            >
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Switch College</span>
            </button>
            <button
              type="button"
              onClick={onBackToDepartments}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Departments</span>
            </button>
          </div>
        </div>

        {/* Department & College Identity Badge */}
        {(college || department) && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            {college && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 p-0.5 overflow-hidden shrink-0">
                  {college.collegeLogoUrl ? (
                    <img src={college.collegeLogoUrl} alt={college.name} className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-full h-full text-blue-600" />
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-600 truncate">{college.name}</span>
              </div>
            )}
            <div className="font-bold text-slate-900 text-sm">
              {department?.name || 'Department Faculty Portal'}
            </div>
          </div>
        )}

        {/* Lockout Banner */}
        {isLocked && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Department Account Locked</span>
              <p className="text-slate-600 leading-relaxed">
                Maximum login attempts reached. For data protection, this department account is temporarily locked for 15 minutes.
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
              Department Official Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. cse@college.edu"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Department Password
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
                placeholder="Enter department password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
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
              ⚠️ {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before lockout.
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
                <span>Authenticating Department...</span>
              </>
            ) : (
              <>
                <span>Enter Analysis Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={onBackToDepartments}
            className="hover:text-blue-600 transition-colors font-medium"
          >
            ← Switch department
          </button>
          <button
            type="button"
            onClick={onBackToColleges}
            className="hover:text-slate-800 transition-colors"
          >
            Switch college
          </button>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Reset Department Password</h3>
              <p className="text-xs text-slate-500">
                {forgotStep === 'request'
                  ? `Enter department official email to receive a 6-digit OTP code.`
                  : `Enter the 6-digit code dispatched to ${forgotEmail}`}
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
              emailDelivered ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-950">Real Reset Code Dispatched!</div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Dispatched to <strong className="text-slate-900">{forgotEmail}</strong> via SMTP. Please check your inbox or spam.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Live code not delivered: SMTP email server is not connected.</span>
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
                        onClick={() => setShowDemoOtp(!showDemoOtp)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                      >
                        {showDemoOtp ? 'Hide Dev Code' : 'Show Dev Code'}
                      </button>
                    )}
                  </div>
                  {showDemoOtp && devOtp && (
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. cse@ubdtce.ac.in"
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
                    {forgotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Send Code</span>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyForgot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">6-Digit Code</label>
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

      {/* SMTP Setup Modal */}
      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={forgotEmail || department?.email || ''}
        resendPurpose="dept_reset"
        onSmtpSaved={() => {
          setIsSmtpModalOpen(false);
          handleInitiateForgot({ preventDefault: () => {} } as any);
        }}
      />
    </div>
  );
};
