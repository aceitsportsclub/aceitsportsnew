'use client';

import { useEffect, useRef } from 'react';

type SourceSiteProps = {
  markup: string;
  styles: string;
  scripts: string[];
  club?: string;
  section?: string;
};

const SECTION_META: Record<string, { title: string; subtitle: string; targetId: string }> = {
  players: {
    title: 'Team Roster & Athletes',
    subtitle: 'Official squad profiles, positions, jersey numbers, and athletic records.',
    targetId: 'team'
  },
  matches: {
    title: 'Fixtures & Match Results',
    subtitle: 'Track live college clashes, scheduled tournament draws, and recent match scores.',
    targetId: 'matches'
  },
  gallery: {
    title: 'Club Photo Gallery',
    subtitle: 'Moments of victory, intensive training sessions, celebrations, and court action.',
    targetId: 'gallery'
  },
  events: {
    title: 'Events & Tournaments',
    subtitle: 'Upcoming collegiate championships, trials, sports meets, and RSVP registrations.',
    targetId: 'events'
  },
  'notice-board': {
    title: 'Official Notice Board',
    subtitle: 'Latest club announcements, circulars, schedule changes, and bulletins.',
    targetId: 'notice-board'
  },
  testimonials: {
    title: 'Voices & Testimonials',
    subtitle: 'What captains, coaches, faculty advisors, and student athletes say about the club.',
    targetId: 'testimonials'
  },
  stats: {
    title: 'Club Statistics & Milestones',
    subtitle: 'Key milestones, match statistics, tournament titles, and athletic achievements.',
    targetId: 'stats'
  },
  contact: {
    title: 'Contact & Join Roster',
    subtitle: 'Connect with club leadership, visit training grounds, or apply for roster trials.',
    targetId: 'contact'
  }
};

