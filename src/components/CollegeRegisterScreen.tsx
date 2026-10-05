import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  Upload,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  RefreshCw,
  Clock,
  Sparkles,
  Key,
} from 'lucide-react';
import { College } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';

interface CollegeRegisterScreenProps {
  onRegisterSuccess: (college: College, token: string) => void;
  onNavigateLogin: (email?: string) => void;
  onNavigateBack: () => void;
}

export const CollegeRegisterScreen: React.FC<CollegeRegisterScreenProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
  onNavigateBack,
}) => {
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [collegeLogoUrl, setCollegeLogoUrl] = useState<string>('');
  const [universityLogoUrl, setUniversityLogoUrl] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Error State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicateCollegeId, setDuplicateCollegeId] = useState<string | null>(null);

  // OTP Verification Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [showDemoOtp, setShowDemoOtp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes (600s)
  const [resendCooldown, setResendCooldown] = useState(60); // 60s
  const [canResend, setCanResend] = useState(false);

  const collegeLogoInputRef = useRef<HTMLInputElement>(null);
  const universityLogoInputRef = useRef<HTMLInputElement>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 10-minute expiry countdown
  useEffect(() => {
    if (!isOtpModalOpen) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpModalOpen]);

  // 60-second resend cooldown timer
  useEffect(() => {
    if (!isOtpModalOpen) return;
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    setCanResend(false);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpModalOpen, resendCooldown]);

  // Handle Logo Upload with 2MB limit validation
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImageState: (val: string) => void
  ) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Please upload a valid PNG or JPG image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(`Image "${file.name}" exceeds the maximum allowed size of 2 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageState(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && password === confirmPassword;

  // Step 1: Initiate College Registration (Validate & Send OTP)
  const handleInitiateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateCollegeId(null);

    if (!name.trim() || !universityName.trim() || !email.trim() || !password) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }

    if (!passwordsMatch) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/colleges/register/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          universityName: universityName.trim(),
          collegeLogoUrl,
          universityLogoUrl,
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.code === 'COLLEGE_EXISTS' || data?.code === 'EMAIL_EXISTS') {
          setDuplicateCollegeId(data.collegeId || 'existing');
        }
        throw new Error(data.error || 'Failed to initiate registration.');
      }

      sessionStorage.setItem(
        'pending_college_reg',
        JSON.stringify({
          name: name.trim(),
          universityName: universityName.trim(),
          collegeLogoUrl,
          universityLogoUrl,
          email: email.trim().toLowerCase(),
          password,
          emailDelivered: Boolean(data.emailDelivered),
          smtpConfigured: Boolean(data.smtpConfigured),
          devOtp: data.devOtp || null,
        })
      );

      navigate('/college/verify-otp');
    } catch (err: any) {
      setError(err.message || 'Registration request failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OTP input changes
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
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

  // Step 3: Verify OTP and finalize College Account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code.');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/colleges/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: fullCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify code.');
      }

      // Save college session
      sessionStorage.setItem(
        'marks_analyzer_college_auth',
        JSON.stringify({
          college: data.college,
          token: data.token,
        })
      );

      setIsOtpModalOpen(false);
      onRegisterSuccess(data.college, data.token);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setOtpError(null);

    try {
      const res = await fetch('/api/colleges/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: 'college_register',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend verification code.');

      setEmailDelivered(Boolean(data.emailDelivered));
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setDevOtp(data.devOtp || null);
      setShowDemoOtp(false);
      setTimeLeft(600);
      setResendCooldown(60);
      setCanResend(false);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code.');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Registration Card */}
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 p-6 sm:p-10 my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 flex items-center justify-center shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Onboarding</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                  Step 1 of 2
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Register New College</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSmtpModalOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
              title="Configure real SMTP email verification"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Email & SMTP</span>
            </button>
            <button
              onClick={onNavigateBack}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Colleges</span>
            </button>
          </div>
        </div>

        {/* Duplicate College Notice */}
        {duplicateCollegeId && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <strong>Institution Already Registered:</strong> An account already exists for this college name or email.
              </div>
            </div>
            <button
              onClick={() => onNavigateLogin(email)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-all shrink-0 inline-flex items-center gap-1.5"
            >
              <span>Go to College Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && !duplicateCollegeId && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleInitiateRegister} className="mt-6 space-y-6">
          {/* Section 1: Institutional Identities */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional Details</h3>

            {/* College Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                College Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. University B.D.T. College of Engineering, Davangere"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            {/* University Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Affiliated University Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                  placeholder="e.g. Visvesvaraya Technological University (VTU), Belagavi"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Logo Uploads (Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* College Logo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  College Logo <span className="text-slate-400 font-normal">(PNG/JPG, max 2 MB)</span>
                </label>
                <input
                  type="file"
                  ref={collegeLogoInputRef}
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleImageUpload(e, setCollegeLogoUrl)}
                  className="hidden"
                />
                <div
                  onClick={() => collegeLogoInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500/60 rounded-2xl p-3 flex items-center gap-3 cursor-pointer bg-slate-50/60 hover:bg-blue-50/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {collegeLogoUrl ? (
                      <img src={collegeLogoUrl} alt="College Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {collegeLogoUrl ? 'Logo Uploaded ✓' : 'Upload College Logo'}
                    </div>
                    <div className="text-[11px] text-slate-500">Click to choose image</div>
                  </div>
                </div>
              </div>

              {/* University Logo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  University Logo <span className="text-slate-400 font-normal">(PNG/JPG, max 2 MB)</span>
                </label>
                <input
                  type="file"
                  ref={universityLogoInputRef}
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleImageUpload(e, setUniversityLogoUrl)}
                  className="hidden"
                />
                <div
                  onClick={() => universityLogoInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500/60 rounded-2xl p-3 flex items-center gap-3 cursor-pointer bg-slate-50/60 hover:bg-blue-50/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {universityLogoUrl ? (
                      <img src={universityLogoUrl} alt="University Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <GraduationCap className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {universityLogoUrl ? 'Logo Uploaded ✓' : 'Upload University Logo'}
                    </div>
                    <div className="text-[11px] text-slate-500">Click to choose image</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Account & Security */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Credentials</h3>

            {/* Official College Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                College Official Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. principal@ubdtce.ac.in"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">A 6-digit OTP verification code will be sent to this email address.</p>
            </div>

            {/* Password & Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, letters & numbers"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Password Requirement Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className={`px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${hasMinLength ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                {hasMinLength ? '✓' : '•'} 8+ characters
              </span>
              <span className={`px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${hasLetter ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                {hasLetter ? '✓' : '•'} At least 1 letter
              </span>
              <span className={`px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${hasNumber ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                {hasNumber ? '✓' : '•'} At least 1 number
              </span>
              {confirmPassword && (
                <span className={`px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${passwordsMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                </span>
              )}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigateLogin(email)}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors order-2 sm:order-1"
            >
              Already registered? Sign in instead
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center justify-center gap-2 order-1 sm:order-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Send 6-Digit OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 6-DIGIT OTP VERIFICATION MODAL */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-900 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Verify College Email</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter the 6-digit OTP code dispatched to <strong className="text-slate-800">{email}</strong> to verify your account.
              </p>
            </div>

            {/* Live Email Delivery Status or Dev Mode Helper */}
            {emailDelivered ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-emerald-950">Real-Time Verification Code Dispatched!</div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    A real email was dispatched to <strong className="text-slate-900">{email}</strong> via verified SMTP. Please check your inbox or spam folder.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-950">Live Email Not Dispatched (SMTP Not Connected)</div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      To receive the real verification code in your inbox (<strong className="text-slate-900">{email}</strong>), connect your SMTP server or Gmail App Password.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsSmtpModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Connect Real SMTP / Gmail</span>
                  </button>
                  {devOtp && (
                    <button
                      type="button"
                      onClick={() => setShowDemoOtp(!showDemoOtp)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      {showDemoOtp ? 'Hide Dev Code' : 'Use Dev Code for Demo'}
                    </button>
                  )}
                </div>
                {showDemoOtp && devOtp && (
                  <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-xs text-indigo-900 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Dev Mode Code: <strong className="font-mono text-sm tracking-wider font-bold">{devOtp}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtp(devOtp.split(''));
                        setOtpError(null);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      Quick Fill
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* OTP Error */}
            {otpError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              {/* 6 Digit Input Boxes */}
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
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all text-slate-900 shadow-sm"
                  />
                ))}
              </div>

              {/* Timer and Resend Controls */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expires in: <strong className={timeLeft < 60 ? 'text-rose-600 font-bold' : 'text-slate-700'}>{formatTimer(timeLeft)}</strong></span>
                </div>

                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleResendOtp}
                  className={`font-semibold transition-colors ${canResend ? 'text-blue-600 hover:text-blue-700 cursor-pointer' : 'text-slate-400 cursor-not-allowed'}`}
                >
                  {canResend ? 'Resend OTP' : `Resend in ${resendCooldown}s`}
                </button>
              </div>

              {/* Delivery Help / SMTP Link */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setIsSmtpModalOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 font-medium"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Didn't receive real email in inbox? Configure SMTP Dispatcher</span>
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOtpModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpLoading || otp.join('').length !== 6}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {otpLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Create</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMTP Setup Modal */}
      <SmtpSetupModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        defaultRecipientEmail={email}
        resendPurpose="college_register"
        onSmtpSaved={() => {
          setIsSmtpModalOpen(false);
          handleResendOtp();
        }}
      />
    </div>
  );
};
