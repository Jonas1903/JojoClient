import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Listen to messages from main process via preload bridge
if (window.jojoclient && typeof window.jojoclient.onMainMessage === 'function') {
  window.jojoclient.onMainMessage((message) => {
    console.log(message)
  })
}