const ROUTE_CSS = `
  /* Route Header Banner */
  .route-header-banner {
    padding: 110px 24px 36px;
    background: linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%);
    color: #fff;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: relative;
    overflow: hidden;
  }
  .route-header-banner::after {
    content: '';
    position: absolute;
    top: -40%;
    right: -15%;
    width: 420px;
    height: 420px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245,166,35,0.18) 0%, transparent 70%);
    pointer-events: none;
  }
  .route-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  .route-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-family: var(--font-mono);
    color: rgba(255,255,255,0.65);
    margin-bottom: 12px;
  }
  .route-breadcrumb a {
    color: var(--gold);
    text-decoration: none;
    font-weight: 600;
    transition: opacity 0.2s;
  }
  .route-breadcrumb a:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
  .route-breadcrumb .sep {
    opacity: 0.4;
  }
  .route-title {
    font-family: var(--font-display);
    font-size: clamp(30px, 4.5vw, 52px);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px;
    line-height: 1.08;
    color: #fff;
  }
  .route-subtitle {
    font-size: 15px;
    color: rgba(255,255,255,0.78);
    max-width: 640px;
    margin: 0;
    line-height: 1.5;
  }

  /* View All CTA Buttons on Home */
  .view-all-row {
    display: flex;
    justify-content: center;
    margin-top: 32px;
    padding: 8px 0 16px;
  }
  .view-all-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 26px;
    font-size: 13px;
    font-family: var(--font-mono);
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--charcoal);
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
    transition: all 0.25s var(--ease);
  }
  .view-all-btn:hover {
    background: var(--charcoal);
    color: #fff;
    border-color: var(--charcoal);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .view-all-btn .arrow {
    transition: transform 0.2s;
    font-size: 16px;
  }
  .view-all-btn:hover .arrow {
    transform: translateX(4px);
  }

  /* Lazy image fade in */
  img[loading="lazy"] {
    transition: opacity 0.3s ease-in;
  }

  /* Match Card Layout & Responsiveness: Prevent landing.css grid collision */
  #matches .match-card,
  .matches-grid .match-card,
  .match-card {
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: unset !important;
    min-width: 0 !important;
    max-height: none !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    white-space: normal !important;
    padding: 24px 28px !important;
  }

  /* Top Bar */
  .match-card .match-top {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
    margin-bottom: 16px !important;
  }

  /* Center Teams Row */
  .match-card .match-teams {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-around !important;
    gap: 16px !important;
    width: 100% !important;
    margin: 12px 0 !important;
  }
  .match-card .match-team {
    flex: 1 1 auto !important;
    text-align: center !important;
    min-width: 90px !important;
  }
  .match-card .match-team .crest {
    width: 56px !important;
    height: 56px !important;
    margin: 0 auto 8px !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .match-card .match-team .crest img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: 50% !important;
  }
  .match-card .match-team strong {
    display: block !important;
    word-break: break-word !important;
    font-size: clamp(13px, 1.4vw, 16px) !important;
    line-height: 1.3 !important;
    color: var(--charcoal) !important;
  }
  .match-card .match-vs {
    font-family: var(--font-mono) !important;
    font-weight: 800 !important;
    font-size: 14px !important;
    color: var(--charcoal-soft) !important;
    padding: 0 10px !important;
    flex-shrink: 0 !important;
  }

  /* Centered Score Badge */
  .match-card div[style*="border-radius:10px"] {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 260px !important;
    min-width: 140px !important;
    margin: 16px auto !important;
    padding: 8px 16px !important;
    text-align: center !important;
    display: block !important;
    background: var(--cream-2) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
  }
  .match-card [style*="Final Match Score"],
  .match-card [style*="FINAL MATCH SCORE"],
  .match-card [style*="final match score"] {
    white-space: normal !important;
    word-break: keep-all !important;
    line-height: 1.3 !important;
    letter-spacing: 0.8px !important;
    font-size: 11px !important;
    display: block !important;
    color: var(--charcoal-soft) !important;
  }

  /* Bottom Metadata Row: Venue on Left, Date & Time on Right */
  .match-card .match-meta {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
    border-top: 1px dashed var(--border) !important;
    padding-top: 14px !important;
    margin-top: 16px !important;
    font-size: 13px !important;
    color: var(--charcoal-soft) !important;
  }
  .match-card .match-meta .match-venue,
  .match-card .match-meta span:first-child {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-weight: 600 !important;
    color: var(--charcoal) !important;
  }
  .match-card .match-meta .match-time-date,
  .match-card .match-meta span:last-child {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    font-family: var(--font-mono) !important;
    font-size: 12px !important;
    color: var(--charcoal-soft) !important;
  }

  /* Responsive Grid and Breakpoints */
  @media (max-width: 1100px) {
    .matches-grid {
      grid-template-columns: 1fr !important;
      gap: 20px !important;
    }
  }
  @media (max-width: 600px) {
    #matches .match-card,
    .matches-grid .match-card,
    .match-card {
      padding: 16px 14px !important;
    }
    .match-card .match-meta {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 6px !important;
    }
  }
`;

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function SourceSite({ markup, styles, scripts, club, section }: SourceSiteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scriptsInitialized = useRef(false);

  // Dynamically resolve club and section from URL in browser if not explicitly supplied or if running statically
  let initialClub = club;
  let initialSection = section;

  if (typeof window !== 'undefined') {
    (window as any).__API_BASE__ = PUBLIC_API_BASE ? (PUBLIC_API_BASE.replace(/\/+$/, '') + (PUBLIC_API_BASE.endsWith('/api') ? '' : '/api')) : '/api';

    const pathname = window.location.pathname;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'club' || parts[0] === 'clubs')) {
      initialClub = parts[1].toLowerCase().trim();
      if (parts.length >= 3) {
        initialSection = parts[2].toLowerCase().trim();
      }
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      const queryClub = searchParams.get('club') || searchParams.get('clubId') || searchParams.get('c');
      if (queryClub) initialClub = queryClub.toLowerCase().trim();
      const querySec = searchParams.get('section') || searchParams.get('view') || searchParams.get('page');
      if (querySec) initialSection = querySec.toLowerCase().trim();
    }
  }

  const cleanClub = (initialClub || 'spikers').toLowerCase().trim();
  const cleanSection = (initialSection || 'home').toLowerCase().trim();
  const isHome = cleanSection === 'home';

  if (typeof window !== 'undefined') {
    (window as any).__ACTIVE_CLUB__ = cleanClub;
    (window as any).__ACTIVE_SECTION__ = cleanSection;

    if (!(window as any).handleClubLogoError) {
      (window as any).handleClubLogoError = function (img: HTMLImageElement) {
        if (!img) return;
        img.style.display = 'none';
        const fallbackId = img.id === 'loaderLogoImg' ? 'loaderLogoFallback' : (img.id === 'navBrandLogo' ? 'navBrandFallback' : 'heroLogoFallback');
        const fallback = document.getElementById(fallbackId);
        if (fallback) fallback.style.display = 'block';
      };
    }
  }

  useEffect(() => {
    (window as any).__ACTIVE_CLUB__ = cleanClub;
    (window as any).__ACTIVE_SECTION__ = cleanSection;

    // Apply route-based navigation links
    const updateNavLinks = () => {
      const basePrefix = `/club/${encodeURIComponent(cleanClub)}`;
      const navLinksEl = document.getElementById('navLinks');
      if (navLinksEl) {
        const linkMap: Record<string, string> = {
          '#team': `${basePrefix}/players`,
          '#notice-board': `${basePrefix}/notice-board`,
          '#gallery': `${basePrefix}/gallery`,
          '#matches': `${basePrefix}/matches`,
          '#events': `${basePrefix}/events`,
          '#contact': `${basePrefix}/contact`
        };

        navLinksEl.querySelectorAll('a').forEach((link) => {
          const href = link.getAttribute('href') || '';
          if (href === '/' || href.includes('navHomeLink')) {
            link.href = basePrefix;
          } else if (linkMap[href]) {
            link.href = linkMap[href];
          }

          // Active indicator
          const targetSection = cleanSection === 'team' ? 'players' : cleanSection;
          if (
            (targetSection === 'players' && href.includes('players')) ||
            (targetSection === 'matches' && href.includes('matches')) ||
            (targetSection === 'gallery' && href.includes('gallery')) ||
            (targetSection === 'events' && href.includes('events')) ||
            (targetSection === 'notice-board' && href.includes('notice-board')) ||
            (targetSection === 'contact' && href.includes('contact')) ||
            (targetSection === 'home' && link.id === 'navHomeLink')
          ) {
            link.classList.add('active');
            link.style.color = 'var(--gold)';
            link.style.fontWeight = '700';
          }
        });
      }

      // Brand link -> Home
      const brand = document.querySelector('.nav-brand') as HTMLAnchorElement | null;
      if (brand) {
        brand.href = `${basePrefix}`;
      }
    };

    // Apply Route Section Layout & Buttons
    const applySectionLayout = () => {
      const basePrefix = `/club/${encodeURIComponent(cleanClub)}`;

      if (isHome) {
        // Add "View All" CTA buttons to home preview sections if not already present
        const attachViewAll = (containerId: string, sectionRoute: string, label: string) => {
          const sectionEl = document.getElementById(containerId);
          if (!sectionEl) return;
          if (sectionEl.querySelector('.view-all-row')) return;

          const row = document.createElement('div');
          row.className = 'view-all-row';
          row.innerHTML = `<a href="${basePrefix}/${sectionRoute}" class="view-all-btn">${label} <span class="arrow">&rarr;</span></a>`;

          sectionEl.appendChild(row);
        };

        attachViewAll('team', 'players', 'View All Players');
        attachViewAll('notice-board', 'notice-board', 'View All Announcements');
        attachViewAll('gallery', 'gallery', 'View All Photos');
        attachViewAll('matches', 'matches', 'View All Fixtures & Results');
        attachViewAll('events', 'events', 'View All Events');
        attachViewAll('testimonials', 'testimonials', 'View All Testimonials');
      } else {
        // Dedicated section route: insert route header banner above active section
        const meta = SECTION_META[cleanSection];
        const activeTargetId = meta ? meta.targetId : cleanSection;

        if (meta && !document.getElementById('routeHeaderBanner')) {
          const activeEl = document.getElementById(activeTargetId);
          if (activeEl && activeEl.parentNode) {
            const banner = document.createElement('div');
            banner.id = 'routeHeaderBanner';
            banner.className = 'route-header-banner';
            banner.innerHTML = `
              <div class="route-header-inner">
                <nav class="route-breadcrumb" aria-label="Breadcrumb">
                  <a href="${basePrefix}">Home</a>
                  <span class="sep">/</span>
                  <span class="current">${meta.title}</span>
                </nav>
                <h1 class="route-title">${meta.title}</h1>
                <p class="route-subtitle">${meta.subtitle}</p>
              </div>
            `;
            activeEl.parentNode.insertBefore(banner, activeEl);
            setTimeout(() => {
              banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }
      }
    };

    // FIX 1: Eager LCP images for Hero/Banner; Lazy loading for below-the-fold images
    const applyLazyImages = () => {
      document.querySelectorAll('img').forEach((img) => {
        const isCriticalHero =
          img.id === 'heroLogoImg' ||
          img.id === 'navBrandLogo' ||
          img.id === 'loaderLogoImg' ||
          img.closest('.hero') !== null ||
          img.closest('.showcase-card[data-index="0"]') !== null ||
          img.closest('.showcase-card:first-child') !== null;

        if (isCriticalHero) {
          img.removeAttribute('loading');
          img.setAttribute('loading', 'eager');
          img.setAttribute('fetchpriority', 'high');
        } else if (!img.getAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
          img.setAttribute('decoding', 'async');
        }
      });
    };

    updateNavLinks();
    applySectionLayout();
    applyLazyImages();

    const observer = new MutationObserver(() => {
      applyLazyImages();
    });
    if (rootRef.current) {
      observer.observe(rootRef.current, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
    };
  }, [cleanClub, cleanSection, isHome]);

  useEffect(() => {
    if (scriptsInitialized.current) return;
    scriptsInitialized.current = true;

    // FIX 3: Safety and route-specific fetch interceptor with Admin Overlay exemption
    const origFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());

      // Route-specific DB fetching interceptor
      if (urlStr.includes('/api/db')) {
        const isAdminActive = Boolean(
          document.querySelector('.admin-overlay.open') ||
          document.querySelector('#adminOverlay.open') ||
          document.querySelector('.admin-tab-btn.active') ||
          (window as any).currentAdminTab ||
          urlStr.includes('export=1') ||
          urlStr.includes('export=true')
        );

        let newUrl = urlStr;
        // Admin dashboard must ALWAYS receive unconstrained full database content
        if (!isAdminActive && !urlStr.includes('section=')) {
          const activeSec = ((window as any).__ACTIVE_SECTION__ || cleanSection || 'home').toLowerCase();
          if (activeSec) {
            const separator = urlStr.includes('?') ? '&' : '?';
            newUrl = `${urlStr}${separator}section=${encodeURIComponent(activeSec)}`;
          }
        }

        const freshInit: RequestInit = { ...(init || {}), cache: 'no-cache' };
        if (typeof input === 'string') {
          return origFetch(newUrl, freshInit);
        } else if (input instanceof Request) {
          return origFetch(new Request(newUrl, { ...input, ...freshInit }));
        }
      }

      // Gallery upload and save safety interceptor
      if (urlStr.includes('/api/upload')) {
        const isAdminGalleryOpen = Boolean(
          document.querySelector('.admin-tab-btn.active[data-tab="gallery"]') ||
          document.querySelector('#adminForm[data-tab="gallery"]') ||
          (window as any).currentAdminTab === 'gallery'
        );
        if (isAdminGalleryOpen && !urlStr.includes('bucket=') && !urlStr.includes('gallery-media')) {
          const separator = urlStr.includes('?') ? '&' : '?';
          const newUrl = `${urlStr}${separator}bucket=gallery-media&module=gallery`;
          if (typeof input === 'string') {
            return origFetch(newUrl, init);
          } else if (input instanceof Request) {
            return origFetch(new Request(newUrl, input));
          }
        }
      }
      return origFetch(input, init);
    };

    // Prevent saving gallery when image upload is empty or in-progress
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target && target.matches && target.matches('.admin-photo-file')) {
        const formEl = target.closest('#adminForm, .admin-modal, .admin-form');
        const isGallery = Boolean(
          (window as any).currentAdminTab === 'gallery' ||
          formEl?.querySelector('[data-field="photo"]')
        );
        if (isGallery) {
          const saveBtn = document.getElementById('adminSaveBtn') as HTMLButtonElement | null;
          if (saveBtn) {
            saveBtn.disabled = true;
            const origText = saveBtn.textContent || 'Save';
            saveBtn.textContent = 'Processing Image...';
            const checkReady = () => {
              const hidden = target.closest('.admin-photo-upload')?.querySelector('input[type="hidden"]') as HTMLInputElement | null;
              if (hidden && hidden.value && hidden.value.length > 0) {
                saveBtn.disabled = false;
                saveBtn.textContent = origText;
              } else {
                setTimeout(checkReady, 50);
              }
            };
            setTimeout(checkReady, 50);
          }
        }
      }
    }, true);

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.id === 'adminSaveBtn' || target.closest('#adminSaveBtn'))) {
        const isGallery = (window as any).currentAdminTab === 'gallery';
        if (isGallery) {
          const photoInput = document.querySelector('#adminForm [data-field="photo"]') as HTMLInputElement | null;
          if (photoInput && !photoInput.value.trim()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            alert('Please select or upload a photo before saving.');
            return false;
          }
        }
      }
    }, true);

    for (const source of scripts) {
      const script = document.createElement('script');
      script.text = source;
      document.body.appendChild(script);
    }

    setTimeout(() => {
      if (window.location.search.includes('auth=signin') || window.location.hash === '#login') {
        if (typeof (window as any).openAuthModal === 'function') {
          (window as any).openAuthModal('signin');
        } else {
          const btn = document.getElementById('navSignInBtn');
          if (btn) btn.click();
        }
      }
    }, 600);
  }, [scripts, cleanSection]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles + ROUTE_CSS }} />
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
