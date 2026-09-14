'use client';

import React, { useState, useMemo } from 'react';
import { LandingClub, LandingEvent } from './types';
import { SPORT_METADATA } from './data/defaultLandingData';

interface MasterLandingEventsProps {
  events: LandingEvent[];
  clubs: LandingClub[];
}

export default function MasterLandingEvents({ events, clubs }: MasterLandingEventsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const initialCount = 6;

  const sortedEvents = useMemo(() => {
    const list = [...events];

    const getStatusWeight = (ev: LandingEvent) => {
      const status = (ev.badge || '').toLowerCase();
      if (status.includes('live') || status.includes('happening')) return 1;
      if (status.includes('concluded') || status.includes('past')) return 3;
      return 2; // upcoming
    };

    return list.sort((a, b) => {
      const weightA = getStatusWeight(a);
      const weightB = getStatusWeight(b);

      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // If both upcoming: nearest date/time first
      if (weightA === 2) {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (!isNaN(timeA) && !isNaN(timeB) && timeA > 0 && timeB > 0) {
          return timeA - timeB;
        }
      }

      return 0;
    });
  }, [events]);

  const displayedEvents = isExpanded ? sortedEvents : sortedEvents.slice(0, initialCount);

  const toggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      const sec = document.getElementById('events');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsExpanded(true);
    }
  };

  const getEventClub = (ev: LandingEvent) => {
    if (ev.clubSlug) {
      const found = clubs.find((c) => c.slug === ev.clubSlug);
      if (found) return found;
    }
    if (ev.clubId) {
      const found = clubs.find((c) => c.id === ev.clubId);
      if (found) return found;
    }
    return null;
  };

  const getEventPoster = (ev: LandingEvent, club: LandingClub | null) => {
    if (ev.poster) return ev.poster;
    const sportKey = (club?.sport || '').toLowerCase();
    const slugKey = (club?.slug || ev.clubSlug || '').toLowerCase();
    return SPORT_METADATA[slugKey]?.fallbackBanner || SPORT_METADATA[sportKey]?.fallbackBanner || '/landing/assets/images/event_volleyball.jpg';
  };

  return (
    <section className="section" id="events">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">CAMPUS ATHLETIC EVENTS</span>
          <h2 className="section-title">EVENTS &amp; TOURNAMENTS</h2>
          <p className="section-subtitle">
            Key dates, trials, workshops, and invitationals across the entire Arya athletic calendar.
          </p>
        </div>

        {/* Events Grid (Initially shows exactly 6 events) */}
        <div className="events-grid" id="events-grid-container">
          {displayedEvents.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '30px' }}>
              No collegiate events currently scheduled.
            </p>
          ) : (
            displayedEvents.map((ev) => {
              const club = getEventClub(ev);
              const clubName = club ? club.name : (ev.clubName || 'ACEIT Sports');
              const shortClubName = club ? club.name.replace(/^ACEIT\s+/i, '') : 'ACEIT';
              const clubLogo = club?.logo || ev.clubLogo || '/landing/assets/icons/aceit_crest.svg';
              const posterUrl = getEventPoster(ev, club);
              const isLive = (ev.badge || '').toLowerCase().includes('live') || (ev.time || '').toLowerCase().includes('now');
              const isConcluded = (ev.badge || '').toLowerCase().includes('concluded');

              const statusClass = isLive ? 'live' : isConcluded ? 'completed' : 'upcoming';
              const statusLabel = isLive ? 'LIVE CHAMPIONSHIP' : isConcluded ? 'CONCLUDED' : (ev.badge || 'UPCOMING');

              return (
                <article key={ev.id} className="event-card" data-event-id={ev.id}>
                  {/* Event Media & Badges */}
                  <div className="event-card-media">
                    <img
                      src={posterUrl}
                      alt={ev.title}
                      className="event-card-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/landing/assets/images/event_volleyball.jpg';
                      }}
                    />

                    <div className="event-badge-overlay">
                      <span className={`status-pill ${statusClass}`}>
                        {isLive && <span className="live-pulse-dot" />}
                        {statusLabel}
                      </span>
                    </div>

                    <div className="event-club-badge-overlay">
                      <img
                        src={clubLogo}
                        alt={clubName}
                        width={18}
                        height={18}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/landing/assets/icons/aceit_crest.svg';
                        }}
                      />
                      <span>{shortClubName}</span>
                    </div>
                  </div>

                  {/* Event Body Content */}
                  <div className="event-card-body">
                    <div className="event-datetime-row">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M2 7H14" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M5 1V4M11 1V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      <span>{ev.date}{ev.time ? ` • ${ev.time}` : ''}</span>
                    </div>

                    <h3 className="event-title">{ev.title}</h3>

                    <p className="event-description">
                      {ev.description || 'Collegiate championship event at Arya College of Engineering & IT.'}
                    </p>

                    <div className="event-card-footer">
                      <div className="event-venue">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8 1.5C5.51472 1.5 3.5 3.51472 3.5 6C3.5 9.5 8 14.5 8 14.5C8 14.5 12.5 9.5 12.5 6C12.5 3.51472 10.4853 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.6" />
                          <circle cx="8" cy="6" r="2" fill="currentColor" />
                        </svg>
                        <span>{ev.venue || 'ACEIT Sports Complex'}</span>
                      </div>

                      {ev.registrationUrl ? (
                        <a
                          href={ev.registrationUrl}
                          className="btn-event-cta"
                          id={`cta-ev-${ev.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {ev.registrationButtonText || 'REGISTER'}
                        </a>
                      ) : (
                        <a
                          href={club ? `/?club=${encodeURIComponent(club.slug)}#events` : '#events'}
                          className="btn-event-cta"
                          id={`cta-ev-${ev.id}`}
                        >
                          {ev.registrationButtonText || (isLive ? 'VIEW LIVESTREAM' : isConcluded ? 'RECAP' : 'DETAILS')}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Show More / Show Less Toggle for Events (Strict 6 Rule) */}
        {sortedEvents.length > initialCount && (
          <div className="show-more-wrap" id="events-toggle-wrap">
            <button
              className={`btn-show-toggle ${isExpanded ? 'expanded' : ''}`}
              id="btn-toggle-events"
              aria-expanded={isExpanded}
              onClick={toggleExpand}
            >
              <span id="events-toggle-label">
                {isExpanded ? 'SHOW LESS EVENTS' : 'SHOW MORE EVENTS'}
              </span>
              <svg
                className="toggle-arrow"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
