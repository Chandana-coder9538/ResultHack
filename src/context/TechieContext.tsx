import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';

export type TechieScene =
  | 'intro'
  | 'idle'
  | 'search'
  | 'search_found'
  | 'search_not_found'
  | 'login_door'
  | 'login_typing'
  | 'login_success'
  | 'login_failed'
  | 'register_gate'
  | 'register_step1'
  | 'register_step2'
  | 'register_otp_sent'
  | 'register_verified'
  | 'tab_upload'
  | 'tab_analysis'
  | 'tab_toppers'
  | 'tab_reports'
  | 'tab_history'
  | 'delete_confirm';

export interface RouteSceneConfig {
  scene: TechieScene;
  message: string;
}

/**
 * Single editable dictionary mapping each route to its Techie scene and spoken dialogue.
 * You can modify any text or scene here to customize Techie's reactions.
 */
export const routeScenes: Record<string, RouteSceneConfig> = {
  '/': {
    scene: 'intro',
    message:
      "Hi, I'm Techie, welcome to MarksAnalyzer! Here you can register your college, upload result sheets, get subject-wise and faculty-wise analysis, find toppers and FCD counts, and download official PDF reports. Search your college below to begin.",
  },
  '/college/login': {
    scene: 'login_door',
    message:
      'Welcome back! Enter your college credentials or passcode to unlock your portal.',
  },
  '/college/register': {
    scene: 'register_gate',
    message: "Let's set up your college, I'll guide you step by step!",
  },
  '/college/otp-verify': {
    scene: 'register_otp_sent',
    message: "Check your inbox! Enter the code sent to your email to verify your college.",
  },
  '/college/departments': {
    scene: 'idle',
    message: 'Select your department to access department logins or register a new one.',
  },
  '/department/login': {
    scene: 'login_door',
    message: 'Hi! Log in to your department dashboard with your faculty credentials.',
  },
  '/department/register': {
    scene: 'register_gate',
    message: "Let's register your department! I'll guide you through each field.",
  },
  '/department/otp-verify': {
    scene: 'register_otp_sent',
    message: "I've sent an OTP code to your department email. Check your inbox!",
  },
  '/department/dashboard': {
    scene: 'tab_upload',
    message: "Upload your result sheet and I'll analyse it!",
  },
};

/**
 * Single editable dictionary mapping each dashboard tab to Techie's scene & speech.
 */
export const tabScenes: Record<string, RouteSceneConfig> = {
  upload: {
    scene: 'tab_upload',
    message: "Upload your result sheet and I'll analyse it!",
  },
  subject: {
    scene: 'tab_analysis',
    message: 'Studying subject-wise metrics, pass percentages, and grade distributions.',
  },
  summary: {
    scene: 'tab_toppers',
    message: 'Here are the semester toppers, distinction holders, and FCD breakdowns! 🏆',
  },
  print: {
    scene: 'tab_reports',
    message: 'Official consolidated reports stamped and ready for download.',
  },
  history: {
    scene: 'tab_history',
    message: 'Pulling your past marks uploads and analytics history from the archive.',
  },
};

export interface TechieContextType {
  scene: TechieScene;
  message: string;
  isMuted: boolean;
  isHidden: boolean;
  hasPlayedIntro: boolean;
  isIntroActive: boolean;
  play: (
    scene: TechieScene,
    message?: string,
    options?: { duration?: number; force?: boolean }
  ) => void;
  say: (message: string, scene?: TechieScene) => void;
  introduceSelf: (customIntro?: string) => void;
  skipIntro: () => void;
  toggleMute: () => void;
  toggleHide: () => void;
  closeBubble: () => void;
}

const TechieContext = createContext<TechieContextType | undefined>(undefined);

