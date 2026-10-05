import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, RefreshCw, X, ShieldCheck, Download } from 'lucide-react';

interface TestResultItem {
  id: string;
  name: string;
  category: 'normal' | 'edge_cases' | 'strict_split' | 'invalid_format';
  passed: boolean;
  message: string;
  details?: any;
}

interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResultItem[];
  timestamp: string;
}

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [suite, setSuite] = useState<TestSuiteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const runTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/run-tests');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: TestSuiteSummary = await res.json();
      setSuite(data);
    } catch (err: any) {
      setError(err.message || 'Failed to run backend tests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold tracking-wider text-blue-400 uppercase">
              Automated Verification Suite
            </div>
            <h3 className="font-bold text-base text-white">Backend Logic & Math Verification</h3>
            <p className="text-xs text-slate-400 font-sans">
              Fixtures: Synthetic Excel datasets (Standard, Rank-5 Ties, Component Splits, Coercion)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 font-mono text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={runTests}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Test Suite</span>
                </>
              )}
            </button>
            {suite && (
              <span className="text-xs text-slate-500 font-mono">
                Executed at {new Date(suite.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/sample-excel/edge_ties"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Tie Fixture</span>
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-mono">
              Error: {error}
            </div>
          )}

          {!suite && !loading && !error && (
            <div className="text-center py-12 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="font-bold text-slate-900 text-sm">Backend Verification Ready</h4>
              <p className="text-xs text-slate-500 font-sans max-w-md mx-auto mt-1 leading-relaxed">
                Execute unit tests verifying ties preservation at rank 5, separate passing thresholds for internal/external components, coercion of string marks, and pass rate calculations.
              </p>
            </div>
          )}

          {suite && (
            <div className="space-y-4">
              {/* Overall Score */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono">
                <div>
                  <span className="col-header text-slate-400 text-[10px] block">Suite Summary</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {suite.passed} of {suite.total} tests passed ({((suite.passed / suite.total) * 100).toFixed(0)}%)
                  </p>
                </div>
                <div className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                  suite.failed === 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {suite.failed === 0 ? 'All Tests Passed' : `${suite.failed} Failed`}
                </div>
              </div>

              {/* Test List */}
              <div className="space-y-2.5">
                {suite.results.map((test) => (
                  <div
                    key={test.id}
                    className={`p-3.5 border rounded-xl transition-all ${
                      test.passed
                        ? 'bg-white border-slate-200'
                        : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {test.passed ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold rounded-md mt-0.5">
                            PASS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 font-mono text-[10px] font-bold rounded-md mt-0.5">
                            FAIL
                          </span>
                        )}
                        <div>
                          <div className="flex items-center gap-2 font-mono flex-wrap">
                            <h5 className="font-bold text-slate-900 text-xs">{test.name}</h5>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {test.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-sans mt-1 leading-relaxed">{test.message}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

