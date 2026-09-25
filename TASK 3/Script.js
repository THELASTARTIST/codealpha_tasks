(() => {
  'use strict';

  /* ===========================================================
     DEMO LIBRARY
     Each photo: { id, src, category, date }
     =========================================================== */
  const CATEGORY_SEEDS = {
    nature:        ['forest-a','forest-b','meadow-a','lake-a','lake-b','fern-a'],
    people:        ['portrait-a','portrait-b','crowd-a','friends-a','friends-b','portrait-c'],
    travel:        ['road-a','city-a','coast-a','market-a','airport-a','trail-a'],
    architecture:  ['facade-a','stairs-a','bridge-a','skyline-a','interior-a','arch-a'],
    animals:       ['cat-a','dog-a','bird-a','horse-a','fox-a','owl-a']
  };

  function daysAgo(n){
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  // Spread demo photos across the last ~15 months so memory grouping has real spans
  const DEMO_OFFSETS = [1, 3, 6, 9, 13, 20, 27, 35, 48, 60, 75, 95, 130, 170, 220, 280, 340, 400, 430];
  let uid = 0;
  const IMAGES = [];

  Object.entries(CATEGORY_SEEDS).forEach(([category, seeds]) => {
    seeds.forEach((seed) => {
      const offset = DEMO_OFFSETS[uid % DEMO_OFFSETS.length];
      const w = 400, h = 300 + ((uid % 4) * 60); // varied aspect ratios for masonry
      IMAGES.push({
        id: `demo-${uid++}`,
        src: `https://picsum.photos/seed/${seed}/${w}/${h}`,
        category,
        date: daysAgo(offset),
        title: seed.replace('-', ' ')
      });
    });
  });

  /* ===========================================================
     STATE
     =========================================================== */
  const state = {
    filter: 'all',
    isLoggedIn: false,
    lightboxIndex: 0,
    lightboxSet: [],
    albumSelection: new Set(),
    userAlbums: []
  };

  /* ===========================================================
     ELEMENT REFS
     =========================================================== */
  const galleryEl   = document.getElementById('gallery');
  const filtersEl   = document.getElementById('filters');
  const railBtns    = document.querySelectorAll('.rail-btn');
  const accountNav  = document.getElementById('accountNav');
  const profileBtn  = document.getElementById('profileBtn');
  const avatarEl    = document.getElementById('avatar');

  const lightbox    = document.getElementById('lightbox');
  const lbImage     = document.getElementById('lbImage');
  const lbCaption   = document.getElementById('lbCaption');
  const lbClose     = document.getElementById('lbClose');
  const lbPrev      = document.getElementById('lbPrev');
  const lbNext      = document.getElementById('lbNext');

  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm     = document.getElementById('loginForm');
  const modalClose     = document.getElementById('modalClose');

  const dropzone    = document.getElementById('dropzone');
  const fileInput   = document.getElementById('fileInput');
  const importGrid  = document.getElementById('importGrid');
  const importCategorySelect = document.getElementById('importCategory');

  const smartAlbumStrip = document.getElementById('smartAlbumStrip');
  const reshuffleBtn    = document.getElementById('reshuffleBtn');
  const albumPickGrid   = document.getElementById('albumPickGrid');
  const albumForm       = document.getElementById('albumForm');
  const albumNameInput  = document.getElementById('albumName');
  const userAlbumsEl    = document.getElementById('userAlbums');

  const flashbackEl     = document.getElementById('flashback');
  const memoryGroupsEl  = document.getElementById('memoryGroups');

  const compareTableEl  = document.getElementById('compareTable');

  /* ===========================================================
     GALLERY
     =========================================================== */
  function renderGallery(){
    galleryEl.innerHTML = '';
    IMAGES.forEach((img, i) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      if (state.filter !== 'all' && img.category !== state.filter) tile.classList.add('is-hidden');
      tile.innerHTML = `
        <img src="${img.src}" alt="${img.title}" loading="lazy">
        <div class="tile-overlay"><span class="tag">${img.category}</span></div>
      `;
      tile.addEventListener('click', () => openLightbox(visibleImages(), visibleImages().indexOf(img)));
      galleryEl.appendChild(tile);
    });
  }

  function visibleImages(){
    return state.filter === 'all' ? IMAGES : IMAGES.filter(i => i.category === state.filter);
  }

  filtersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filtersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    state.filter = chip.dataset.filter;
    renderGallery();
  });

  /* ===========================================================
     LIGHTBOX
     =========================================================== */
  function openLightbox(set, index){
    state.lightboxSet = set;
    state.lightboxIndex = index;
    updateLightbox();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function updateLightbox(){
    const img = state.lightboxSet[state.lightboxIndex];
    if (!img) return;
    lbImage.style.animation = 'none';
    void lbImage.offsetWidth;
    lbImage.style.animation = '';
    lbImage.src = img.src;
    lbImage.alt = img.title;
    lbCaption.textContent = `${img.title} — ${img.category} — ${formatDate(img.date)}`;
  }
  function stepLightbox(dir){
    const len = state.lightboxSet.length;
    state.lightboxIndex = (state.lightboxIndex + dir + len) % len;
    updateLightbox();
  }
  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => stepLightbox(-1));
  lbNext.addEventListener('click', () => stepLightbox(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });

  /* ===========================================================
     NAVIGATION (rail buttons -> views)
     =========================================================== */
  function showView(name){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
    document.getElementById(`view-${name}`).classList.add('is-active');
    railBtns.forEach(b => b.classList.toggle('is-active', b.dataset.view === name));

    if (name === 'import') renderImportGrid();
    if (name === 'albums') { renderSmartAlbum(); renderAlbumPickGrid(); renderUserAlbums(); }
    if (name === 'memories') { renderFlashback(); renderMemoryGroups(); }
    if (name === 'about') renderCompareTable();
  }

  railBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (['import','albums','memories','about'].includes(view) && !state.isLoggedIn) {
        openLogin();
        return;
      }
      showView(view);
    });
  });

  /* ===========================================================
     LOGIN / ACCOUNT MENU
     =========================================================== */
  function openLogin(){
    loginOverlay.classList.add('is-open');
  }
  function closeLoginModal(){
    loginOverlay.classList.remove('is-open');
  }
  modalClose.addEventListener('click', closeLoginModal);
  loginOverlay.addEventListener('click', (e) => { if (e.target === loginOverlay) closeLoginModal(); });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('loginName').value.trim() || 'Guest';
    state.isLoggedIn = true;
    avatarEl.textContent = name.charAt(0).toUpperCase();
    profileBtn.classList.add('is-logged-in');
    profileBtn.title = name;
    accountNav.classList.add('is-open');
    closeLoginModal();
  });

  profileBtn.addEventListener('click', () => {
    if (!state.isLoggedIn) { openLogin(); return; }
    accountNav.classList.toggle('is-open');
  });

  /* ===========================================================
     IMPORT
     =========================================================== */
  function addImages(fileList){
    const category = importCategorySelect.value;
    [...fileList].forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        IMAGES.unshift({
          id: `import-${uid++}`,
          src: e.target.result,
          category,
          date: new Date(),
          title: file.name.replace(/\.[^.]+$/, '')
        });
        renderGallery();
        renderImportGrid();
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener('change', (e) => addImages(e.target.files));

  ['dragover','dragenter'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('is-drag'); })
  );
  ['dragleave','drop'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('is-drag'); })
  );
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) addImages(e.dataTransfer.files);
  });

  function renderImportGrid(){
    const recent = IMAGES.filter(i => i.id.startsWith('import-'));
    importGrid.innerHTML = recent.length
      ? recent.map(img => `
          <div class="thumb"><img src="${img.src}" alt="${img.title}"></div>
        `).join('')
      : '';
  }

  /* ===========================================================
     ALBUMS
     =========================================================== */
  function shuffledSample(arr, n){
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  function renderSmartAlbum(){
    const picks = shuffledSample(IMAGES, Math.min(8, IMAGES.length));
    smartAlbumStrip.innerHTML = picks.map(img => `<img src="${img.src}" alt="${img.title}">`).join('');
  }
  reshuffleBtn.addEventListener('click', renderSmartAlbum);

  function renderAlbumPickGrid(){
    albumPickGrid.innerHTML = IMAGES.map(img => `
      <div class="thumb ${state.albumSelection.has(img.id) ? 'is-selected' : ''}" data-id="${img.id}">
        <img src="${img.src}" alt="${img.title}">
      </div>
    `).join('');
    albumPickGrid.querySelectorAll('.thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const id = thumb.dataset.id;
        if (state.albumSelection.has(id)) state.albumSelection.delete(id);
        else state.albumSelection.add(id);
        thumb.classList.toggle('is-selected');
      });
    });
  }

  albumForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.albumSelection.size === 0) return;
    const cover = IMAGES.filter(i => state.albumSelection.has(i.id)).slice(0, 4);
    state.userAlbums.unshift({
      name: albumNameInput.value.trim(),
      count: state.albumSelection.size,
      cover
    });
    state.albumSelection.clear();
    albumNameInput.value = '';
    renderAlbumPickGrid();
    renderUserAlbums();
  });

  function renderUserAlbums(){
    if (state.userAlbums.length === 0) {
      userAlbumsEl.innerHTML = '<p class="empty-note">Nothing here yet — build one above.</p>';
      return;
    }
    userAlbumsEl.innerHTML = state.userAlbums.map(album => `
      <div class="album-card">
        <div class="album-cover">
          ${album.cover.map(img => `<img src="${img.src}" alt="">`).join('')}
        </div>
        <div class="album-meta">
          <strong>${album.name}</strong>
          <span>${album.count} photo${album.count === 1 ? '' : 's'}</span>
        </div>
      </div>
    `).join('');
  }

  /* ===========================================================
     MEMORIES
     =========================================================== */
  function formatDate(d){
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  }

  function renderFlashback(){
    const past = IMAGES.filter(i => (Date.now() - i.date.getTime()) > 1000*60*60*24*20);
    const pick = past.length ? past[Math.floor(Math.random() * past.length)] : IMAGES[0];
    if (!pick) { flashbackEl.innerHTML=''; return; }
    const daysBack = Math.round((Date.now() - pick.date.getTime()) / 86400000);
    flashbackEl.innerHTML = `
      <img src="${pick.src}" alt="${pick.title}">
      <div>
        <div class="fb-label">On this day</div>
        <h3>${pick.title}</h3>
        <p class="muted">${daysBack} days ago · ${formatDate(pick.date)}</p>
      </div>
    `;
  }

  function renderMemoryGroups(){
    const now = Date.now();
    const buckets = { 'This week': [], 'This month': [], 'This year': [], 'Earlier': [] };
    IMAGES.forEach(img => {
      const days = (now - img.date.getTime()) / 86400000;
      if (days <= 7) buckets['This week'].push(img);
      else if (days <= 31) buckets['This month'].push(img);
      else if (days <= 365) buckets['This year'].push(img);
      else buckets['Earlier'].push(img);
    });

    memoryGroupsEl.innerHTML = Object.entries(buckets)
      .filter(([, imgs]) => imgs.length)
      .map(([label, imgs]) => `
        <div class="memory-group">
          <h2>${label} <span>${imgs.length} photo${imgs.length === 1 ? '' : 's'}</span></h2>
          <div class="memory-grid">
            ${imgs.map(img => `<img src="${img.src}" alt="${img.title}" data-id="${img.id}">`).join('')}
          </div>
        </div>
      `).join('');

    memoryGroupsEl.querySelectorAll('img').forEach(el => {
      el.addEventListener('click', () => {
        const set = IMAGES;
        const idx = set.findIndex(i => i.id === el.dataset.id);
        openLightbox(set, idx);
      });
    });
  }

  /* ===========================================================
     ABOUT — comparison
     =========================================================== */
  const COMPARISON = [
    { label:'Smart auto-organization', mine:92, other:58 },
    { label:'Privacy — data stays on your device', mine:95, other:40 },
    { label:'Setup speed', mine:88, other:65 },
    { label:'Free storage before limits', mine:80, other:45 },
    { label:'Album creation flexibility', mine:90, other:60 }
  ];

  function renderCompareTable(){
    compareTableEl.innerHTML = COMPARISON.map(row => `
      <div class="compare-row">
        <div class="label">${row.label}</div>
        <div class="compare-bars">
          <div class="bar-line">
            <span class="who">Photominac</span>
            <div class="bar-track"><div class="bar-fill mine" data-w="${row.mine}"></div></div>
            <span class="pct">${row.mine}%</span>
          </div>
          <div class="bar-line">
            <span class="who">Typical app</span>
            <div class="bar-track"><div class="bar-fill other" data-w="${row.other}"></div></div>
            <span class="pct">${row.other}%</span>
          </div>
        </div>
      </div>
    `).join('');

    requestAnimationFrame(() => {
      compareTableEl.querySelectorAll('.bar-fill').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    });
  }

  /* ===========================================================
     INIT
     =========================================================== */
  renderGallery();
})();