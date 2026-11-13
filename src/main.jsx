
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Import global CSS before rendering the application.
import './index.css';

// Import the main application component.
import App from './App.jsx';

// Mount the React application inside the HTML root element.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
