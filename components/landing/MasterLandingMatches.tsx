'use client';

import React, { useState, useMemo } from 'react';
import { LandingMatch } from './types';

interface MasterLandingMatchesProps {
  matches: LandingMatch[];
}

export default function MasterLandingMatches({ matches }: MasterLandingMatchesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const initialCount = 4;

  const sortedMatches = useMemo(() => {
    const list = [...matches];

    const getStatusWeight = (m: LandingMatch) => {
      const isLive = m.isLive || m.status === 'live';
      if (isLive) return 1;
      if (m.status === 'upcoming') return 2;
      return 3;
    };

    return list.sort((a, b) => {
      const weightA = getStatusWeight(a);
      const weightB = getStatusWeight(b);

      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // If both live, keep order
      if (a.isLive || a.status === 'live') return 0;

      // If both upcoming, nearest date/time first
      if (a.status === 'upcoming') {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeA - timeB;
      }

      // If both completed, most recent first
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [matches]);

  const displayedMatches = isExpanded ? sortedMatches : sortedMatches.slice(0, initialCount);

  const toggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      const sec = document.getElementById('matches');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsExpanded(true);
    }
  };

  const formatMatchDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
      const month = months[d.getMonth()];
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day} ${month} • ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="section section-dark-elevated" id="matches">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">LIVE &amp; UPCOMING FIXTURES</span>
          <h2 className="section-title">FIXTURES &amp; RESULTS</h2>
          <p className="section-subtitle">
            Real-time match updates, live scores, and upcoming championship schedules across all ACEIT varsity clubs.
          </p>
        </div>

        {/* Matches Render List */}
        <div className="matches-list" id="matches-list-container">
          {displayedMatches.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '30px' }}>
              No collegiate matches currently scheduled.
            </p>
          ) : (
            displayedMatches.map((match) => {
              const isLive = match.isLive || match.status === 'live';
              const isUpcoming = match.status === 'upcoming';
              const isCompleted = match.status === 'completed';
              const clubName = match.clubName || 'ACEIT Sports';
              const clubLogo = match.clubLogo || '/landing/assets/icons/aceit_crest.svg';
              const homeScore = match.score1 !== null && match.score1 !== undefined ? match.score1 : '-';
              const awayScore = match.score2 !== null && match.score2 !== undefined ? match.score2 : '-';
              const formattedDate = formatMatchDate(match.date);

              return (
                <article
                  key={match.id}
                  className={`match-card ${isLive ? 'is-live' : ''}`}
                  data-match-id={match.id}
                >
                  {/* Club & Meta */}
                  <div className="match-meta">
                    <div className="match-club-tag">
                      <img
                        src={clubLogo}
                        alt={`${clubName} emblem`}
                        className="match-club-logo"
                        width={26}
                        height={26}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/landing/assets/icons/aceit_crest.svg';
                        }}
                      />
                      <span className="match-club-name">{clubName}</span>
                    </div>
                    <div className="match-tournament">{match.venue || 'Collegiate Arena'}</div>
                  </div>

                  {/* Face-off Teams & Scoreboard */}
                  <div className="match-teams-score">
                    <div className="team-block team-home">
                      <span className="team-name">{match.team1 || 'ACEIT Team'}</span>
                      {(isLive || isCompleted) && (
                        <span className="team-score-num">{homeScore}</span>
                      )}
                    </div>

                    <span className="vs-badge">VS</span>

                    <div className="team-block team-away">
                      {(isLive || isCompleted) && (
                        <span className="team-score-num" style={{ color: '#cbd5e1' }}>{awayScore}</span>
                      )}
                      <span className="team-name">{match.team2 || match.opponent || 'Opponent'}</span>
                    </div>
                  </div>

                  {/* Match Status & Venue */}
                  <div className="match-status-col">
                    {isLive && (
                      <span className="status-pill live">
                        <span className="live-pulse-dot" />
                        {match.sets || 'LIVE NOW'}
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="status-pill upcoming">
                        {formattedDate || 'UPCOMING'}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="status-pill completed">
                        {formattedDate ? `${formattedDate} • FINAL` : 'FINAL'}
                      </span>
                    )}

                    <div className="match-detail-note">{match.winner && match.winner !== 'none' ? `Winner: ${match.winner.toUpperCase()}` : (match.sets || '')}</div>
                    <div className="match-venue-text">{match.venue || 'ACEIT Sports Complex'}</div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Show More / Show Less Toggle */}
        {sortedMatches.length > initialCount && (
          <div className="show-more-wrap" id="matches-toggle-wrap">
            <button
              className={`btn-show-toggle ${isExpanded ? 'expanded' : ''}`}
              id="btn-toggle-matches"
              aria-expanded={isExpanded}
              onClick={toggleExpand}
            >
              <span id="matches-toggle-label">
                {isExpanded ? 'SHOW LESS MATCHES' : 'SHOW MORE MATCHES'}
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
