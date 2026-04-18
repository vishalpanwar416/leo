import { useRef, useEffect } from 'react'

const STATE_COLORS = {
  idle:      '#8b5cf6',
  listening: '#ef4444',
  thinking:  '#3b82f6',
  playing:   '#10b981',
}
const ICONS = { idle: '🎙️', listening: '🔴', thinking: '💭', playing: '🔊' }
const ORB_BG = {
  idle:      'radial-gradient(circle at 35% 35%, #8b5cf6, #1e1b4b)',
  listening: 'radial-gradient(circle at 35% 35%, #ef4444, #7f1d1d)',
  thinking:  'radial-gradient(circle at 35% 35%, #3b82f6, #1e3a8a)',
  playing:   'radial-gradient(circle at 35% 35%, #10b981, #064e3b)',
}

function hex2rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function Orb({ state, analyserRef, freqRef, onClick }) {
  const canvasRef = useRef(null)
  const stateRef  = useRef(state)
  const rafRef    = useRef(null)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = 220, H = 220, CX = 110, CY = 110

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      const col = STATE_COLORS[stateRef.current] || STATE_COLORS.idle

      if (!analyserRef.current) {
        ctx.strokeStyle = hex2rgba(col, 0.25)
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(CX, CY, 66, 0, Math.PI * 2); ctx.stroke()
        return
      }

      // Frequency bars
      const freq = freqRef.current
      analyserRef.current.getByteFrequencyData(freq)
      const N = 80, step = Math.floor(freq.length / N)
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2
        const v = freq[i * step] / 255
        ctx.strokeStyle = hex2rgba(col, 0.25 + v * 0.75)
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(CX + Math.cos(angle) * 65, CY + Math.sin(angle) * 65)
        ctx.lineTo(CX + Math.cos(angle) * (65 + v * 42), CY + Math.sin(angle) * (65 + v * 42))
        ctx.stroke()
      }

      // Time-domain waveform ring
      const td = new Uint8Array(analyserRef.current.fftSize)
      analyserRef.current.getByteTimeDomainData(td)
      ctx.beginPath()
      for (let i = 0; i <= td.length; i++) {
        const angle = (i / td.length) * Math.PI * 2 - Math.PI / 2
        const v = (td[i % td.length] - 128) / 128
        const r = 52 + v * (stateRef.current === 'listening' ? 13 : 4)
        const x = CX + Math.cos(angle) * r, y = CY + Math.sin(angle) * r
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = hex2rgba(col, 0.45)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyserRef, freqRef])

  return (
    <div onClick={onClick} style={{
      position: 'relative', width: 220, height: 220,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <canvas ref={canvasRef} width={220} height={220}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      <div style={{
        width: 100, height: 100, borderRadius: '50%', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2rem', userSelect: 'none',
        background: ORB_BG[state] || ORB_BG.idle,
        boxShadow: `0 0 30px ${hex2rgba(STATE_COLORS[state]||STATE_COLORS.idle, 0.4)}`,
        transition: 'background 0.3s, box-shadow 0.3s',
      }}>
        {ICONS[state] || '🎙️'}
      </div>
    </div>
  )
}