export const TechieProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [scene, setScene] = useState<TechieScene>('idle');
  const [message, setMessage] = useState<string>('');
  const [isIntroActive, setIsIntroActive] = useState<boolean>(false);

  // Persistent user preferences in sessionStorage
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('techie_muted') === 'true';
    } catch {
      return false;
    }
  });

  const [isHidden, setIsHidden] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('techie_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const [hasPlayedIntro, setHasPlayedIntro] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('techie_intro_played') === 'true';
    } catch {
      return false;
    }
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSceneRef = useRef<string>('');
  const lastMessageRef = useRef<string>('');

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('techie_muted', String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleHide = useCallback(() => {
    setIsHidden((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('techie_hidden', String(next));
      } catch {}
      return next;
    });
  }, []);

  const closeBubble = useCallback(() => {
    setMessage('');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const skipIntro = useCallback(() => {
    setIsIntroActive(false);
    setScene('idle');
    try {
      sessionStorage.setItem('techie_intro_played', 'true');
    } catch {}
    setHasPlayedIntro(true);
  }, []);

  /**
   * Play an animated scene with optional spoken message.
   * Debounced to avoid stutter, and suppresses duplicate identical calls.
   */
  const play = useCallback(
    (
      newScene: TechieScene,
      customMessage?: string,
      options?: { duration?: number; force?: boolean }
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        // Prevent duplicate scenes unless forced
        if (
          !options?.force &&
          lastSceneRef.current === newScene &&
          lastMessageRef.current === (customMessage || '')
        ) {
          return;
        }

        lastSceneRef.current = newScene;
        lastMessageRef.current = customMessage || '';

        // If intro requested and already played this session, gracefully downgrade to idle/wave
        if (newScene === 'intro' && hasPlayedIntro && !options?.force) {
          setScene('idle');
          if (customMessage) {
            setMessage(customMessage);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              setMessage('');
            }, 4500);
          }
          return;
        }

        setScene(newScene);

        if (newScene === 'intro') {
          setIsIntroActive(true);
          try {
            sessionStorage.setItem('techie_intro_played', 'true');
          } catch {}
          setHasPlayedIntro(true);
        }

        if (customMessage) {
          setMessage(customMessage);
          if (timerRef.current) clearTimeout(timerRef.current);

          // Intro speeches stay for center speaking period (16.5s) so user can read naturally
          const duration =
            options?.duration || (newScene === 'intro' ? 16500 : 4500);

          timerRef.current = setTimeout(() => {
            setMessage('');
            if (newScene === 'intro') {
              setTimeout(() => {
                setIsIntroActive(false);
                setScene('idle');
              }, 3500);
            }
          }, duration);
        }
      }, 70);
    },
    [hasPlayedIntro]
  );

  const say = useCallback(
    (newMessage: string, overrideScene?: TechieScene) => {
      play(overrideScene || scene, newMessage);
    },
    [play, scene]
  );

  const introduceSelf = useCallback(
    (customIntro?: string) => {
      setIsIntroActive(true);
      setHasPlayedIntro(true);
      try {
        sessionStorage.setItem('techie_intro_played', 'true');
      } catch {}
      play(
        'intro',
        customIntro ||
          "Hi, I'm Techie, welcome to MarksAnalyzer! Here you can register your college, upload result sheets, get subject-wise and faculty-wise analysis, find toppers and FCD counts, and download official PDF reports. Search your college below to begin.",
        { force: true, duration: 16500 }
      );
    },
    [play]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <TechieContext.Provider
      value={{
        scene,
        message,
        isMuted,
        isHidden,
        hasPlayedIntro,
        isIntroActive,
        play,
        say,
        introduceSelf,
        skipIntro,
        toggleMute,
        toggleHide,
        closeBubble,
      }}
    >
      {children}
    </TechieContext.Provider>
  );
};

export const useTechie = (): TechieContextType => {
  const context = useContext(TechieContext);
  if (!context) {
    throw new Error('useTechie must be used within a TechieProvider');
  }
  return context;
};

/**
 * Route & Tab Watcher for Techie
 * Triggers corresponding scenes on route transitions or tab switches
 * Every new session, Techie introduces himself.
 */
export const TechieRouteWatcher: React.FC<{ currentTab?: string }> = ({
  currentTab,
}) => {
  const location = useLocation();
  const { play, hasPlayedIntro } = useTechie();
  const prevPathRef = useRef<string>('');
  const prevTabRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const pathname = location.pathname;

    // 1. Dashboard Tab Switch
    if (pathname === '/department/dashboard' && currentTab) {
      if (prevTabRef.current !== currentTab) {
        prevTabRef.current = currentTab;
        const tabConfig = tabScenes[currentTab];
        if (tabConfig) {
          play(tabConfig.scene, tabConfig.message);
        }
      }
      return;
    }

    // 2. Normal Route Transition
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;

      // On new session entering department dashboard, introduce himself
      if (pathname === '/department/dashboard' && !hasPlayedIntro) {
        play(
          'intro',
          "Hi, I'm Techie! Welcome to your new active session for the marks analysis portal. Let's upload and analyze your result sheets!",
          { force: true }
        );
        return;
      }

      const config = routeScenes[pathname];
      if (config) {
        // On home page, play full intro on first visit of every session, or short wave afterwards
        if (pathname === '/' && hasPlayedIntro) {
          play(
            'idle',
            "Welcome back! Search for your college or pick from the list below."
          );
        } else {
          play(config.scene, config.message);
        }
      }
    }
  }, [location.pathname, currentTab, play, hasPlayedIntro]);

  return null;
};
