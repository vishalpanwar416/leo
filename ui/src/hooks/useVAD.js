import { useRef, useState, useCallback, useEffect } from 'react'

const SILENCE_MS        = 280   // aggressive turn-end detection
const MIN_SPEECH_MS     = 300
const MAX_SPEECH_MS     = 15000
const SPEECH_TRIGGER_N  = 4         // 200ms of sustained speech
const NOISE_EMA_ALPHA   = 0.04

// Encode Float32 PCM as a WAV ArrayBuffer
function encodeWAV(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  writeStr(36, 'data'); v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  return buf
}

export function useVAD({ onAudioReady, paused = false }) {
  const [active, setActive]       = useState(false)
  const [recording, setRecording] = useState(false)
  const [vol, setVol]             = useState(0)
  const [noiseFloor, setNoiseFloor] = useState(5)
  const [sensitivity, setSensitivity] = useState(5)   // 1 = strict, 10 = easy trigger

  // Refs (don't trigger renders)
  const streamRef      = useRef(null)
  const ctxRef         = useRef(null)
  const analyserRef    = useRef(null)
  const freqRef        = useRef(null)
  const pcmBufferRef   = useRef([])
  const recordingRef   = useRef(false)
  const isSpeakingRef  = useRef(false)
  const speechStartRef = useRef(0)
  const silTimerRef    = useRef(null)
  const vadIntervalRef = useRef(null)
  const noiseRef       = useRef(5)
  const triggerCountRef = useRef(0)
  const pausedRef      = useRef(paused)
  pausedRef.current    = paused
  const sensRef        = useRef(sensitivity)
  sensRef.current      = sensitivity

  // Compute voice-band energy — ignore low-freq (HVAC/fans) and high-freq hiss
  const getVoiceVol = useCallback(() => {
    if (!analyserRef.current) return 0
    const analyser = analyserRef.current
    const sampleRate = ctxRef.current.sampleRate
    const binHz = sampleRate / analyser.fftSize
    const loBin = Math.floor(80 / binHz)   // 80 Hz
    const hiBin = Math.min(freqRef.current.length, Math.floor(3000 / binHz))
    analyser.getByteFrequencyData(freqRef.current)
    let s = 0, n = 0
    for (let i = loBin; i < hiBin; i++) { s += freqRef.current[i]; n++ }
    return n > 0 ? s / n : 0
  }, [])

  const startRec = useCallback(() => {
    pcmBufferRef.current = []
    recordingRef.current = true
    speechStartRef.current = Date.now()
    setRecording(true)
    console.log('▶ rec start')
  }, [])

  const stopRec = useCallback(() => {
    if (!recordingRef.current) return
    recordingRef.current = false
    const elapsed = Date.now() - speechStartRef.current
    const total = pcmBufferRef.current.reduce((s, b) => s + b.length, 0)
    console.log(`■ rec stop: ${elapsed}ms, ${total} samples`)

    if (elapsed >= MIN_SPEECH_MS && total > 1600) {
      const pcm = new Float32Array(total)
      let off = 0
      for (const b of pcmBufferRef.current) { pcm.set(b, off); off += b.length }
      const wav = encodeWAV(pcm, ctxRef.current.sampleRate)
      console.log(`→ WAV ${wav.byteLength}B`)
      onAudioReady?.(wav)
    } else {
      console.log('discarded (too short)')
    }
    pcmBufferRef.current = []
    setRecording(false)
    triggerCountRef.current = 0
  }, [onAudioReady])

  const resetVAD = useCallback(() => {
    console.log('⚠ VAD force reset')
    isSpeakingRef.current = false
    recordingRef.current = false
    setRecording(false)
    triggerCountRef.current = 0
    pcmBufferRef.current = []
    if (silTimerRef.current) {
      clearTimeout(silTimerRef.current)
      silTimerRef.current = null
    }
  }, [])

  const runVAD = useCallback(() => {
    const v = getVoiceVol()
    setVol(v)

    // Always track noise floor via EMA while NOT currently recording/speaking
    if (!isSpeakingRef.current && !recordingRef.current) {
      const a = NOISE_EMA_ALPHA
      noiseRef.current = noiseRef.current * (1 - a) + v * a
      setNoiseFloor(noiseRef.current)
    }

    if (pausedRef.current) return

    // Sensitivity slider (1–10) → factor 4.0 (strict) … 1.6 (easy) + floor 18 … 5
    const s = sensRef.current
    const factor = 4.0 - (s - 1) * (4.0 - 1.6) / 9
    const floor  = 18   - (s - 1) * (18  - 5  ) / 9
    const dynThr  = Math.max(floor, noiseRef.current * factor)
    const stopThr = Math.max(floor * 0.65, noiseRef.current * 1.5)

    if (!isSpeakingRef.current) {
      if (v > dynThr) {
        triggerCountRef.current++
        if (triggerCountRef.current >= SPEECH_TRIGGER_N) {
          isSpeakingRef.current = true
          clearTimeout(silTimerRef.current)
          startRec()
        }
      } else {
        triggerCountRef.current = 0
      }
    } else {
      if (Date.now() - speechStartRef.current > MAX_SPEECH_MS) {
        console.log('max duration → auto-stop')
        isSpeakingRef.current = false
        clearTimeout(silTimerRef.current)
        silTimerRef.current = null
        stopRec()
        return
      }

      if (v < stopThr) {
        if (!silTimerRef.current) {
          silTimerRef.current = setTimeout(() => {
            isSpeakingRef.current = false
            silTimerRef.current = null
            stopRec()
          }, SILENCE_MS)
        }
      } else {
        if (silTimerRef.current) { clearTimeout(silTimerRef.current); silTimerRef.current = null }
      }
    }
  }, [getVoiceVol, startRec, stopRec])

  const activate = useCallback(async (opts = {}) => {
    if (active) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: opts.echoCancel ?? true,
          noiseSuppression: opts.noiseSuppress ?? false,
          autoGainControl:  opts.autoGain     ?? false,
        }
      })
      streamRef.current = stream

      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      await ctx.resume()
      ctxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.3
      analyserRef.current = analyser
      freqRef.current = new Uint8Array(analyser.frequencyBinCount)

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      // PCM capture via ScriptProcessor
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (e) => {
        if (recordingRef.current) {
          const input = e.inputBuffer.getChannelData(0)
          pcmBufferRef.current.push(new Float32Array(input))
        }
      }
      source.connect(processor)
      const muteGain = ctx.createGain()
      muteGain.gain.value = 0
      processor.connect(muteGain); muteGain.connect(ctx.destination)

      setActive(true)
      console.log(`🎤 mic active @ ${ctx.sampleRate}Hz — adaptive VAD running`)
      vadIntervalRef.current = setInterval(runVAD, 50)
      return true
    } catch (err) {
      console.error('mic error:', err)
      return false
    }
  }, [active, runVAD])

  useEffect(() => {
    if (!active) return
    clearInterval(vadIntervalRef.current)
    vadIntervalRef.current = setInterval(runVAD, 50)
    return () => clearInterval(vadIntervalRef.current)
  }, [active, runVAD])

  return { active, recording, vol, noiseFloor, sensitivity, setSensitivity, activate, resetVAD, analyserRef, freqRef }
}
