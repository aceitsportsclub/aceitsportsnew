'use client';

import React, { useState, useEffect } from 'react';
import './styles/landing.css';
import { AuthUserProfile, LandingClub, LandingEvent, LandingFooterConfig, LandingJourneyItem, LandingMatch } from './types';
import { DEFAULT_CLUBS, DEFAULT_FOOTER, DEFAULT_JOURNEY, FALLBACK_EVENTS, FALLBACK_MATCHES } from './data/defaultLandingData';
import MasterLandingHeader from './MasterLandingHeader';
import MasterLandingHero from './MasterLandingHero';
import MasterLandingMatches from './MasterLandingMatches';
import MasterLandingEvents from './MasterLandingEvents';
import MasterLandingJourney from './MasterLandingJourney';
import MasterLandingFooter from './MasterLandingFooter';

interface CachedLandingPayload {
  clubs: LandingClub[];
  matches: LandingMatch[];
  events: LandingEvent[];
  journey: LandingJourneyItem[];
  footerConfig: LandingFooterConfig;
}

const LANDING_CACHE_KEY = 'aceit_landing_data_cache_v1';

function getInitialLandingCache(): CachedLandingPayload | null {
  if (cachedLandingPayload) return cachedLandingPayload;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LANDING_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.clubs)) {
          cachedLandingPayload = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

let cachedLandingPayload: CachedLandingPayload | null = null;

export default function MasterLandingPage() {
  const initialCache = getInitialLandingCache();
  const [clubs, setClubs] = useState<LandingClub[]>(initialCache ? initialCache.clubs : DEFAULT_CLUBS);
  const [matches, setMatches] = useState<LandingMatch[]>(initialCache ? initialCache.matches : FALLBACK_MATCHES);
  const [events, setEvents] = useState<LandingEvent[]>(initialCache ? initialCache.events : FALLBACK_EVENTS);
  const [journey, setJourney] = useState<LandingJourneyItem[]>(initialCache ? initialCache.journey : DEFAULT_JOURNEY);
  const [footerConfig, setFooterConfig] = useState<LandingFooterConfig>(initialCache ? initialCache.footerConfig : DEFAULT_FOOTER);
  const [user, setUser] = useState<AuthUserProfile | null>(null);

  // If already cached in memory or persistent storage, no splash loading screen needed
  const [isLoading, setIsLoading] = useState(!initialCache);

  useEffect(() => {
    // 1. Fetch Landing Data (Clubs, Matches, Events, Config) in parallel
    const dataPromise = fetch('/api/landing/data')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success) {
          const newClubs = Array.isArray(data.clubs) && data.clubs.length > 0 ? data.clubs : DEFAULT_CLUBS;
          const newMatches = Array.isArray(data.matches) && data.matches.length > 0 ? data.matches : FALLBACK_MATCHES;
          const newEvents = Array.isArray(data.events) && data.events.length > 0 ? data.events : FALLBACK_EVENTS;
          const newJourney = data.config && Array.isArray(data.config.journey) ? data.config.journey : DEFAULT_JOURNEY;
          const newFooter = data.config && data.config.footer ? data.config.footer : DEFAULT_FOOTER;

          setClubs(newClubs);
          setMatches(newMatches);
          setEvents(newEvents);
          setJourney(newJourney);
          setFooterConfig(newFooter);

          const payload = {
            clubs: newClubs,
            matches: newMatches,
            events: newEvents,
            journey: newJourney,
            footerConfig: newFooter
          };
          cachedLandingPayload = payload;
          try {
            localStorage.setItem(LANDING_CACHE_KEY, JSON.stringify(payload));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Master Landing data fetch error:', err);
      });

    // 2. Check Auth State via existing /api/auth/me in parallel
    const authPromise = fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res && res.authenticated && (res.user || res.profile)) {
          setUser(res.user || res.profile);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      });

    // Immediately show page as soon as required landing data & auth are ready (no artificial delays)
    Promise.all([dataPromise, authPromise]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="aceit-master-landing">
      {/* Landing Page Loading Screen with Arya College Sports Emblem */}
      <div
        id="landing-preloader"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#040814',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          transition: 'opacity 0.45s ease, visibility 0.45s ease',
          opacity: isLoading ? 1 : 0,
          visibility: isLoading ? 'visible' : 'hidden',
          pointerEvents: isLoading ? 'all' : 'none'
        }}
      >
        <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="/landing/assets/icons/aceit_sports_emblem.png"
            alt="ACEIT Sports"
            width={80}
            height={80}
            decoding="async"
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 25px rgba(0, 240, 255, 0.45)) drop-shadow(0 0 45px rgba(255, 122, 26, 0.3))'
            }}
          />
        </div>
        <div style={{
          marginTop: 18,
          fontFamily: 'var(--font-display, sans-serif)',
          fontSize: '1.15rem',
          fontWeight: 800,
          letterSpacing: '0.15em',
          color: '#ffffff',
          textTransform: 'uppercase'
        }}>
          ACEIT SPORTS
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.72rem',
          letterSpacing: '0.1em',
          color: '#00f0ff',
          textTransform: 'uppercase'
        }}>
          Arya College of Engineering & IT
        </div>
      </div>

      <MasterLandingHeader clubs={clubs} user={user} />
      <MasterLandingHero clubs={clubs} />
      <MasterLandingMatches matches={matches} />
      <MasterLandingEvents events={events} clubs={clubs} />
      <MasterLandingJourney journey={journey} clubs={clubs} />
      <MasterLandingFooter config={footerConfig} />
    </div>
  );
}
