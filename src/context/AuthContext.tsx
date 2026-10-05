import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, College, Department } from '../types/auth';

export type AuthType = 'college' | 'department' | null;

export interface AuthContextType {
  authType: AuthType;
  college: College | null;
  department: Department | null;
  collegeToken: string | null;
  token: string | null;
  user: AuthUser | null;
  isAuthChecking: boolean;
  authNotice: { message: string; type: 'info' | 'warning' } | null;
  setAuthNotice: (notice: { message: string; type: 'info' | 'warning' } | null) => void;
  sessionLoginTime: number | null;
  loginCollege: (college: College, token: string) => void;
  loginDepartment: (dept: Department, col: College, token: string) => void;
  logoutCollege: () => void;
  logoutDepartment: () => void;
  logoutAll: () => void;
  refreshSession: () => Promise<void>;
  selectCollegeForBrowsing: (college: College) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authType, setAuthType] = useState<AuthType>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [collegeToken, setCollegeToken] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [authNotice, setAuthNotice] = useState<{ message: string; type: 'info' | 'warning' } | null>(null);

  const [sessionLoginTime, setSessionLoginTime] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem('marks_analyzer_session_start');
      return raw ? parseInt(raw, 10) : null;
    } catch {
      return null;
    }
  });

  const rehydrate = async () => {
    setIsAuthChecking(true);
    try {
      // Session-based authentication: restore active browser session if present
      const rawStart = sessionStorage.getItem('marks_analyzer_session_start');
      if (rawStart) {
        setSessionLoginTime(parseInt(rawStart, 10));
      }

      // 1. Check saved department session
      const savedDept = sessionStorage.getItem('marks_analyzer_dept_auth');
      const savedCollege = sessionStorage.getItem('marks_analyzer_college_auth');
      const selectedCollege = sessionStorage.getItem('marks_analyzer_selected_college');

      let activeToken: string | null = null;

      if (savedDept) {
        try {
          const parsed = JSON.parse(savedDept);
          if (parsed.token) activeToken = parsed.token;
        } catch {}
      } else if (savedCollege) {
        try {
          const parsed = JSON.parse(savedCollege);
          if (parsed.token) activeToken = parsed.token;
        } catch {}
      }

      if (activeToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.type === 'department') {
              setAuthType('department');
              setCollege(data.college);
              setDepartment(data.department);
              setUser(data.user);
              setToken(data.token);
              setCollegeToken(data.token);
              setIsAuthChecking(false);
              return;
            } else if (data.type === 'college') {
              setAuthType('college');
              setCollege(data.college);
              setCollegeToken(data.token);
              setDepartment(null);
              setToken(null);
              setUser(null);
              setIsAuthChecking(false);
              return;
            }
          }
        } catch (err) {
          console.warn('Session verification error:', err);
        }
      }

      // If no valid active token but there was a selected college for browsing
      if (selectedCollege) {
        try {
          const parsed = JSON.parse(selectedCollege);
          setCollege(parsed);
        } catch {}
      }

      setAuthType(null);
      setDepartment(null);
      setToken(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    rehydrate();
  }, []);

  // Login is purely session based with standard browser session persistence
  const loginCollege = (col: College, colTok: string) => {
    const now = Date.now();
    sessionStorage.setItem('marks_analyzer_session_start', String(now));
    sessionStorage.setItem(
      'marks_analyzer_college_auth',
      JSON.stringify({ college: col, token: colTok })
    );
    sessionStorage.setItem('marks_analyzer_selected_college', JSON.stringify(col));
    // Reset Techie intro for new session
    sessionStorage.removeItem('techie_intro_played');
    setSessionLoginTime(now);
    setCollege(col);
    setCollegeToken(colTok);
    setAuthType('college');
    setDepartment(null);
    setToken(null);
    setUser(null);
  };

  const loginDepartment = (dept: Department, col: College, deptTok: string) => {
    const now = Date.now();
    sessionStorage.setItem('marks_analyzer_session_start', String(now));
    sessionStorage.setItem(
      'marks_analyzer_dept_auth',
      JSON.stringify({ department: dept, college: col, token: deptTok })
    );
    sessionStorage.setItem('marks_analyzer_selected_college', JSON.stringify(col));
    // Reset Techie intro for new session
    sessionStorage.removeItem('techie_intro_played');
    setSessionLoginTime(now);
    setDepartment(dept);
    setCollege(col);
    setToken(deptTok);
    setCollegeToken(deptTok);
    setAuthType('department');
    setUser({
      username: dept.name,
      email: dept.email,
      department: dept.name,
      departmentId: dept.id,
      collegeId: col.id,
      institution: col.name,
      role: 'Department Faculty / Examination Officer',
      loginAt: new Date().toISOString(),
    });
  };

  const selectCollegeForBrowsing = (col: College) => {
    sessionStorage.setItem('marks_analyzer_selected_college', JSON.stringify(col));
    setCollege(col);
  };

  const logoutCollege = () => {
    sessionStorage.removeItem('marks_analyzer_college_auth');
    sessionStorage.removeItem('marks_analyzer_dept_auth');
    sessionStorage.removeItem('marks_analyzer_selected_college');
    sessionStorage.removeItem('marks_analyzer_session_start');
    sessionStorage.removeItem('techie_intro_played');
    setSessionLoginTime(null);
    setCollege(null);
    setDepartment(null);
    setCollegeToken(null);
    setToken(null);
    setUser(null);
    setAuthType(null);
  };

  const logoutDepartment = () => {
    sessionStorage.removeItem('marks_analyzer_dept_auth');
    sessionStorage.removeItem('techie_intro_played');
    setDepartment(null);
    setToken(null);
    setUser(null);

    // If college session exists, fall back to college session
    const savedCollege = sessionStorage.getItem('marks_analyzer_college_auth');
    if (savedCollege) {
      try {
        const parsed = JSON.parse(savedCollege);
        setCollege(parsed.college);
        setCollegeToken(parsed.token);
        setAuthType('college');
        return;
      } catch {}
    }

    sessionStorage.removeItem('marks_analyzer_session_start');
    setSessionLoginTime(null);
    setAuthType(null);
  };

  const logoutAll = () => {
    sessionStorage.removeItem('marks_analyzer_college_auth');
    sessionStorage.removeItem('marks_analyzer_dept_auth');
    sessionStorage.removeItem('marks_analyzer_selected_college');
    sessionStorage.removeItem('marks_analyzer_session_start');
    sessionStorage.removeItem('techie_intro_played');
    setSessionLoginTime(null);
    setCollege(null);
    setDepartment(null);
    setCollegeToken(null);
    setToken(null);
    setUser(null);
    setAuthType(null);
  };

  return (
    <AuthContext.Provider
      value={{
        authType,
        college,
        department,
        collegeToken,
        token,
        user,
        isAuthChecking,
        authNotice,
        setAuthNotice,
        sessionLoginTime,
        loginCollege,
        loginDepartment,
        logoutCollege,
        logoutDepartment,
        logoutAll,
        refreshSession: rehydrate,
        selectCollegeForBrowsing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

