import { useEffect, useRef } from 'react'

export default function Chat({ messages, streamingText }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '1rem 1.2rem',
      display: 'flex', flexDirection: 'column', gap: '0.8rem',
    }}>
      {messages.map((m, i) => (
        <Message key={i} who={m.who} text={m.text} />
      ))}
      {streamingText !== null && (
        <StreamingMessage text={streamingText} />
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function Message({ who, text }) {
  return (
    <div style={{
      alignSelf: who === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '76%',
      padding: '0.65rem 1rem',
      borderRadius: who === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      background: who === 'user' ? '#78350f' : '#1e3a1e',
      color: who === 'user' ? '#fde68a' : '#86efac',
      fontSize: '0.88rem', lineHeight: 1.6,
      animation: 'fadeUp 0.18s ease',
    }}>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.12em', opacity: 0.7, marginBottom: '0.25rem' }}>
        {who === 'user' ? 'YOU' : '🐕 LEO'}
      </div>
      {text}
    </div>
  )
}

function StreamingMessage({ text }) {
  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '76%',
      padding: '0.65rem 1rem',
      borderRadius: '14px 14px 14px 4px',
      background: '#1e3a1e', color: '#86efac',
      fontSize: '0.88rem', lineHeight: 1.6,
      animation: 'fadeUp 0.18s ease',
    }}>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.12em', opacity: 0.7, marginBottom: '0.25rem' }}>
        🐕 LEO
      </div>
      {text}
      <span style={{
        display: 'inline-block', width: 2, height: '0.9em',
        background: '#86efac', verticalAlign: 'text-bottom', marginLeft: 2,
        animation: 'blink 0.7s step-end infinite',
      }} />
    </div>
  )
}
