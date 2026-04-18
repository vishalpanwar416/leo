import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import Dog from './components/Dog'
import Chat from './components/Chat'
import { useVAD } from './hooks/useVAD'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const [orbState, setOrbState]   = useState('idle')
  const [messages, setMessages]   = useState([])
  const [streaming, setStreaming] = useState(null)
  const [models, setModels]       = useState([])
  const [model, setModel]         = useState('mistral')
  const [isPlaying, setIsPlaying] = useState(false)
  const [cameraOn, setCameraOn]   = useState(false)
  const [profile, setProfile]     = useState({ people: {}, active: null })
  const [showProfile, setShowProfile] = useState(false)

  const currentAudioRef = useRef(null)
  const audioQueueRef   = useRef([])
  const playingRef      = useRef(false)
  const videoRef        = useRef(null)
  const cameraStreamRef = useRef(null)
  const latestFrameRef  = useRef(null)

  // ── audio queue ─────────────────────────────────────
  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      playingRef.current = false
      setIsPlaying(false)
      setOrbState('idle')
      return
    }
    playingRef.current = true
    setIsPlaying(true)
    setOrbState('playing')
    const buf = audioQueueRef.current.shift()
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
    const audio = new Audio(url)
    currentAudioRef.current = audio
    audio.onended = () => { URL.revokeObjectURL(url); playNext() }
    audio.play().catch(() => playNext())
  }, [])

  const playAudio = useCallback((buffer) => {
    audioQueueRef.current.push(buffer)
    if (!playingRef.current) playNext()
  }, [playNext])

  const browserTTS = useCallback((text) => {
    setIsPlaying(true); setOrbState('playing')
    const u = new SpeechSynthesisUtterance(text)
    u.onend = () => { setIsPlaying(false); setOrbState('idle') }
    speechSynthesis.speak(u)
  }, [])

  const stopPlayback = useCallback(() => {
    audioQueueRef.current = []
    playingRef.current = false
    currentAudioRef.current?.pause()
    speechSynthesis.cancel()
    setIsPlaying(false)
    setOrbState('idle')
  }, [])

  // ── websocket ───────────────────────────────────────
  const { connected, sendAudio, sendImage } = useWebSocket({
    model,
    onTranscript: (text) => {
      setMessages(prev => [...prev, { who: 'user', text }])
      setOrbState('thinking')
    },
    onResponseStart: () => setStreaming(''),
    onToken: (t) => setStreaming(prev => (prev ?? '') + t),
    onResponseEnd: () => setStreaming(prev => {
      if (prev !== null) setMessages(m => [...m, { who: 'leo', text: prev }])
      return null
    }),
    onAudio: playAudio,
    onTtsFallback: browserTTS,
    onError: () => setOrbState('idle'),
  })

  // Capture frame when audio is being sent — bundles voice+vision
  const captureFrame = useCallback(() => {
    if (!cameraStreamRef.current || !videoRef.current) return null
    const video = videoRef.current
    if (video.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    const w = 512, h = Math.round((video.videoHeight / video.videoWidth) * 512)
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(video, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.75)
  }, [])

  const onAudioFromVAD = useCallback((buf) => {
    setOrbState('thinking')
    // Attach current camera frame if on
    if (cameraOn) {
      const frame = captureFrame()
      if (frame) sendImage(frame)
    }
    sendAudio(buf)
  }, [sendAudio, sendImage, cameraOn, captureFrame])

  // ── VAD ─────────────────────────────────────────────
  const { active, recording, vol, noiseFloor, sensitivity, setSensitivity, activate } = useVAD({
    onAudioReady: onAudioFromVAD,
    paused: isPlaying,
  })

  useEffect(() => {
    if (recording) setOrbState('listening')
    else if (!isPlaying && orbState === 'listening') setOrbState('idle')
  }, [recording, isPlaying])

  // ── camera ──────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
      setCameraOn(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, facingMode: 'user' }
      })
      cameraStreamRef.current = stream
      setCameraOn(true)
    } catch (err) {
      console.error('camera error', err)
      alert('Camera error: ' + err.message)
    }
  }, [cameraOn])

  // Attach stream to video element whenever camera turns on
  useEffect(() => {
    if (cameraOn && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current
      videoRef.current.play().catch(e => console.error('video play', e))
    }
  }, [cameraOn])

  // Load models
  useEffect(() => {
    fetch('/models').then(r => r.json()).then(({ models }) => {
      setModels(models)
      const def = models.find(m => m.includes('mistral')) || models[0]
      if (def) setModel(def)
    }).catch(() => setModels(['mistral']))
  }, [])

  // Poll profile to refresh what Leo knows
  useEffect(() => {
    const load = () => fetch('/profile').then(r => r.json()).then(setProfile).catch(() => {})
    load()
    const id = setInterval(load, 6000)
    return () => clearInterval(id)
  }, [])

  const resetProfile = useCallback(async () => {
    if (!confirm('Clear everything Leo knows about everyone?')) return
    await fetch('/profile/reset', { method: 'POST' })
    const p = await fetch('/profile').then(r => r.json()); setProfile(p)
  }, [])

  const switchPerson = useCallback(async (name) => {
    await fetch('/profile/active?name=' + encodeURIComponent(name), { method: 'POST' })
    const p = await fetch('/profile').then(r => r.json()); setProfile(p)
  }, [])

  // ── UI ──────────────────────────────────────────────

  // First-run: show big tap-to-start splash
  if (!active) {
    return (
      <div className="splash" onClick={() => activate({ noiseSuppress: true, autoGain: true })}>
        <div className="splash-inner">
          <div className="splash-paw">🐕</div>
          <h1 className="splash-logo">L E O</h1>
          <p className="splash-sub">your golden retriever AI companion</p>
          <div className="splash-btn">tap to say hi 🐾</div>
          <p className="splash-hint">needs microphone access</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <span className="logo">L E O</span>
        <div className="header-right">
          <button className="cam-btn" onClick={() => setShowProfile(s => !s)} title="What Leo remembers">
            🧠 {profile.active || 'no one yet'}
          </button>
          <button className={`cam-btn ${cameraOn ? 'on' : ''}`} onClick={toggleCamera} title="Toggle camera">
            {cameraOn ? '📸 ON' : '📷'}
          </button>
          <select className="model-select" value={model} onChange={e => setModel(e.target.value)}>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className={`conn-dot ${connected ? 'on' : ''}`} />
        </div>
      </header>

      {showProfile && (
        <div className="profile-drawer">
          <div className="profile-head">
            <span>🧠 Leo's memory</span>
            <div>
              <button className="mini-btn danger" onClick={resetProfile}>Clear all</button>
              <button className="mini-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
          </div>
          {Object.keys(profile.people || {}).length === 0 ? (
            <p className="profile-empty">Leo hasn't met anyone yet. Say "Hi, I'm [name]" to introduce yourself!</p>
          ) : (
            <div className="profile-people">
              {Object.entries(profile.people).map(([name, data]) => (
                <div key={name} className={`person-card ${profile.active === name ? 'active' : ''}`}>
                  <div className="person-head">
                    <span className="person-name">{name}{profile.active === name && ' · now talking'}</span>
                    {profile.active !== name && (
                      <button className="mini-btn" onClick={() => switchPerson(name)}>Switch</button>
                    )}
                  </div>
                  {data.facts?.length > 0 ? (
                    <ul className="person-facts">
                      {data.facts.slice(-10).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  ) : <p className="person-empty">no facts yet</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="main">
        <aside className="aside">
          <Dog state={orbState} volume={vol} />

          <p className="status-text">
            {recording    ? '👂 Leo is listening…' :
             isPlaying    ? '🗣 Leo is talking…' :
             orbState === 'thinking' ? '🤔 Leo is thinking…' :
                            '🐕 Leo is ready — just talk'}
          </p>

          <div className="meter-wrap">
            <div className="meter-label">
              <span>Volume</span>
              <span>{vol.toFixed(1)} / noise {noiseFloor.toFixed(1)}</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${Math.min(100, vol * 4)}%` }} />
            </div>
          </div>

          <div className="meter-wrap">
            <div className="meter-label">
              <span>Ear Sensitivity</span>
              <span>{sensitivity} / 10</span>
            </div>
            <input
              type="range" min="1" max="10" value={sensitivity}
              onChange={e => setSensitivity(+e.target.value)}
              className="slider"
            />
            <div className="meter-label" style={{ marginTop: 4 }}>
              <span>strict</span><span>easy trigger</span>
            </div>
          </div>

          {cameraOn && (
            <div className="cam-preview">
              <video ref={videoRef} playsInline muted />
              <div className="cam-label">👁 Leo can see</div>
            </div>
          )}

          {isPlaying && (
            <button className="stop-btn" onClick={stopPlayback}>⏹ Interrupt Leo</button>
          )}

          <p className="hint">🐾 fully hands-free · just talk to Leo</p>
        </aside>

        <section className="chat-section">
          <Chat messages={messages} streamingText={streaming} />
        </section>
      </div>

      <footer className="footer">
        <span>
          {active ? `🎤 mic on · noise floor ${noiseFloor.toFixed(1)}` : 'mic off'}
          {cameraOn && ' · 👁 vision on'}
        </span>
      </footer>

    </div>
  )
}
