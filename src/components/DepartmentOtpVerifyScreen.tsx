import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Mail,
  CheckCircle2,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SmtpSetupModal } from './SmtpSetupModal';

export const DepartmentOtpVerifyScreen: React.FC = () => {
  const navigate = useNavigate();
  const { collegeToken, setAuthNotice, college, loginDepartment } = useAuth();

  const [pendingData, setPendingData] = useState<any | null>(null);
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [emailDelivered, setEmailDelivered] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [showDemoOtp, setShowDemoOtp] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);

  // Quick Gmail App Password connect
  const [quickPass, setQuickPass] = useState('');
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [quickConnectSuccess, setQuickConnectSuccess] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem('pending_dept_reg');
    if (!raw) {
      navigate('/department/register', { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setPendingData(parsed);
      setEmailDelivered(Boolean(parsed.emailDelivered));
      setSmtpConfigured(Boolean(parsed.smtpConfigured));
      setDevOtp(parsed.devOtp || null);
    } catch {
      navigate('/department/register', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const canResend = resendCooldown === 0 && timeLeft > 0;

  const maskEmail = (str: string) => {
    if (!str || !str.includes('@')) return str;
    const [userPart, domain] = str.split('@');
    if (userPart.length <= 2) return `${userPart[0]}***@${domain}`;
    return `${userPart[0]}***${userPart[userPart.length - 1]}@${domain}`;
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/[^0-9]/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, idx) => {
        newOtp[idx] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingData) return;

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError(null);
    setIsVerifying(true);

    try {
      // 1. Verify code and receive short-lived token
      const verifyRes = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingData.email.trim().toLowerCase(),
          purpose: 'dept_register',
          otp: fullCode,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Verification failed. Please check your code.');
      }

      const { verificationToken } = verifyData;

      // 2. Complete department registration on server
      const completeRes = await fetch('/api/department/register/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${collegeToken}`,
        },
        body: JSON.stringify({
          verificationToken,
          collegeId: pendingData?.collegeId || college?.id,
          name: pendingData?.name || '',
          code: pendingData?.code || '',
          email: pendingData?.email || '',
          password: pendingData?.password || '',
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || 'Failed to create department.');
      }

      sessionStorage.removeItem('pending_dept_reg');
      setAuthNotice({
        message: `Department "${completeData.department.name}" registered and email verified successfully!`,
        type: 'info',
      });

      const activeCollege = college || {
        id: pendingData.collegeId,
        name: pendingData.collegeName || 'College',
        universityName: pendingData.universityName || 'University',
        email: '',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      if (completeData.department && completeData.token && activeCollege) {
        loginDepartment(completeData.department, activeCollege, completeData.token);
      }

      // Route directly to the Analysis Dashboard
      navigate('/department/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Department verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !pendingData) return;
    setError(null);
    setIsResending(true);

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingData.email.trim().toLowerCase(),
          purpose: 'dept_register',
          name: pendingData.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification code.');
      }

      setEmailDelivered(Boolean(data.emailDelivered));
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDevOtp(data.devOtp || null);
      setTimeLeft(600);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setSuccessMsg(data.message || 'Fresh verification code dispatched!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPass || !pendingData) return;

    setQuickConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/smtp/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingData.email,
          appPassword: quickPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect SMTP.');
      }

      setSmtpConfigured(true);
      setEmailDelivered(true);
      setDevOtp(null);
      setShowDemoOtp(false);
      setQuickConnectSuccess(`Connected to Gmail! Real verification code has been dispatched directly to ${pendingData.email}.`);
      setResendCooldown(60);
      setTimeLeft(600);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'SMTP Connection failed.');
    } finally {
      setQuickConnecting(false);
    }
  };

  if (!pendingData) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/department/register"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Department Form</span>
        </Link>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
          Step 2 of 2: Email Verification
        </span>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-linear-to-b from-indigo-50/50 to-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verify Department Email</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
            A 6-digit verification code was generated for{' '}
            <strong className="text-slate-900 font-semibold">{maskEmail(pendingData.email)}</strong> to authorize the creation of the{' '}
            <strong className="text-slate-900 font-semibold">{pendingData.name}</strong> department.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {smtpConfigured || emailDelivered ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold">Real-Time Email Dispatched via SMTP</span>
                <p className="text-emerald-800 text-[11px]">
                  Delivered to <strong className="font-mono">{pendingData.email}</strong>. Please check your inbox and spam folder.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-950">Live Email Not Yet Sent (SMTP Disconnected)</div>
                  <p className="text-slate-700 text-[11px] leading-relaxed">
                    To receive the real verification code directly in your inbox (<strong className="text-slate-900">{pendingData.email}</strong>), connect your SMTP dispatcher or Gmail App Password below.
                  </p>
                </div>
              </div>

              <form onSubmit={handleQuickConnect} className="bg-white/80 p-3 rounded-xl border border-amber-200/80 space-y-2">
                <div className="text-[11px] font-semibold text-slate-800 flex items-center justify-between">
                  <span>Fast Setup: Send Real Code with Gmail App Password</span>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline text-[10px]"
                  >
                    Get App Password ↗
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="16-character App Password (e.g. abcd efgh ijkl mnop)"
                    value={quickPass}
                    onChange={(e) => setQuickPass(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <button
                    type="submit"
                    disabled={quickConnecting || !quickPass}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {quickConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    <span>Send Real Code</span>
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={() => setIsSmtpModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Configure Custom SMTP / Relay
                </button>
                {devOtp && (
                  <button
                    type="button"
                    onClick={() => setShowDemoOtp(!showDemoOtp)}
                    className="px-2.5 py-1.5 text-amber-800 hover:text-amber-950 text-xs font-semibold underline cursor-pointer"
                  >
                    {showDemoOtp ? 'Hide Dev Mode Code' : 'Show Dev Mode Code'}
                  </button>
                )}
              </div>

              {showDemoOtp && devOtp && (
                <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-xs text-indigo-900 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Dev Mode OTP: <strong className="font-mono text-sm tracking-wider font-bold">{devOtp}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp(devOtp.split(''));
                      setError(null);
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    Quick Fill
                  </button>
                </div>
              )}
            </div>
          )}

          {quickConnectSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{quickConnectSuccess}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-14 sm:w-13 sm:h-16 text-center text-2xl font-mono font-black rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all text-slate-900 bg-slate-50/50 focus:bg-white shadow-xs"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Code expires in:{' '}
                  <strong className={timeLeft < 60 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                    {formatTimer(timeLeft)}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                disabled={!canResend || isResending}
                onClick={handleResend}
                className={`font-semibold transition-colors ${
                  canResend && !isResending
                    ? 'text-indigo-600 hover:text-indigo-700 cursor-pointer'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                {isResending ? (
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Resending...
                  </span>
                ) : canResend ? (
                  'Resend OTP'
                ) : (
                  `Resend in ${resendCooldown}s`
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/department/register"
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all text-center"
              >
                Change Details
              </Link>
              <button
                type="submit"
                disabled={isVerifying || otp.join('').length !== 6 || timeLeft <= 0}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Create Department</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={pendingData?.email}
        resendPurpose="dept_register"
        onSmtpSaved={() => {
          setIsSmtpModalOpen(false);
          handleResend();
        }}
      />
    </div>
  );
};
