import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
  Server,
  Code,
  Layers,
} from 'lucide-react';

interface SupabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SupabaseDiag {
  configured: boolean;
  ready: boolean;
  projectRef?: string;
  projectUrl?: string;
  message: string;
  schemaSql?: string;
}

export const SupabaseStatusModal: React.FC<SupabaseStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SupabaseDiag | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supabase/status${force ? '?check=true' : ''}`);
      if (!res.ok) throw new Error('Failed to retrieve Supabase status from server.');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error checking Supabase connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus(false);
    }
  }, [isOpen]);

  const handleCopySql = async () => {
    if (!data?.schemaSql) return;
    try {
      await navigator.clipboard.writeText(data.schemaSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = data.schemaSql;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Supabase Database & Vault</h3>
                {data?.ready ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified & Synced
                  </span>
                ) : data?.configured ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" />
                    Local Mode Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                    Local SQLite
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-college and multi-department database status with Row Level Security
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Connection Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                Connection
              </div>
              <div className="text-sm font-bold text-white">
                {data?.configured ? 'Connected (Env)' : 'Local SQLite'}
              </div>
              <div className="text-[11px] text-slate-500 truncate" title={data?.projectUrl || ''}>
                {data?.projectRef ? `Project: ${data.projectRef}` : 'Local Database'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Security Layer
              </div>
              <div className="text-sm font-bold text-white">Row Level Security</div>
              <div className="text-[11px] text-slate-500">Service Role Server-Only</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Database State
              </div>
              <div className="text-sm font-bold text-white">
                {data?.ready ? 'Tables Verified' : 'Tables Pending'}
              </div>
              <div className="text-[11px] text-slate-500">
                {data?.ready ? 'Ready for queries' : 'Using Local Fallback'}
              </div>
            </div>
          </div>

          {/* Diagnostic Message */}
          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Database Diagnostics</span>
              <button
                onClick={() => fetchStatus(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Re-verify Database</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {data?.message || 'Checking database configuration...'}
            </p>
          </div>

          {/* SQL Editor Instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Production Supabase SQL Migration Script</span>
              </div>
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Full SQL Script'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono max-h-48 overflow-y-auto leading-relaxed select-all">
              <pre className="whitespace-pre-wrap">{data?.schemaSql || '-- Loading schema...'}</pre>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              To apply or update tables: Open your Supabase Dashboard &gt; <strong>SQL Editor</strong> &gt; Click <strong>New query</strong> &gt; Paste the script &gt; Click <strong>Run</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero frontend keys exposed • All queries mediated server-side</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
