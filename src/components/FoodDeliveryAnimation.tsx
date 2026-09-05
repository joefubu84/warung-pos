import React from 'react';

interface FoodDeliveryAnimationProps {
  status?: 'pending_payment' | 'preparing' | 'ready' | 'picked_up' | 'on_the_way' | 'arrived' | 'completed' | 'delivered';
  size?: 'compact' | 'standard' | 'hero';
  className?: string;
}

export const FoodDeliveryAnimation: React.FC<FoodDeliveryAnimationProps> = ({
  status = 'on_the_way',
  size = 'standard',
  className = ''
}) => {
  const isCompleted = status === 'completed' || status === 'delivered';
  const isDriving = !isCompleted && (status === 'ready' || status === 'picked_up' || status === 'on_the_way' || status === 'arrived');
  const isPreparing = !isCompleted && !isDriving && status === 'preparing';
  const isPending = !isCompleted && !isDriving && !isPreparing;

  const heightClass = size === 'compact' ? 'h-28' : size === 'hero' ? 'h-52 sm:h-64' : 'h-36 sm:h-44';

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden rounded-2xl bg-gradient-to-b from-sky-50 via-amber-50/40 to-orange-50/60 border border-slate-200/90 shadow-xs flex flex-col justify-end select-none ${className}`}>
      {/* BACKGROUND AMBIENT GLOW */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-2 left-1/4 w-40 h-20 bg-orange-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-4 right-1/4 w-48 h-20 bg-amber-200/30 rounded-full blur-3xl" />
      </div>

      {/* PARALLAX MOUNTAINS / SABAH SILHOUETTE */}
      <div className="absolute inset-x-0 bottom-10 h-16 opacity-30 pointer-events-none">
        <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="w-full h-full text-slate-300 fill-current">
          <path d="M0,120 L0,70 Q120,40 240,65 Q380,20 520,60 Q680,10 820,70 Q920,45 1000,60 L1000,120 Z" />
        </svg>
      </div>

      {/* MOVING CLOUDS (WHEN DRIVING) */}
      <div className={`absolute top-3 inset-x-0 h-6 flex justify-around opacity-60 pointer-events-none ${isDriving ? 'animate-pulse' : ''}`}>
        <div className="w-12 h-3 bg-white/80 rounded-full blur-[1px] shadow-xs" />
        <div className="w-20 h-4 bg-white/90 rounded-full blur-[1px] shadow-xs" />
        <div className="w-14 h-3 bg-white/80 rounded-full blur-[1px] shadow-xs" />
      </div>

      {/* RIDER & SCOOTER STAGE */}
      <div className="relative w-full h-full flex items-center justify-center pt-2">
        <div className={`relative ${isDriving ? 'animate-bounce-subtle' : isPreparing ? 'animate-pulse' : ''}`}>
          
          {/* WIND SPEED LINES (WHEN ON THE WAY) */}
          {isDriving && (
            <div className="absolute -left-12 top-6 space-y-2 opacity-60 pointer-events-none">
              <div className="w-8 h-0.5 bg-orange-400/70 rounded-full animate-wind-1" />
              <div className="w-12 h-0.5 bg-amber-300/60 rounded-full animate-wind-2" />
              <div className="w-6 h-0.5 bg-orange-300/50 rounded-full animate-wind-3" />
            </div>
          )}

          {/* MAIN SCOOTER & RIDER SVG */}
          <svg
            viewBox="0 0 240 160"
            className={`w-44 sm:w-56 h-auto drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] ${isDriving ? 'transform-gpu' : ''}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* STEAM FROM FOOD BOX */}
            {(isDriving || isPreparing) && (
              <g className="animate-steam opacity-80">
                <path d="M45,45 Q50,35 48,25 Q45,15 52,8" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
                <path d="M55,48 Q60,38 56,28 Q52,18 60,10" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
              </g>
            )}

            {/* DELIVERY THERMAL BOX (WARUNG J&J) */}
            <g id="DeliveryBox">
              <rect x="30" y="50" width="48" height="42" rx="7" fill="#ea580c" stroke="#c2410c" strokeWidth="2.5" />
              <rect x="34" y="55" width="40" height="12" rx="3" fill="#9a3412" />
              {/* Logo / Badge */}
              <circle cx="54" cy="76" r="9" fill="#1c1917" />
              <text x="54" y="80" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="sans-serif">J&J</text>
              {/* Straps */}
              <line x1="42" y1="50" x2="42" y2="92" stroke="#7c2d12" strokeWidth="2" />
              <line x1="66" y1="50" x2="66" y2="92" stroke="#7c2d12" strokeWidth="2" />
            </g>

            {/* SCOOTER CHASSIS & BODY */}
            <g id="ScooterBody">
              {/* Back Rack */}
              <path d="M50,92 L95,92 L105,75 L80,75 Z" fill="#44403c" />
              {/* Main Frame */}
              <path d="M75,95 L145,95 L165,65 L145,65 L130,95 Z" fill="#059669" />
              <path d="M125,75 L155,75 L165,58 L140,58 Z" fill="#10b981" />
              {/* Footboard */}
              <rect x="110" y="93" width="36" height="6" rx="3" fill="#292524" />
              {/* Front Shield & Headlight */}
              <path d="M150,60 L168,60 L180,95 L160,95 Z" fill="#047857" />
              <circle cx="173" cy="65" r="5" fill="#fef08a" />
              {/* Headlight Beam (when driving) */}
              {isDriving && (
                <polygon points="178,65 235,50 235,85 178,70" fill="url(#headlightGradient)" opacity="0.35" />
              )}
              {/* Handlebars */}
              <line x1="160" y1="58" x2="152" y2="38" stroke="#78716c" strokeWidth="4" strokeLinecap="round" />
              <rect x="146" y="36" width="16" height="5" rx="2.5" fill="#1c1917" />
              {/* Mirror */}
              <circle cx="150" cy="30" r="3" fill="#78716c" />
              <line x1="150" y1="33" x2="150" y2="36" stroke="#78716c" strokeWidth="1.5" />
            </g>

            {/* RIDER CHARACTER */}
            <g id="Rider">
              {/* Body / Jacket */}
              <path d="M85,68 Q100,52 120,55 L135,78 L115,85 Z" fill="#1c1917" />
              <path d="M92,66 L118,58 L126,72 L100,80 Z" fill="#f97316" />
              {/* Arms reaching handlebar */}
              <path d="M115,62 Q135,55 148,42" stroke="#f97316" strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="148" cy="42" r="3.5" fill="#1c1917" />
              {/* Helmet */}
              <circle cx="112" cy="32" r="14" fill="#047857" />
              {/* Visor */}
              <path d="M116,24 Q128,28 124,38 L114,38 Z" fill="#0f172a" />
              {/* Helmet Detail / Logo */}
              <path d="M102,30 Q112,22 122,30" stroke="#34d399" strokeWidth="2" fill="none" />
            </g>

            {/* REAR WHEEL (SPINNING) */}
            <g id="RearWheel" transform="translate(62, 102)">
              <circle cx="0" cy="0" r="18" fill="#1c1917" stroke="#44403c" strokeWidth="3" />
              <circle cx="0" cy="0" r="11" fill="#78716c" />
              <circle cx="0" cy="0" r="4" fill="#d6d3d1" />
              {/* Wheel Spokes (Rotating) */}
              <g className={isDriving ? 'animate-spin-fast' : ''}>
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="-7" y1="-7" x2="7" y2="7" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="-7" y1="7" x2="7" y2="-7" stroke="#e7e5e4" strokeWidth="1.5" />
              </g>
            </g>

            {/* FRONT WHEEL (SPINNING) */}
            <g id="FrontWheel" transform="translate(175, 102)">
              <circle cx="0" cy="0" r="18" fill="#1c1917" stroke="#44403c" strokeWidth="3" />
              <circle cx="0" cy="0" r="11" fill="#78716c" />
              <circle cx="0" cy="0" r="4" fill="#d6d3d1" />
              {/* Wheel Spokes (Rotating) */}
              <g className={isDriving ? 'animate-spin-fast' : ''}>
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="-7" y1="-7" x2="7" y2="7" stroke="#e7e5e4" strokeWidth="1.5" />
                <line x1="-7" y1="7" x2="7" y2="-7" stroke="#e7e5e4" strokeWidth="1.5" />
              </g>
            </g>

            {/* EXHAUST SMOKE PUFFS (WHEN DRIVING) */}
            {isDriving && (
              <g className="animate-exhaust opacity-70">
                <circle cx="34" cy="98" r="3" fill="#78716c" opacity="0.6" />
                <circle cx="24" cy="96" r="4.5" fill="#a8a29e" opacity="0.4" />
                <circle cx="12" cy="94" r="6" fill="#d6d3d1" opacity="0.2" />
              </g>
            )}

            {/* GRADIENT DEFINITIONS */}
            <defs>
              <linearGradient id="headlightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* ROAD SURFACE & FAST MOVING DASHED STRIPES */}
      <div className="relative w-full h-8 bg-slate-800 border-t-2 border-slate-700 flex items-center overflow-hidden">
        <div className={`flex w-[200%] ${isDriving ? 'animate-road-move' : ''}`}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div className="w-8 h-1 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            </div>
          ))}
        </div>
      </div>

      {/* INLINE STATUS BADGE BAR */}
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border shadow-xs flex items-center gap-1.5 ${
          isCompleted 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : isDriving 
              ? 'bg-sky-50 text-sky-800 border-sky-300 animate-pulse'
              : isPreparing
                ? 'bg-orange-50 text-orange-800 border-orange-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
        }`}>
          <span>{isCompleted ? '✨ Selesai' : isDriving ? '🛵 Dalam Penghantaran' : isPreparing ? '👨‍🍳 Sedang Dimasak' : '🕒 Diterima'}</span>
        </span>
      </div>

      {/* EMBEDDED CSS ANIMATION KEYFRAMES */}
      <style>{`
        @keyframes roadMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-road-move {
          animation: roadMove 0.85s linear infinite;
        }
        @keyframes spinFast {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-fast {
          transform-origin: center;
          animation: spinFast 0.35s linear infinite;
        }
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-2.5px) rotate(-0.5deg); }
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 0.4s ease-in-out infinite;
        }
        @keyframes windLine {
          0% { transform: translateX(20px); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateX(-40px); opacity: 0; }
        }
        .animate-wind-1 { animation: windLine 0.6s linear infinite; }
        .animate-wind-2 { animation: windLine 0.5s linear infinite 0.2s; }
        .animate-wind-3 { animation: windLine 0.7s linear infinite 0.4s; }
        @keyframes steamFloat {
          0% { transform: translateY(0) scale(0.9); opacity: 0.2; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-8px) scale(1.1); opacity: 0; }
        }
        .animate-steam {
          animation: steamFloat 1.2s ease-out infinite;
        }
        @keyframes exhaustPuff {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0.7; }
          100% { transform: translate(-15px, -5px) scale(1.3); opacity: 0; }
        }
        .animate-exhaust {
          animation: exhaustPuff 0.7s ease-out infinite;
        }
      `}</style>
    </div>
  );
};
