
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  // Store the registration form values.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Control password visibility.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Track form submission and feedback messages.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle registration through Supabase Authentication.
  const handleRegister = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    // Validate the form before contacting Supabase.
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

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // The database trigger uses this to create the profile.
          data: {
            display_name: fullName.trim(),
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      // If email confirmation is enabled, the user may need
      // to verify their email before they can sign in.
      if (data.session) {
        navigate('/');
      } else {
        setSuccess(
          'Account created! Please check your email for a verification link.'
        );
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
          <span>Blueroof<span className="brand-highlight">bets</span></span>
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

          {error && (
            <div className="register-message error-message">
              {error}
            </div>
          )}

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
                  onChange={(e) => setFullName(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

            {/* Submit */}
            <button
              type="submit"
              className="register-submit"
              disabled={loading}
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
