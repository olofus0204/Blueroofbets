
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Trophy } from 'lucide-react';

import { supabase } from '../services/supabase';

// Main navigation links displayed on the website.
const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'Fixtures', href: '#fixtures' },
  { name: 'Leaderboard', href: '#leaderboard' },
  { name: 'About', href: '#about' },
];

function Navbar() {
  // Controls whether the mobile navigation menu is visible.
  const [menuOpen, setMenuOpen] = useState(false);

  // Stores the signed-in user and their database role.
  const [account, setAccount] = useState({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let isActive = true;
    let requestNumber = 0;

    // Retrieve the user's role from their Supabase profile.
    const loadAccount = async (user) => {
      const currentRequest = ++requestNumber;

      // Show visitor navigation when nobody is signed in.
      if (!user) {
        if (isActive) {
          setAccount({
            user: null,
            role: null,
            loading: false,
          });
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      // Ignore results from outdated requests or an unmounted component.
      if (!isActive || currentRequest !== requestNumber) return;

      if (error) {
        console.error('Unable to retrieve account role:', error.message);
      }

      // Only users with the admin role receive administrator navigation.
      setAccount({
        user,
        role: profile?.role === 'admin' ? 'admin' : 'participant',
        loading: false,
      });
    };

    // Listen for login, logout and session changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer the profile request until the auth callback has finished.
      setTimeout(() => {
        void loadAccount(session?.user || null);
      }, 0);
    });

    // Also check the existing session when the navbar first loads.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive) return;

      if (error) {
        console.error('Unable to retrieve login session:', error.message);

        setAccount({
          user: null,
          role: null,
          loading: false,
        });
        return;
      }

      void loadAccount(data.session?.user || null);
    });

    // Remove the authentication listener when the navbar unmounts.
    return () => {
      isActive = false;
      requestNumber += 1;
      subscription.unsubscribe();
    };
  }, []);

  // Sign out only when the user explicitly chooses Sign out.
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out failed:', error.message);
      return;
    }

    // Close the mobile navigation after a successful sign-out.
    setMenuOpen(false);
  };

  // Choose the correct destination and label for each account type.
  const dashboardPath =
    account.role === 'admin' ? '/admin' : '/dashboard';

  const dashboardLabel =
    account.role === 'admin' ? 'Admin Dashboard' : 'Dashboard';

  return (
    <header className="navbar">
      <div className="navbar-container">

        {/* Tournament logo and website name. */}
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Trophy size={24} />
          </span>

          <span className="brand-name">
            BLUEROOF
            <small>FOOTBALL TOURNAMENT</small>
          </span>
        </Link>

        {/* Desktop navigation links. */}
        <nav className="desktop-nav">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="nav-link"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Show account actions after checking the login session. */}
        {!account.loading && (
          <div className="nav-actions">
            {account.user ? (
              <>
                <Link to={dashboardPath} className="nav-register">
                  {dashboardLabel}
                </Link>

                <button
                  type="button"
                  className="login-link"
                  onClick={handleSignOut}
                  style={{
                    background: 'none',
                    border: 0,
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="login-link">
                  Login
                </Link>

                <Link to="/register" className="nav-register">
                  Join Competition
                </Link>
              </>
            )}
          </div>
        )}

        {/* Mobile menu toggle button. */}
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      </div>

      {/* Mobile navigation dropdown. */}
      {menuOpen && (
        <nav className="mobile-nav">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="mobile-nav-link"
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}

          {!account.loading && (
            account.user ? (
              <>
                <Link
                  to={dashboardPath}
                  className="mobile-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {dashboardLabel}
                </Link>

                <button
                  type="button"
                  className="mobile-nav-link"
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="mobile-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className="mobile-register"
                  onClick={() => setMenuOpen(false)}
                >
                  Join Competition
                </Link>
              </>
            )
          )}
        </nav>
      )}
    </header>
  );
}

export default Navbar;
