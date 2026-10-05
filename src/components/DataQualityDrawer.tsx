import React from 'react';
import { AlertTriangle, AlertCircle, Info, X, CheckCircle2 } from 'lucide-react';
import { DataQualityWarning } from '../types/analyzer';

interface DataQualityDrawerProps {
  warnings: DataQualityWarning[];
  isOpen: boolean;
  onClose: () => void;
}

export const DataQualityDrawer: React.FC<DataQualityDrawerProps> = ({
  warnings,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const mismatches = warnings.filter((w) => w.type === 'mismatch');
  const discrepancies = warnings.filter((w) => w.type === 'result_discrepancy');
  const coercions = warnings.filter((w) => w.type === 'coercion');
  const structural = warnings.filter((w) => ['incomplete_block', 'trailing_junk_dropped', 'internal_only', 'ambiguous_column'].includes(w.type));

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'incomplete_block':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'trailing_junk_dropped':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'internal_only':
        return 'bg-sky-100 text-sky-900 border-sky-200';
      case 'mismatch':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'coercion':
        return 'bg-orange-100 text-orange-900 border-orange-200';
      default:
        return 'bg-rose-100 text-rose-900 border-rose-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-2xl min-h-screen shadow-2xl p-6 sm:p-8 flex flex-col justify-between border-l border-slate-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="col-header text-slate-400">Diagnostic Telemetry</div>
              <h3 className="text-lg font-bold text-slate-900">Data Integrity & Validation Audits</h3>
              <p className="text-xs text-slate-500 font-sans">
                {warnings.length} flag{warnings.length === 1 ? '' : 's'} recorded during workbook parsing
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-3 my-5 font-mono">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="col-header text-[10px] text-slate-400">Structural</p>
              <p className="text-lg font-bold text-indigo-700 mt-0.5">{structural.length}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="col-header text-[10px] text-slate-400">Mismatches</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{mismatches.length}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="col-header text-[10px] text-slate-400">Coercions</p>
              <p className="text-lg font-bold text-orange-700 mt-0.5">{coercions.length}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="col-header text-[10px] text-slate-400">Discrepancies</p>
              <p className="text-lg font-bold text-rose-700 mt-0.5">{discrepancies.length}</p>
            </div>
          </div>

          {/* Warning List */}
          <div className="space-y-2.5 mt-5 max-h-[60vh] overflow-y-auto pr-1">
            {warnings.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-bold text-slate-900 text-sm">Zero Data Quality Issues Detected</h4>
                <p className="text-xs text-slate-600 font-sans mt-1 max-w-sm mx-auto">
                  All rows have reconciled numeric values, clean sums, and verified column headers.
                </p>
              </div>
            ) : (
              warnings.map((w, idx) => {
                return (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 font-mono flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getBadgeColor(w.type)}`}>
                          {w.type.replace(/_/g, ' ')}
                        </span>
                        {w.rowNumber && (
                          <span className="border border-slate-200 bg-white px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-600">
                            Row #{w.rowNumber}
                          </span>
                        )}
                        {w.subjectCode && (
                          <span className="border border-slate-200 bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-800">
                            {w.subjectCode}
                          </span>
                        )}
                        {w.studentId && (
                          <span className="border border-slate-200 bg-white px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-700">
                            {w.studentId}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 text-xs font-sans leading-relaxed">{w.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between font-mono text-xs">
          <p className="text-[11px] text-slate-400 font-sans">
            Non-fatal flags do not interrupt calculation or persistence.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

