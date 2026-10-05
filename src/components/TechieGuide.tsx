import React, { useState, useEffect, useRef } from 'react';
import { useTechie, TechieScene } from '../context/TechieContext';
import {
  Volume2,
  VolumeX,
  EyeOff,
  Eye,
  X,
  FastForward,
  Sparkles,
  FileSpreadsheet,
  BarChart3,
  Trophy,
  FileCheck,
  FolderArchive,
  KeyRound,
  DoorOpen,
} from 'lucide-react';

export const TechieGuide: React.FC = () => {
  const {
    scene,
    message,
    isMuted,
    isHidden,
    isIntroActive,
    skipIntro,
    toggleMute,
    toggleHide,
    closeBubble,
  } = useTechie();

  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Intro Walk Sequence Phases:
  // 1. 'walk_in_start': Techie starts off-screen at far-left (-160px)
  // 2. 'walking_to_center': Walking across screen towards center (0 to 4.2s)
  // 3. 'speaking_at_center': Stops at center, waves, speech bubble opens and speaks (4.2s to 16.5s)
  // 4. 'walking_to_corner': Walks from center across to bottom-right resting corner (16.5s to 19.8s)
  // 5. 'idle_at_corner': Settled at resting corner, gentle idle breathing/blinking
  const [introPhase, setIntroPhase] = useState<
    | 'walk_in_start'
    | 'walking_to_center'
    | 'speaking_at_center'
    | 'walking_to_corner'
    | 'idle_at_corner'
  >('idle_at_corner');

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearIntroTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    if (scene === 'intro') {
      clearIntroTimers();

      // Check user preference for reduced motion
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      if (prefersReducedMotion) {
        // Skip crossing walk and jump directly to speaking at center
        setIntroPhase('speaking_at_center');
        const tEnd = setTimeout(() => {
          setIntroPhase('idle_at_corner');
        }, 12000);
        timersRef.current.push(tEnd);
        return;
      }

      // Step 1: Start off-screen far left
      setIntroPhase('walk_in_start');

      // Step 2: Begin natural walk to center stage
      const t1 = setTimeout(() => {
        setIntroPhase('walking_to_center');
      }, 50);

      // Step 3: Arrive at center, stop walking, wave and start speaking
      const t2 = setTimeout(() => {
        setIntroPhase('speaking_at_center');
      }, 4200);

      // Step 4: Finish speaking, begin walk to resting corner
      const t3 = setTimeout(() => {
        setIntroPhase('walking_to_corner');
      }, 16500);

      // Step 5: Arrive at resting corner, settle into idle
      const t4 = setTimeout(() => {
        setIntroPhase('idle_at_corner');
      }, 19800);

      timersRef.current.push(t1, t2, t3, t4);

      return () => clearIntroTimers();
    } else {
      clearIntroTimers();
      setIntroPhase('idle_at_corner');
    }
  }, [scene]);

  // Handle Skip Intro
  const handleSkipIntro = () => {
    clearIntroTimers();
    setIntroPhase('idle_at_corner');
    skipIntro();
  };

  // Typewriter effect for speech bubble
  // Only display speech during 'speaking_at_center' for intro, or anytime for other scenes
  const shouldShowBubble =
    Boolean(message) &&
    (scene !== 'intro' || introPhase === 'speaking_at_center');

  useEffect(() => {
    if (!shouldShowBubble || !message) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);

    let index = 0;
    const interval = setInterval(() => {
      index++;
      setDisplayedText(message.slice(0, index));
      if (index >= message.length) {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [message, shouldShowBubble]);

  if (isHidden) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={toggleHide}
          title="Show Techie guide"
          className="p-2.5 rounded-full bg-slate-900/90 text-blue-400 hover:text-blue-300 border border-slate-700 shadow-xl backdrop-blur-md transition-all hover:scale-110 flex items-center gap-1.5 text-xs font-semibold px-3 cursor-pointer"
        >
          <Eye className="w-4 h-4 text-blue-400" />
          <span>Techie</span>
        </button>
      </div>
    );
  }

  // Dynamic coordinates and transition for the intro walk
  let containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: 45,
    transition: 'all 0.3s ease-out',
  };

  let isWalking = false;
  let isWaving = false;
  let isAtCenter = false;

  if (scene === 'intro' && isIntroActive) {
    if (introPhase === 'walk_in_start') {
      isWalking = true;
      containerStyle = {
        position: 'fixed',
        bottom: '24px',
        left: '-160px',
        zIndex: 50,
        transition: 'none',
      };
    } else if (introPhase === 'walking_to_center') {
      isWalking = true;
      containerStyle = {
        position: 'fixed',
        bottom: '24px',
        left: 'calc(50vw - 64px)',
        zIndex: 50,
        transition: 'left 4.15s cubic-bezier(0.25, 1, 0.45, 1)',
      };
    } else if (introPhase === 'speaking_at_center') {
      isWaving = true;
      isAtCenter = true;
      containerStyle = {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        transition: 'transform 0.3s ease-out',
      };
    } else if (introPhase === 'walking_to_corner') {
      isWalking = true;
      containerStyle = {
        position: 'fixed',
        bottom: '16px',
        left: 'calc(100vw - 160px)',
        zIndex: 50,
        transition:
          'left 3.25s cubic-bezier(0.25, 1, 0.45, 1), bottom 3.25s ease-in-out',
      };
    }
  }

  return (
    <div
      style={containerStyle}
      className={`pointer-events-none flex flex-col ${
        isAtCenter ? 'items-center max-w-lg w-full px-4' : 'items-end max-w-sm sm:max-w-md'
      }`}
      role="region"
      aria-label="Techie Assistant Guide"
    >
      {/* Walking Pill Indicator with Skip Button during Cross-Screen Walk */}
      {scene === 'intro' &&
        isIntroActive &&
        (introPhase === 'walk_in_start' || introPhase === 'walking_to_center') && (
          <div className="pointer-events-auto mb-3 flex items-center gap-2 bg-slate-900/90 border border-blue-500/40 rounded-full px-3 py-1 shadow-xl backdrop-blur-md animate-bounce">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span className="text-[11px] font-semibold text-blue-300">
              Techie is walking in...
            </span>
            <button
              onClick={handleSkipIntro}
              className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 transition-colors cursor-pointer shadow"
              title="Skip intro"
            >
              <FastForward className="w-2.5 h-2.5" />
              Skip
            </button>
          </div>
        )}

      {/* Speech Bubble */}
      {shouldShowBubble && (
        <div
          className={`pointer-events-auto mb-3.5 bg-slate-900/95 backdrop-blur-2xl border border-blue-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-blue-950/60 text-slate-100 relative animate-fade-in ${
            isAtCenter
              ? 'max-w-md sm:max-w-lg w-full text-center'
              : 'max-w-[320px] sm:max-w-[360px] text-left'
          }`}
          aria-live="polite"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800 text-[11px] font-bold text-blue-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
              <span className="tracking-wide">Techie Guide</span>
              {scene === 'intro' && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                  Welcome Tour
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {scene === 'intro' && isIntroActive && (
                <button
                  onClick={handleSkipIntro}
                  className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center gap-1 transition-colors font-medium cursor-pointer border border-slate-700/60"
                  title="Skip intro"
                >
                  <FastForward className="w-3 h-3 text-blue-400" />
                  <span>Skip Intro</span>
                </button>
              )}
              <button
                onClick={closeBubble}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Typewritten Message */}
          <p className="text-xs sm:text-[13.5px] leading-relaxed font-medium text-slate-100">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-blue-400 animate-pulse align-middle" />
            )}
          </p>

          {/* Bubble Tail */}
          {isAtCenter ? (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900/95 border-r border-b border-blue-500/40 transform rotate-45" />
          ) : (
            <div className="absolute -bottom-2 right-12 w-4 h-4 bg-slate-900/95 border-r border-b border-blue-500/40 transform rotate-45" />
          )}
        </div>
      )}

      {/* Techie Rigged Character Stage Area */}
      <div className="pointer-events-auto flex items-end gap-2">
        {/* Quick Controls Pill (Mute / Hide) */}
        {!isAtCenter && (
          <div className="flex flex-col gap-1.5 mb-2 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-lg">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={toggleHide}
              title="Hide Techie"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Character Stage & Props Canvas */}
        <div className="relative group cursor-pointer select-none">
          <TechieSvgRig
            scene={scene}
            isWalking={isWalking}
            isWaving={isWaving}
          />
        </div>
      </div>
    </div>
  );
};

