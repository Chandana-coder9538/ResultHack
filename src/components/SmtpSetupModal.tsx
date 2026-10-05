import React, { useState, useEffect } from 'react';
import {
  Mail,
  Shield,
  Check,
  Copy,
  X,
  Server,
  Key,
  AlertCircle,
  Send,
  RefreshCw,
  CheckCircle2,
  Sliders,
  HelpCircle,
  Lock,
} from 'lucide-react';

interface SmtpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipientEmail?: string;
  resendPurpose?: string;
  onSmtpSaved?: () => void;
}

export const SmtpSetupModal: React.FC<SmtpSetupModalProps> = ({
  isOpen,
  onClose,
  defaultRecipientEmail = '',
  resendPurpose = 'college_register',
  onSmtpSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'guide'>('config');

  // Config Form State
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [secure, setSecure] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [isFromEnv, setIsFromEnv] = useState(false);

  // Status & Testing State
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState(defaultRecipientEmail || 'chandanagangadhar9538@gmail.com');
  const [copied, setCopied] = useState(false);

  // Load active SMTP configuration
  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/smtp/config');
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(Boolean(data.configured));
        setHost(data.host || '');
        setPort(String(data.port || 587));
        setUser(data.user || defaultRecipientEmail || '');
        setFrom(data.from || (data.user ? `Academic Result Analysis <${data.user}>` : ''));
        setHasPassword(Boolean(data.hasPassword));
        setSecure(Boolean(data.secure));
        setIsFromEnv(Boolean(data.isFromEnv));

        // If not configured but user has a gmail address, auto-populate Gmail settings
        if (!data.configured && defaultRecipientEmail && defaultRecipientEmail.toLowerCase().includes('@gmail.com')) {
          setHost('smtp.gmail.com');
          setPort('587');
          setSecure(false);
          setUser(defaultRecipientEmail);
          setFrom(`Academic Result Analysis <${defaultRecipientEmail}>`);
        }
      }
    } catch (err) {
      console.error('Failed to load SMTP config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setSaveSuccess(null);
      setTestResult(null);
      if (defaultRecipientEmail) {
        setTestEmail(defaultRecipientEmail);
      }
    }
  }, [isOpen, defaultRecipientEmail]);

  if (!isOpen) return null;

  // Preset quick fill
  const handleApplyPreset = (preset: 'gmail' | 'brevo' | 'outlook') => {
    if (preset === 'gmail') {
      setHost('smtp.gmail.com');
      setPort('587');
      setSecure(false);
      const activeUser = user || defaultRecipientEmail;
      if (!from && activeUser) setFrom(`Academic Result Vault <${activeUser}>`);
    } else if (preset === 'brevo') {
      setHost('smtp-relay.brevo.com');
      setPort('587');
      setSecure(false);
    } else if (preset === 'outlook') {
      setHost('smtp.office365.com');
      setPort('587');
      setSecure(false);
    }
  };

  // Save SMTP configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port: parseInt(port, 10) || 587,
          user: user.trim(),
          pass: pass.trim(),
          from: from.trim() || `Academic Result Analysis <${user.trim()}>`,
          secure,
          resendToEmail: defaultRecipientEmail || undefined,
          resendPurpose,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');

      setSaveSuccess(data.message || 'SMTP settings successfully saved.');
      setIsConfigured(true);
      setPass('');
      setHasPassword(true);
      loadConfig();

      if (onSmtpSaved) {
        setTimeout(() => {
          onSmtpSaved();
        }, 600);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error saving SMTP settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Test SMTP connection & send live email
  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid recipient email address for testing.' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setSaveSuccess(null);

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail.trim().toLowerCase(),
          host: host.trim() || undefined,
          port: parseInt(port, 10) || undefined,
          user: user.trim() || undefined,
          pass: pass.trim() || undefined,
          from: from.trim() || undefined,
          secure,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'SMTP delivery test failed.');
      }

      setTestResult({
        success: true,
        message: data.message || `Test verification email delivered to ${testEmail}!`,
      });
      setIsConfigured(true);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'SMTP test failed. Please verify host, port, and authentication credentials.',
      });
    } finally {
      setTesting(false);
    }
  };

  const envSample = `# SMTP Email Service Configuration
SMTP_HOST=${host || 'smtp.gmail.com'}
SMTP_PORT=${port || '587'}
SMTP_USER=${user || 'your-email@gmail.com'}
SMTP_PASS=your-16-character-app-password
SMTP_FROM="${from || 'Academic Result Analysis Vault <' + (user || 'your-email@gmail.com') + '>'}"

# Master encryption secret for SQLite data-at-rest encryption
ENCRYPTION_SECRET=ubdt-academic-marks-encryption-vault-2026`;

  const handleCopy = () => {
    navigator.clipboard.writeText(envSample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden text-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/25 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">Real Email & SMTP Dispatcher</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {isConfigured ? 'SMTP Active' : 'Simulated / Dev Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-300">Configure live email delivery for OTP verification & deletion codes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Live Settings & Tester</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>.env Guide & Presets</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm flex-1">
          {activeTab === 'config' ? (
            <div className="space-y-5">
              {/* Status Notice */}
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                  isConfigured
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                {isConfigured ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold">
                    {isConfigured ? 'Real Email Delivery Active' : 'Operating in Development / Simulated Mode'}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {isConfigured
                      ? `Real emails are actively dispatched via ${host || 'SMTP'}:${port}. Every OTP and deletion authorization code is sent to actual inboxes.`
                      : 'Without SMTP credentials, OTP codes are logged to the server console and rendered on screen with a "Quick Fill OTP" button. Enter your SMTP details below to send real emails to Gmail, Yahoo, Outlook, or institutional mailboxes.'}
                  </p>
                </div>
              </div>

              {/* Feedback messages */}
              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {testResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">
                    <span className="font-bold">{testResult.success ? 'Success: ' : 'Delivery Failed: '}</span>
                    {testResult.message}
                  </div>
                </div>
              )}

              {/* Presets Quick Fill */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Provider Presets:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('gmail')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('brevo')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Brevo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('outlook')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Outlook
                  </button>
                </div>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SMTP Server Host <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="e.g. smtp.gmail.com"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Port <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-mono"
                    >
                      <option value="587">587 (STARTTLS)</option>
                      <option value="465">465 (SSL/TLS)</option>
                      <option value="25">25 (Standard)</option>
                      <option value="2525">2525 (Alternative)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SMTP User / Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      placeholder="e.g. admin@college.edu or examinations@gmail.com"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Password or App Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      placeholder={hasPassword ? '•••••••••••• (Saved)' : 'Enter SMTP password or App Password'}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sender Address (From Header)
                  </label>
                  <input
                    type="text"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder='e.g. "Academic Result Analysis Vault <examinations@college.edu>"'
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-500">
                    {isFromEnv ? 'Active values loaded from server environment.' : 'Settings stored in institutional database.'}
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save SMTP Settings</span>
                  </button>
                </div>
              </form>

              {/* Live Test Dispatcher */}
              <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    <span>Send Live Test Verification Email</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold">Immediate Delivery Check</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Recipient email address to test"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-blue-200 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow shrink-0 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Test Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                You can also configure SMTP permanently via environment variables in your deployment or <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800">.env</code> file:
              </p>

              {/* Code Box */}
              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                  {envSample}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Provider details */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Provider Setup Instructions</h4>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <span className="font-semibold text-slate-900">Gmail / Google Workspace:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Enable 2-Step Verification in your Google Account &gt; Security, then generate an <strong>"App Password"</strong> (16 characters) under "App passwords". Use your Gmail address as SMTP_USER and the 16-character App Password as SMTP_PASS.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <span className="font-semibold text-slate-900">Brevo (formerly Sendinblue):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Create a free Brevo account, go to "SMTP & API" tab, copy the SMTP Key and login email. Free tier includes 300 real emails per day.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

