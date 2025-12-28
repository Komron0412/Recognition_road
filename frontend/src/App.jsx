import { useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'
import FaceRecognition from './components/FaceRecognition'
import Settings from './components/Settings'

function App() {
  const [view, setView] = useState('camera'); // 'camera', 'dashboard', 'settings'

  return (
    <div className="App">
      <h1>Face Recognition System</h1>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setView('camera')} disabled={view === 'camera'}>Live Camera</button>
        <button onClick={() => setView('dashboard')} disabled={view === 'dashboard'} style={{ marginLeft: '10px' }}>Dashboard</button>
        <button onClick={() => setView('settings')} disabled={view === 'settings'} style={{ marginLeft: '10px' }}>Settings</button>
      </div>
      <div className="card">
        {view === 'camera' && <FaceRecognition />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'settings' && <Settings />}
      </div>
      <p className="read-the-docs">
        Ensure backend is running on port 8000
      </p>
    </div>
  )
}

export default App
