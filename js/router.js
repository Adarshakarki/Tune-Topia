const Router = (() => {
  const contentArea = document.getElementById('content-area');
  let currentPage   = null;

  async function go(page) {
    if (page === currentPage) return;
    currentPage = page;
    syncNav(page);

    contentArea.innerHTML = '<div class="page-loading"><div class="spin"></div></div>';

    try {
      const r = await fetch(`pages/${page}.html`);
      if (!r.ok) throw new Error(`${r.status}`);
      const html = await r.text();

      contentArea.innerHTML = html;
      contentArea.scrollTop = 0;

      // Call the page's init function (defined in js/pages/*.js, loaded in index.html)
      const pageName = page.charAt(0).toUpperCase() + page.slice(1);
      window[`Page${pageName}`]?.init();

    } catch (err) {
      contentArea.innerHTML = `<div class="msg">
        <span class="msg-icon">⚠️</span>Failed to load page (${err.message})
      </div>`;
    }
  }

  function syncNav(page) {
    document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.page === page));
  }

  // Wire all nav buttons (sidebar + mobile bottom nav)
  document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(btn =>
    btn.addEventListener('click', () => go(btn.dataset.page)));

  // Start on home — scripts are at bottom of <body> so DOM is already ready here,
  // but we defer one tick so all other scripts (api, player, ui) finish initialising.
  setTimeout(() => go('home'), 0);

  return { go };
})();