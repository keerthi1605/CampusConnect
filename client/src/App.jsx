import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  const [api, setApi] = useState('checking...')

  useEffect(() => {
    axios
      .get(`${API_URL}/health`)
      .then((res) => setApi(res.data.status))
      .catch(() => setApi('unreachable'))
  }, [])

  return (
    <main>
      <h1>CampusConnect</h1>
      <p>Campus Placement Management System</p>
      <p>API status: <strong>{api}</strong></p>
    </main>
  )
}

export default App
