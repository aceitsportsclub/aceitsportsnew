'use client';

import { useEffect, useRef } from 'react';

type SourceSiteProps = {
  markup: string;
  styles: string;
  scripts: string[];
};

export default function SourceSite({ markup, styles, scripts }: SourceSiteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scriptsInitialized = useRef(false);

  if (typeof window !== 'undefined' && !(window as any).handleClubLogoError) {
    (window as any).handleClubLogoError = function (img: HTMLImageElement) {
      if (!img) return;
      img.style.display = 'none';
      const fallbackId = img.id === 'loaderLogoImg' ? 'loaderLogoFallback' : (img.id === 'navBrandLogo' ? 'navBrandFallback' : 'heroLogoFallback');
      const fallback = document.getElementById(fallbackId);
      if (fallback) fallback.style.display = 'block';
    };
  }

  useEffect(() => {
    if (scriptsInitialized.current) return;
    scriptsInitialized.current = true;

    // Gallery upload and save safety interceptor
    const origFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
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
  }, [scripts]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
