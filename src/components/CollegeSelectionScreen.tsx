import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Building2,
  Search,
  PlusCircle,
  Mail,
  Sparkles,
  BookOpen,
  ChevronRight,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { College } from '../types/auth';
import { SmtpSetupModal } from './SmtpSetupModal';
import { useTechie } from '../context/TechieContext';

interface CollegeSelectionScreenProps {
  onSelectCollege: (college: College) => void;
  onNavigateRegister: () => void;
}

export const CollegeSelectionScreen: React.FC<CollegeSelectionScreenProps> = ({
  onSelectCollege,
  onNavigateRegister,
}) => {
  const [allColleges, setAllColleges] = useState<College[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const techie = useTechie();

  // Helper for simple text normalization (letters & numbers only)
  const normalizeText = (text: string) =>
    (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Simple and intuitive matching: checks names, universities, emails, clean alphanumeric strings, and acronyms
  const matchesCollege = (col: College, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = (col.name || '').toLowerCase();
    const uni = (col.universityName || '').toLowerCase();
    const email = (col.email || '').toLowerCase();

    // 1. Direct substring match
    if (name.includes(q) || uni.includes(q) || email.includes(q)) return true;

    // 2. Normalized alphanumeric match (e.g. "UBDT" matches "U.B.D.T. College of Engineering")
    const cleanQ = normalizeText(q);
    if (cleanQ.length >= 2) {
      if (normalizeText(name).includes(cleanQ) || normalizeText(uni).includes(cleanQ)) {
        return true;
      }
    }

    // 3. Word initials / acronym match (e.g. "UBDT" from "University B D T")
    const initials = name
      .split(/[\s,.-]+/)
      .filter(Boolean)
      .map((w) => w[0]?.toLowerCase() || '')
      .join('');
    if (initials && cleanQ.length >= 2 && initials.includes(cleanQ)) {
      return true;
    }

    return false;
  };

  // Exact or direct match check
  const isExactMatch = (col: College, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    const name = (col.name || '').toLowerCase();
    const uni = (col.universityName || '').toLowerCase();
    if (name === q || uni === q) return true;

    const cleanQ = normalizeText(q);
    if (cleanQ.length >= 2) {
      if (normalizeText(name) === cleanQ || normalizeText(uni) === cleanQ) {
        return true;
      }
    }
    return false;
  };

  const fetchColleges = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/colleges');
      if (!res.ok) throw new Error('Failed to load colleges from server');
      const data: College[] = await res.json();
      setAllColleges(data);
    } catch (err: any) {
      console.error('Error fetching colleges:', err);
      setError(err.message || 'Failed to load colleges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  // Simple, quiet live filtering as the user types
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSearchStatus(null);
  };

  const handleClearSearch = () => {
    setSearch('');
    setSearchStatus(null);
  };

  // Searching only takes if the correct matching has been done!
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    if (!query) {
      setSearchStatus(null);
      return;
    }

    // 1. Check for exact match
    const exact = allColleges.find((col) => isExactMatch(col, query));
    if (exact) {
      setSearchStatus({
        type: 'success',
        message: `Correct match found: "${exact.name}". Opening login portal...`,
      });
      techie.play('search_found', `Correct match found for ${exact.name}! Taking you to login.`);
      setTimeout(() => {
        onSelectCollege(exact);
      }, 500);
      return;
    }

    // 2. Check for unique single match
    const matches = allColleges.filter((col) => matchesCollege(col, query));
    if (matches.length === 1) {
      const single = matches[0];
      setSearchStatus({
        type: 'success',
        message: `Correct match found: "${single.name}". Opening login portal...`,
      });
      techie.play('search_found', `Correct match found for ${single.name}! Taking you to login.`);
      setTimeout(() => {
        onSelectCollege(single);
      }, 500);
      return;
    }

    if (matches.length > 1) {
      setSearchStatus({
        type: 'info',
        message: `Found ${matches.length} matching colleges. Click on your exact institution below to proceed.`,
      });
      techie.play('search_found', `Found ${matches.length} matching colleges. Click your institution.`);
      return;
    }

    // 3. No match found: Searching only takes if correct matching has been done!
    setSearchStatus({
      type: 'error',
      message: `No matching college found for "${query}". Searching takes only when correct matching has been done. Please verify spelling or register a new college below.`,
    });
    techie.play(
      'search_not_found',
      "No matching college found. Searching takes only when correct matching has been done."
    );
  };

  const handleRegisterClick = () => {
    techie.play('register_gate', "Let's set up your college, I'll guide you step by step!");
    onNavigateRegister();
  };

  // Displayed colleges filtered simply by current search query
  const displayedColleges = allColleges.filter((col) => matchesCollege(col, search));

  return (
    <div className="min-h-screen bg-slate-950/65 backdrop-blur-xs text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[700px] h-96 bg-slate-800/40 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-lg tracking-tight">MarksAnalyzer</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  MULTI-TENANT
                </span>
              </div>
              <p className="text-xs text-slate-400">Institutional Result Analysis & Accreditation Suite</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => techie.introduceSelf()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 hover:text-white text-xs font-semibold border border-blue-500/30 transition-all cursor-pointer shadow-sm"
              title="Have Techie introduce himself and explain the portal"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Techie Intro</span>
            </button>

            <button
              onClick={() => setIsSmtpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition-colors cursor-pointer"
              title="Configure real SMTP email delivery and test connection"
            >
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <span>Email & SMTP Setup</span>
            </button>

            <button
              onClick={handleRegisterClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all btn-hover-glow cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register New College</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 flex flex-col">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>Select Your Institution</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Academic Examination & Marks Intelligence Portal
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Choose your college to log in, access your departmental result analyses, calculate grade distributions, and export official dossiers.
          </p>
        </div>

        {/* Search Bar & Simple Matching Form */}
        <div className="max-w-xl mx-auto w-full mb-8">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by college name, university, or acronym (e.g. UBDT)..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl pl-12 pr-32 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-xl"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-24 text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md btn-hover-glow cursor-pointer flex items-center gap-1.5"
            >
              <span>Search</span>
            </button>
          </form>

          {/* Simple Search Status Banner */}
          {searchStatus && (
            <div
              className={`mt-3 p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 animate-fade-in ${
                searchStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : searchStatus.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {searchStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : searchStatus.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <span>{searchStatus.message}</span>
              </div>
              <button
                onClick={() => setSearchStatus(null)}
                className="text-slate-400 hover:text-white shrink-0 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* College Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-4">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading registered colleges...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center space-y-3">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchColleges()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-all"
            >
              Try Again
            </button>
          </div>
        ) : displayedColleges.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {search ? 'No Matching College Found' : 'No Colleges Registered Yet'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {search
                ? `No registered colleges matched "${search}". Searching takes only if the correct matching has been done.`
                : 'No colleges have been registered yet. Be the first to register your institution!'}
            </p>
            <div className="flex items-center gap-3 pt-2">
              {search && (
                <button
                  onClick={handleClearSearch}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  Clear Search
                </button>
              )}
              <button
                onClick={handleRegisterClick}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register New College</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedColleges.map((college) => (
              <div
                key={college.id}
                onClick={() => onSelectCollege(college)}
                className="group cursor-pointer bg-slate-900/60 hover:bg-slate-900/80 border border-slate-700/60 hover:border-blue-500/60 rounded-3xl p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-blue-500/20 flex flex-col justify-between relative overflow-hidden backdrop-blur-md btn-tilt-3d"
              >
                {/* Subtle Hover Gradient Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/15 transition-all pointer-events-none" />

                <div className="space-y-4">
                  {/* Logos Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                    {/* College Logo */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center p-2 shadow-inner shrink-0 overflow-hidden">
                        {college.collegeLogoUrl ? (
                          <img
                            src={college.collegeLogoUrl}
                            alt={college.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 className="w-7 h-7 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-400">
                          College Profile
                        </span>
                        <div className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-slate-500" />
                          <span>{college.departmentsCount || 0} Departments</span>
                        </div>
                      </div>
                    </div>

                    {/* University Logo */}
                    <div
                      className="w-11 h-11 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-center p-1.5 shrink-0 overflow-hidden"
                      title={college.universityName}
                    >
                      {college.universityLogoUrl ? (
                        <img
                          src={college.universityLogoUrl}
                          alt={college.universityName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <GraduationCap className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                  </div>

                  {/* College & University Info */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition-colors line-clamp-2">
                      {college.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span>{college.universityName}</span>
                    </p>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-5 mt-4 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Institutional Portal</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1 transition-all">
                    <span>Login</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-2">
          <span>Multi-Tenant Academic Marks Analysis Suite • Session-Based Authorization</span>
          <button
            onClick={() => setIsSmtpModalOpen(true)}
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email & SMTP Setup Guide</span>
          </button>
        </div>
      </footer>

      {/* SMTP / Email Setup Guide Modal */}
      <SmtpSetupModal isOpen={isSmtpModalOpen} onClose={() => setIsSmtpModalOpen(false)} />
    </div>
  );
};
