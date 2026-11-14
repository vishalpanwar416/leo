import { useEffect, useRef, useState } from 'react'

/**
 * Cute front-facing golden retriever puppy.
 *   idle       → relaxed, slow tail wag, soft blinks, tongue peeking out
 *   listening  → ears rise slightly, alert eyes, sound waves, lean forward
 *   thinking   → head tilts, eyebrow quirks, thought bubble
 *   playing    → mouth opens/closes, tongue out, fast tail wag, music notes
 */
export default function Dog({ state }) {
  const [blink, setBlink]         = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const lastBlinkRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastBlinkRef.current > 1800 && Math.random() < 0.35) {
        lastBlinkRef.current = Date.now()
        setBlink(true)
        setTimeout(() => setBlink(false), 130)
      }
    }, 700)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (state !== 'playing') { setMouthOpen(false); return }
    const id = setInterval(() => setMouthOpen(o => !o), 160)
    return () => clearInterval(id)
  }, [state])

  const headTilt   = state === 'thinking' ? -8 : state === 'listening' ? 2 : 0
  const earLift    = state === 'listening' || state === 'playing'    // floppy ears flick slightly
  const tongueShow = state === 'idle' || state === 'playing'

  // Wag parameters — tail waves more, faster when excited
  const wagSpeed   = state === 'playing' ? '0.28s' : state === 'listening' ? '0.5s' : state === 'thinking' ? '1.4s' : '0.85s'
  const wagRange   = state === 'playing' ? 18 : state === 'listening' ? 14 : state === 'thinking' ? 4 : 10

  return (
    <div className="dog-wrap">
      <svg viewBox="0 0 320 320" width="260" height="260" className={`dog dog-${state}`}>
        <defs>
          <radialGradient id="head" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0%"  stopColor="#fde8a6"/>
            <stop offset="60%" stopColor="#ebbd5e"/>
            <stop offset="100%" stopColor="#a66f14"/>
          </radialGradient>
          <radialGradient id="body" cx="0.4" cy="0.3" r="0.9">
            <stop offset="0%"  stopColor="#f6d080"/>
            <stop offset="70%" stopColor="#d99929"/>
            <stop offset="100%" stopColor="#855408"/>
          </radialGradient>
          <linearGradient id="ear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#b07012"/>
            <stop offset="60%"  stopColor="#824e06"/>
            <stop offset="100%" stopColor="#5a3605"/>
          </linearGradient>
          <radialGradient id="snout" cx="0.5" cy="0.3" r="0.7">
            <stop offset="0%"   stopColor="#fef7d6"/>
            <stop offset="100%" stopColor="#f2cf82"/>
          </radialGradient>
          <radialGradient id="nose" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%"  stopColor="#5a3924"/>
            <stop offset="70%" stopColor="#1a0d05"/>
            <stop offset="100%" stopColor="#000"/>
          </radialGradient>
          <linearGradient id="tongue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffadc7"/>
            <stop offset="100%" stopColor="#d9618a"/>
          </linearGradient>
          <radialGradient id="eye" cx="0.35" cy="0.35" r="0.75">
            <stop offset="0%"  stopColor="#4f2e12"/>
            <stop offset="70%" stopColor="#1a0d02"/>
            <stop offset="100%" stopColor="#000"/>
          </radialGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="160" cy="300" rx="90" ry="8" fill="#000" opacity="0.3"/>

        {/* ── TAIL ── curves up-and-back from rear of body, clearly dog-shaped */}
        <g className="tail-group"
           style={{
             transformOrigin: '235px 230px',
             '--wag-speed': wagSpeed,
             '--wag-range': `${wagRange}deg`,
           }}>
          {/* Feathery outer fluff (wider, lighter) */}
          <path d="M 232 235
                   C 258 230, 288 215, 300 180
                   C 306 155, 300 138, 282 138
                   C 268 138, 260 152, 258 175
                   C 256 198, 244 218, 228 230 Z"
                fill="#c88a1f" opacity="0.85"/>
          {/* Tail core */}
          <path d="M 235 230
                   C 255 225, 280 212, 292 182
                   C 296 164, 290 150, 278 151
                   C 268 152, 263 165, 262 182
                   C 260 202, 250 218, 238 228 Z"
                fill="url(#ear)"/>
          {/* Top highlight */}
          <path d="M 278 154 C 284 156, 288 164, 286 175"
                stroke="#fde68a" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6"/>
          {/* Feathery tip */}
          <ellipse cx="282" cy="145" rx="7" ry="5" fill="#f2c668" opacity="0.9"/>
          <ellipse cx="286" cy="150" rx="4" ry="3" fill="#fef3c7" opacity="0.8"/>
        </g>

        {/* ── BODY ── */}
        <ellipse cx="160" cy="252" rx="92" ry="55" fill="url(#body)"/>

        {/* Chest fluff */}
        <path d="M 120 250 Q 135 278 160 282 Q 185 278 200 250 Q 195 285 160 290 Q 125 285 120 250 Z"
              fill="#fff6db" opacity="0.9"/>

        {/* Front paws */}
        <ellipse cx="133" cy="295" rx="19" ry="11" fill="#8f560c"/>
        <ellipse cx="187" cy="295" rx="19" ry="11" fill="#8f560c"/>
        <ellipse cx="133" cy="292" rx="17" ry="9"  fill="#d48617"/>
        <ellipse cx="187" cy="292" rx="17" ry="9"  fill="#d48617"/>
        {/* Toe bumps */}
        <circle cx="123" cy="294" r="2.5" fill="#4a2508"/>
        <circle cx="133" cy="295" r="2.5" fill="#4a2508"/>
        <circle cx="143" cy="294" r="2.5" fill="#4a2508"/>
        <circle cx="177" cy="294" r="2.5" fill="#4a2508"/>
        <circle cx="187" cy="295" r="2.5" fill="#4a2508"/>
        <circle cx="197" cy="294" r="2.5" fill="#4a2508"/>

        {/* ── HEAD GROUP ── (ears + head + face). Tilts with mood. */}
        <g style={{
          transform: `rotate(${headTilt}deg)`,
          transformOrigin: '160px 165px',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

          {/* ── LEFT FLOPPY EAR ── attaches top-left of head, drapes DOWN along face */}
          <g className={`ear-left ${earLift ? 'lift' : ''}`}>
            <path d="M 118 95
                     C 98 100, 82 120, 80 170
                     C 80 205, 96 225, 118 220
                     C 132 215, 138 200, 138 175
                     C 138 140, 132 110, 128 95 Z"
                  fill="url(#ear)"/>
            {/* Inner ear shadow */}
            <path d="M 120 110
                     C 108 120, 100 140, 100 170
                     C 102 195, 112 208, 120 206
                     C 126 200, 128 185, 128 165 Z"
                  fill="#5a3605" opacity="0.5"/>
            {/* Ear highlight along top edge */}
            <path d="M 122 100 C 110 108, 100 125, 95 150"
                  stroke="#d48617" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
          </g>

          {/* ── RIGHT FLOPPY EAR ── */}
          <g className={`ear-right ${earLift ? 'lift' : ''}`}>
            <path d="M 202 95
                     C 222 100, 238 120, 240 170
                     C 240 205, 224 225, 202 220
                     C 188 215, 182 200, 182 175
                     C 182 140, 188 110, 192 95 Z"
                  fill="url(#ear)"/>
            <path d="M 200 110
                     C 212 120, 220 140, 220 170
                     C 218 195, 208 208, 200 206
                     C 194 200, 192 185, 192 165 Z"
                  fill="#5a3605" opacity="0.5"/>
            <path d="M 198 100 C 210 108, 220 125, 225 150"
                  stroke="#d48617" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"/>
          </g>

          {/* ── HEAD ── slightly pear-shaped, wider at bottom */}
          <path d="M 160 88
                   C 110 88, 85 130, 88 175
                   C 90 215, 120 238, 160 238
                   C 200 238, 230 215, 232 175
                   C 235 130, 210 88, 160 88 Z"
                fill="url(#head)"/>

          {/* Top-of-head fluff */}
          <path d="M 130 105 Q 150 92, 160 92 Q 170 92, 190 105 Q 180 115, 160 113 Q 140 115, 130 105 Z"
                fill="#fef3c7" opacity="0.85"/>

          {/* Cheek blush */}
          <ellipse cx="112" cy="188" rx="15" ry="10" fill="#fca5a5" opacity="0.3"/>
          <ellipse cx="208" cy="188" rx="15" ry="10" fill="#fca5a5" opacity="0.3"/>

          {/* ── EYES ── */}
          <g>
            {blink ? (
              <>
                <path d="M 128 152 Q 138 148 148 152" stroke="#2d1a08" strokeWidth="3.5"
                      fill="none" strokeLinecap="round"/>
                <path d="M 172 152 Q 182 148 192 152" stroke="#2d1a08" strokeWidth="3.5"
                      fill="none" strokeLinecap="round"/>
              </>
            ) : (
              <>
                <ellipse cx="138" cy="150" rx="10" ry="12" fill="#fffbea"/>
                <ellipse cx="182" cy="150" rx="10" ry="12" fill="#fffbea"/>
                <ellipse cx="140" cy="152" rx="7.5" ry="9.5" fill="url(#eye)"/>
                <ellipse cx="184" cy="152" rx="7.5" ry="9.5" fill="url(#eye)"/>
                <circle cx="143" cy="148" r="3" fill="#fff"/>
                <circle cx="187" cy="148" r="3" fill="#fff"/>
                <circle cx="137" cy="156" r="1.2" fill="#fff" opacity="0.6"/>
                <circle cx="181" cy="156" r="1.2" fill="#fff" opacity="0.6"/>
              </>
            )}
          </g>

          {/* Eyebrows for mood */}
          {state === 'thinking' && (
            <>
              <path d="M 126 133 Q 138 128 150 132" stroke="#6b3906"
                    strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M 170 128 Q 182 124 194 134" stroke="#6b3906"
                    strokeWidth="3" fill="none" strokeLinecap="round"/>
            </>
          )}
          {state === 'listening' && (
            <>
              <path d="M 126 131 Q 138 126 150 130" stroke="#6b3906"
                    strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.8"/>
              <path d="M 170 130 Q 182 126 194 131" stroke="#6b3906"
                    strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.8"/>
            </>
          )}

          {/* ── SNOUT ── */}
          <ellipse cx="160" cy="198" rx="40" ry="28" fill="url(#snout)"/>
          <ellipse cx="160" cy="194" rx="32" ry="20" fill="#fef9e7"/>

          {/* ── NOSE ── */}
          <ellipse cx="160" cy="180" rx="10" ry="8" fill="url(#nose)"/>
          <ellipse cx="157" cy="177" rx="3" ry="2" fill="#fff" opacity="0.55"/>

          {/* ── MOUTH / TONGUE ── */}
          {mouthOpen ? (
            <g>
              <path d="M 138 202 Q 160 230 182 202 Q 172 218 160 220 Q 148 218 138 202 Z"
                    fill="#1a0e04"/>
              <ellipse cx="160" cy="213" rx="13" ry="7" fill="url(#tongue)"/>
              <path d="M 160 210 L 160 220" stroke="#c74f7a" strokeWidth="1" opacity="0.6"/>
            </g>
          ) : (
            <g>
              <path d="M 160 188 L 160 202" stroke="#1a0e04" strokeWidth="2.8"
                    fill="none" strokeLinecap="round"/>
              <path d="M 160 202 Q 148 210 140 205" stroke="#1a0e04"
                    strokeWidth="2.8" fill="none" strokeLinecap="round"/>
              <path d="M 160 202 Q 172 210 180 205" stroke="#1a0e04"
                    strokeWidth="2.8" fill="none" strokeLinecap="round"/>
              {tongueShow && (
                <g className="tongue-wiggle">
                  <ellipse cx="160" cy="216" rx="8" ry="8" fill="url(#tongue)"/>
                  <path d="M 160 212 L 160 222" stroke="#c74f7a"
                        strokeWidth="1" opacity="0.6"/>
                </g>
              )}
            </g>
          )}

          {/* Small whisker dots for muzzle detail */}
          <circle cx="145" cy="192" r="0.9" fill="#8b5a1a" opacity="0.55"/>
          <circle cx="150" cy="196" r="0.9" fill="#8b5a1a" opacity="0.55"/>
          <circle cx="170" cy="196" r="0.9" fill="#8b5a1a" opacity="0.55"/>
          <circle cx="175" cy="192" r="0.9" fill="#8b5a1a" opacity="0.55"/>
        </g>

        {/* ── OVERLAYS ── */}
        {state === 'thinking' && (
          <g className="think-bubble">
            <circle cx="250" cy="85" r="9"  fill="#fef9e7" opacity="0.95" stroke="#d97706" strokeWidth="1"/>
            <circle cx="266" cy="70" r="13" fill="#fef9e7" opacity="0.95" stroke="#d97706" strokeWidth="1"/>
            <circle cx="285" cy="50" r="22" fill="#fef9e7" opacity="0.97" stroke="#d97706" strokeWidth="1.5"/>
            <text x="285" y="56" textAnchor="middle" fontSize="22" fill="#78350f" fontWeight="700">?</text>
          </g>
        )}

        {state === 'listening' && (
          <g className="sound-waves">
            <g transform="translate(50 160)">
              <circle r="14" fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.8" className="wave w1"/>
              <circle r="22" fill="none" stroke="#10b981" strokeWidth="2"   opacity="0.5" className="wave w2"/>
              <circle r="30" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.3" className="wave w3"/>
            </g>
            <g transform="translate(270 160)">
              <circle r="14" fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.8" className="wave w1"/>
              <circle r="22" fill="none" stroke="#10b981" strokeWidth="2"   opacity="0.5" className="wave w2"/>
              <circle r="30" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.3" className="wave w3"/>
            </g>
          </g>
        )}

        {state === 'playing' && (
          <g className="notes">
            <text x="252" y="125" fontSize="26" fill="#f59e0b" className="note n1">♪</text>
            <text x="76"  y="110" fontSize="22" fill="#fbbf24" className="note n2">♫</text>
            <text x="232" y="86"  fontSize="20" fill="#f59e0b" className="note n3">♩</text>
          </g>
        )}

        {state === 'idle' && (
          <g className="sparkles">
            <text x="246" y="105" fontSize="14" fill="#fde68a" opacity="0.7" className="spark s1">✦</text>
            <text x="78"  y="130" fontSize="12" fill="#fde68a" opacity="0.6" className="spark s2">✧</text>
          </g>
        )}
      </svg>
    </div>
  )
}
