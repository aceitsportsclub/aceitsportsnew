import { LandingClub, LandingEvent, LandingFooterConfig, LandingJourneyItem, LandingMatch } from '../types';

export const SPORT_METADATA: Record<string, { tagline: string; accentColor: string; fallbackBanner: string; fallbackLogo: string }> = {
  volleyball: {
    tagline: '',
    accentColor: '#00f0ff',
    fallbackBanner: '/landing/assets/images/hero_spikers.jpg',
    fallbackLogo: '/landing/assets/icons/spikers_logo.svg'
  },
  spikers: {
    tagline: '',
    accentColor: '#00f0ff',
    fallbackBanner: '/landing/assets/images/hero_spikers.jpg',
    fallbackLogo: '/landing/assets/icons/spikers_logo.svg'
  },
  cricket: {
    tagline: '',
    accentColor: '#1ABC9C',
    fallbackBanner: '/landing/assets/images/hero_cricket.jpg',
    fallbackLogo: '/landing/assets/icons/cricket_logo.svg'
  },
  basketball: {
    tagline: '',
    accentColor: '#E67E22',
    fallbackBanner: '/landing/assets/images/hero_ballers.jpg',
    fallbackLogo: '/landing/assets/icons/ballers_logo.svg'
  },
  ballers: {
    tagline: '',
    accentColor: '#E67E22',
    fallbackBanner: '/landing/assets/images/hero_ballers.jpg',
    fallbackLogo: '/landing/assets/icons/ballers_logo.svg'
  },
  football: {
    tagline: '',
    accentColor: '#27AE60',
    fallbackBanner: '/landing/assets/images/hero_strikers.jpg',
    fallbackLogo: '/landing/assets/icons/strikers_logo.svg'
  },
  strikers: {
    tagline: '',
    accentColor: '#27AE60',
    fallbackBanner: '/landing/assets/images/hero_strikers.jpg',
    fallbackLogo: '/landing/assets/icons/strikers_logo.svg'
  },
  kabaddi: {
    tagline: '',
    accentColor: '#C0392B',
    fallbackBanner: '/landing/assets/images/hero_spikers.jpg',
    fallbackLogo: '/landing/assets/icons/aceit_crest.svg'
  },
  badminton: {
    tagline: '',
    accentColor: '#8E44AD',
    fallbackBanner: '/landing/assets/images/hero_spikers.jpg',
    fallbackLogo: '/landing/assets/icons/aceit_crest.svg'
  }
};

export const DEFAULT_CLUBS: LandingClub[] = [
  {
    id: 'spikers',
    name: 'ACEIT Spikers',
    sport: 'Volleyball',
    slug: 'spikers',
    logo: '/landing/assets/icons/spikers_logo.svg',
    coverImage: '/landing/assets/images/hero_spikers.jpg',
    description: '',
    accentColor: '#00f0ff',
    active: true
  },
  {
    id: 'cricket',
    name: 'ACEIT Cricket',
    sport: 'Cricket',
    slug: 'cricket',
    logo: '/landing/assets/icons/cricket_logo.svg',
    coverImage: '/landing/assets/images/hero_cricket.jpg',
    description: '',
    accentColor: '#1ABC9C',
    active: true
  },
  {
    id: 'ballers',
    name: 'ACEIT Ballers',
    sport: 'Basketball',
    slug: 'aceit-ballers',
    logo: '/landing/assets/icons/ballers_logo.svg',
    coverImage: '/landing/assets/images/hero_ballers.jpg',
    description: '',
    accentColor: '#E67E22',
    active: true
  }
];

export const DEFAULT_JOURNEY: LandingJourneyItem[] = [
  {
    step: '01',
    title: 'ELITE TRAINING GROUNDS',
    desc: 'State-of-the-art sports facilities including indoor arenas, floodlit football turf, professional cricket nets, and dedicated athletic fitness gyms.'
  },
  {
    step: '02',
    title: 'UNIFIED CLUB ECOSYSTEM',
    desc: 'Seamless integration between volleyball, cricket, basketball, and football. Every athlete trains with specialized coaches and sports science support.'
  },
  {
    step: '03',
    title: 'STATE & NATIONAL GLORY',
    desc: 'Representing Arya College of Engineering & IT at prestigious university leagues, state cups, and national collegiate championships.'
  }
];

export const DEFAULT_FOOTER: LandingFooterConfig = {
  brand: 'ACEIT SPORTS',
  description: 'The official collegiate sports & athletics community of Arya College of Engineering & IT.',
  copyright: '© 2026 Arya College of Engineering & IT (ACEIT Sports). All rights reserved.',
  maintainer: 'Founded & Maintained by Patidar',
  maintainerUrl: 'https://www.instagram.com/aceitsportsclub',
  exploreLinks: [
    { label: 'Squads', href: '#' },
    { label: 'Matches', href: '#matches' },
    { label: 'All Clubs', href: '#hero-showcase' }
  ],
  communityLinks: [
    { label: 'Gallery', href: '#' },
    { label: 'Join Club', href: '#hero-showcase' },
    { label: 'Contact', href: '#' }
  ],
  socialLinks: [
    { platform: 'Instagram', url: 'https://www.instagram.com/aceitsportsclub' },
    { platform: 'Facebook', url: 'https://facebook.com' },
    { platform: 'YouTube', url: 'https://youtube.com' }
  ]
};

