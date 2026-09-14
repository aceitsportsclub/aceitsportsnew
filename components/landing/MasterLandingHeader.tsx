'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AuthUserProfile, LandingClub } from './types';
import { SPORT_METADATA } from './data/defaultLandingData';

interface MasterLandingHeaderProps {
  clubs: LandingClub[];
  user: AuthUserProfile | null;
}

export default function MasterLandingHeader({ clubs, user }: MasterLandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aceit_theme');
      const cur = saved === 'light' ? 'light' : 'dark';
      setTheme(cur);
      document.documentElement.setAttribute('data-theme', cur);
    } catch (e) {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'aceit_theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue);
        document.documentElement.setAttribute('data-theme', e.newValue);
      }
    };
    const handlePageShow = () => {
      try {
        const cur = localStorage.getItem('aceit_theme');
        if (cur === 'light' || cur === 'dark') {
          setTheme(cur);
          document.documentElement.setAttribute('data-theme', cur);
        }
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('aceit_theme', next);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const getClubLogo = (club: LandingClub) => {
    if (club.logo) return club.logo;
    const sportKey = (club.sport || '').toLowerCase();
    const slugKey = (club.slug || '').toLowerCase();
    return SPORT_METADATA[slugKey]?.fallbackLogo || SPORT_METADATA[sportKey]?.fallbackLogo || '/landing/assets/icons/aceit_crest.svg';
  };

  const cleanUserName = (user?.name || user?.username || 'Athlete').trim();
  const firstName = cleanUserName.split(' ')[0] || cleanUserName;
  const userInitial = firstName.charAt(0).toUpperCase() || 'A';

  return (
    <>
      <header className={`site-header ${isScrolled ? 'scrolled' : ''}`} id="site-header">
        <div className="container nav-container">
          {/* Brand Lockup */}
          <a href="#" className="brand-link" id="brand-home-link" aria-label="ACEIT Sports Home">
            <img
              src="/landing/assets/icons/aceit_sports_emblem.png"
              alt="ACEIT Sports Emblem"
              className="brand-crest"
              width={38}
              height={38}
              style={{ objectFit: 'contain' }}
            />
            <div className="brand-text">
              <span className="brand-title">ACEIT CLUBS</span>
              <span className="brand-subtitle">OFFICIAL ATHLETICS</span>
            </div>
          </a>

          {/* Center Desktop Navigation */}
          <nav className="main-nav" aria-label="Main Navigation">
            <a href="#journey" className="nav-link">JOURNEY</a>

            {/* Clubs Dropdown */}
            <div className={`nav-dropdown-wrapper ${isDropdownOpen ? 'open' : ''}`} id="clubs-dropdown-wrapper" ref={dropdownRef}>
              <button
                className="nav-link dropdown-trigger"
                id="clubs-dropdown-btn"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
              >
                CLUBS
                <svg className="dropdown-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="clubs-dropdown" id="clubs-dropdown-menu" role="menu">
                <div className="dropdown-header">VARSITY ATHLETIC CLUBS</div>
                <div id="dropdown-clubs-list">
                  {clubs.map((club) => (
                    <a
                      key={club.id || club.slug}
                      href={`/?club=${encodeURIComponent(club.slug)}`}
                      className="club-dropdown-item"
                      role="menuitem"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <img
                        src={getClubLogo(club)}
                        alt={`${club.name} Crest`}
                        className="club-dropdown-logo"
                        width={32}
                        height={32}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/landing/assets/icons/aceit_crest.svg';
                        }}
                      />
                      <div className="club-dropdown-info">
                        <div className="club-dropdown-name">{club.name}</div>
                        <div className="club-dropdown-sport">{club.sport}</div>
                      </div>
                      <span className="club-dropdown-arrow">→</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <a href="#matches" className="nav-link">MATCHES</a>
            <a href="#events" className="nav-link">EVENTS</a>
          </nav>

          {/* Right Action & Auth */}
          <div className="nav-actions">
            {/* Global Dark / Light Theme Toggle */}
            <button
              type="button"
              className="theme-toggle"
              id="landing-theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {user ? (
              <a
                href="/?club=spikers"
                className="user-profile-badge"
                id="nav-user-profile"
                style={{ display: 'inline-flex', cursor: 'pointer', textDecoration: 'none' }}
                title="View Account / Profile"
              >
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt={cleanUserName}
                    className="user-avatar"
                    id="nav-user-avatar"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--color-orange), #b84500)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: '#fff'
                    }}
                  >
                    {userInitial}
                  </span>
                )}
                <span className="user-name" id="nav-user-name">{firstName}</span>
              </a>
            ) : (
              <a
                href="/?club=spikers&auth=signin"
                className="btn-login"
                id="nav-login-btn"
                data-auth="logged_out"
              >
                LOGIN
              </a>
            )}

            {/* Mobile Navigation Hamburger */}
            <button
              className={`mobile-nav-toggle ${isMobileMenuOpen ? 'open' : ''}`}
              id="mobile-nav-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`} id="mobile-nav-drawer">
        <a
          href="#journey"
          className="mobile-nav-link"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          JOURNEY
        </a>

        <div>
          <span className="mobile-nav-link" style={{ color: 'var(--color-orange)', borderBottom: 'none' }}>
            ALL CLUBS
          </span>
          <div className="mobile-clubs-list" id="mobile-clubs-container">
            {clubs.map((club) => (
              <a
                key={club.id || club.slug}
                href={`/?club=${encodeURIComponent(club.slug)}`}
                className="club-dropdown-item"
                style={{ padding: '8px 0' }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <img
                  src={getClubLogo(club)}
                  alt={`${club.name} Crest`}
                  className="club-dropdown-logo"
                  width={28}
                  height={28}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/landing/assets/icons/aceit_crest.svg';
                  }}
                />
                <div className="club-dropdown-info">
                  <div className="club-dropdown-name" style={{ fontSize: '1.15rem' }}>{club.name}</div>
                  <div className="club-dropdown-sport">{club.sport}</div>
                </div>
                <span className="club-dropdown-arrow" style={{ opacity: 1 }}>→</span>
              </a>
            ))}
          </div>
        </div>

        <a
          href="#matches"
          className="mobile-nav-link"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          MATCHES
        </a>
        <a
          href="#events"
          className="mobile-nav-link"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          EVENTS
        </a>

        <div style={{ margin: '20px 0' }}>
          {user ? (
            <a
              href="/?club=spikers"
              className="btn-login"
              style={{ display: 'block', textAlign: 'center' }}
            >
              {firstName} (Profile)
            </a>
          ) : (
            <a
              href="/?club=spikers&auth=signin"
              className="btn-login"
              style={{ display: 'block', textAlign: 'center' }}
            >
              LOGIN
            </a>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
            THEME ({theme.toUpperCase()})
          </span>
          <button
            type="button"
            className="theme-toggle"
            id="mobile-nav-theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </>
  );
}
