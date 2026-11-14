import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode off: it double-mounts effects in dev which duplicated our WebSocket.
createRoot(document.getElementById('root')).render(<App />)
