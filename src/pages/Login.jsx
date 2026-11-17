
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

import { supabase } from '../services/supabase';
import './Login.css';

function Login() {
  const navigate = useNavigate();

  // Store the user's login details.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Control password visibility.
  const [showPassword, setShowPassword] = useState(false);

  // Track loading and error messages.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Authenticate the user with Supabase.
  const handleLogin = async (event) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      // Sign in and retrieve the user's account details.
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      // Retrieve the user's role from their Supabase profile.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      // Send administrators and participants to their respective dashboards.
navigate(
  profile.role === 'admin' ? '/admin' : '/dashboard',
  { replace: true }
);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-container">

        {/* Brand */}
        <Link to="/" className="login-brand">
          <span className="login-brand-icon">
            <Trophy size={24} />
          </span>

          <span>
            Blueroof<span className="login-brand-highlight">bets</span>
          </span>
        </Link>

        {/* Login card */}
        <section className="login-card">
          <div className="login-heading">
            <h1>Welcome back!</h1>
            <p>
              Sign in to continue predicting and competing
              in the Blueroof Football Tournament.
            </p>
          </div>

          {/* Display authentication errors */}
          {error && (
            <div className="login-message">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* Email address */}
            <div className="login-field">
              <label htmlFor="loginEmail">Email address</label>

              <div className="login-input-wrapper">
                <Mail size={18} />

                <input
                  id="loginEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label htmlFor="loginPassword">Password</label>

              <div className="login-input-wrapper">
                <Lock size={18} />

                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Registration link */}
          <div className="login-footer">
            Don't have an account?
            {' '}
            <Link to="/register">Create an account</Link>
          </div>
        </section>

        <p className="login-bottom-text">
          Blueroof Football Tournament
        </p>
      </div>
    </main>
  );
}

export default Login;