interface RigProps {
  scene: TechieScene;
  isWalking: boolean;
  isWaving: boolean;
}

/**
 * High-Fidelity Rigged SVG Techie Character:
 * Tech-savvy young man with stylish haircut, round spectacles, cyan-lit headphones
 * around neck, indigo hoodie, and laptop backpack.
 */
const TechieSvgRig: React.FC<RigProps> = ({ scene, isWalking, isWaving }) => {
  const isExcited =
    scene === 'search_found' ||
    scene === 'register_verified' ||
    scene === 'login_success';
  const isWorried =
    scene === 'search_not_found' ||
    scene === 'login_failed' ||
    scene === 'delete_confirm';

  return (
    <div className="relative w-28 h-36 sm:w-32 sm:h-40 flex items-end justify-center select-none filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
      {/* Dynamic Background Stage Props per Scene */}
      <ScenePropsOverlay scene={scene} />

      {/* Main Rigged SVG Character */}
      <svg
        viewBox="0 0 160 200"
        className={`w-full h-full transition-transform duration-300 ${
          isWalking ? 'animate-techie-walk' : 'animate-techie-breathe'
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hoodieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="50%" stopColor="#4338ca" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>

          <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffdfbf" />
            <stop offset="100%" stopColor="#f3be94" />
          </linearGradient>

          <linearGradient id="backpackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. BACKPACK (Visible behind left shoulder) */}
        <g id="backpack" className="transition-transform duration-300">
          <rect
            x="42"
            y="86"
            width="30"
            height="52"
            rx="10"
            fill="url(#backpackGrad)"
            stroke="#334155"
            strokeWidth="2"
          />
          {/* Laptop pouch zipper */}
          <path
            d="M48 94 Q57 90 66 94"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Tech badge / keychain */}
          <circle cx="49" cy="116" r="3" fill="#38bdf8" />
          <path d="M49 119 L49 126" stroke="#94a3b8" strokeWidth="1.5" />
        </g>

        {/* 2. LEGS & SNEAKERS (Independent Gait Swing) */}
        <g id="legs">
          {/* Left Leg */}
          <g className={isWalking ? 'animate-leg-left' : ''}>
            <rect x="62" y="142" width="14" height="42" rx="6" fill="#1e1b4b" />
            {/* Left Sneaker */}
            <path
              d="M57 180 L76 180 Q80 180 80 184 L80 188 Q76 190 57 190 Z"
              fill="#ffffff"
            />
            <path d="M72 182 L78 184" stroke="#3b82f6" strokeWidth="2" />
          </g>

          {/* Right Leg */}
          <g className={isWalking ? 'animate-leg-right' : ''}>
            <rect x="84" y="142" width="14" height="42" rx="6" fill="#1e1b4b" />
            {/* Right Sneaker */}
            <path
              d="M80 180 L99 180 Q103 180 103 184 L103 188 Q99 190 80 190 Z"
              fill="#ffffff"
            />
            <path d="M95 182 L101 184" stroke="#3b82f6" strokeWidth="2" />
          </g>
        </g>

        {/* 3. TORSO & HOODIE */}
        <g id="torso">
          {/* Main Hoodie Body */}
          <path
            d="M52 92 C52 82, 108 82, 108 92 L112 144 C112 148, 48 148, 48 144 Z"
            fill="url(#hoodieGrad)"
          />

          {/* Kangaroo Pocket */}
          <path
            d="M60 120 L100 120 L103 138 Q80 142 57 138 Z"
            fill="#3730a3"
            stroke="#4338ca"
            strokeWidth="1.5"
          />

          {/* Drawstring Cords */}
          <path
            d="M72 88 L72 108"
            stroke="#c7d2fe"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="72" cy="110" r="2" fill="#c7d2fe" />
          <path
            d="M88 88 L88 106"
            stroke="#c7d2fe"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="88" cy="110" r="2" fill="#c7d2fe" />

          {/* Backpack Straps over shoulders */}
          <path
            d="M57 88 L58 136"
            stroke="#0f172a"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M103 88 L102 136"
            stroke="#0f172a"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>

        {/* 4. HEADPHONES (Resting comfortably around neck) */}
        <g id="headphones">
          {/* Padded neckband arc */}
          <path
            d="M58 84 Q80 96 102 84"
            stroke="#0f172a"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M58 84 Q80 96 102 84"
            stroke="#334155"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Left Earcup with glowing cyan LED ring */}
          <rect x="52" y="74" width="10" height="18" rx="5" fill="#1e293b" />
          <rect
            x="54"
            y="77"
            width="6"
            height="12"
            rx="3"
            fill="#06b6d4"
            filter="url(#glowEffect)"
          />

          {/* Right Earcup with glowing cyan LED ring */}
          <rect x="98" y="74" width="10" height="18" rx="5" fill="#1e293b" />
          <rect
            x="100"
            y="77"
            width="6"
            height="12"
            rx="3"
            fill="#06b6d4"
            filter="url(#glowEffect)"
          />
        </g>

        {/* 5. HEAD & HAIR */}
        <g id="head" className="animate-techie-head">
          {/* Neck */}
          <rect x="73" y="72" width="14" height="16" fill="#f3be94" />

          {/* Face */}
          <ellipse cx="80" cy="54" rx="22" ry="24" fill="url(#faceGrad)" />

          {/* Ears */}
          <circle cx="58" cy="54" r="5" fill="#f3be94" />
          <circle cx="102" cy="54" r="5" fill="#f3be94" />

          {/* Stylish Modern Haircut */}
          <path
            d="M58 48 C56 30, 80 20, 102 32 C104 38, 104 46, 102 50 C96 42, 92 44, 88 40 C84 46, 76 42, 70 45 C64 43, 60 46, 58 48 Z"
            fill="#1c1917"
          />
          {/* Hair Sheen */}
          <path
            d="M72 28 Q84 25 94 30"
            stroke="#44403c"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Eyebrows */}
          {isWorried ? (
            <>
              <path
                d="M68 43 L76 45"
                stroke="#1c1917"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M84 45 L92 43"
                stroke="#1c1917"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M68 44 L76 43"
                stroke="#1c1917"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M84 43 L92 44"
                stroke="#1c1917"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Eyes with Natural Blinking */}
          <g id="eyes" className="animate-techie-blink">
            <ellipse cx="72" cy="50" rx="3.5" ry="4" fill="#0f172a" />
            <circle cx="73" cy="48.5" r="1.2" fill="#ffffff" />

            <ellipse cx="88" cy="50" rx="3.5" ry="4" fill="#0f172a" />
            <circle cx="89" cy="48.5" r="1.2" fill="#ffffff" />
          </g>

          {/* Round Glasses (Techie Signature) */}
          <g id="glasses">
            <circle
              cx="72"
              cy="50"
              r="9"
              stroke="#38bdf8"
              strokeWidth="2.5"
              fill="rgba(56, 189, 248, 0.12)"
            />
            <circle
              cx="88"
              cy="50"
              r="9"
              stroke="#38bdf8"
              strokeWidth="2.5"
              fill="rgba(56, 189, 248, 0.12)"
            />
            <path d="M81 50 L79 50" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Glint Reflection */}
            <path
              d="M67 46 L70 43"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M83 46 L86 43"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>

          {/* Nose */}
          <path
            d="M79 52 Q81 56 78 57"
            stroke="#e09d6c"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Mouth (Expressive & Speaking) */}
          {isWorried ? (
            <path
              d="M75 66 Q80 62 85 66"
              stroke="#991b1b"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          ) : isExcited ? (
            <path
              d="M73 63 Q80 72 87 63 Z"
              fill="#991b1b"
              stroke="#7f1d1d"
              strokeWidth="1"
            />
          ) : isWaving ? (
            <path
              d="M73 62 Q80 70 87 62 Z"
              fill="#991b1b"
              stroke="#7f1d1d"
              strokeWidth="1"
            />
          ) : (
            <path
              d="M74 63 Q80 68 86 63"
              stroke="#831843"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>

        {/* 6. ARMS & PROPS */}
        {/* Left Arm */}
        <g id="left-arm">
          {isWaving ? (
            /* Friendly Hand Wave */
            <g className="animate-techie-wave origin-[52px_92px]">
              <path
                d="M52 92 L34 70 L30 48"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="29" cy="44" r="6" fill="#f3be94" />
            </g>
          ) : isExcited ? (
            <g className="animate-techie-cheer origin-[52px_92px]">
              <path
                d="M52 92 L36 68 L28 46"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="26" cy="42" r="6" fill="#f3be94" />
            </g>
          ) : isWalking ? (
            /* Arm swings naturally opposite to legs while walking */
            <g className="animate-leg-right origin-[52px_92px]">
              <path
                d="M52 92 L46 118 L48 132"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="48" cy="134" r="5" fill="#f3be94" />
            </g>
          ) : (
            <path
              d="M52 92 L46 118 L48 132"
              stroke="url(#hoodieGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>

        {/* Right Arm & Active Props */}
        <g id="right-arm">
          {scene === 'search' ? (
            /* Holding Magnifying Glass */
            <g className="animate-techie-search origin-[108px_92px]">
              <path
                d="M108 92 L124 104 L138 96"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="138" cy="94" r="6" fill="#f3be94" />
              <circle
                cx="144"
                cy="84"
                r="10"
                stroke="#f59e0b"
                strokeWidth="3"
                fill="rgba(245, 158, 11, 0.2)"
              />
              <line
                x1="138"
                y1="92"
                x2="132"
                y2="100"
                stroke="#b45309"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </g>
          ) : scene === 'tab_toppers' ? (
            /* Holding Shiny Gold Trophy */
            <g>
              <path
                d="M108 92 L122 108 L126 116"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="126" cy="116" r="6" fill="#f3be94" />
              <g transform="translate(118, 92)">
                <path
                  d="M0 6 Q0 18 10 18 Q20 18 20 6 Z"
                  fill="#fbbf24"
                  stroke="#d97706"
                  strokeWidth="1.5"
                />
                <path d="M7 18 L13 18 L14 26 L6 26 Z" fill="#b45309" />
                <rect x="4" y="26" width="12" height="4" rx="1" fill="#78350f" />
                <path
                  d="M-3 8 Q-6 12 0 14"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M23 8 Q26 12 20 14"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            </g>
          ) : scene === 'register_otp_sent' ? (
            /* Holding Envelope */
            <g>
              <path
                d="M108 92 L122 106 L124 116"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="124" cy="116" r="6" fill="#f3be94" />
              <rect
                x="116"
                y="100"
                width="22"
                height="15"
                rx="2"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <path
                d="M116 100 L127 109 L138 100"
                stroke="#ffffff"
                strokeWidth="1.5"
                fill="none"
              />
            </g>
          ) : scene === 'delete_confirm' ? (
            /* Holding Caution Warning Sign */
            <g className="animate-techie-shake origin-[108px_92px]">
              <path
                d="M108 92 L122 104 L126 114"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="126" cy="114" r="6" fill="#f3be94" />
              <polygon
                points="127,90 141,114 113,114"
                fill="#eab308"
                stroke="#ca8a04"
                strokeWidth="2"
              />
              <text
                x="127"
                y="110"
                textAnchor="middle"
                fill="#000"
                fontSize="12"
                fontWeight="bold"
              >
                !
              </text>
            </g>
          ) : isWalking ? (
            /* Arm swings opposite while walking */
            <g className="animate-leg-left origin-[108px_92px]">
              <path
                d="M108 92 L114 118 L112 132"
                stroke="url(#hoodieGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="112" cy="134" r="5" fill="#f3be94" />
            </g>
          ) : (
            <path
              d="M108 92 L114 118 L112 132"
              stroke="url(#hoodieGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>
      </svg>
    </div>
  );
};

/**
 * Scene-Specific Stage Props:
 * Portal for Login, Scanner for Upload, Floating Chart for Analysis, Confetti for Register
 */
const ScenePropsOverlay: React.FC<{ scene: TechieScene }> = ({ scene }) => {
  if (
    scene === 'login_door' ||
    scene === 'login_typing' ||
    scene === 'login_success' ||
    scene === 'login_failed'
  ) {
    return (
      <div className="absolute -left-12 bottom-0 w-16 h-28 border-2 border-blue-500/60 rounded-t-lg bg-slate-900/90 flex flex-col items-center justify-between p-1.5 shadow-lg shadow-blue-500/20 overflow-hidden pointer-events-none">
        <div className="w-full flex items-center justify-between text-[8px] text-blue-400 font-mono">
          <span>PORTAL</span>
          <KeyRound className="w-2.5 h-2.5 text-blue-400" />
        </div>
        <div className="w-8 h-8 rounded-full border border-blue-400/50 flex items-center justify-center my-auto">
          {scene === 'login_success' ? (
            <DoorOpen className="w-5 h-5 text-emerald-400 animate-bounce" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          )}
        </div>
        <div className="w-full bg-slate-800 rounded p-0.5 text-center text-[7px] text-slate-400 font-mono">
          {scene === 'login_success' ? 'UNLOCKED' : 'SECURE'}
        </div>
      </div>
    );
  }

  if (scene === 'tab_upload') {
    return (
      <div className="absolute -left-10 bottom-2 w-14 h-16 bg-slate-900/90 border border-cyan-500/50 rounded-lg p-1.5 flex flex-col items-center justify-between shadow-cyan-500/20 shadow-md">
        <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
        <div className="w-full h-0.5 bg-cyan-400 animate-scanner-laser shadow-[0_0_8px_#22d3ee]" />
        <span className="text-[7px] text-cyan-300 font-mono uppercase">
          SCANNER
        </span>
      </div>
    );
  }

  if (scene === 'tab_analysis') {
    return (
      <div className="absolute -left-10 bottom-2 w-14 h-16 bg-slate-900/90 border border-indigo-500/50 rounded-lg p-1 flex flex-col items-center justify-between shadow-indigo-500/20 shadow-md">
        <BarChart3 className="w-6 h-6 text-indigo-400 animate-pulse" />
        <span className="text-[7px] text-indigo-300 font-mono uppercase">
          METRICS
        </span>
      </div>
    );
  }

  if (scene === 'tab_reports') {
    return (
      <div className="absolute -left-10 bottom-2 w-14 h-16 bg-slate-900/90 border border-emerald-500/50 rounded-lg p-1 flex flex-col items-center justify-between shadow-emerald-500/20 shadow-md">
        <FileCheck className="w-6 h-6 text-emerald-400" />
        <span className="text-[7px] text-emerald-300 font-mono uppercase">
          OFFICIAL
        </span>
      </div>
    );
  }

  if (scene === 'tab_history') {
    return (
      <div className="absolute -left-10 bottom-2 w-14 h-16 bg-slate-900/90 border border-purple-500/50 rounded-lg p-1 flex flex-col items-center justify-between shadow-purple-500/20 shadow-md">
        <FolderArchive className="w-6 h-6 text-purple-400" />
        <span className="text-[7px] text-purple-300 font-mono uppercase">
          ARCHIVE
        </span>
      </div>
    );
  }

  if (
    scene === 'register_gate' ||
    scene === 'register_verified' ||
    scene === 'search_found'
  ) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
          <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
        </div>
      </div>
    );
  }

  return null;
};
