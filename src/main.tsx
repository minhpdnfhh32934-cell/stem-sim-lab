import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme/tokens.css';
import './app/theme/base.css';
import './ui/ui.css';
import './app/layout/layout.css';
import './app/sim/sim.css';
// Last: the bench's rules must win ties with every shared stylesheet, as they did while the
// bench was a lazy chunk (before B8, #193).
import './app/bench/bench.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
