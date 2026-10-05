import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSpreadsheet,
  History,
  Eye,
  UserCheck,
  RefreshCw,
  X,
  Users,
  BookOpen,
  Calendar,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { AlreadyAnalysedMatch } from '../types/analyzer';

interface AlreadyAnalysedModalProps {
  isOpen: boolean;
  matchData: AlreadyAnalysedMatch | null;
  onLookup: (match: AlreadyAnalysedMatch) => void;
  onEditFaculty: (match: AlreadyAnalysedMatch) => void;
  onForceReanalyze: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const AlreadyAnalysedModal: React.FC<AlreadyAnalysedModalProps> = ({
  isOpen,
  matchData,
  onLookup,
  onEditFaculty,
  onForceReanalyze,
  onClose,
  isLoading = false,
}) => {
  if (!isOpen || !matchData) return null;

  const formattedDate = matchData.uploadedAt
    ? new Date(matchData.uploadedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Earlier session';

  return (
    <AnimatePresence>
      <div
        id="already-analysed-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          id="already-analysed-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden my-6"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white px-6 py-5 relative">
            <button
              id="already-analysed-close-btn"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-white/15 border border-white/20 shadow-inner">
                <History className="w-6 h-6 text-indigo-100" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                  Already Analysed Record Found
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white">
                  Semester Already Analysed
                </h3>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed mt-1">
              {matchData.message || 'This Excel spreadsheet and semester configuration match an existing analysis session in your database.'}
            </p>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Recommendation Banner */}
            <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Recommendation</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
                {matchData.recommendation || 'This semester has already been analyzed and verified. We recommend checking the existing analysis to view complete student rankings and official charts directly. If faculty members, sections, or subject details need changes, select "Want to Edit Faculty & Other Things".'}
              </p>
            </div>

            {/* Existing Dataset Overview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <FileSpreadsheet className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate" title={matchData.fileName}>
                      {matchData.fileName}
                    </div>
                    <div className="text-xs text-slate-700 flex items-center gap-2 mt-0.5">
                      <span>Analysed on: {formattedDate}</span>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ready to View
                </span>
              </div>

              {/* Semester Details Badges */}
              <div className="flex flex-wrap gap-2 text-xs">
                {matchData.semesterDetails?.semester && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
                    {matchData.semesterDetails.semester}
                  </span>
                )}
                {matchData.semesterDetails?.academicYear && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                    <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                    AY {matchData.semesterDetails.academicYear}
                  </span>
                )}
                {matchData.semesterDetails?.examination && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                    {matchData.semesterDetails.examination}
                  </span>
                )}
                {matchData.semesterDetails?.scheme && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                    Scheme {matchData.semesterDetails.scheme}
                  </span>
                )}
              </div>

              {/* Quick Metrics Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-slate-700 font-medium flex items-center justify-center gap-1">
                    <Users className="w-3 h-3 text-slate-700" /> Students
                  </div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">
                    {matchData.totalStudents}
                  </div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-slate-700 font-medium flex items-center justify-center gap-1">
                    <BookOpen className="w-3 h-3 text-slate-700" /> Subjects
                  </div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">
                    {matchData.totalSubjects}
                  </div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-slate-700 font-medium">Pass Rate</div>
                  <div className="text-base font-bold text-emerald-600 mt-0.5">
                    {matchData.overallPassPercentage?.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-slate-700 font-medium">Cohort Mean</div>
                  <div className="text-base font-bold text-indigo-600 mt-0.5">
                    {matchData.cohortMeanPercentage?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Question */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 animate-pulse" />
              <div className="text-sm font-semibold text-indigo-950">
                Do you want to check the already analysed results (recommended) or want to edit faculty and other things?
              </div>
            </div>

            {/* Action Cards / Primary Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Check / View Already Analysed */}
              <button
                id="btn-lookup-already-analysed"
                type="button"
                onClick={() => onLookup(matchData)}
                disabled={isLoading}
                className="group relative flex flex-col items-start text-left p-4 rounded-xl bg-gradient-to-b from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all border border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-white/15 border border-white/20">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
                      Recommended
                    </span>
                    <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                <div className="font-bold text-sm tracking-wide text-white">
                  Check Already Analysed
                </div>
                <div className="text-xs text-indigo-100/90 mt-1 leading-snug">
                  Instantly open completed analysis reports, student rankings, and official charts.
                </div>
              </button>

              {/* Option 2: Want to Edit Faculty & Other Things */}
              <button
                id="btn-edit-faculty"
                type="button"
                onClick={() => onEditFaculty(matchData)}
                disabled={isLoading}
                className="group relative flex flex-col items-start text-left p-4 rounded-xl bg-gradient-to-b from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md hover:shadow-lg transition-all border border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-white/15 border border-white/20">
                    <UserCheck className="w-5 h-5 text-white" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="font-bold text-sm tracking-wide text-white">
                  Want to Edit Faculty & Other Things
                </div>
                <div className="text-xs text-emerald-100/90 mt-1 leading-snug">
                  Pre-fills saved faculty and lets you modify faculty names, section assignments (Sec A/B/Both), subject names, or cutoffs.
                </div>
              </button>
            </div>

            {/* Sub-actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <button
                id="btn-force-reanalyze"
                type="button"
                onClick={onForceReanalyze}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 transition-colors font-medium py-1 px-2 rounded-md hover:bg-slate-100"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Re-analyze from scratch (Overwrite)</span>
              </button>

              <button
                id="btn-already-analysed-cancel"
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-slate-600 hover:text-slate-700 font-medium py-1 px-2.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default AlreadyAnalysedModal;
