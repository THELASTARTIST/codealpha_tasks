/* ==========================================================
   AUDIOPROCTOR
   Front-end demo: real playback works for files you import.
   Spotify / Apple Music / YouTube Music entries are shown as
   connected-source previews — wiring them to real playback
   requires each provider's OAuth + API credentials on a backend,
   which this static demo does not have.
   ========================================================== */

(() => {
  "use strict";

  /* ---------------- Helpers ---------------- */
  // uid() only works in secure contexts (https/localhost) and can
  // throw when this file is opened directly (file://) or served over plain http,
  // which would silently abort script execution before any buttons get wired up.
  function uid(){
    if (window.crypto && typeof window.crypto.randomUUID === "function"){
      try { return window.crypto.randomUUID(); } catch(e){ /* fall through */ }
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c=>{
      const r = Math.random()*16|0, v = c==="x" ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }

  /* ---------------- State ---------------- */
  const LS_KEY = "audioproctor_account_v1";

  const ARTISTS = ["Nova Bloom","The Aftertaste","Mono Static","Kilo Halcyon","Reverie Co.","Half Light","Glass Pilot","Echo Ridge"];

  function mk(titles){
    return titles.map(t => ({
      id: uid(),
      title: t,
      artist: ARTISTS[Math.floor(Math.random()*ARTISTS.length)],
      duration: 120 + Math.floor(Math.random()*140),
      source: "stream", // preview-only
      playable: false,
    }));
  }

  const DEMO_PLAYLISTS = {
    spotify: [
      { name: "Late Night Drive", tracks: mk(["Neon Skyline","Static & Gold","Slowburn","Pressure Points"]) },
      { name: "Gym Locked In",    tracks: mk(["Iron Pulse","Redline","No Days Off"]) },
    ],
    apple: [
      { name: "Sunday Reset",     tracks: mk(["Soft Focus","Paper Clouds","Low Tide"]) },
      { name: "Study Session",    tracks: mk(["Quiet Room","Margins","Glasswing"]) },
    ],
    ytmusic: [
      { name: "Discover Mix",     tracks: mk(["Overdrive","Blue Hour","Felt Sense","Afterglow"]) },
      { name: "Throwback Hits",   tracks: mk(["Rewind","Dial Tone","Analog Heart"]) },
    ],
  };

  // Freely redistributable demo audio (SoundHelix sample tracks), used so
  // guests and anyone without imports yet have something real to press play on.
  const SAMPLE_TRACKS = [
    { title:"Neon Skyline",  artist:"Sample Reel", url:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { title:"Slowburn",      artist:"Sample Reel", url:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { title:"Paper Clouds",  artist:"Sample Reel", url:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { title:"Afterglow",     artist:"Sample Reel", url:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
    { title:"Analog Heart",  artist:"Sample Reel", url:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  ].map(t => ({
    id: uid(),
    title: t.title,
    artist: t.artist,
    duration: 0,
    source: "sample",
    playable: true,
    url: t.url,
  }));

  const state = {
    account: null,          // { email, service }
    imported: [],           // playable local files
    queue: [],              // active queue (array of track refs)
    queueIndex: -1,
    shuffle: false,
    repeat: "off",          // off | all | one
    autoplay: true,
    volume: 0.7,
    muted: false,
    liked: new Set(),
  };

  /* ---------------- Element refs ---------------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const signinEl   = $("#signin");
  const appEl      = $("#app");
  const audioEl    = $("#audioEl");
  const toastEl    = $("#toast");

  /* ================= TOAST ================= */
  let toastTimer;
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove("show"), 2600);
  }

  /* ================= AUTH FLOW ================= */
  const linkModal = $("#linkModal");
  const demoEmailInput = $("#demoEmail");
  let pendingGoogle = false;

  $$(".oauth-btn").forEach(btn=>{
    btn.addEventListener("click", () => {
      const provider = btn.dataset.provider;
      if(provider === "google"){
        openLinkModal();
      } else {
        attemptLink(demoEmailInput.value || "you@gmail.com", provider);
      }
    });
  });

  function openLinkModal(){
    pendingGoogle = true;
    linkModal.classList.remove("hidden");
  }
  $("#modalCancel").addEventListener("click", ()=> linkModal.classList.add("hidden"));
  linkModal.addEventListener("click", (e)=>{ if(e.target === linkModal) linkModal.classList.add("hidden"); });

  $$(".modal-opt").forEach(opt=>{
    opt.addEventListener("click", ()=>{
      const service = opt.dataset.service;
      const email = demoEmailInput.value.trim() || "you@gmail.com";
      linkModal.classList.add("hidden");
      attemptLink(email, service);
    });
  });

  $("#guestBtn").addEventListener("click", ()=>{
    const account = { email: "Guest", service: "guest" };
    localStorage.setItem(LS_KEY, JSON.stringify(account));
    signIn(account);
  });

  function attemptLink(email, service){
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if(existing && existing.email === email && existing.service !== service){
      toast(`${email} is already linked to ${labelFor(existing.service)}. Sign out to switch services.`);
      return;
    }
    const account = { email, service };
    localStorage.setItem(LS_KEY, JSON.stringify(account));
    signIn(account);
  }

  function labelFor(service){
    return { spotify:"Spotify", apple:"Apple Music", ytmusic:"YouTube Music" }[service] || service;
  }

  function signIn(account){
    state.account = account;
    signinEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    renderAccount();
    renderSourcePlaylists();
    renderSampleTracks();
    renderHome();
    toast(account.service === "guest" ? "Browsing as guest · sample tracks loaded" : `Signed in · linked to ${labelFor(account.service)}`);
  }

  $("#signOutBtn").addEventListener("click", ()=>{
    audioEl.pause();
    state.account = null;
    localStorage.removeItem(LS_KEY);
    appEl.classList.add("hidden");
    signinEl.classList.remove("hidden");
  });

  // restore session
  (function restore(){
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if(existing){ signIn(existing); }
  })();

  function renderAccount(){
    const { email, service } = state.account;
    $("#accountAvatar").textContent = email.charAt(0).toUpperCase();
    $("#accountName").textContent = email;
    $("#accountService").textContent = service === "guest" ? "Browsing as guest" : `Linked · ${labelFor(service)}`;
  }

  /* ================= SIDEBAR ================= */
  const sidebar = $("#sidebar");
  $("#sidebarToggle").addEventListener("click", ()=> sidebar.classList.toggle("collapsed"));

  $$(".nav-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      $$(".nav-item").forEach(i=>i.classList.remove("active"));
      item.classList.add("active");
      showView(item.dataset.view);
    });
  });
  function showView(view){
    $$(".view").forEach(v=>v.classList.remove("active"));
    $("#view-"+view).classList.add("active");
    if(view === "about") animateCharts();
    if(view === "library") renderLibraryView();
  }

  $$(".source-head").forEach(head=>{
    head.addEventListener("click", ()=> head.parentElement.classList.toggle("open"));
  });

  function renderSourcePlaylists(){
    const myService = state.account.service; // "spotify" | "apple" | "ytmusic" | "guest"
    Object.entries(DEMO_PLAYLISTS).forEach(([source, playlists])=>{
      const group = $(`.source-group[data-source="${source}"]`);
      const list = group.querySelector(".source-list");
      list.innerHTML = "";
      const connected = source === myService;
      playlists.forEach(pl=>{
        const li = document.createElement("li");
        li.innerHTML = `<span>${pl.name}</span>${connected ? "" : '<svg class="lock" width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" stroke-width="1.6"/></svg>'}`;
        li.addEventListener("click", ()=>{
          if(connected) playPlaylist(pl, source);
          else if(myService === "guest") toast(`Sign in and link ${labelFor(source)} to play "${pl.name}" — guests get sample tracks + their own imports.`);
          else toast(`Link ${labelFor(source)} to play "${pl.name}" — you're currently linked to ${labelFor(myService)}.`);
        });
        list.appendChild(li);
      });
    });
    // auto-open the linked service's group (guests have none to open)
    const openGroup = $(`.source-group[data-source="${myService}"]`);
    if(openGroup) openGroup.classList.add("open");
  }

  function renderSampleTracks(){
    const list = $("#sampleList");
    list.innerHTML = "";
    SAMPLE_TRACKS.forEach(t=>{
      const li = document.createElement("li");
      li.textContent = t.title;
      li.addEventListener("click", ()=> playSingle(t, SAMPLE_TRACKS));
      list.appendChild(li);
      const probe = new Audio(t.url);
      probe.addEventListener("loadedmetadata", ()=>{ t.duration = probe.duration || 0; });
    });
  }

  /* ================= IMPORT ================= */
  const importBtn = $("#importBtn");
  const fileInput = $("#fileInput");
  importBtn.addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", (e)=>{
    const files = Array.from(e.target.files);
    files.forEach(file=>{
      const url = URL.createObjectURL(file);
      const track = {
        id: uid(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Imported file",
        duration: 0,
        source: "import",
        playable: true,
        url,
      };
      state.imported.push(track);
      const probe = new Audio(url);
      probe.addEventListener("loadedmetadata", ()=>{
        track.duration = probe.duration || 0;
        renderImportedList();
        renderHome();
      });
    });
    renderImportedList();
    renderHome();
    toast(`Imported ${files.length} track${files.length>1?"s":""}`);
    fileInput.value = "";
  });

  function renderImportedList(){
    const list = $("#importedList");
    list.innerHTML = "";
    if(state.imported.length === 0){
      list.innerHTML = `<li class="empty-hint">No imports yet — add local files to play them here.</li>`;
      return;
    }
    state.imported.forEach(t=>{
      const li = document.createElement("li");
      li.textContent = t.title;
      li.addEventListener("click", ()=> playSingle(t, state.imported));
      list.appendChild(li);
    });
  }

  /* ================= HOME / LIBRARY / SEARCH RENDER ================= */
  function trackCardHTML(t){
    let badge;
    if(t.source === "import") badge = "IMPORT";
    else if(t.source === "sample") badge = "SAMPLE";
    else badge = labelFor(state.account.service).toUpperCase();
    return `
      <div class="track-card" data-id="${t.id}">
        <div class="badge">${badge}</div>
        <div class="cover" style="background:${coverGradient(t.title)}">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l11-2v13" stroke="rgba(255,255,255,.75)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" stroke="rgba(255,255,255,.75)" stroke-width="1.6"/><circle cx="17.5" cy="16" r="2.5" stroke="rgba(255,255,255,.75)" stroke-width="1.6"/></svg>
          <div class="play-overlay">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M7 4.5v15l13-7.5-13-7.5z"/></svg>
          </div>
        </div>
        <div class="t-title">${escapeHTML(t.title)}</div>
        <div class="t-artist">${escapeHTML(t.artist)}</div>
      </div>`;
  }

  function coverGradient(seed){
    const palettes = [
      "linear-gradient(135deg,#7C5CFC,#FF3D9A)",
      "linear-gradient(135deg,#33F0C8,#7C5CFC)",
      "linear-gradient(135deg,#C24CFF,#33F0C8)",
      "linear-gradient(135deg,#FF3D9A,#C24CFF)",
    ];
    let hash = 0;
    for(const c of seed) hash = (hash*31 + c.charCodeAt(0)) % 997;
    return palettes[hash % palettes.length];
  }

  function escapeHTML(s){
    return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }

  function renderHome(){
    $("#homeGreeting").textContent = state.imported.length
      ? "Pick up where you left off"
      : state.account.service === "guest"
        ? "Press play — here's a starter reel while you're browsing"
        : "Let's find your next favorite track";

    const sampleGrid = $("#sampleGrid");
    sampleGrid.innerHTML = SAMPLE_TRACKS.map(trackCardHTML).join("");
    bindCardClicks(sampleGrid, SAMPLE_TRACKS);

    const importGrid = $("#importGrid");
    importGrid.innerHTML = state.imported.length
      ? state.imported.map(trackCardHTML).join("")
      : `<p style="color:var(--text-faint);font-size:13.5px;">Nothing imported yet — use "Import music" in the sidebar.</p>`;

    const sourceGrid = $("#sourceGrid");
    const myTracks = (DEMO_PLAYLISTS[state.account.service] || []).flatMap(p=>p.tracks);
    sourceGrid.innerHTML = myTracks.length
      ? myTracks.map(trackCardHTML).join("")
      : `<p style="color:var(--text-faint);font-size:13.5px;">${state.account.service === "guest" ? "Sign in and link Spotify, Apple Music, or YouTube Music to see their playlists here." : "No playlists found."}</p>`;

    bindCardClicks(importGrid, state.imported);
    bindCardClicks(sourceGrid, myTracks);
  }

  function bindCardClicks(container, list){
    container.querySelectorAll(".track-card").forEach(card=>{
      card.addEventListener("click", ()=>{
        const t = list.find(x=>x.id === card.dataset.id);
        if(t) playSingle(t, list);
      });
    });
  }

  function trackRowHTML(t, i){
    let src;
    if(t.source === "import") src = "Import";
    else if(t.source === "sample") src = "Sample";
    else src = labelFor(state.account.service);
    return `
      <li class="track-row" data-id="${t.id}">
        <span class="row-index">${i+1}</span>
        <div class="row-cover" style="background:${coverGradient(t.title)}"></div>
        <div class="row-meta">
          <span class="row-title">${escapeHTML(t.title)}</span>
          <span class="row-artist">${escapeHTML(t.artist)}</span>
        </div>
        <span class="row-src">${src}</span>
        <span class="row-dur">${t.duration ? formatTime(t.duration) : "—"}</span>
      </li>`;
  }

  function renderLibraryView(){
    const all = [...SAMPLE_TRACKS, ...state.imported, ...((DEMO_PLAYLISTS[state.account.service]||[]).flatMap(p=>p.tracks))];
    const list = $("#libraryList");
    list.innerHTML = all.map(trackRowHTML).join("");
    list.querySelectorAll(".track-row").forEach(row=>{
      row.addEventListener("click", ()=>{
        const t = all.find(x=>x.id === row.dataset.id);
        if(t) playSingle(t, all);
      });
    });
  }

  /* Search */
  const searchInput = $("#searchInput");
  searchInput.addEventListener("input", ()=>{
    const q = searchInput.value.trim().toLowerCase();
    const all = [...SAMPLE_TRACKS, ...state.imported, ...Object.values(DEMO_PLAYLISTS).flat().flatMap(p=>p.tracks)];
    const results = q ? all.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) : [];
    const el = $("#searchResults");
    el.innerHTML = results.map(trackRowHTML).join("");
    el.querySelectorAll(".track-row").forEach(row=>{
      row.addEventListener("click", ()=>{
        const t = results.find(x=>x.id === row.dataset.id);
        if(t) playSingle(t, results);
      });
    });
  });

  /* ================= PLAYER ENGINE ================= */
  const playBtn = $("#playBtn"), playIcon = $("#playIcon"), pauseIcon = $("#pauseIcon");
  const prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn");
  const shuffleBtn = $("#shuffleBtn"), repeatBtn = $("#repeatBtn"), autoplayBtn = $("#autoplayBtn");
  const seekBar = $("#seekBar"), volumeBar = $("#volumeBar"), muteBtn = $("#muteBtn"), volIcon = $("#volIcon");
  const timeCurrent = $("#timeCurrent"), timeTotal = $("#timeTotal");
  const playerTitle = $("#playerTitle"), playerArtist = $("#playerArtist"), playerArt = $("#playerArt");
  const eq = $("#eq"), likeBtn = $("#likeBtn");
  const queueBtn = $("#queueBtn"), queueDrawer = $("#queueDrawer"), queueClose = $("#queueClose"), queueList = $("#queueList");

  autoplayBtn.classList.add("on"); // default on

  function playSingle(track, listContext){
    state.queue = listContext.slice();
    state.queueIndex = state.queue.findIndex(t=>t.id===track.id);
    loadAndPlay(track);
    renderQueue();
  }

  function playPlaylist(playlist, source){
    state.queue = playlist.tracks.slice();
    state.queueIndex = 0;
    loadAndPlay(state.queue[0]);
    renderQueue();
  }

  function loadAndPlay(track){
    if(!track.playable){
      toast(`"${track.title}" is a connected-source preview. Real streaming needs ${labelFor(state.account.service)}'s API credentials on a backend.`);
      showTrackMeta(track, false);
      return;
    }
    showTrackMeta(track, true);
    audioEl.src = track.url;
    audioEl.play().catch(()=>{});
    highlightPlayingCards(track.id);
  }

  function showTrackMeta(track, playable){
    playerTitle.textContent = track.title;
    playerArtist.textContent = track.artist;
    playerArt.style.background = playable ? coverGradient(track.title) : "";
    playerArt.classList.toggle("has-art", true);
  }

  function highlightPlayingCards(id){
    $$(".track-card").forEach(c=>c.classList.toggle("playing", c.dataset.id===id));
    $$(".track-row").forEach(r=>r.classList.toggle("playing", r.dataset.id===id));
    $$("#queueList .track-row").forEach(r=>r.classList.toggle("playing", r.dataset.id===id));
  }

  playBtn.addEventListener("click", ()=>{
    if(!audioEl.src){ toast("Pick a track from your library first."); return; }
    if(audioEl.paused) audioEl.play(); else audioEl.pause();
  });

  audioEl.addEventListener("play", ()=>{
    playIcon.style.display="none"; pauseIcon.style.display="";
    eq.classList.add("playing");
  });
  audioEl.addEventListener("pause", ()=>{
    playIcon.style.display=""; pauseIcon.style.display="none";
    eq.classList.remove("playing");
  });

  audioEl.addEventListener("timeupdate", ()=>{
    if(!audioEl.duration) return;
    const pct = (audioEl.currentTime/audioEl.duration)*100;
    seekBar.value = pct;
    seekBar.style.setProperty("--val", pct+"%");
    timeCurrent.textContent = formatTime(audioEl.currentTime);
    timeTotal.textContent = formatTime(audioEl.duration);
  });
  seekBar.addEventListener("input", ()=>{
    if(audioEl.duration) audioEl.currentTime = (seekBar.value/100)*audioEl.duration;
  });

  audioEl.addEventListener("ended", ()=>{
    if(state.repeat === "one"){ audioEl.currentTime=0; audioEl.play(); return; }
    if(state.autoplay) goNext(true);
  });

  function goNext(fromEnded=false){
    if(state.queue.length===0) return;
    let idx = state.queueIndex;
    if(state.shuffle){
      idx = Math.floor(Math.random()*state.queue.length);
    } else {
      idx += 1;
      if(idx >= state.queue.length){
        if(state.repeat === "all") idx = 0;
        else { if(!fromEnded) toast("End of queue"); return; }
      }
    }
    state.queueIndex = idx;
    loadAndPlay(state.queue[idx]);
    renderQueue();
  }
  function goPrev(){
    if(state.queue.length===0) return;
    if(audioEl.currentTime > 4){ audioEl.currentTime = 0; return; }
    let idx = state.queueIndex - 1;
    if(idx < 0) idx = state.repeat==="all" ? state.queue.length-1 : 0;
    state.queueIndex = idx;
    loadAndPlay(state.queue[idx]);
    renderQueue();
  }
  nextBtn.addEventListener("click", ()=>goNext(false));
  prevBtn.addEventListener("click", goPrev);

  shuffleBtn.addEventListener("click", ()=>{
    state.shuffle = !state.shuffle;
    shuffleBtn.classList.toggle("on", state.shuffle);
    toast(state.shuffle ? "Shuffle on" : "Shuffle off");
  });
  repeatBtn.addEventListener("click", ()=>{
    state.repeat = state.repeat==="off" ? "all" : state.repeat==="all" ? "one" : "off";
    repeatBtn.classList.toggle("on", state.repeat!=="off");
    toast("Repeat: " + state.repeat);
  });
  autoplayBtn.addEventListener("click", ()=>{
    state.autoplay = !state.autoplay;
    autoplayBtn.classList.toggle("on", state.autoplay);
    toast(state.autoplay ? "Autoplay on" : "Autoplay off");
  });

  volumeBar.addEventListener("input", ()=>{
    state.volume = volumeBar.value/100;
    audioEl.volume = state.volume;
    volumeBar.style.setProperty("--val", volumeBar.value+"%");
    state.muted = false;
    updateVolIcon();
  });
  muteBtn.addEventListener("click", ()=>{
    state.muted = !state.muted;
    audioEl.muted = state.muted;
    updateVolIcon();
  });
  function updateVolIcon(){
    volIcon.style.opacity = state.muted || state.volume===0 ? 0.4 : 1;
  }
  audioEl.volume = state.volume;
  volumeBar.style.setProperty("--val","70%");

  likeBtn.addEventListener("click", ()=>{
    likeBtn.classList.toggle("active");
  });

  queueBtn.addEventListener("click", ()=> queueDrawer.classList.toggle("open"));
  queueClose.addEventListener("click", ()=> queueDrawer.classList.remove("open"));

  function renderQueue(){
    queueList.innerHTML = state.queue.map((t,i)=>trackRowHTML(t,i)).join("");
    highlightPlayingCards(state.queue[state.queueIndex]?.id);
    queueList.querySelectorAll(".track-row").forEach((row,i)=>{
      row.addEventListener("click", ()=>{
        state.queueIndex = i;
        loadAndPlay(state.queue[i]);
        renderQueue();
      });
    });
  }

  $("#shuffleAllBtn").addEventListener("click", ()=>{
    const all = [...SAMPLE_TRACKS, ...state.imported, ...(DEMO_PLAYLISTS[state.account.service]||[]).flatMap(p=>p.tracks)];
    if(all.length===0){ toast("Nothing to shuffle yet."); return; }
    state.shuffle = true;
    shuffleBtn.classList.add("on");
    state.queue = all;
    state.queueIndex = Math.floor(Math.random()*all.length);
    loadAndPlay(state.queue[state.queueIndex]);
    renderQueue();
  });

  function formatTime(sec){
    if(!isFinite(sec)) return "0:00";
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return `${m}:${s.toString().padStart(2,"0")}`;
  }

  /* ================= ABOUT CHARTS ================= */
  let chartsBuilt = false;
  function animateCharts(){
    buildBarChart();
    buildCompareChart();
    buildLineChart();
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        $$(".bar-fill").forEach(el=> el.style.height = el.dataset.h);
        $$(".c-fill").forEach(el=> el.style.width = el.dataset.w);
      });
    });
  }

  function buildBarChart(){
    const el = $("#barChart");
    if(el.dataset.built) { el.querySelectorAll(".bar-fill").forEach(b=>b.style.height=0); requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll(".bar-fill").forEach(b=>b.style.height=b.dataset.h))); return; }
    const data = [
      { label:"Streaming app", pct:46 },
      { label:"Local files",   pct:24 },
      { label:"Downloads",     pct:18 },
      { label:"Other apps",    pct:12 },
    ];
    el.innerHTML = data.map(d=>`
      <div class="bar-col">
        <div class="bar-fill" data-h="${d.pct}%" style="height:0"></div>
        <span class="bar-pct">${d.pct}%</span>
        <span class="bar-label">${d.label}</span>
      </div>`).join("");
    el.dataset.built = "1";
  }

  function buildCompareChart(){
    const el = $("#compareChart");
    const rows = [
      { label:"Cross-platform playlists", us:95, them:20 },
      { label:"Local file import",        us:100, them:10 },
      { label:"Unified queue",            us:90, them:15 },
      { label:"One-account clarity",      us:85, them:55 },
    ];
    if(!el.dataset.built){
      el.innerHTML = rows.map(r=>`
        <div class="compare-row">
          <span class="c-label">${r.label}</span>
          <div class="c-track">
            <div class="c-fill them" data-w="${r.them}%" style="width:0"></div>
          </div>
        </div>`).join("") + `<div class="compare-legend"><span><span class="legend-dot us"></span>AUDIOPROCTOR</span><span><span class="legend-dot them"></span>Typical single-service app</span></div>`;
      // add "us" fills as an overlay pass (drawn after, on top, offset)
      el.querySelectorAll(".compare-row").forEach((row,i)=>{
        const usFill = document.createElement("div");
        usFill.className = "c-fill us";
        usFill.dataset.w = rows[i].us + "%";
        usFill.style.width = "0";
        usFill.style.opacity = "0.9";
        row.querySelector(".c-track").appendChild(usFill);
      });
      el.dataset.built = "1";
    } else {
      el.querySelectorAll(".c-fill").forEach(f=> f.style.width = "0");
    }
  }

  function buildLineChart(){
    const svg = $("#lineChart");
    const points = [62,68,71,75,80,88,94]; // % continuity across a week
    const w=320,h=140,pad=14;
    const stepX = (w-pad*2)/(points.length-1);
    const maxY=100;
    const coords = points.map((p,i)=>[pad+i*stepX, h-pad-((p/maxY)*(h-pad*2))]);
    const linePath = coords.map((c,i)=> (i===0?"M":"L")+c[0].toFixed(1)+","+c[1].toFixed(1)).join(" ");
    const areaPath = linePath + ` L${coords[coords.length-1][0]},${h-pad} L${coords[0][0]},${h-pad} Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#33F0C8"/>
          <stop offset="100%" stop-color="#7C5CFC"/>
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7C5CFC" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#7C5CFC" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="line-area" d="${areaPath}" style="opacity:0"></path>
      <path class="line-path" d="${linePath}" style="stroke-dasharray:600; stroke-dashoffset:600;"></path>
      ${coords.map(c=>`<circle class="line-dot" cx="${c[0]}" cy="${c[1]}" r="3" style="opacity:0"></circle>`).join("")}
    `;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const path = svg.querySelector(".line-path");
        path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)";
        path.style.strokeDashoffset = "0";
        svg.querySelector(".line-area").style.transition = "opacity 1s ease .3s";
        svg.querySelector(".line-area").style.opacity = "1";
        svg.querySelectorAll(".line-dot").forEach((d,i)=>{
          d.style.transition = `opacity .4s ease ${0.2+i*0.12}s`;
          d.style.opacity = "1";
        });
      });
    });
  }

  /* Build initial imported list state */
  renderImportedList();
})();