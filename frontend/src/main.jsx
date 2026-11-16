import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import './styles/global.css';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { SoundProvider } from './context/SoundContext.jsx';
import nasaLogo from '../../docs/assets/nasa-logo.png';

document.getElementById('app-icon').href = nasaLogo;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SoundProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </SoundProvider>
    </BrowserRouter>
  </StrictMode>
);
