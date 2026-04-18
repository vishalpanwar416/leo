import { useEffect, useRef, useCallback, useState } from 'react'

export function useWebSocket({ model, onTranscript, onToken, onResponseStart, onResponseEnd, onAudio, onTtsFallback, onError }) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const modelRef = useRef(model)
  modelRef.current = model

  const connect = useCallback(() => {
    const url = `ws://${location.host}/ws?model=${encodeURIComponent(modelRef.current)}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setTimeout(connect, 2000) }
    ws.onerror = () => {}

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) { onAudio?.(e.data); return }
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'transcript')     onTranscript?.(msg.text)
        if (msg.type === 'response_start') onResponseStart?.()
        if (msg.type === 'token')          onToken?.(msg.text)
        if (msg.type === 'response_end')   onResponseEnd?.()
        if (msg.type === 'tts_fallback')   onTtsFallback?.(msg.text)
        if (msg.type === 'error')          onError?.(msg.text)
      } catch {}
    }

    wsRef.current = ws
  }, [])

  useEffect(() => { connect(); return () => wsRef.current?.close() }, [connect])

  // reconnect when model changes
  useEffect(() => {
    if (wsRef.current) { wsRef.current.close() }
  }, [model])

  const sendAudio = useCallback((buffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(buffer)
  }, [])

  const sendImage = useCallback((dataUrl) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'image', data: dataUrl }))
    }
  }, [])

  return { connected, sendAudio, sendImage }
}
