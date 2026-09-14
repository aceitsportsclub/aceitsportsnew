'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LandingClub } from './types';
import { SPORT_METADATA } from './data/defaultLandingData';

interface MasterLandingHeroProps {
  clubs: LandingClub[];
}

export default function MasterLandingHero({ clubs }: MasterLandingHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const slideCount = clubs.length || 1;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartXRef = useRef<number>(0);

  const goToSlide = useCallback((nextIdx: number) => {
    setCurrentIndex((nextIdx + slideCount) % slideCount);
  }, [slideCount]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  // Autoplay effect
  useEffect(() => {
    if (isHovered || slideCount <= 1) return;
    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isHovered, nextSlide, slideCount]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const getClubBanner = (club: LandingClub) => {
    if (club.coverImage) return club.coverImage;
    const sportKey = (club.sport || '').toLowerCase();
    const slugKey = (club.slug || '').toLowerCase();
    return SPORT_METADATA[slugKey]?.fallbackBanner || SPORT_METADATA[sportKey]?.fallbackBanner || '/landing/assets/images/hero_spikers.jpg';
  };

  const SPORT_ACCENT_MAP: Record<string, string> = {
    volleyball: '#00f0ff', spikers: '#00f0ff',
    cricket: '#1ABC9C',
    basketball: '#E67E22', ballers: '#E67E22',
    football: '#27AE60', soccer: '#27AE60', strikers: '#27AE60',
    kabaddi: '#C0392B',
    badminton: '#8E44AD', shuttle: '#8E44AD',
    'table tennis': '#2980B9', 'ping pong': '#2980B9',
    chess: '#7F8C8D',
    carrom: '#F39C12',
    athletics: '#E91E63', track: '#E91E63', run: '#E91E63'
  };

  const getClubAccent = (club: LandingClub) => {
    // Priority: custom themeColor > accentColor > slug lookup > sport name lookup > fallback
    if (club.themeColor) return club.themeColor;
    if (club.accentColor) return club.accentColor;
    const slugKey = (club.slug || '').toLowerCase();
    const sportKey = (club.sport || '').toLowerCase();
    return (
      SPORT_METADATA[slugKey]?.accentColor ||
      SPORT_METADATA[sportKey]?.accentColor ||
      SPORT_ACCENT_MAP[slugKey] ||
      Object.entries(SPORT_ACCENT_MAP).find(([k]) => sportKey.includes(k))?.[1] ||
      '#F5A623'
    );
  };

  const formatNumber = (n: number) => String(n).padStart(2, '0');
  const progressPercent = ((currentIndex + 1) / slideCount) * 100;

  return (
    <section
      className="hero-section"
      id="hero-showcase"
      aria-label="Collegiate Clubs Showcase"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={(e) => {
        touchStartXRef.current = e.changedTouches[0].screenX;
      }}
      onTouchEnd={(e) => {
        const diff = touchStartXRef.current - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 45) {
          if (diff > 0) nextSlide();
          else prevSlide();
        }
      }}
    >
      <div className="hero-slider" id="hero-slider-track">
        {clubs.map((club, idx) => {
          const isActive = idx === currentIndex;
          const isPrev = idx === (currentIndex - 1 + slideCount) % slideCount;
          const slideClass = isActive ? 'active' : isPrev ? 'exit-left' : '';
          const shortName = club.name.replace(/^ACEIT\s+/i, '');
          const accentColor = getClubAccent(club);

          return (
            <article
              key={club.id || club.slug}
              className={`hero-slide ${slideClass}`}
              data-slide-index={idx}
              aria-hidden={!isActive}
            >
              {/* Cinematic Background */}
              <div className="hero-slide-media">
                <img
                  src={getClubBanner(club)}
                  alt={`${club.name} action photography`}
                  className="hero-slide-img"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    const fallback = SPORT_METADATA[(club.sport || '').toLowerCase()]?.fallbackBanner || '/landing/assets/images/hero_spikers.jpg';
                    (e.currentTarget as HTMLImageElement).src = fallback;
                  }}
                />
                {/* Club-color tinted overlay — each club gets its own palette atmosphere */}
                <div
                  className="hero-slide-overlay"
                  style={{
                    background: [
                      `linear-gradient(90deg, ${accentColor}22 0%, transparent 60%)`,
                      `linear-gradient(90deg, rgba(6,10,20,0.92) 0%, rgba(6,10,20,0.72) 42%, rgba(6,10,20,0.28) 70%, rgba(6,10,20,0.08) 100%)`,
                      `linear-gradient(0deg, var(--bg-main) 0%, rgba(6,10,20,0.78) 12%, transparent 40%)`,
                      `linear-gradient(180deg, rgba(6,10,20,0.75) 0%, transparent 20%)`
                    ].join(', ')
                  }}
                />
                {/* Bottom accent glow bar */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, transparent 0%, ${accentColor} 40%, ${accentColor} 60%, transparent 100%)`,
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 0.6s ease 0.8s',
                    zIndex: 4
                  }}
                />
              </div>

              {/* Hero Content Layer */}
              <div className="container hero-content-wrap">
                <div className="hero-text-block">
                  {/* Sport badge */}
                  <div className="hero-badge-row">
                    <span
                      className="hero-sport-badge"
                      style={{ color: accentColor }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          background: accentColor,
                          borderRadius: '50%',
                          boxShadow: `0 0 10px ${accentColor}`,
                          display: 'inline-block',
                          flexShrink: 0
                        }}
                      />
                      {club.sport?.toUpperCase() || 'SPORTS'}
                    </span>
                  </div>

                  {/* Monumental Club Headline */}
                  <h1 className="hero-club-title" style={{ color: '#ffffff' }}>
                    {shortName}
                  </h1>

                  {/* Accent Line — club color */}
                  <div
                    className="hero-accent-line"
                    style={{
                      background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                      boxShadow: `0 0 16px ${accentColor}`
                    }}
                  />

                  {/* CTA Buttons Row */}
                  <div className="hero-cta-group" style={{ marginTop: '32px' }}>
                    <a
                      href={`/?club=${encodeURIComponent(club.slug)}`}
                      className="btn-hero-primary"
                      id={`cta-club-${club.slug}`}
                      style={{
                        background: accentColor,
                        boxShadow: `0 0 28px ${accentColor}80`,
                        color: '#060a14',
                        borderColor: accentColor
                      }}
                    >
                      <span>{`EXPLORE ${shortName.toUpperCase()}`}</span>
                      <span className="arrow">→</span>
                    </a>
                    <a
                      href="#matches"
                      className="btn-hero-secondary"
                      style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.35)' }}
                    >
                      <span>EXPLORE ALL CLUBS</span>
                      <span>↓</span>
                    </a>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom Navigation Bar & Controls */}
      <div className="hero-bottom-bar">
        <div className="container hero-bottom-content">
          {/* Navigation Controls: [ < ] [ > ]  01 / 04 */}
          <div className="hero-nav-controls">
            <button
              className="hero-ctrl-btn"
              id="hero-prev"
              aria-label="Previous club slide"
              onClick={prevSlide}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              className="hero-ctrl-btn"
              id="hero-next"
              aria-label="Next club slide"
              onClick={nextSlide}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="hero-counter">
              <span
                className="hero-counter-current"
                id="hero-counter-current"
                style={{ color: getClubAccent(clubs[currentIndex] || clubs[0]) }}
              >
                {formatNumber(currentIndex + 1)}
              </span>
              <span className="hero-counter-sep">/</span>
              <span className="hero-counter-total" id="hero-counter-total">
                {formatNumber(slideCount)}
              </span>
            </div>

            <div className="hero-progress-track">
              <div
                className="hero-progress-fill"
                id="hero-progress-bar"
                style={{
                  width: `${progressPercent}%`,
                  background: getClubAccent(clubs[currentIndex] || clubs[0]),
                  boxShadow: `0 0 12px ${getClubAccent(clubs[currentIndex] || clubs[0])}`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
