import React, { useState } from 'react';
import {
  GraduationCap,
  Mail,
  User,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Building2,
  FileSpreadsheet,
  Award,
} from 'lucide-react';
import { AuthUser } from '../types/auth';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Access denied: Unauthorized credentials.');
      }

      if (rememberMe) {
        localStorage.setItem(
          'ubdt_marks_analyzer_auth',
          JSON.stringify({
            user: data.user,
            token: data.token,
          })
        );
      } else {
        sessionStorage.setItem(
          'ubdt_marks_analyzer_auth',
          JSON.stringify({
            user: data.user,
            token: data.token,
          })
        );
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Access denied: Unauthorized credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Decorative Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Department & Institutional Brand Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header & Crest */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                <GraduationCap className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  UBDT College of Engineering
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Davanagere, Karnataka</div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[11px] font-semibold">
                <Sparkles className="w-3 h-3" />
                Department of CSE Portal
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
                Semester Marks Intelligence Suite
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Academic dossier generation, scheme attainment metrics, grade band distributions, and remedial backlog ledgers.
              </p>
            </div>
          </div>

          {/* Institutional Highlights */}
          <div className="my-8 space-y-3">
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-slate-300">
                <strong className="text-white block font-medium">Departmental Security Gate</strong>
                Restricted examination & faculty access control.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-slate-300">
                <strong className="text-white block font-medium">Multi-Format Ingestion</strong>
                Direct support for Google Forms & VTU/Autonomous sheets.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-slate-300">
                <strong className="text-white block font-medium">Automated PDF Dossiers</strong>
                Executive single-page and consolidated master reports.
              </div>
            </div>
          </div>

          {/* Footer Accreditation Notice */}
          <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between font-mono">
            <span>RESTRICTED ACCESS</span>
            <span>PORTAL V1.0</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Faculty Sign In</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-500" />
                  Protected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter your authorized department username and registered institutional email to continue.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-800">Access Denied</div>
                  <div className="text-[11px] text-rose-600 mt-0.5">{error}</div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your authorized username"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>

              {/* Email ID field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Department Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email address"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">Keep me signed in</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Access...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Access Suite</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Department Footer Note */}
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Authorized Personnel Only • Academic Department Examination Cell
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
