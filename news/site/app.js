/* ============================================================
   THE DAILY BRIEF — Front-end JS
   Loads data/news.json and renders all pages
   ============================================================ */

const CATEGORIES = [
  { id: 'world-politics', label: 'World Politics', page: './pages/world-politics.html', tagClass: 'world' },
  { id: 'us-politics', label: 'US Politics', page: './pages/us-politics.html', tagClass: 'us-politics' },
  { id: 'dfw-politics', label: 'DFW News', page: './pages/dfw-politics.html', tagClass: 'dfw-politics' },
  { id: 'ai-news', label: 'AI News', page: './pages/ai-news.html', tagClass: 'ai' },
  { id: 'jpmorgan-chase', label: 'JPMorgan Chase', page: './pages/jpmorgan-chase.html', tagClass: 'jpmc' },
  { id: 'dfw-events', label: 'DFW Events', page: './pages/dfw-events.html', tagClass: 'events' }
];

// Resolve data path (works from index and from pages/)
function dataPath() {
  const path = window.location.pathname;
  if (path.includes('/pages/')) return '../data/news.json';
  return './data/news.json';
}

function rootPath() {
  const path = window.location.pathname;
  if (path.includes('/pages/')) return '../';
  return './';
}

// Image error handler
function onImgError(img) {
  img.onerror = null;
  img.classList.add('img-fallback');
  img.alt = 'Image unavailable';
  img.style.minHeight = '120px';
  // Replace with a simple SVG placeholder
  const parent = img.parentElement;
  if (parent) {
    const div = document.createElement('div');
    div.className = 'img-fallback ' + img.className;
    div.style.aspectRatio = '16/10';
    div.style.minHeight = '120px';
    div.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    img.replaceWith(div);
  }
}

function formatDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function renderArticleCard(article, category) {
  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  return `
    <article class="article-card">
      <img class="card-image" src="${article.image || ''}" alt="${article.title}" loading="lazy" referrerpolicy="no-referrer" onerror="onImgError(this)">
      <div class="card-body">
        <span class="category-tag ${cat.tagClass}">${cat.label}</span>
        <h3><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a></h3>
        <p class="summary">${article.summary || ''}</p>
        <p class="meta"><span class="source">${article.source || ''}</span></p>
      </div>
    </article>
  `;
}

function renderArticleRow(article, category) {
  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  return `
    <article class="article-row">
      <img class="row-image" src="${article.image || ''}" alt="${article.title}" loading="lazy" referrerpolicy="no-referrer" onerror="onImgError(this)">
      <div class="row-content">
        <span class="category-tag ${cat.tagClass}">${cat.label}</span>
        <h3><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a></h3>
        <p class="summary">${article.summary || ''}</p>
        <p class="meta"><span class="source">${article.source || ''}</span></p>
      </div>
    </article>
  `;
}

function renderHero(article, category) {
  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  return `
    <div class="hero-card">
      <img class="hero-image" src="${article.image || ''}" alt="${article.title}" loading="lazy" referrerpolicy="no-referrer" onerror="onImgError(this)">
      <div class="hero-content">
        <span class="category-tag ${cat.tagClass}">${cat.label}</span>
        <h2><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a></h2>
        <p class="summary">${article.summary || ''}</p>
        <p class="meta"><span class="source">${article.source || ''}</span></p>
      </div>
    </div>
  `;
}

// === HOME PAGE ===
async function renderHomePage() {
  const dateEl = document.getElementById('editionDate');
  const heroEl = document.getElementById('heroSection');
  const sectionsEl = document.getElementById('categorySections');
  if (!dateEl || !heroEl || !sectionsEl) return;

  try {
    const resp = await fetch(dataPath());
    const data = await resp.json();

    dateEl.textContent = formatDate(data.date);

    // Pick hero: first article from first category that has articles
    let heroRendered = false;
    let html = '';

    for (const cat of CATEGORIES) {
      const articles = data.categories[cat.id] || [];
      if (articles.length === 0) continue;

      // First article from first category becomes the hero
      if (!heroRendered) {
        heroEl.innerHTML = renderHero(articles[0], cat.id);
        heroRendered = true;
      }

      // Section with up to 3 articles (skip hero article for first cat)
      const startIdx = (!heroRendered || html === '') && cat.id === CATEGORIES.find(c => (data.categories[c.id] || []).length > 0)?.id ? 1 : 0;
      const sectionArticles = cat.id === CATEGORIES.find(c => (data.categories[c.id] || []).length > 0)?.id
        ? articles.slice(1, 4)
        : articles.slice(0, 3);

      if (sectionArticles.length === 0) continue;

      const root = rootPath();
      html += `
        <div class="section-header">
          <h2>${cat.label}</h2>
          <a href="${root}pages/${cat.id}.html" class="view-all">View All &rarr;</a>
        </div>
        <div class="articles-grid">
          ${sectionArticles.map(a => renderArticleCard(a, cat.id)).join('')}
        </div>
      `;
    }

    sectionsEl.innerHTML = html;

    if (!heroRendered) {
      heroEl.innerHTML = '<p class="loading-placeholder">No news available yet. Check back soon.</p>';
    }
  } catch (e) {
    console.error('Failed to load news data:', e);
    heroEl.innerHTML = '<p class="loading-placeholder">Could not load today\'s news. Please try again later.</p>';
  }
}

// === CATEGORY PAGE ===
async function renderCategoryPage() {
  const categoryId = document.body.dataset.category;
  if (!categoryId) return;

  const dateEl = document.getElementById('editionDate');
  const listEl = document.getElementById('articlesList');
  if (!listEl) return;

  try {
    const resp = await fetch(dataPath());
    const data = await resp.json();

    if (dateEl) dateEl.textContent = formatDate(data.date);

    const articles = data.categories[categoryId] || [];

    if (articles.length === 0) {
      listEl.innerHTML = '<p class="loading-placeholder">No articles available for this category yet.</p>';
      return;
    }

    listEl.innerHTML = articles.map(a => renderArticleRow(a, categoryId)).join('');
  } catch (e) {
    console.error('Failed to load category data:', e);
    listEl.innerHTML = '<p class="loading-placeholder">Could not load articles. Please try again later.</p>';
  }
}

// Dark mode toggle
(function(){
  const t = document.querySelector('[data-theme-toggle]');
  const r = document.documentElement;
  let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  r.setAttribute('data-theme', d);
  function updateIcon() {
    if (!t) return;
    t.innerHTML = d === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  updateIcon();
  if (t) t.addEventListener('click', () => {
    d = d === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', d);
    updateIcon();
  });
})();

// Route
if (document.body.dataset.category) {
  renderCategoryPage();
} else {
  renderHomePage();
}
