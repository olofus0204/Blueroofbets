
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Standings from './pages/Standings';
import Leaderboard from './pages/Leaderboard';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import ParticipantDashboard from './pages/ParticipantDashboard';
import PredictionPage from './pages/PredictionPage';
import Fixtures from './pages/Fixtures';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages. */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/standings" element={<Standings />} />
   
          {/* Any signed-in participant can access this dashboard. */}
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <ParticipantDashboard />
    </ProtectedRoute>
  }
/>
 {/* Signed-in participants can submit predictions for a fixture. */}
   <Route
     path="/predict/:matchId"
     element={
       <ProtectedRoute>
         <PredictionPage />
       </ProtectedRoute>
     }
   />

   {/* Public fixtures page. */}
<Route path="/fixtures" element={<Fixtures />} />
  
    {/* Public tournament leaderboard. */}
<Route
  path="/leaderboard"
  element={<Leaderboard />}
/>
          {/* Admin-only pages. */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
