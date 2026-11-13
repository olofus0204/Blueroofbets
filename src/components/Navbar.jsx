
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Trophy } from 'lucide-react';

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

        {/* Registration and login links for desktop. */}
        <div className="nav-actions">
          <Link to="/login" className="login-link">
            Login
          </Link>

          <Link to="/register" className="nav-register">
            Join Competition
          </Link>
        </div>

        {/* Mobile menu toggle button. */}
        <button
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
        </nav>
      )}
    </header>
  );
}

export default Navbar;
