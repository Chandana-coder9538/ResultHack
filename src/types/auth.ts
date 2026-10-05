export interface College {
  id: string;
  name: string;
  universityName: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  email: string;
  emailVerified: boolean;
  departmentsCount?: number;
  createdAt: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
}

export interface Department {
  id: string;
  collegeId: string;
  name: string;
  code?: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
}

export interface AuthUser {
  username: string;
  email: string;
  department: string;
  departmentId?: string;
  collegeId?: string;
  institution: string;
  role: string;
  loginAt: string;
}

export interface CollegeSession {
  college: College;
  token: string;
}

export interface DepartmentSession {
  department: Department;
  college: College;
  user: AuthUser;
  token: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  college?: College;
  department?: Department;
}
