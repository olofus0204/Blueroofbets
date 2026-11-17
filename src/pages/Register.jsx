
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  Trophy,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

import { supabase } from '../services/supabase';
import './Register.css';

function Register() {
  const navigate = useNavigate();

  // Reference the CAPTCHA widget so it can be reset after submission.
  const turnstileRef = useRef(null);

  // Read the public Cloudflare Site Key from the environment.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Store the registration form values.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Control password visibility.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Store the CAPTCHA verification token.
  const [captchaToken, setCaptchaToken] = useState('');

  // Track form submission and feedback messages.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaError, setCaptchaError] = useState('');

  // Handle registration through Supabase Authentication.
  const handleRegister = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');
    setCaptchaError('');

    // Make sure the Cloudflare configuration is available.
    if (!siteKey) {
      setError(
        'Security verification is not configured. Please contact the administrator.'
      );
      return;
    }

    // Require successful CAPTCHA verification.
    if (!captchaToken) {
      setCaptchaError('Please complete the security verification.');
      return;
    }

    // Validate the registration form before contacting Supabase.
    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setLoading(true);

    // Redirect only when Supabase returns an authenticated session.
    let shouldRedirect = false;

    try {
      // Register the new participant and send the CAPTCHA token.
      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          captchaToken,

          // The database trigger uses this to create the profile.
          data: {
            display_name: fullName.trim(),
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      // Email confirmation is currently disabled for the free beta.
      if (data.session) {
        shouldRedirect = true;
      } else {
        setSuccess(
          'Your account was created, but no active session was returned. Please sign in.'
        );
      }
    } catch (signupError) {
      setError(
        signupError.message || 'Registration failed. Please try again.'
      );
    } finally {
      // Reset the single-use CAPTCHA token after every attempt.
      setCaptchaToken('');
      turnstileRef.current?.reset();

      setLoading(false);
    }

    // New authenticated participants go directly to their dashboard.
    if (shouldRedirect) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <main className="register-page">
      <div className="register-container">

        {/* Brand section */}
        <Link to="/" className="register-brand">
          <span className="register-brand-icon">
            <Trophy size={24} />
          </span>

          <span>
            Blueroof
            <span className="brand-highlight">bets</span>
          </span>
        </Link>

        {/* Registration form */}
        <section className="register-card">
          <div className="register-heading">
            <h1>Create your account</h1>
            <p>
              Join the Blueroof Football Tournament prediction
              competition.
            </p>
          </div>

          {/* Display registration errors. */}
          {error && (
            <div className="register-message error-message">
              {error}
            </div>
          )}

          {/* Display successful registration feedback. */}
          {success && (
            <div className="register-message success-message">
              {success}
            </div>
          )}

          <form onSubmit={handleRegister}>

            {/* Full name */}
            <div className="register-field">
              <label htmlFor="fullName">Full name</label>

              <div className="register-input-wrapper">
                <User size={18} />

                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="register-field">
              <label htmlFor="email">Email address</label>

              <div className="register-input-wrapper">
                <Mail size={18} />

                <input
                  id="email"
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
            <div className="register-field">
              <label htmlFor="password">Password</label>

              <div className="register-input-wrapper">
                <Lock size={18} />

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
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

            {/* Confirm password */}
            <div className="register-field">
              <label htmlFor="confirmPassword">Confirm password</label>

              <div className="register-input-wrapper">
                <Lock size={18} />

                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile security verification. */}
            <div className="register-captcha">
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
                <p className="register-captcha-error">
                  Cloudflare Site Key is missing from the application configuration.
                </p>
              )}
            </div>

            {captchaError && (
              <p className="register-captcha-error" role="alert">
                {captchaError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="register-submit"
              disabled={loading || !captchaToken || !siteKey}
            >
              {loading ? 'Creating account...' : 'Create account'}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="register-footer">
            Already have an account?
            {' '}
            <Link to="/login">Sign in</Link>
          </div>
        </section>

        <p className="register-bottom-text">
          Blueroof Football Tournament
        </p>
      </div>
    </main>
  );
}

export default Register;