export const FALLBACK_MATCHES: LandingMatch[] = [
  {
    id: 'match-spikers-live-1',
    clubSlug: 'spikers',
    clubName: 'ACEIT Spikers',
    clubLogo: '/landing/assets/icons/spikers_logo.svg',
    team1: 'ACEIT Spikers',
    team1Logo: '/landing/assets/icons/spikers_logo.svg',
    team2: 'SKIT Strikers',
    status: 'live',
    isLive: true,
    score1: 2,
    score2: 1,
    sets: 'Set 4: 22-19',
    venue: 'ACEIT Main Indoor Sports Arena Court 1'
  },
  {
    id: 'match-cricket-live-2',
    clubSlug: 'cricket',
    clubName: 'ACEIT Cricket',
    clubLogo: '/landing/assets/icons/cricket_logo.svg',
    team1: 'ACEIT Cricket',
    team1Logo: '/landing/assets/icons/cricket_logo.svg',
    team2: 'JECRC Royals',
    status: 'live',
    isLive: true,
    score1: 164,
    score2: 112,
    sets: '17.4 Overs',
    venue: 'ACEIT Sports Complex Pitch'
  },
  {
    id: 'match-ballers-up-1',
    clubSlug: 'aceit-ballers',
    clubName: 'ACEIT Ballers',
    clubLogo: '/landing/assets/icons/ballers_logo.svg',
    team1: 'ACEIT Ballers',
    team1Logo: '/landing/assets/icons/ballers_logo.svg',
    team2: 'MNIT Cagers',
    status: 'upcoming',
    date: '2026-09-15T17:00:00+05:30',
    venue: 'ACEIT Hardwood Stadium'
  },
  {
    id: 'match-spikers-up-2',
    clubSlug: 'spikers',
    clubName: 'ACEIT Spikers',
    clubLogo: '/landing/assets/icons/spikers_logo.svg',
    team1: 'ACEIT Spikers',
    team1Logo: '/landing/assets/icons/spikers_logo.svg',
    team2: 'Poornima Spikes',
    status: 'upcoming',
    date: '2026-09-17T11:00:00+05:30',
    venue: 'University Indoor Hall'
  }
];

export const FALLBACK_EVENTS: LandingEvent[] = [
  {
    id: 'ev-1',
    clubSlug: 'spikers',
    clubName: 'ACEIT Spikers',
    clubLogo: '/landing/assets/icons/spikers_logo.svg',
    title: 'Inter-Collegiate Volleyball Championship 2026',
    date: 'SEPT 13-15, 2026',
    time: 'HAPPENING NOW',
    venue: 'ACEIT Main Indoor Sports Arena',
    poster: '/landing/assets/images/event_volleyball.jpg',
    description: 'The flagship 3-day volleyball tournament featuring 16 top university squads competing for the coveted Arya Rolling Trophy.',
    badge: 'LIVE CHAMPIONSHIP'
  },
  {
    id: 'ev-2',
    clubSlug: 'cricket',
    clubName: 'ACEIT Cricket',
    clubLogo: '/landing/assets/icons/cricket_logo.svg',
    title: 'State University Cricket Derby 2026',
    date: 'SEPT 16, 2026',
    time: '9:30 AM IST',
    venue: 'ACEIT Sports Complex Pitch',
    poster: '/landing/assets/images/event_cricket.jpg',
    description: 'High-voltage collegiate rivalry showdown under the floodlights with live commentary, student stands, and alumni honors.',
    badge: 'UPCOMING DERBY'
  },
  {
    id: 'ev-3',
    clubSlug: 'spikers',
    clubName: 'ACEIT Spikers',
    clubLogo: '/landing/assets/icons/spikers_logo.svg',
    title: 'ACEIT Spikers Open Freshers Trials & Tryouts',
    date: 'SEPT 19, 2026',
    time: '7:00 AM IST',
    venue: 'ACEIT Outdoor Volleyball Courts',
    poster: '/landing/assets/images/hero_spikers.jpg',
    description: 'Official scouting day for incoming 1st and 2nd year students. Professional coaching staff assessing spikes, sets, and libero agility.',
    badge: 'OPEN TRYOUTS'
  },
  {
    id: 'ev-4',
    clubSlug: 'aceit-ballers',
    clubName: 'ACEIT Ballers',
    clubLogo: '/landing/assets/icons/ballers_logo.svg',
    title: 'Midnight Madness 3v3 Hardcourt Showdown',
    date: 'SEPT 21, 2026',
    time: '8:00 PM IST',
    venue: 'ACEIT Floodlit Outdoor Hoops',
    poster: '/landing/assets/images/hero_ballers.jpg',
    description: 'Intense streetball atmosphere under the glow lights with DJ, live beats, slam dunk exhibition, and prize pool.',
    badge: 'REGISTRATION OPEN'
  },
  {
    id: 'ev-5',
    clubSlug: 'cricket',
    clubName: 'ACEIT Cricket',
    clubLogo: '/landing/assets/icons/cricket_logo.svg',
    title: 'Pro Bowling & Pace Conditioning Clinic',
    date: 'SEPT 28, 2026',
    time: '6:30 AM IST',
    venue: 'ACEIT Cricket Nets & Gym',
    poster: '/landing/assets/images/hero_cricket.jpg',
    description: 'Specialized masterclass with state Ranji Trophy bowling coaches focused on biomechanics, seam release, and speed drills.',
    badge: 'MASTERCLASS'
  },
  {
    id: 'ev-6',
    clubSlug: 'aceit-ballers',
    clubName: 'ACEIT Ballers',
    clubLogo: '/landing/assets/icons/ballers_logo.svg',
    title: 'Collegiate Basketball Alumni All-Star Game',
    date: 'OCT 02, 2026',
    time: '5:30 PM IST',
    venue: 'ACEIT Hardwood Stadium',
    poster: '/landing/assets/images/hero_ballers.jpg',
    description: 'Annual reunion clash pitting current varsity stars against distinguished alumni players from the past decade.',
    badge: 'ALUMNI SPECIAL'
  }
];
