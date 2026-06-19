import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import './styles/theme.css'
import { AppProvider } from '@/context/AppContext.jsx'
import { SocketProvider } from '@/context/SocketContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </SocketProvider>
  </StrictMode>,
)