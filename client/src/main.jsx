import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'

import { installCompanyGuard } from './services/companyGuard.js'

axios.defaults.baseURL = '/myob-api'
installCompanyGuard(axios)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
