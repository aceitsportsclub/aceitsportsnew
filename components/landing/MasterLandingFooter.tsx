'use client';

import React from 'react';
import { LandingFooterConfig } from './types';

interface MasterLandingFooterProps {
  config: LandingFooterConfig;
}

export default function MasterLandingFooter({ config }: MasterLandingFooterProps) {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="container">
        {/* Top Grid: Brand & Link Columns */}
        <div className="footer-top-grid">
          {/* Brand Column */}
          <div className="footer-brand-col">
            <div className="footer-brand-lockup">
              <img
                src="/landing/assets/icons/aceit_sports_emblem.png"
                alt="ACEIT Sports Emblem"
                className="footer-crest"
                width={42}
                height={42}
                loading="lazy"
                decoding="async"
                style={{ objectFit: 'contain' }}
              />
              <span className="footer-brand-name">{config.brand || 'ACEIT SPORTS'}</span>
            </div>
            <p className="footer-desc" id="footer-brand-desc">
              {config.description || 'The official collegiate sports & athletics community of Arya College of Engineering & IT.'}
            </p>
          </div>

          {/* Column: EXPLORE */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">EXPLORE</h4>
            <ul className="footer-links-list" id="footer-explore-links">
              {config.exploreLinks?.map((l, i) => (
                <li key={i}>
                  <a href={l.href} className="footer-link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column: COMMUNITY */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">COMMUNITY</h4>
            <ul className="footer-links-list" id="footer-community-links">
              {config.communityLinks?.map((l, i) => (
                <li key={i}>
                  <a href={l.href} className="footer-link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column: FOLLOW US */}
          <div className="footer-links-col">
            <h4 className="footer-col-title">FOLLOW US</h4>
            <ul className="social-links-list" id="footer-social-links">
              <li>
                <a
                  href="https://instagram.com"
                  className="social-link-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="social-icon" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>Instagram</span>
                </a>
              </li>
              <li>
                <a
                  href="https://facebook.com"
                  className="social-link-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="social-icon" viewBox="0 0 24 24">
                    <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.657 5H18V0h-3.808C10.597 0 9 1.582 9 4.615V8z" />
                  </svg>
                  <span>Facebook</span>
                </a>
              </li>
              <li>
                <a
                  href="https://youtube.com"
                  className="social-link-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="social-icon" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  <span>YouTube</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright" id="footer-copyright-text">
            {config.copyright || '© 2026 Arya College of Engineering & IT (ACEIT Sports). All rights reserved.'}
          </div>
          <div className="footer-maintainer" id="footer-maintainer-text">
            Founded &amp; Maintained by{' '}
            {config.maintainerUrl ? (
              <a
                href={config.maintainerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'inherit',
                  textDecoration: 'none'
                }}
              >
                <span
                  style={{
                    color: 'var(--color-orange)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-orange-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-orange)')}
                >
                  {config.maintainer?.replace(/^Founded\s+&\s+Maintained\s+by\s+/i, '') || 'Patidar'}
                </span>
              </a>
            ) : (
              <span>{config.maintainer?.replace(/^Founded\s+&\s+Maintained\s+by\s+/i, '') || 'Patidar'}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
