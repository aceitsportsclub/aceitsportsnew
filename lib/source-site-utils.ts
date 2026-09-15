import fs from 'node:fs';
import path from 'node:path';

export function getSourceSiteData(section?: string) {
  const source = fs.readFileSync(path.join(process.cwd(), 'source', 'HTML.txt'), 'utf8');
  const styles = source.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? '';
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  let markup = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') ?? '';

  if (section && section !== 'home') {
    markup = filterMarkupForSection(markup, section);
  }

  return { styles, scripts, markup };
}

export function filterMarkupForSection(html: string, section?: string): string {
  const cleanSection = (section || 'home').toLowerCase().trim();
  if (!cleanSection || cleanSection === 'home') return html;

  const sectionMap: Record<string, string> = {
    players: 'team',
    team: 'team',
    matches: 'matches',
    gallery: 'gallery',
    events: 'events',
    'notice-board': 'notice-board',
    notices: 'notice-board',
    testimonials: 'testimonials',
    stats: 'stats',
    contact: 'contact'
  };

  const activeId = sectionMap[cleanSection] || cleanSection;
  const sectionsToStrip = [
    { tag: 'header', id: 'hero' },
    { tag: 'section', id: 'hero-slideshow' },
    { tag: 'section', id: 'clubs' },
    { tag: 'section', id: 'team' },
    { tag: 'section', id: 'notice-board' },
    { tag: 'section', id: 'gallery' },
    { tag: 'section', id: 'matches' },
    { tag: 'section', id: 'events' },
    { tag: 'section', id: 'sponsors' },
    { tag: 'section', id: 'testimonials' },
    { tag: 'section', id: 'join' }
  ];

  let filtered = html;
  for (const item of sectionsToStrip) {
    if (item.id === activeId || item.id === 'contact') continue;
    if (activeId === 'contact' && item.id === 'join') continue;

    const regex = new RegExp('<' + item.tag + '[^>]*id=["\']' + item.id + '["\'][\\s\\S]*?<\\/' + item.tag + '>', 'i');
    filtered = filtered.replace(regex, `<!-- stripped: ${item.id} -->`);
  }

  if (activeId === 'stats' && !filtered.includes('class="stats-grid"')) {
    const statsHtml = `
      <section id="stats" style="padding:60px 0;background:var(--cream-2);">
        <div style="max-width:1200px;margin:0 auto;padding:0 24px;">
          <div class="stats-band" style="display:block;padding:32px 24px;border-radius:var(--radius-lg);">
            <div class="stats-grid"></div>
          </div>
        </div>
      </section>
    `;
    const contactIdx = filtered.indexOf('<section id="contact"');
    if (contactIdx !== -1) {
      filtered = filtered.slice(0, contactIdx) + statsHtml + filtered.slice(contactIdx);
    }
  }

  return filtered;
}
