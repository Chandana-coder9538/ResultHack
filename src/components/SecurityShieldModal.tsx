import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Bot,
  AlertTriangle,
  RefreshCw,
  X,
  FileCode,
  EyeOff,
  CheckCircle2,
  Server,
  Activity,
  Copy,
  Download,
} from 'lucide-react';

interface SecurityShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  watermarkEnabled: boolean;
  onToggleWatermark: (enabled: boolean) => void;
  copyProtectionEnabled: boolean;
  onToggleCopyProtection: (enabled: boolean) => void;
}

interface SecurityStatsData {
  encryption: {
    algorithm: string;
    status: string;
    authenticatedEncryption: boolean;
    restProtection: string;
  };
  defense: {
    antiScrapingShield: string;
    aiBotsBlockedCount: number;
    attackAttemptsBlockedCount: number;
    totalEventsLogged: number;
    strictCsp: string;
    antiClickjacking: string;
    antiSniffing: string;
    noIndexDirectives: string;
  };
  recentEvents: Array<{
    id: string;
    timestamp: string;
    ip: string;
    userAgent: string;
    path: string;
    method: string;
    reason: string;
    details: string;
  }>;
}

export const SecurityShieldModal: React.FC<SecurityShieldModalProps> = ({
  isOpen,
  onClose,
  watermarkEnabled,
  onToggleWatermark,
  copyProtectionEnabled,
  onToggleCopyProtection,
}) => {
  const [stats, setStats] = useState<SecurityStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit_log' | 'bot_shield' | 'controls'>('overview');

  const fetchSecurityStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/status');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch security status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSecurityStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const downloadAuditReport = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UBDT_Security_Shield_Audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Security & Anti-Scraping Shield</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Shield
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                AES-256-GCM Encrypted Vault • AI Bot & Scraper Firewall • Anti-Tamper Defense
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSecurityStatus}
              disabled={loading}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Refresh Security Status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Security Architecture
          </button>
          <button
            onClick={() => setActiveTab('bot_shield')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'bot_shield'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            AI Scrapers & Bots Firewall
          </button>
          <button
            onClick={() => setActiveTab('audit_log')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit_log'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Audit Log</span>
            {stats && stats.recentEvents.length > 0 && (
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
                {stats.recentEvents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'controls'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Anti-Exfiltration Controls
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Security Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold mb-1">
                    <Lock className="w-4 h-4" />
                    <span>Data at Rest</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 font-mono">AES-256-GCM</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Authenticated encryption with random IV and 16-byte tamper tag per record.
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-1">
                    <Bot className="w-4 h-4" />
                    <span>AI Bot Firewall</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-900 font-mono">
                    {stats?.defense.aiBotsBlockedCount || 0} Blocked
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    GPTBot, ClaudeBot, Bytespider, and 30+ AI web scraper signatures blocked.
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                  <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                    <Shield className="w-4 h-4" />
                    <span>Access Protection</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900 font-mono">Enforced</div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Strict departmental credential token verification & rate limiters active.
                  </div>
                </div>
              </div>

              {/* Detailed Safeguards Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Active Defense Mechanisms</span>
                  <span className="text-[10px] text-slate-500 font-mono">Zero-Trust Academic Vault</span>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block font-semibold">Strict Anti-Scraping & No-Index Directives</strong>
                      <p className="text-slate-600 text-[11px]">
                        HTTP response headers send <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">X-Robots-Tag: noindex, nofollow, noarchive, nosnippet</code> and a hardened <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">/robots.txt</code> forbidding web crawlers from indexing student data.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block font-semibold">Content Security Policy (CSP) & Frame Isolation</strong>
                      <p className="text-slate-600 text-[11px]">
                        Prevents unauthorized code injection (XSS) and forbids malicious third-party frame embedding or unauthorized script execution.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block font-semibold">Anti-Brute Force Sliding-Window Throttling</strong>
                      <p className="text-slate-600 text-[11px]">
                        Limits login attempts to 15 per 5 minutes and API uploads to prevent denial-of-service, automated credential guessing, or bulk harvest attacks.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block font-semibold">Input Sanitization & Attack Pattern Firewall</strong>
                      <p className="text-slate-600 text-[11px]">
                        Intercepts and blocks SQL injection strings, path traversal attacks (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">../</code>), and hostile probe signatures before reaching storage.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 block font-semibold">Session-Based Cryptographic Authorization</strong>
                      <p className="text-slate-600 text-[11px]">
                        Department and college sessions are strictly session-based and isolated to the active browser tab, protecting against token leakage, unauthorized persistence, or multi-device crossover.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOT & AI SCRAPER FIREWALL */}
          {activeTab === 'bot_shield' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-blue-400 flex items-center gap-1.5">
                    <Bot className="w-4 h-4" />
                    Automated AI Harvester Blocking Rules
                  </span>
                  <span className="text-[10px] font-mono bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded">
                    30+ Rules Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Incoming requests are checked against known generative AI training bots, content scrapers, and headless tools. Matching user agents receive an immediate HTTP 403 Forbidden rejection.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {[
                  { name: 'GPTBot (OpenAI)', status: 'Blocked' },
                  { name: 'ChatGPT-User', status: 'Blocked' },
                  { name: 'CCBot (Common Crawl)', status: 'Blocked' },
                  { name: 'ClaudeBot (Anthropic)', status: 'Blocked' },
                  { name: 'Claude-Web', status: 'Blocked' },
                  { name: 'Bytespider (ByteDance)', status: 'Blocked' },
                  { name: 'PerplexityBot', status: 'Blocked' },
                  { name: 'Amazonbot', status: 'Blocked' },
                  { name: 'Diffbot Harvester', status: 'Blocked' },
                  { name: 'FacebookBot / Meta', status: 'Blocked' },
                  { name: 'Cohere-AI Crawler', status: 'Blocked' },
                  { name: 'Google-Extended', status: 'Blocked' },
                  { name: 'Scrapy Python Spider', status: 'Blocked' },
                  { name: 'HTTrack Offline Copier', status: 'Blocked' },
                  { name: 'WebReaper', status: 'Blocked' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800 truncate pr-1">{item.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-mono shrink-0">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit_log' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Real-Time Security Event Stream</span>
                </div>
                <button
                  onClick={downloadAuditReport}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>

              {stats?.recentEvents && stats.recentEvents.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {stats.recentEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-rose-600">{evt.reason}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-slate-700 text-[11px]">{evt.details}</div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-0.5">
                        <span>IP: {evt.ip}</span>
                        <span>Path: {evt.path}</span>
                        <span>Method: {evt.method}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <div className="font-semibold text-slate-700">All Perimeter Defenses Clear</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No unauthorized scraping or hostile bot intrusions detected in the current session.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANTI-EXFILTRATION CONTROLS */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-blue-600" />
                      <span>Confidential Watermark Shield</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Renders an institutional "UBDT CSE CONFIDENTIAL" diagonal watermark across all student score matrices to deter unauthorized photography and screen recording.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={watermarkEnabled}
                      onChange={(e) => onToggleWatermark(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Copy className="w-4 h-4 text-indigo-600" />
                      <span>Clipboard Bulk Scraping Guard</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Restricts arbitrary bulk text selection and copy keyboard shortcuts (Ctrl+C / Cmd+C) on sensitive student mark grids without authorized export.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={copyProtectionEnabled}
                      onChange={(e) => onToggleCopyProtection(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                <strong>Institutional Compliance:</strong> Examination marks stored in the local SQLite vault are protected under authenticated encryption at rest. All automated downloads and PDF generation are watermarked with departmental metadata.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Vault Status: Protected & Encrypted</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
