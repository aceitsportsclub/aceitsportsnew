'use client';

import React from 'react';
import { LandingClub, LandingJourneyItem } from './types';
import { SPORT_METADATA } from './data/defaultLandingData';

interface MasterLandingJourneyProps {
  journey: LandingJourneyItem[];
  clubs: LandingClub[];
}

export default function MasterLandingJourney({ journey, clubs }: MasterLandingJourneyProps) {
  const getClubLogo = (club: LandingClub) => {
    if (club.logo) return club.logo;
    const sportKey = (club.sport || '').toLowerCase();
    const slugKey = (club.slug || '').toLowerCase();
    return SPORT_METADATA[slugKey]?.fallbackLogo || SPORT_METADATA[sportKey]?.fallbackLogo || '/landing/assets/icons/aceit_crest.svg';
  };

  return (
    <section className="section section-dark-elevated" id="journey">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">ARYA ATHLETICS CULTURE</span>
          <h2 className="section-title">THE CHAMPIONSHIP JOURNEY</h2>
          <p className="section-subtitle">
            Empowering student-athletes to pursue collegiate dominance through relentless discipline, elite facilities, and team camaraderie.
          </p>
        </div>

        <div className="journey-grid">
          {journey.map((item) => (
            <div key={item.step} className="journey-card">
              <span className="journey-step-num">{item.step}</span>
              <h3 className="journey-card-title">{item.title}</h3>
              <p className="journey-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
