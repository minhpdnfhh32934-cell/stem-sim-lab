import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme/tokens.css';
import './app/theme/base.css';
import './ui/ui.css';
import './app/layout/layout.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
