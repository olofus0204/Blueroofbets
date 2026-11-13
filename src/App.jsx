
import { BrowserRouter } from 'react-router-dom';

// Import the homepage component.
import Home from './pages/Home';

// Import the application's global component styles.
import './App.css';

function App() {
  return (
    // BrowserRouter enables navigation within the application.
    <BrowserRouter>
      <Home />
    </BrowserRouter>
  );
}

export default App;
