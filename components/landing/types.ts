export interface LandingClub {
  id: string;
  name: string;
  sport: string;
  slug: string;
  logo: string | null;
  loaderLogo?: string | null;
  coverImage?: string | null;
  description?: string | null;
  themeColor?: string | null;
  accentColor?: string | null;
  active?: boolean;
}

export interface LandingMatch {
  id: string;
  clubId?: string;
  clubSlug?: string;
  clubName?: string;
  clubLogo?: string | null;
  team1?: string;
  team1Logo?: string | null;
  team2?: string;
  opponent?: string;
  team2Logo?: string | null;
  date?: string | null;
  venue?: string | null;
  status?: string; // 'live' | 'upcoming' | 'completed'
  score1?: number | null;
  score2?: number | null;
  sets?: string | null;
  winner?: string | null;
  isLive?: boolean;
}

export interface LandingEvent {
  id: string;
  clubId?: string;
  clubSlug?: string;
  clubName?: string;
  clubLogo?: string | null;
  poster?: string | null;
  title: string;
  date?: string | null;
  time?: string | null;
  venue?: string | null;
  description?: string | null;
  registrationButtonText?: string | null;
  registrationUrl?: string | null;
  registrationEnabled?: boolean;
  badge?: string;
}

export interface LandingJourneyItem {
  step: string;
  title: string;
  desc: string;
}

export interface LandingFooterConfig {
  brand: string;
  description: string;
  copyright: string;
  maintainer: string;
  maintainerUrl?: string;
  exploreLinks: { label: string; href: string }[];
  communityLinks: { label: string; href: string }[];
  socialLinks: { platform: string; url: string }[];
}

export interface AuthUserProfile {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  photo: string | null;
  role: string;
}
