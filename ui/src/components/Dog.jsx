import { useEffect, useRef, useState } from 'react'

/**
 * Animated golden retriever. State-driven reactions:
 *   idle       → gentle breathing, slow tail wag, occasional blink
 *   listening  → ears perked up, alert eyes, head leaning forward
 *   thinking   → head tilted to the side, blinking, thought bubble
 *   playing    → mouth opens/closes as he "speaks", tongue out, fast wag
 */
export default function Dog({ state, volume = 0 }) {
  const [blink, setBlink]       = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const lastBlinkRef = useRef(0)

  // Random blinks
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastBlinkRef.current > 2000 && Math.random() < 0.3) {
        lastBlinkRef.current = Date.now()
        setBlink(true)
        setTimeout(() => setBlink(false), 150)
      }
    }, 800)
    return () => clearInterval(id)
  }, [])

  // Mouth animation while speaking — drives from volume if we had it, else rhythmic
  useEffect(() => {
    if (state !== 'playing') { setMouthOpen(false); return }
    const id = setInterval(() => setMouthOpen(o => !o), 130)
    return () => clearInterval(id)
  }, [state])

  const earPerk    = state === 'listening' || state === 'playing'
  const headTilt   = state === 'thinking' ? -8 : state === 'listening' ? 3 : 0
  const tongueShow = state === 'playing' || state === 'idle'
  const wagSpeed   = state === 'playing' ? '0.35s' : state === 'listening' ? '0.5s' : state === 'thinking' ? '1.2s' : '0.9s'

  return (
    <div className="dog-wrap">
      <svg viewBox="0 0 320 320" width="240" height="240" className={`dog dog-${state}`}>
        {/* Wagging tail — behind body */}
        <g className="tail-group" style={{ transformOrigin: '250px 220px', animationDuration: wagSpeed }}>
          <path d="M 245 215 Q 280 195 290 160" stroke="#c27c18" strokeWidth="18"
                fill="none" strokeLinecap="round" />
          <path d="M 245 215 Q 280 195 290 160" stroke="#e09b2c" strokeWidth="11"
                fill="none" strokeLinecap="round" />
        </g>

        {/* Body */}
        <ellipse cx="160" cy="230" rx="95" ry="60" fill="#e09b2c" />
        <ellipse cx="160" cy="222" rx="88" ry="50" fill="#edb755" />

        {/* Chest fluff */}
        <ellipse cx="160" cy="255" rx="48" ry="22" fill="#fde68a" opacity="0.85" />

        {/* Front legs */}
        <rect x="120" y="265" width="22" height="38" rx="11" fill="#e09b2c" />
        <rect x="178" y="265" width="22" height="38" rx="11" fill="#e09b2c" />
        <ellipse cx="131" cy="305" rx="14" ry="6" fill="#c27c18" />
        <ellipse cx="189" cy="305" rx="14" ry="6" fill="#c27c18" />

        {/* Head group — tilts based on state */}
        <g style={{ transform: `rotate(${headTilt}deg)`, transformOrigin: '160px 160px', transition: 'transform 0.4s ease' }}>

          {/* Ears — floppy by default, perk up on listen/play */}
          <g className={`ear-left ${earPerk ? 'perked' : ''}`}>
            <path d="M 100 115 Q 75 135 80 175 Q 85 195 110 185 Z" fill="#b86d12" />
            <path d="M 102 120 Q 85 138 90 170 Q 95 185 110 180 Z" fill="#d48617" />
          </g>
          <g className={`ear-right ${earPerk ? 'perked' : ''}`}>
            <path d="M 220 115 Q 245 135 240 175 Q 235 195 210 185 Z" fill="#b86d12" />
            <path d="M 218 120 Q 235 138 230 170 Q 225 185 210 180 Z" fill="#d48617" />
          </g>

          {/* Head */}
          <ellipse cx="160" cy="155" rx="78" ry="72" fill="#edb755" />
          <ellipse cx="160" cy="150" rx="72" ry="64" fill="#f2c668" />

          {/* Cheeks */}
          <ellipse cx="115" cy="175" rx="20" ry="14" fill="#fde68a" opacity="0.6" />
          <ellipse cx="205" cy="175" rx="20" ry="14" fill="#fde68a" opacity="0.6" />

          {/* Eyes */}
          <g>
            {blink ? (
              <>
                <path d="M 132 145 L 148 145" stroke="#3a2616" strokeWidth="3" strokeLinecap="round" />
                <path d="M 172 145 L 188 145" stroke="#3a2616" strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="140" cy="145" rx="8" ry="10" fill="#2d1a08" />
                <ellipse cx="180" cy="145" rx="8" ry="10" fill="#2d1a08" />
                <circle cx="143" cy="141" r="2.5" fill="#fff" />
                <circle cx="183" cy="141" r="2.5" fill="#fff" />
              </>
            )}
          </g>

          {/* Eyebrows — subtle expression */}
          {state === 'thinking' && (
            <>
              <path d="M 130 130 Q 140 127 150 130" stroke="#8b5a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 170 130 Q 180 125 190 132" stroke="#8b5a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* Snout */}
          <ellipse cx="160" cy="185" rx="32" ry="22" fill="#fde68a" />
          <ellipse cx="160" cy="180" rx="28" ry="18" fill="#fef3c7" />

          {/* Nose */}
          <ellipse cx="160" cy="173" rx="8" ry="6" fill="#1a0e04" />
          <ellipse cx="158" cy="170" rx="2.5" ry="1.8" fill="#4a3120" />

          {/* Mouth — opens when speaking */}
          {mouthOpen ? (
            <>
              <path d="M 145 195 Q 160 215 175 195 Q 160 205 145 195" fill="#1a0e04" />
              <ellipse cx="160" cy="202" rx="10" ry="6" fill="#ff7a9a" />
            </>
          ) : (
            <>
              <path d="M 160 180 L 160 192" stroke="#1a0e04" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 160 192 Q 150 200 143 196" stroke="#1a0e04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 160 192 Q 170 200 177 196" stroke="#1a0e04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Tongue — sticks out a bit when idle/happy */}
              {tongueShow && (
                <ellipse cx="160" cy="205" rx="7" ry="8" fill="#ff8ba8" opacity="0.95" />
              )}
            </>
          )}
        </g>

        {/* Thinking bubble */}
        {state === 'thinking' && (
          <g className="think-bubble">
            <circle cx="248" cy="85"  r="10" fill="#fde68a" opacity="0.9" />
            <circle cx="265" cy="70"  r="14" fill="#fde68a" opacity="0.9" />
            <circle cx="285" cy="52"  r="22" fill="#fde68a" opacity="0.95" />
            <text x="285" y="58" textAnchor="middle" fontSize="22" fill="#78350f">?</text>
          </g>
        )}

        {/* Listening sound waves — radiating from ears */}
        {state === 'listening' && (
          <g className="sound-waves">
            <circle cx="80" cy="150" r="18" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.7" className="wave w1" />
            <circle cx="80" cy="150" r="28" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.5" className="wave w2" />
            <circle cx="240" cy="150" r="18" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.7" className="wave w1" />
            <circle cx="240" cy="150" r="28" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.5" className="wave w2" />
          </g>
        )}

        {/* Speaking notes floating up */}
        {state === 'playing' && (
          <g className="notes">
            <text x="255" y="120" fontSize="24" fill="#f59e0b" className="note n1">♪</text>
            <text x="75" y="110" fontSize="20" fill="#f59e0b" className="note n2">♫</text>
          </g>
        )}
      </svg>
    </div>
  )
}
