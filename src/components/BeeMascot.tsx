import React, { useEffect, useState, useRef } from 'react';
import { useBee } from '../context/BeeContext';
import { X, Volume2, VolumeX, Sparkles, Search, AlertCircle, Compass } from 'lucide-react';

export const BeeMascot: React.FC = () => {
  const { mood, message, isMuted, toggleMute, dismiss } = useBee();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Position & Zig-Zag state for cursor tracking
  const [pos, setPos] = useState({ x: -100, y: -100, rot: 0, isFlying: false });
  const [trail, setTrail] = useState<{ x: number; y: number; id: number; opacity: number }[]>([]);

  const mousePosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const flightTimeRef = useRef(0);
  const lastMouseMoveRef = useRef(0);
  const trailCounterRef = useRef(0);

  // Initialize position at bottom right
  useEffect(() => {
    const initX = window.innerWidth - 100;
    const initY = window.innerHeight - 100;
    mousePosRef.current = { x: initX, y: initY };
    currentPosRef.current = { x: initX, y: initY };
    setPos({ x: initX, y: initY, rot: 0, isFlying: false });

    // Track mouse cursor across window
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      lastMouseMoveRef.current = performance.now();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Animation Loop for Zig-Zag flight
    let animId: number;
    let trailDropTimer = 0;

    const loop = () => {
      animId = requestAnimationFrame(loop);

      const now = performance.now();
      const timeSinceMouse = now - lastMouseMoveRef.current;
      const isRecentlyActive = timeSinceMouse < 2200;

      // Determine Target:
      // If cursor is active, target is offset safely next to cursor so it never covers buttons
      let targetX = mousePosRef.current.x + 36;
      let targetY = mousePosRef.current.y + 24;

      // If mouse hasn't moved in >2.2s, gracefully settle towards home nest at bottom-right
      if (!isRecentlyActive) {
        targetX = window.innerWidth - 100;
        targetY = window.innerHeight - 100;
      }

      // Constrain within viewport boundaries
      targetX = Math.max(48, Math.min(window.innerWidth - 88, targetX));
      targetY = Math.max(56, Math.min(window.innerHeight - 88, targetY));

      const dx = targetX - currentPosRef.current.x;
      const dy = targetY - currentPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Lerp base position smoothly towards target
      const lerp = dist > 50 ? 0.08 : 0.045;
      currentPosRef.current.x += dx * lerp;
      currentPosRef.current.y += dy * lerp;

      // Flight time increases faster when traveling
      const isFlying = dist > 6;
      flightTimeRef.current += isFlying ? 0.065 : 0.02;
      const t = flightTimeRef.current;

      // Zig-Zag oscillation calculation:
      // Normal vector perpendicular to flight direction
      let nx = 0;
      let ny = 0;
      if (dist > 2) {
        nx = -dy / dist;
        ny = dx / dist;
      } else {
        nx = 0;
        ny = 1;
      }

      // Zig-zag amplitude scales with distance/speed
      const zigZagAmp = Math.min(dist * 0.42, 32);
      // Dual harmonic sine wave for authentic erratic insect zig-zag darting
      const zigZagOffset =
        Math.sin(t * 18) * zigZagAmp + Math.sin(t * 36) * (zigZagAmp * 0.35);

      // Gentle vertical hover bobbing
      const hoverBob = Math.sin(t * 7) * 6;

      // Computed final rendered coordinates
      const renderX = currentPosRef.current.x + nx * zigZagOffset;
      const renderY = currentPosRef.current.y + ny * zigZagOffset + hoverBob;

      // Banking angle: tilts dynamically into turns and zig-zags
      const bankBase = isFlying ? (dx > 0 ? 14 : -14) : 0;
      const bankWiggle = isFlying ? Math.sin(t * 18) * 18 : Math.sin(t * 6) * 4;
      const renderRot = bankBase + bankWiggle;

      setPos({
        x: renderX,
        y: renderY,
        rot: renderRot,
        isFlying,
      });

      // Spawn faint golden sparkle trail while in zig-zag motion
      trailDropTimer += 1;
      if (isFlying && trailDropTimer % 6 === 0) {
        trailCounterRef.current += 1;
        setTrail((prev) => [
          ...prev.slice(-4),
          {
            x: renderX,
            y: renderY,
            id: trailCounterRef.current,
            opacity: 0.7,
          },
        ]);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Typewriter effect when a new message arrives
  useEffect(() => {
    if (!message) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);

    let currentIndex = 0;
    const speed = 25; // 25ms per character for snappy natural typing

    const interval = setInterval(() => {
      currentIndex += 1;
      setDisplayedText(message.slice(0, currentIndex));
      if (currentIndex >= message.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [message]);

  if (pos.x < 0) return null;

  // Determine speech bubble placement to prevent clipping off screen
  const isNearTop = pos.y < 180;
  const isNearRight = pos.x > window.innerWidth - 320;

  return (
    <>
      {/* Golden Zig-Zag Pollen Trail Dots */}
      {trail.map((pt, idx) => (
        <div
          key={pt.id}
          className="fixed pointer-events-none rounded-full bg-amber-400/60 blur-[1px] -z-0 transition-opacity duration-500"
          style={{
            left: `${pt.x + 28}px`,
            top: `${pt.y + 28}px`,
            width: `${4 + idx * 1.5}px`,
            height: `${4 + idx * 1.5}px`,
            opacity: (idx + 1) * 0.15,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Main Bee Mascot Container (Follows cursor in dynamic Zig-Zag path) */}
      <div
        className="fixed z-50 select-none pointer-events-none transition-transform will-change-transform"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Speech Bubble (Anchored smartly above or beside the bee) */}
        {message && !isMuted && (
          <div
            className={`absolute pointer-events-auto max-w-[270px] sm:max-w-[310px] bg-white/95 backdrop-blur-md border border-amber-200/90 shadow-2xl shadow-amber-500/15 rounded-2xl p-3.5 text-slate-800 text-xs leading-relaxed transition-all duration-200 ${
              isNearTop ? 'top-16' : 'bottom-16'
            } ${isNearRight ? 'right-0' : 'left-0'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-700">
                {mood === 'searching' && <Search className="w-3 h-3 text-amber-600 animate-spin" />}
                {mood === 'success' && <Sparkles className="w-3 h-3 text-emerald-600 animate-bounce" />}
                {mood === 'error' && <AlertCircle className="w-3 h-3 text-rose-500" />}
                <span>Bee Assistant</span>
              </div>
              <button
                onClick={dismiss}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close message"
                aria-label="Close message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-1 text-slate-700 font-medium">
              {displayedText}
              {isTyping && <span className="inline-block w-1.5 h-3 ml-0.5 bg-amber-500 animate-pulse" />}
            </div>

            {/* Speech Bubble Arrow */}
            <div
              className={`absolute w-3.5 h-3.5 bg-white border-amber-200/90 transform rotate-45 ${
                isNearTop
                  ? '-top-2 border-t border-l ' + (isNearRight ? 'right-8' : 'left-8')
                  : '-bottom-2 border-b border-r ' + (isNearRight ? 'right-8' : 'left-8')
              }`}
            />
          </div>
        )}

        {/* Bee Character & Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Mute/Unmute toggle on hover */}
          <button
            onClick={toggleMute}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all text-xs shadow-md border cursor-pointer ${
              isMuted
                ? 'bg-slate-800/90 text-slate-400 border-slate-700 opacity-90 hover:opacity-100'
                : 'bg-white/90 text-amber-600 border-amber-200/80 opacity-0 hover:opacity-100'
            } ${isHovered ? 'opacity-100' : ''}`}
            title={isMuted ? 'Unmute Bee assistant' : 'Mute Bee assistant'}
            aria-label={isMuted ? 'Unmute Bee assistant' : 'Mute Bee assistant'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Animated SVG Bee Character with Banking Angle */}
          <div
            className={`relative cursor-pointer filter drop-shadow-[0_8px_16px_rgba(245,158,11,0.3)] transition-transform duration-75 ${
              mood === 'searching'
                ? 'animate-bee-search'
                : mood === 'success'
                ? 'animate-bee-bounce'
                : mood === 'error'
                ? 'animate-bee-shake'
                : mood === 'talking'
                ? 'animate-bee-bob'
                : 'animate-bee-hover'
            }`}
            style={{
              transform: `rotate(${pos.rot}deg)`,
            }}
            onClick={() => {
              if (isMuted) toggleMute();
            }}
            title={isMuted ? 'Bee is muted (click to unmute)' : "Bee — MarksAnalyzer's friendly helper!"}
          >
            {/* Confetti / Sparkles for Success Mood */}
            {mood === 'success' && (
              <div className="absolute -top-3 -left-3 -right-3 -bottom-3 pointer-events-none flex items-center justify-center">
                <span className="absolute -top-1 left-2 text-xs animate-ping">✨</span>
                <span className="absolute -bottom-1 right-2 text-xs animate-bounce">🎉</span>
                <span className="absolute top-2 -right-1 text-xs animate-pulse">⭐</span>
              </div>
            )}

            {/* SVG Animated Bee */}
            <svg
              width="64"
              height="64"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-14 h-14 sm:w-16 sm:h-16"
            >
              <defs>
                {/* Gold gradient for bee body */}
                <linearGradient id="beeGold" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FBBF24" />
                  <stop offset="0.5" stopColor="#F59E0B" />
                  <stop offset="1" stopColor="#D97706" />
                </linearGradient>

                {/* Wing translucent glow gradient */}
                <linearGradient id="beeWing" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#E0F2FE" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#BAE6FD" stopOpacity="0.5" />
                </linearGradient>
              </defs>

              {/* Left Wing (Back Wing) - Flaps faster when flying */}
              <ellipse
                cx="38"
                cy="28"
                rx="12"
                ry="22"
                transform="rotate(-25 38 28)"
                fill="url(#beeWing)"
                stroke="#7DD3FC"
                strokeWidth="1.5"
                className="animate-wing-left origin-[46px_40px]"
                style={{
                  animationDuration: pos.isFlying ? '0.07s' : '0.12s',
                }}
              />

              {/* Right Wing (Front Wing) - Flaps faster when flying */}
              <ellipse
                cx="58"
                cy="25"
                rx="13"
                ry="24"
                transform="rotate(20 58 25)"
                fill="url(#beeWing)"
                stroke="#7DD3FC"
                strokeWidth="1.5"
                className="animate-wing-right origin-[52px_38px]"
                style={{
                  animationDuration: pos.isFlying ? '0.07s' : '0.12s',
                }}
              />

              {/* Bee Stinger */}
              <path d="M16 52L22 47V57L16 52Z" fill="#1E293B" />

              {/* Bee Main Body (Chubby striped oval) */}
              <ellipse cx="50" cy="52" rx="28" ry="24" fill="url(#beeGold)" stroke="#B45309" strokeWidth="2" />

              {/* Black Stripes */}
              <path
                d="M34 32.5C36 44 36 59 34 71.5"
                stroke="#0F172A"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M48 28.5C50 44 50 60 48 75.5"
                stroke="#0F172A"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M62 31C63.5 43 63.5 61 62 73"
                stroke="#0F172A"
                strokeWidth="6"
                strokeLinecap="round"
              />

              {/* Antennae */}
              <path
                d="M66 32C70 24 74 18 80 18"
                stroke="#1E293B"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={mood === 'error' ? 'origin-[66px_32px] rotate-12' : ''}
              />
              <circle cx="81" cy="18" r="3" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />

              <path
                d="M74 36C78 28 84 24 90 26"
                stroke="#1E293B"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={mood === 'error' ? 'origin-[74px_36px] rotate-12' : ''}
              />
              <circle cx="91" cy="26" r="3" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />

              {/* Eyes */}
              {mood === 'error' ? (
                <>
                  <path d="M66 45L72 49" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M76 47L82 51" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
                </>
              ) : mood === 'success' ? (
                <>
                  <path d="M66 48C68 44 71 44 73 48" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M76 50C78 46 81 46 83 50" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <circle cx="70" cy="47" r="4.5" fill="#0F172A" />
                  <circle cx="71.5" cy="45.5" r="1.5" fill="#FFFFFF" />

                  <circle cx="80" cy="49" r="4" fill="#0F172A" />
                  <circle cx="81.2" cy="47.8" r="1.3" fill="#FFFFFF" />
                </>
              )}

              {/* Cheeks (Blushing pink) */}
              <ellipse cx="68" cy="55" rx="3.5" ry="2" fill="#F43F5E" fillOpacity="0.6" />
              <ellipse cx="80" cy="56" rx="3" ry="1.8" fill="#F43F5E" fillOpacity="0.6" />

              {/* Mouth */}
              {mood === 'error' ? (
                <path d="M72 59C74 57 76 57 78 59" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
              ) : mood === 'talking' ? (
                <ellipse cx="74" cy="59" rx="3" ry="3.5" fill="#BE123C" stroke="#0F172A" strokeWidth="1.5" />
              ) : (
                <path d="M71 58C73 61 76 61 78 58" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
              )}

              {/* Magnifying Glass Accessory for Searching Mood */}
              {mood === 'searching' && (
                <g className="animate-pulse">
                  <circle cx="86" cy="58" r="7" stroke="#3B82F6" strokeWidth="2.5" fill="#60A5FA" fillOpacity="0.3" />
                  <path d="M91 63L97 69" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};
