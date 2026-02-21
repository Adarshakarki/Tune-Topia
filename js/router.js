/* ═══════════════════════════════════════════════════
   router.js — loads page HTML fragments into #content-area
   All page JS is already loaded in index.html upfront.
   ═══════════════════════════════════════════════════ */

const Router = (() => {
  const contentArea = document.getElementById('content-area');
  let currentPage   = null;

  async function go(page) {
    if (page === currentPage) return;
    currentPage = page;

    // Highlight active nav button
    syncNav(page);

    // Show spinner
    contentArea.innerHTML = '<div class="page-loading"><div class="spin"></div></div>';

    try {
      const html = await fetch(`pages/${page}.html`).then(r => {
        if (!r.ok) throw new Error(`${r.status} loading ${page}.html`);
        return r.text();
      });

      contentArea.innerHTML = html;
      contentArea.scrollTop = 0;

      // Call page init
      const pageName = page.charAt(0).toUpperCase() + page.slice(1);
      window[`Page${pageName}`]?.init();

    } catch (err) {
      contentArea.innerHTML = `<div class="msg" style="padding:60px 40px">
        <span class="msg-icon">⚠️</span>Failed to load page: ${err.message}
      </div>`;
    }
  }

  // Wire nav buttons (sidebar + bottom nav)
  document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(btn =>
    btn.addEventListener('click', () => go(btn.dataset.page)));

  // Sync active state across both navbars
  function syncNav(page) {
    document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.page === page));
  }

  // Start on home
  document.addEventListener('DOMContentLoaded', () => go('home'));

  return { go };
})();