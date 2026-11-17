
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
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

  // Reference the Turnstile widget so it can be reset after each attempt.
  const turnstileRef = useRef(null);

  // Read the public Cloudflare Site Key from the environment.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Store the user's login details.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Control password visibility.
  const [showPassword, setShowPassword] = useState(false);

  // Store the CAPTCHA verification token.
  const [captchaToken, setCaptchaToken] = useState('');

  // Track loading, authentication errors and CAPTCHA errors.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaError, setCaptchaError] = useState('');

  // Authenticate the user with Supabase.
  const handleLogin = async (event) => {
    event.preventDefault();

    setError('');
    setCaptchaError('');

    // Prevent login if the Cloudflare configuration is missing.
    if (!siteKey) {
      setError(
        'Security verification is not configured. Please contact the administrator.'
      );
      return;
    }

    // Require a successfully completed CAPTCHA challenge.
    if (!captchaToken) {
      setCaptchaError('Please complete the security verification.');
      return;
    }

    setLoading(true);

    // Store the destination until the authentication request finishes.
    let destination = null;

    try {
      // Sign in and send the CAPTCHA token to Supabase.
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: {
            captchaToken,
          },
        });

      if (loginError) {
        throw loginError;
      }

      // Retrieve the user's role from their Supabase profile.
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      // Determine the correct destination for this account.
      destination =
        profile.role === 'admin' ? '/admin' : '/dashboard';
    } catch (loginError) {
      setError(
        loginError.message || 'Unable to sign in. Please try again.'
      );
    } finally {
      // A Turnstile token must not be reused for another request.
      setCaptchaToken('');
      turnstileRef.current?.reset();

      setLoading(false);
    }

    // Redirect only after authentication and profile retrieval succeed.
    if (destination) {
      navigate(destination, { replace: true });
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
            Blueroof
            <span className="login-brand-highlight">bets</span>
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

          {/* Display authentication errors. */}
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
                  autoComplete="email"
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
                  autoComplete="current-password"
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

            {/* Cloudflare Turnstile security verification. */}
            <div className="login-captcha">
              {siteKey ? (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={siteKey}
                  options={{ theme: 'auto' }}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError('');
                  }}
                  onExpire={() => {
                    setCaptchaToken('');
                    setCaptchaError(
                      'Security verification expired. Please complete it again.'
                    );
                  }}
                  onError={() => {
                    setCaptchaToken('');
                    setCaptchaError(
                      'Security verification failed. Please try again.'
                    );
                  }}
                />
              ) : (
                <p className="login-captcha-error">
                  Cloudflare Site Key is missing from the application configuration.
                </p>
              )}
            </div>

            {captchaError && (
              <p className="login-captcha-error" role="alert">
                {captchaError}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="login-submit"
              disabled={loading || !captchaToken || !siteKey}
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
