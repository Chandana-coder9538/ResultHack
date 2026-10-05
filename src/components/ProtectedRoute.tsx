import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredType: 'college' | 'department' | 'any';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredType }) => {
  const { authType, college, department, token, collegeToken, isAuthChecking, setAuthNotice, authNotice } = useAuth();
  const location = useLocation();

  const decision = useMemo(() => {
    if (isAuthChecking) {
      return { isChecking: true, isAllowed: false, redirectTo: null, notice: null };
    }

    // 1. Department route guard
    if (requiredType === 'department') {
      if (authType === 'department' && token && department && college) {
        return { isChecking: false, isAllowed: true, redirectTo: null, notice: null };
      }

      if (authType === 'college' && college) {
        return {
          isChecking: false,
          isAllowed: false,
          redirectTo: '/college/departments',
          notice: {
            message: `Authorized as College Administrator for ${college.name}. Please select a Department and log in to access the examination marks dashboard.`,
            type: 'info' as const,
          },
        };
      }

      return {
        isChecking: false,
        isAllowed: false,
        redirectTo: college ? '/department/login' : '/college/login',
        notice: {
          message: 'Department Authorization Required: Please login to your official department account.',
          type: 'warning' as const,
        },
      };
    }

    // 2. College route guard
    if (requiredType === 'college') {
      if ((authType === 'college' && collegeToken) || (authType === 'department' && college)) {
        return { isChecking: false, isAllowed: true, redirectTo: null, notice: null };
      }

      return {
        isChecking: false,
        isAllowed: false,
        redirectTo: '/college/login',
        notice: {
          message: 'College Authorization Required: Please log in as a College Administrator to manage departments.',
          type: 'warning' as const,
        },
      };
    }

    // 3. Any authenticated route
    if (requiredType === 'any') {
      if (authType && college) {
        return { isChecking: false, isAllowed: true, redirectTo: null, notice: null };
      }
      return {
        isChecking: false,
        isAllowed: false,
        redirectTo: '/college/login',
        notice: null,
      };
    }

    return { isChecking: false, isAllowed: true, redirectTo: null, notice: null };
  }, [isAuthChecking, requiredType, authType, token, department, college, collegeToken]);

  const noticeMessage = decision.notice?.message;
  const noticeType = decision.notice?.type;

  useEffect(() => {
    if (noticeMessage && noticeType) {
      if (!authNotice || authNotice.message !== noticeMessage) {
        setAuthNotice({ message: noticeMessage, type: noticeType });
      }
    }
  }, [noticeMessage, noticeType, authNotice, setAuthNotice]);

  if (decision.isChecking) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span>Verifying cryptographic session authorization...</span>
        </div>
      </div>
    );
  }

  if (decision.redirectTo) {
    return <Navigate to={decision.redirectTo} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
