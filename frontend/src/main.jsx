import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ScenarioProvider } from './context/ScenarioContext.jsx';
import './styles/global.css';
import nasaLogo from '../../docs/assets/nasa-logo.png';

document.getElementById('app-icon').href = nasaLogo;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </BrowserRouter>
  </StrictMode>
);
