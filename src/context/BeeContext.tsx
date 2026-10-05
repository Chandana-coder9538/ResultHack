import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export type BeeMood = 'idle' | 'talking' | 'searching' | 'success' | 'error';

export interface BeeContextType {
  mood: BeeMood;
  message: string | null;
  isMuted: boolean;
  toggleMute: () => void;
  say: (text: string, newMood?: BeeMood, durationMs?: number) => void;
  dismiss: () => void;
}

const BeeContext = createContext<BeeContextType | null>(null);

// Editable dictionary for route-based and tab-based messages
export const routeMessages: Record<string, { message: string; mood: BeeMood }> = {
  '/': {
    message: "Hey! I'm Bee 🐝 Welcome to MarksAnalyzer. Search for your college to get started!",
    mood: 'talking',
  },
  '/college/register': {
    message: "Let's get your college registered! I'll guide you.",
    mood: 'talking',
  },
  '/college/verify-otp': {
    message: "I've sent a code to your email. Check your inbox! 📧",
    mood: 'talking',
  },
  '/college/login': {
    message: "Welcome back! Please log in to your college 🎓",
    mood: 'talking',
  },
  '/college/departments': {
    message: "Select your department to access marksheets and analytics vault!",
    mood: 'talking',
  },
  '/department/register': {
    message: "Add your department credentials to get started!",
    mood: 'talking',
  },
  '/department/verify-otp': {
    message: "Department authorization code sent! Please verify to continue.",
    mood: 'talking',
  },
  '/department/login': {
    message: "Hi! Log in to your department dashboard.",
    mood: 'talking',
  },
  '/department/dashboard': {
    message: "Upload your result sheet and I'll analyse it!",
    mood: 'talking',
  },
};

export const tabMessages: Record<string, { message: string; mood: BeeMood }> = {
  upload: {
    message: "Upload your result sheet and I'll analyse it!",
    mood: 'talking',
  },
  subject: {
    message: "Here is your detailed subject-by-subject grade breakdown!",
    mood: 'talking',
  },
  summary: {
    message: "Here is your overall semester performance and cohort summary!",
    mood: 'success',
  },
  print: {
    message: "Ready to preview and print official consolidated reports!",
    mood: 'talking',
  },
  archive: {
    message: "Browse your historical spreadsheet uploads and saved records!",
    mood: 'talking',
  },
};

export const BeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mood, setMood] = useState<BeeMood>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('marks_analyzer_bee_muted') === 'true';
    } catch {
      return false;
    }
  });

  const lastMessageRef = useRef<string | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismiss = useCallback(() => {
    setMessage(null);
    setMood('idle');
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('marks_analyzer_bee_muted', String(next));
      } catch {}
      if (next) {
        dismiss();
      }
      return next;
    });
  }, [dismiss]);

  const say = useCallback(
    (text: string, newMood: BeeMood = 'talking', durationMs = 4000) => {
      if (isMuted) return;
      if (!text || text.trim() === '') return;

      // Do not repeat the exact same message twice consecutively
      if (lastMessageRef.current === text.trim() && message !== null) {
        return;
      }

      // Debounce slightly to prevent message clipping on rapid triggers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }

        lastMessageRef.current = text.trim();
        setMessage(text.trim());
        setMood(newMood);

        // Auto-hide after specified duration (defaults to 4 seconds)
        dismissTimerRef.current = setTimeout(() => {
          setMessage(null);
          setMood('idle');
        }, durationMs);
      }, 80);
    },
    [isMuted, message]
  );

  return (
    <BeeContext.Provider
      value={{
        mood,
        message,
        isMuted,
        toggleMute,
        say,
        dismiss,
      }}
    >
      {children}
    </BeeContext.Provider>
  );
};

export const useBee = () => {
  const context = useContext(BeeContext);
  if (!context) {
    throw new Error('useBee must be used within a BeeProvider');
  }
  return context;
};
