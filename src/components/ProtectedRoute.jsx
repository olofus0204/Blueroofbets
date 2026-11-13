
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Protect routes that require authentication or administrator access.
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isAdmin, loading } = useAuth();

  // Wait until Supabase finishes checking the user's session.
  if (loading) {
    return (
      <div className="auth-loading">
        <p>Checking your account...</p>
      </div>
    );
  }

  // Redirect users who are not logged in to the login page.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Prevent regular participants from accessing admin-only pages.
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Allow access when all required checks pass.
  return children;
}

export default ProtectedRoute;
