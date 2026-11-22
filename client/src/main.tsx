import { createRoot } from 'react-dom/client';

import App from './App';
import { setBaseUrl } from '@/api';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Khi frontend và API chạy khác domain (production), đặt VITE_API_URL=https://api.example.com
// Khi phát triển, để trống: Vite proxy /api -> localhost:5000
setBaseUrl(import.meta.env.VITE_API_URL || null);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
