/* ============================================================================
   ZENQUIZ HUB - COMPLETE OFFLINE ENGINE FOR ALL 41 MODES & 32 CATEGORIES
   ============================================================================ */

const State = {
  lang: localStorage.getItem("zq_lang") || "en",
  theme: localStorage.getItem("zq_theme") || "light",
  sound: localStorage.getItem("zq_sound") !== "off",
  xp: parseInt(localStorage.getItem("zq_xp") || "0", 10),
  streak: parseInt(localStorage.getItem("zq_streak") || "0", 10),
  favorites: JSON.parse(localStorage.getItem("zq_favs") || "[]"),
  highScores: JSON.parse(localStorage.getItem("zq_scores") || "{}"),
  hubFilter: "all",
  searchQuery: "",
  diff: "easy",
  qtype: "mix",
  activeMode: null,
  score: 0,
  timerId: null
};

/* GENTLE WEB AUDIO SYNTHESIZER (NO EXTERNAL MP3 REQUIRED) */
function playCalmTone(type) {
  if (!State.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    if (type === "good") {
      osc.frequency.setValueAtTime(528, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
    } else if (type === "tap") {
      osc.frequency.setValueAtTime(440, now);
    } else {
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.2);
    }
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.25);
  } catch (e) {}
}

function saveState() {
  localStorage.setItem("zq_lang", State.lang);
  localStorage.setItem("zq_theme", State.theme);
  localStorage.setItem("zq_sound", State.sound ? "on" : "off");
  localStorage.setItem("zq_xp", String(State.xp));
  localStorage.setItem("zq_streak", String(State.streak));
  localStorage.setItem("zq_favs", JSON.stringify(State.favorites));
  localStorage.setItem("zq_scores", JSON.stringify(State.highScores));
  updateHeaderStats();
}

function addPoints(pts) {
  State.score += pts;
  State.xp += Math.max(5, Math.round(pts / 2));
  State.streak += 1;
  if (State.activeMode) {
    const prev = State.highScores[State.activeMode] || 0;
    if (State.score > prev) State.highScores[State.activeMode] = State.score;
  }
  saveState();
  const el = document.getElementById("stageScore");
  if (el) el.textContent = `${t("score")}: ${State.score}`;
}

function t(key) {
  return (window.I18N[State.lang] && window.I18N[State.lang][key]) || window.I18N.en[key] || key;
}

function tr(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[State.lang] || obj.en || "";
}

function updateHeaderStats() {
  const lv = Math.floor(State.xp / 100) + 1;
  document.getElementById("statLevel").textContent = `Lv ${lv}`;
  document.getElementById("statXP").textContent = State.xp;
  document.getElementById("statStreak").textContent = State.streak;
}

function applyLanguageAndTheme() {
  document.documentElement.lang = State.lang;
  document.documentElement.dir = State.lang === "ar" ? "rtl" : "ltr";
  document.body.className = State.theme === "dark" ? "theme-dark" : "theme-light";

  const mapIds = {
    appTitle: "appTitle", appSubtitle: "appSubtitle", heroWelcome: "heroWelcome",
    heroDesc: "heroDesc", btnQuickPlay: "quickPlay", chipAll: "chipAll",
    chipFavFirst: "chipFavFirst", chipFavOnly: "chipFavOnly", chipSpeed: "chipSpeed",
    chipWord: "chipWord", chipGuess: "chipGuess", chipGeo: "chipGeo",
    chipLogic: "chipLogic", chipAdv: "chipAdv", catHeaderTitle: "catHeaderTitle",
    catHeaderSub: "catHeaderSub", lblDiff: "lblDiff", btnEasy: "easy",
    btnMedium: "medium", btnHard: "hard", lblQType: "lblQType",
    qtMix: "qtMix", qtMcq: "qtMcq", qtTf: "qtTf", qtBlank: "qtBlank",
    qtTyped: "qtTyped", qtMatch: "qtMatch", qtOrder: "qtOrder", qtOdd: "qtOdd",
    statsTitle: "statsTitle", statsSub: "statsSub", highScoresTitle: "highScoresTitle",
    settingsTitle: "settingsTitle", settingsSub: "settingsSub",
    navHub: "navHub", navCats: "navCats", navStats: "navStats", navSettings: "navSettings",
    lblBack: "back"
  };
  Object.keys(mapIds).forEach(id => {
    const node = document.getElementById(id);
    if (node) node.textContent = t(mapIds[id]);
  });
  const searchInput = document.getElementById("searchModes");
  if (searchInput) searchInput.placeholder = t("searchPlaceholder");
  document.getElementById("btnToggleSound").textContent = State.sound ? "🔊 Sound: ON" : "🔇 Sound: OFF";

  renderModesHub();
  renderCategories();
  renderStats();
}

/* RENDER 41 MODES HUB WITH FAVORITES SORT/FILTER */
function renderModesHub() {
  const grid = document.getElementById("modesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  let list = window.GAME_MODES.slice();

  if (State.searchQuery) {
    const q = State.searchQuery.toLowerCase();
    list = list.filter(m => tr(m.title).toLowerCase().includes(q) || tr(m.desc).toLowerCase().includes(q));
  }
  if (State.hubFilter === "fav_only") {
    list = list.filter(m => State.favorites.includes(m.id));
  } else if (["speed", "word", "guess", "geo", "logic", "adventure"].includes(State.hubFilter)) {
    list = list.filter(m => m.group === State.hubFilter);
  }
  if (State.hubFilter === "fav_first") {
    list.sort((a, b) => (State.favorites.includes(b.id) ? 1 : 0) - (State.favorites.includes(a.id) ? 1 : 0));
  }

  list.forEach(mode => {
    const isFav = State.favorites.includes(mode.id);
    const hi = State.highScores[mode.id] || 0;
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="card-top">
        <div class="card-icon">${mode.icon}</div>
        <button class="fav-btn" aria-label="Favorite">${isFav ? "❤️" : "🤍"}</button>
      </div>
      <div>
        <h3>${tr(mode.title)}</h3>
        <p>${tr(mode.desc)}</p>
      </div>
      <span class="card-badge">★ ${hi}</span>
    `;
    card.querySelector(".fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      playCalmTone("tap");
      const idx = State.favorites.indexOf(mode.id);
      if (idx >= 0) State.favorites.splice(idx, 1);
      else State.favorites.push(mode.id);
      saveState();
      renderModesHub();
    });
    card.addEventListener("click", () => startMode(mode.id, tr(mode.title)));
    grid.appendChild(card);
  });
}

/* RENDER 32 CATEGORIES */
function renderCategories() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  window.CATEGORIES.forEach(cat => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="card-top">
        <div class="card-icon">${cat.icon}</div>
        <span class="card-badge">${t(State.diff)}</span>
      </div>
      <div>
        <h3>${tr(cat.name)}</h3>
        <p>${t("qt" + State.qtype.charAt(0).toUpperCase() + State.qtype.slice(1)) || ""}</p>
      </div>
    `;
    card.addEventListener("click", () => startCategoryQuiz(cat.id, tr(cat.name)));
    grid.appendChild(card);
  });
}

/* RENDER PROGRESS & HIGH SCORES */
function renderStats() {
  const ov = document.getElementById("statsOverview");
  const list = document.getElementById("highScoresList");
  if (!ov || !list) return;
  const lv = Math.floor(State.xp / 100) + 1;
  ov.innerHTML = `
    <div class="score-row"><strong>⭐ Level</strong><span>${lv} (${State.xp} XP)</span></div>
    <div class="score-row"><strong>🔥 Answer Streak</strong><span>${State.streak}</span></div>
    <div class="score-row"><strong>❤️ Favorite Games</strong><span>${State.favorites.length}</span></div>
  `;
  list.innerHTML = "";
  window.GAME_MODES.forEach(m => {
    const sc = State.highScores[m.id] || 0;
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<span>${m.icon} ${tr(m.title)}</span><strong>${sc} pts</strong>`;
    list.appendChild(row);
  });
}

function clearStageTimer() {
  if (State.timerId) {
    clearInterval(State.timerId);
    State.timerId = null;
  }
  const tEl = document.getElementById("stageTimer");
  if (tEl) tEl.textContent = "∞";
}

function startCountdown(seconds, onExpire) {
  clearStageTimer();
  let rem = seconds;
  const tEl = document.getElementById("stageTimer");
  tEl.textContent = `⏱️ ${rem}s`;
  State.timerId = setInterval(() => {
    rem -= 1;
    tEl.textContent = `⏱️ ${rem}s`;
    if (rem <= 0) {
      clearStageTimer();
      if (onExpire) onExpire();
    }
  }, 1000);
}

function openStage(id, titleText) {
  clearStageTimer();
  State.activeMode = id;
  State.score = 0;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("viewStage").classList.add("active");
  document.getElementById("stageTitle").textContent = titleText;
  document.getElementById("stageScore").textContent = `${t("score")}: 0`;
  playCalmTone("tap");
}

function pickQuestionsForCategory(catId, diff) {
  let pool = window.QUESTION_BANK.filter(q => (!catId || q.cat === catId) && (!diff || q.diff === diff));
  if (pool.length === 0) pool = window.QUESTION_BANK.filter(q => !catId || q.cat === catId);
  if (pool.length === 0) pool = window.QUESTION_BANK.slice();
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================================
   7 QUESTION TYPES ENGINE (MCQ, TF, BLANK, TYPED, MATCH, ORDER, ODD ONE OUT)
   ============================================================================ */
function startCategoryQuiz(catId, catName) {
  openStage("cat_" + catId, catName);
  renderNextCategoryQuestion(catId);
}

function renderNextCategoryQuestion(catId) {
  const stage = document.getElementById("stageBody");
  const item = pickQuestionsForCategory(catId, State.diff);
  const types = ["mcq", "tf", "blank", "typed", "match", "order", "odd"];
  const chosenType = State.qtype === "mix" ? types[Math.floor(Math.random() * types.length)] : State.qtype;

  const qText = tr(item.q);
  const ansText = tr(item.a);
  const opts = (item.opts[State.lang] || item.opts.en).slice();

  if (chosenType === "mcq") {
    const shuffled = opts.slice().sort(() => Math.random() - 0.5);
    stage.innerHTML = `
      <div class="q-sub">${t("qtMcq")} · ${t(State.diff)}</div>
      <div class="q-prompt">${qText}</div>
      <div class="options-list" id="optBox"></div>
      <div id="fbBox"></div>
    `;
    const box = document.getElementById("optBox");
    shuffled.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";
      btn.textContent = opt;
      btn.onclick = () => handleAnswerResult(opt === ansText, ansText, () => renderNextCategoryQuestion(catId), btn);
      box.appendChild(btn);
    });
  } else if (chosenType === "tf") {
    const showTrue = Math.random() > 0.5;
    const shownAns = showTrue ? ansText : opts.find(o => o !== ansText) || opts[1];
    stage.innerHTML = `
      <div class="q-sub">${t("qtTf")}</div>
      <div class="q-prompt">${qText}<br/><span style="color:var(--primary)">“${shownAns}”</span></div>
      <div class="options-list">
        <button class="opt-btn" id="btnT">✅ ${t("trueWord")}</button>
        <button class="opt-btn" id="btnF">❌ ${t("falseWord")}</button>
      </div>
      <div id="fbBox"></div>
    `;
    document.getElementById("btnT").onclick = (e) => handleAnswerResult(showTrue === true, ansText, () => renderNextCategoryQuestion(catId), e.target);
    document.getElementById("btnF").onclick = (e) => handleAnswerResult(showTrue === false, ansText, () => renderNextCategoryQuestion(catId), e.target);
  } else if (chosenType === "blank") {
    const masked = ansText.split("").map((ch, i) => (i === 0 || ch === " " ? ch : "_")).join(" ");
    stage.innerHTML = `
      <div class="q-sub">${t("qtBlank")}</div>
      <div class="q-prompt">${qText}</div>
      <div class="q-Prompt" style="letter-spacing:3px;text-align:center;font-size:22px;margin-bottom:14px;">${masked}</div>
      <div class="options-list" id="optBox"></div>
      <div id="fbBox"></div>
    `;
    const box = document.getElementById("optBox");
    opts.slice().sort(() => Math.random() - 0.5).forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";
      btn.textContent = opt;
      btn.onclick = () => handleAnswerResult(opt === ansText, ansText, () => renderNextCategoryQuestion(catId), btn);
      box.appendChild(btn);
    });
  } else if (chosenType === "typed") {
    stage.innerHTML = `
      <div class="q-sub">${t("qtTyped")} (${ansText.charAt(0)}...)</div>
      <div class="q-prompt">${qText}</div>
      <input type="text" id="typedIn" class="search-input" placeholder="..." />
      <button class="btn-primary" id="btnSubTyped" style="width:100%">${t("checkBtn")}</button>
      <div id="fbBox"></div>
    `;
    document.getElementById("btnSubTyped").onclick = () => {
      const val = document.getElementById("typedIn").value.trim().toLowerCase();
      const ok = val === ansText.toLowerCase() || (val.length >= 3 && ansText.toLowerCase().includes(val));
      handleAnswerResult(ok, ansText, () => renderNextCategoryQuestion(catId));
    };
  } else if (chosenType === "match") {
    renderCapitalMatchMode(stage, () => renderNextCategoryQuestion(catId));
  } else if (chosenType === "order") {
    renderTimelineSortMode(stage, () => renderNextCategoryQuestion(catId));
  } else {
    renderOddOneOutMode(stage, () => renderNextCategoryQuestion(catId));
  }
}

function handleAnswerResult(isCorrect, correctText, nextCallback, btnEl) {
  if (btnEl) btnEl.classList.add(isCorrect ? "correct" : "wrong");
  if (isCorrect) {
    playCalmTone("good");
    addPoints(20);
  } else {
    playCalmTone("miss");
    State.streak = 0;
    saveState();
  }
  const fb = document.getElementById("fbBox");
  if (fb) {
    fb.innerHTML = `
      <div class="feedback-banner">
        <div>${isCorrect ? t("correctMsg") : t("wrongMsg") + correctText}</div>
        <button class="btn-primary" style="margin-top:10px" id="btnNextQ">${t("nextBtn")}</button>
      </div>
    `;
    document.getElementById("btnNextQ").onclick = nextCallback;
  }
}

/* ============================================================================
   ALL 41 GAME MODES DISPATCHER & INTERACTIVE HANDLERS
   ============================================================================ */
function startMode(modeId, titleText) {
  openStage(modeId, titleText);
  const stage = document.getElementById("stageBody");

  switch (modeId) {
    case "timed_blitz": return runTimedBlitz(stage);
    case "unscramble_geo": return runUnscramble(stage, true);
    case "tf_rush": return runTfRush(stage);
    case "speed_tap": return runSpeedTap(stage);
    case "category_blitz": return runCategoryBlitz(stage);
    case "spelling_bee": return runSpellingBee(stage);
    case "unscramble_words": return runUnscramble(stage, false);
    case "wordle_theme": return runWordle(stage);
    case "hangman": return runHangman(stage);
    case "missing_letters": return runMissingLetters(stage);
    case "word_search": return runWordSearch(stage);
    case "mini_crossword": return runMiniCrossword(stage);
    case "anagram_chain": return runAnagramChain(stage);
    case "guess_person": return runGuessPerson(stage, false);
    case "guess_vs_bot": return runGuessPerson(stage, true);
    case "guess_zoom": return runGuessZoom(stage);
    case "guess_movie_emoji": return runMovieEmoji(stage);
    case "guess_silhouette": return runSilhouette(stage);
    case "guess_footballer": return runFootballer(stage);
    case "pixel_clear": return runPixelClear(stage);
    case "color_guess": return runColorGuess(stage);
    case "who_am_i": return runWhoAmI(stage);
    case "map_click": return runMapClick(stage);
    case "border_guess": return runBorderGuess(stage);
    case "capital_match": return renderCapitalMatchMode(stage, () => startMode(modeId, titleText));
    case "geo_higher_lower": return runHigherLower(stage, true);
    case "distance_guess": return runDistanceGuess(stage);
    case "stat_higher_lower": return runHigherLower(stage, false);
    case "compare_two": return runHigherLower(stage, false);
    case "odd_one_out": return renderOddOneOutMode(stage, () => startMode(modeId, titleText));
    case "timeline_sort": return renderTimelineSortMode(stage, () => startMode(modeId, titleText));
    case "match_pairs": return runMatchPairs(stage);
    case "connections": return runConnections(stage);
    case "number_puzzles": return runNumberPuzzles(stage);
    case "time_travel": return runTimeTravel(stage);
    case "escape_room": return runEscapeRoom(stage);
    case "treasure_hunt": return runTreasureHunt(stage);
    case "spot_difference": return runSpotDifference(stage);
    case "millionaire": return runMillionaire(stage);
    case "jeopardy": return runJeopardy(stage);
    case "true_or_fake": return runTrueOrFake(stage);
    default: return renderNextCategoryQuestion("general");
  }
}

/* 1. TIMED BLITZ (60s) */
function runTimedBlitz(stage) {
  startCountdown(60, () => {
    stage.innerHTML = `<div class="q-prompt">⏱️ Time Up!</div><div class="feedback-banner">${t("score")}: ${State.score}</div>`;
  });
  const nextQ = () => {
    const item = pickQuestionsForCategory(null, null);
    const ans = tr(item.a);
    const opts = (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5);
    stage.innerHTML = `<div class="q-prompt">${tr(item.q)}</div><div class="options-list" id="blitzOpts"></div>`;
    opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        if (o === ans) { playCalmTone("good"); addPoints(15); } else playCalmTone("miss");
        nextQ();
      };
      document.getElementById("blitzOpts").appendChild(b);
    });
  };
  nextQ();
}

/* 2 & 7. UNSCRAMBLE (10s GEO OR WORDS) */
function runUnscramble(stage, isTimedGeo) {
  const words = isTimedGeo
    ? ["ALGIERS", "PARIS", "CAIRO", "TOKYO", "BRAZIL", "CANADA", "ORAN"]
    : ["DOLPHIN", "JASMINE", "COUSCOUS", "EMERALD", "PLANET", "GUITAR"];
  const target = words[Math.floor(Math.random() * words.length)];
  const scrambled = target.split("").sort(() => Math.random() - 0.5);
  let picked = [];
  if (isTimedGeo) startCountdown(10, () => runUnscramble(stage, true));

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">${isTimedGeo ? "10s City/Country Unscramble" : "Tap letters in order"}</div>
      <div class="q-prompt">${picked.join(" ") || "_ ".repeat(target.length)}</div>
      <div class="tile-row" id="scrTiles"></div>
      <div id="fbBox"></div>
    `;
    const row = document.getElementById("scrTiles");
    scrambled.forEach((ch, idx) => {
      if (ch === null) return;
      const b = document.createElement("button");
      b.className = "letter-tile";
      b.textContent = ch;
      b.onclick = () => {
        picked.push(ch);
        scrambled[idx] = null;
        playCalmTone("tap");
        render();
        if (picked.length === target.length) {
          clearStageTimer();
          handleAnswerResult(picked.join("") === target, target, () => runUnscramble(stage, isTimedGeo));
        }
      };
      row.appendChild(b);
    });
  };
  render();
}

/* 3. TRUE OR FALSE RUSH (SWIPE / TAP) */
function runTfRush(stage) {
  startCountdown(45, () => {
    stage.innerHTML = `<div class="q-prompt">⚖️ Rush Complete! ${State.score} pts</div>`;
  });
  const nextCard = () => {
    const item = pickQuestionsForCategory(null, null);
    const ans = tr(item.a);
    const opts = item.opts[State.lang] || item.opts.en;
    const isTrue = Math.random() > 0.5;
    const shown = isTrue ? ans : (opts.find(x => x !== ans) || opts[1]);
    stage.innerHTML = `
      <div class="q-sub">Swipe Left (${t("falseWord")}) or Right (${t("trueWord")})</div>
      <div class="q-prompt" id="swipeCard" style="padding:26px;background:var(--surface-alt);border-radius:18px;">
        ${tr(item.q)}<br/><strong style="color:var(--primary)">${shown}</strong>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="opt-btn" id="rushF" style="text-align:center">⬅️ ${t("falseWord")}</button>
        <button class="opt-btn" id="rushT" style="text-align:center">${t("trueWord")} ➡️</button>
      </div>
    `;
    const answer = (userSaidTrue) => {
      if (userSaidTrue === isTrue) { playCalmTone("good"); addPoints(15); } else playCalmTone("miss");
      nextCard();
    };
    document.getElementById("rushF").onclick = () => answer(false);
    document.getElementById("rushT").onclick = () => answer(true);
    let sx = 0;
    const card = document.getElementById("swipeCard");
    card.ontouchstart = (e) => { sx = e.changedTouches[0].clientX; };
    card.ontouchend = (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) answer(dx > 0);
    };
  };
  nextCard();
}

/* 4. SPEED TAP FALLING BUBBLES */
function runSpeedTap(stage) {
  stage.innerHTML = `
    <div class="q-sub">Tap ONLY Countries! Avoid Animals!</div>
    <div class="falling-arena" id="arena"></div>
    <button class="btn-primary" id="btnRestartFall" style="width:100%">🔄 New Wave</button>
  `;
  const arena = document.getElementById("arena");
  const goods = ["Algeria 🌍", "France 🌍", "Japan 🌍", "Brazil 🌍", "Egypt 🌍"];
  const bads = ["Dolphin 🐬", "Tiger 🐅", "Falcon 🦅", "Koala 🐨"];
  [...goods, ...bads].sort(() => Math.random() - 0.5).slice(0, 6).forEach((label, i) => {
    const el = document.createElement("div");
    el.className = "falling-item";
    el.textContent = label;
    el.style.left = `${10 + (i * 14)}%`;
    let top = -10 - (i * 25);
    el.style.top = `${top}px`;
    const iv = setInterval(() => {
      top += 3;
      el.style.top = `${top}px`;
      if (top > 240) clearInterval(iv);
    }, 80);
    el.onclick = () => {
      clearInterval(iv);
      const ok = goods.includes(label);
      if (ok) { playCalmTone("good"); addPoints(15); el.style.background = "var(--accent-mint)"; }
      else { playCalmTone("miss"); el.style.background = "var(--accent-peach)"; }
      setTimeout(() => el.remove(), 200);
    };
    arena.appendChild(el);
  });
  document.getElementById("btnRestartFall").onclick = () => runSpeedTap(stage);
}

/* 5. CATEGORY BLITZ (30s) */
function runCategoryBlitz(stage) {
  startCountdown(30, () => {
    stage.innerHTML = `<div class="q-prompt">🗂️ 30s Complete! ${State.score} pts</div>`;
  });
  const valid = ["Algeria", "Argentina", "Australia", "Austria", "Angola", "Albania", "Armenia", "Azerbaijan"];
  const decoys = ["Brazil", "Canada", "France", "Japan", "Egypt", "Spain", "Norway", "Kenya"];
  const all = [...valid, ...decoys].sort(() => Math.random() - 0.5);
  stage.innerHTML = `
    <div class="q-prompt">Tap all Countries starting with letter “A”</div>
    <div class="grid-4x4" id="catBlitzGrid"></div>
  `;
  const g = document.getElementById("catBlitzGrid");
  all.forEach(w => {
    const b = document.createElement("button");
    b.className = "grid-cell-btn";
    b.textContent = w;
    b.onclick = () => {
      if (w.startsWith("A")) { b.classList.add("solved"); playCalmTone("good"); addPoints(10); }
      else { playCalmTone("miss"); b.style.opacity = "0.4"; }
    };
    g.appendChild(b);
  });
}

/* 6. SPELLING BEE */
function runSpellingBee(stage) {
  const sets = [
    { good: "Mediterranean", opts: ["Mediterranean", "Mediteranean", "Meditterranean", "Mediteranian"] },
    { good: "Architecture", opts: ["Architecture", "Architechture", "Arcitecture", "Architeture"] },
    { good: "Photosynthesis", opts: ["Photosynthesis", "Fotosynthesis", "Photosinthesis", "Photosyntesis"] },
    { good: "Chrysanthemum", opts: ["Chrysanthemum", "Crysanthemum", "Chrysanthamum", "Chrisanthemum"] }
  ];
  const s = sets[Math.floor(Math.random() * sets.length)];
  stage.innerHTML = `<div class="q-prompt">🐝 Pick the correct spelling:</div><div class="options-list" id="beeOpts"></div><div id="fbBox"></div>`;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.good, s.good, () => runSpellingBee(stage), b);
    document.getElementById("beeOpts").appendChild(b);
  });
}

/* 8. THEMED WORDLE (6 TRIES) */
function runWordle(stage) {
  const entry = window.SPECIAL_DATA.words5[Math.floor(Math.random() * window.SPECIAL_DATA.words5.length)];
  const target = entry.word;
  let guesses = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Theme: ${entry.theme} — ${tr(entry.clue)}</div>
      <div class="wordle-grid" id="wGrid"></div>
      <input type="text" id="wInput" maxlength="5" class="search-input" placeholder="5 letters..." style="text-transform:uppercase;text-align:center" />
      <button class="btn-primary" id="wSub" style="width:100%">${t("checkBtn")}</button>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("wGrid");
    for (let r = 0; r < 6; r++) {
      const word = guesses[r] || "     ";
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "wordle-cell";
        const ch = word[c];
        cell.textContent = ch;
        if (guesses[r]) {
          if (ch === target[c]) cell.classList.add("hit");
          else if (target.includes(ch)) cell.classList.add("near");
          else cell.classList.add("miss");
        }
        g.appendChild(cell);
      }
    }
    document.getElementById("wSub").onclick = () => {
      const val = document.getElementById("wInput").value.trim().toUpperCase();
      if (val.length !== 5) return;
      guesses.push(val);
      render();
      if (val === target || guesses.length >= 6) {
        handleAnswerResult(val === target, target, () => runWordle(stage));
      }
    };
  };
  render();
}

/* 9. HANGMAN WITH CALM SVG DRAWING */
function runHangman(stage) {
  const words = ["ALGERIA", "PYRAMID", "JASMINE", "HORIZON", "COMPASS"];
  const target = words[Math.floor(Math.random() * words.length)];
  let used = [];
  let misses = 0;
  const render = () => {
    const masked = target.split("").map(c => (used.includes(c) ? c : "_")).join(" ");
    stage.innerHTML = `
      <svg viewBox="0 0 200 120" class="svg-stage" style="height:130px">
        <line x1="20" y1="110" x2="180" y2="110" stroke="var(--primary)" stroke-width="4"/>
        ${misses >= 1 ? '<line x1="60" y1="110" x2="60" y2="20" stroke="var(--primary)" stroke-width="4"/>' : ''}
        ${misses >= 2 ? '<line x1="60" y1="20" x2="120" y2="20" stroke="var(--primary)" stroke-width="4"/>' : ''}
        ${misses >= 3 ? '<circle cx="120" cy="40" r="12" fill="none" stroke="var(--primary)" stroke-width="3"/>' : ''}
        ${misses >= 4 ? '<line x1="120" y1="52" x2="120" y2="82" stroke="var(--primary)" stroke-width="3"/>' : ''}
        ${misses >= 5 ? '<line x1="100" y1="65" x2="140" y2="65" stroke="var(--primary)" stroke-width="3"/>' : ''}
      </svg>
      <div class="q-prompt" style="letter-spacing:4px">${masked}</div>
      <div class="tile-row" id="hmKeys"></div>
      <div id="fbBox"></div>
    `;
    const kb = document.getElementById("hmKeys");
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(ch => {
      const b = document.createElement("button");
      b.className = "letter-tile";
      b.textContent = ch;
      b.disabled = used.includes(ch);
      if (used.includes(ch)) b.style.opacity = "0.35";
      b.onclick = () => {
        used.push(ch);
        if (!target.includes(ch)) misses++;
        else playCalmTone("tap");
        render();
        if (!target.split("").some(c => !used.includes(c))) {
          handleAnswerResult(true, target, () => runHangman(stage));
        } else if (misses >= 5) {
          handleAnswerResult(false, target, () => runHangman(stage));
        }
      };
      kb.appendChild(b);
    });
  };
  render();
}

/* 10. MISSING LETTERS ("P_R_S" -> PARIS) */
function runMissingLetters(stage) {
  const list = [
    { mask: "P _ R _ S", ans: "PARIS", opts: ["PARIS", "PORTO", "PERTH", "PRAGUE"] },
    { mask: "A L G _ _ R S", ans: "ALGIERS", opts: ["ALGIERS", "ANTWERP", "ATHENS", "AMMAN"] },
    { mask: "C _ I R _", ans: "CAIRO", opts: ["CAIRO", "CUSCO", "CORFU", "CHILE"] }
  ];
  const it = list[Math.floor(Math.random() * list.length)];
  stage.innerHTML = `
    <div class="q-sub">Complete the missing letters</div>
    <div class="q-prompt" style="letter-spacing:4px">${it.mask}</div>
    <div class="options-list" id="mlOpts"></div>
    <div id="fbBox"></div>
  `;
  it.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === it.ans, it.ans, () => runMissingLetters(stage), b);
    document.getElementById("mlOpts").appendChild(b);
  });
}

/* 11. THEMED WORD SEARCH */
function runWordSearch(stage) {
  const rows = ["ALGERIA", "NILEXOP", "PARISab", "MARSdef", "OAKghij"];
  const targets = ["ALGERIA", "NILE", "PARIS", "MARS", "OAK"];
  let found = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap rows containing hidden words: ${targets.map(w => found.includes(w) ? `<s>${w}</s>` : w).join(" · ")}</div>
      <div class="options-list" id="wsGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("wsGrid");
    targets.forEach((word, i) => {
      const b = document.createElement("button");
      b.className = "opt-btn " + (found.includes(word) ? "correct" : "");
      b.style.letterSpacing = "6px";
      b.style.textAlign = "center";
      b.textContent = rows[i].toUpperCase();
      b.onclick = () => {
        if (!found.includes(word)) {
          found.push(word);
          playCalmTone("good");
          addPoints(10);
          render();
          if (found.length === targets.length) {
            handleAnswerResult(true, "All 5 Words Found!", () => runWordSearch(stage));
          }
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 12. MINI THEMED CROSSWORD */
function runMiniCrossword(stage) {
  stage.innerHTML = `
    <div class="q-sub">Mini Crossword: 1-Across (Red Planet, 4 letters) &amp; 2-Across (French Capital, 5 letters)</div>
    <input id="cw1" class="search-input" placeholder="1-Across (4 letters): M _ _ _" />
    <input id="cw2" class="search-input" placeholder="2-Across (5 letters): P _ _ _ _" />
    <button class="btn-primary" id="cwCheck" style="width:100%">${t("checkBtn")}</button>
    <div id="fbBox"></div>
  `;
  document.getElementById("cwCheck").onclick = () => {
    const v1 = document.getElementById("cw1").value.trim().toUpperCase();
    const v2 = document.getElementById("cw2").value.trim().toUpperCase();
    handleAnswerResult(v1 === "MARS" && v2 === "PARIS", "MARS & PARIS", () => runMiniCrossword(stage));
  };
}

/* 13. ANAGRAM CHAIN (Last letter starts next word) */
function runAnagramChain(stage) {
  const chain = [
    { start: "PARIS", hint: "Starts with S — Yellow star in our sky (3 letters)", ans: "SUN" },
    { start: "SUN", hint: "Starts with N — Longest African river (4 letters)", ans: "NILE" },
    { start: "NILE", hint: "Starts with E — Our home planet (5 letters)", ans: "EARTH" }
  ];
  const step = chain[Math.floor(Math.random() * chain.length)];
  stage.innerHTML = `
    <div class="q-sub">Previous Word: <strong>${step.start}</strong> (ends with ${step.start.slice(-1)})</div>
    <div class="q-prompt">${step.hint}</div>
    <input id="acIn" class="search-input" placeholder="Type next word..." />
    <button class="btn-primary" id="acSub" style="width:100%">${t("checkBtn")}</button>
    <div id="fbBox"></div>
  `;
  document.getElementById("acSub").onclick = () => {
    const val = document.getElementById("acIn").value.trim().toUpperCase();
    handleAnswerResult(val === step.ans, step.ans, () => runAnagramChain(stage));
  };
}

/* 14 & 15. GUESS THE PERSON (PROGRESSIVE CLUES & VS BOT) */
function runGuessPerson(stage, vsBot) {
  const p = window.SPECIAL_DATA.peopleClues[Math.floor(Math.random() * window.SPECIAL_DATA.peopleClues.length)];
  const clues = p.clues[State.lang] || p.clues.en;
  const ans = tr(p.ans);
  const opts = p.opts[State.lang] || p.opts.en;
  let shown = 1;

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">${vsBot ? "🤖 CalmBot is thinking... Guess before Clue 4!" : `Points available: ${(5 - shown) * 100}`}</div>
      <div class="options-list" style="margin-bottom:12px">
        ${clues.slice(0, shown).map((c, i) => `<div class="pill" style="border-radius:12px">Clue ${i + 1}: ${c}</div>`).join("")}
      </div>
      ${shown < clues.length ? `<button class="btn-secondary" id="btnMoreClue" style="width:100%;margin-bottom:12px">+ Reveal Next Clue</button>` : ""}
      <div class="options-list" id="gpOpts"></div>
      <div id="fbBox"></div>
    `;
    if (document.getElementById("btnMoreClue")) {
      document.getElementById("btnMoreClue").onclick = () => { shown++; render(); };
    }
    opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => handleAnswerResult(o === ans, ans, () => runGuessPerson(stage, vsBot), b);
      document.getElementById("gpOpts").appendChild(b);
    });
  };
  render();
}

/* 16. GUESS ZOOM / BLUR REVEAL */
function runGuessZoom(stage) {
  const items = [
    { icon: "🕌", ans: "Mosque / Masjid", opts: ["Mosque / Masjid", "Lighthouse", "Windmill", "Castle"] },
    { icon: "🦊", ans: "Red Fox", opts: ["Red Fox", "Polar Bear", "Dolphin", "Eagle"] },
    { icon: "🗼", ans: "Tower Landmark", opts: ["Tower Landmark", "Suspension Bridge", "Colosseum", "Pyramid"] }
  ];
  const it = items[Math.floor(Math.random() * items.length)];
  let blur = 12;
  const render = () => {
    stage.innerHTML = `
      <div style="height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-alt);border-radius:16px;margin-bottom:10px">
        <span style="font-size:74px;filter:blur(${blur}px);transform:scale(${1 + blur / 6});transition:all 0.3s ease">${it.icon}</span>
      </div>
      <button class="btn-secondary" id="btnSharpen" style="width:100%;margin-bottom:10px">🔍 Sharpen Image</button>
      <div class="options-list" id="gzOpts"></div>
      <div id="fbBox"></div>
    `;
    document.getElementById("btnSharpen").onclick = () => { blur = Math.max(0, blur - 4); render(); };
    it.opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => { blur = 0; handleAnswerResult(o === it.ans, it.ans, () => runGuessZoom(stage), b); };
      document.getElementById("gzOpts").appendChild(b);
    });
  };
  render();
}

/* 17. GUESS THE MOVIE FROM EMOJIS */
function runMovieEmoji(stage) {
  const m = window.SPECIAL_DATA.movieEmojis[Math.floor(Math.random() * window.SPECIAL_DATA.movieEmojis.length)];
  const ans = tr(m.ans);
  const opts = m.opts[State.lang] || m.opts.en;
  stage.innerHTML = `
    <div class="q-prompt" style="font-size:44px">${m.emojis}</div>
    <div class="options-list" id="meOpts"></div>
    <div id="fbBox"></div>
  `;
  opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === ans, ans, () => runMovieEmoji(stage), b);
    document.getElementById("meOpts").appendChild(b);
  });
}

/* 18. GUESS THE SILHOUETTE */
function runSilhouette(stage) {
  stage.innerHTML = `
    <div class="q-sub">Identify this silhouette</div>
    <div style="text-align:center;font-size:78px;filter:brightness(0);margin:10px 0">🐪</div>
    <div class="options-list" id="silOpts"></div>
    <div id="fbBox"></div>
  `;
  ["Dromedary Camel", "Kangaroo", "Giraffe", "Rhinoceros"].forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === "Dromedary Camel", "Dromedary Camel", () => runSilhouette(stage), b);
    document.getElementById("silOpts").appendChild(b);
  });
}

/* 19. GUESS THE FOOTBALLER */
function runFootballer(stage) {
  const f = window.SPECIAL_DATA.footballTransfers[Math.floor(Math.random() * window.SPECIAL_DATA.footballTransfers.length)];
  stage.innerHTML = `
    <div class="q-sub">Club Transfer Path:</div>
    <div class="q-prompt">${f.career}</div>
    <div class="options-list" id="fbOpts"></div>
    <div id="fbBox"></div>
  `;
  f.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === f.ans, f.ans, () => runFootballer(stage), b);
    document.getElementById("fbOpts").appendChild(b);
  });
}

/* 20. PIXELATED IMAGE REVEAL */
function runPixelClear(stage) {
  stage.innerHTML = `
    <div class="q-sub">Pixelated Icon — Tap Clearer or Guess Now</div>
    <svg viewBox="0 0 80 80" class="svg-stage" style="height:130px">
      <rect x="10" y="50" width="60" height="15" fill="#d4a373"/>
      <polygon points="40,12 12,55 68,55" fill="#e9c46a"/>
    </svg>
    <div class="options-list" id="pxOpts"></div>
    <div id="fbBox"></div>
  `;
  ["Great Pyramid", "Colosseum", "Big Ben", "Taj Mahal"].forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === "Great Pyramid", "Great Pyramid", () => runPixelClear(stage), b);
    document.getElementById("pxOpts").appendChild(b);
  });
}

/* 21. COLOR PALETTE GUESS */
function runColorGuess(stage) {
  stage.innerHTML = `
    <div class="q-sub">Which country flag uses this exact color palette?</div>
    <div style="display:flex;height:70px;border-radius:16px;overflow:hidden;border:1px solid var(--border);margin-bottom:14px">
      <div style="flex:1;background:#006233"></div>
      <div style="flex:1;background:#ffffff"></div>
      <div style="flex:1;background:#d21034"></div>
    </div>
    <div class="options-list" id="cgOpts"></div>
    <div id="fbBox"></div>
  `;
  ["Algeria 🇩🇿", "Sweden 🇸🇪", "Argentina 🇦🇷", "Greece 🇬🇷"].forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o.startsWith("Algeria"), "Algeria 🇩🇿", () => runColorGuess(stage), b);
    document.getElementById("cgOpts").appendChild(b);
  });
}

/* 22. WHO AM I? (20 QUESTIONS YES/NO DEDUCTION) */
function runWhoAmI(stage) {
  const qs = [
    "Q1: Is it a living animal? ➔ YES",
    "Q2: Does it live in the ocean? ➔ YES",
    "Q3: Is it the largest mammal on Earth? ➔ YES"
  ];
  stage.innerHTML = `
    <div class="q-sub">20-Questions Yes/No Log:</div>
    <div class="options-list" style="margin-bottom:12px">
      ${qs.map(q => `<div class="pill">${q}</div>`).join("")}
    </div>
    <div class="options-list" id="waiOpts"></div>
    <div id="fbBox"></div>
  `;
  ["Blue Whale", "Falcon", "Desert Fox", "Cheetah"].forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === "Blue Whale", "Blue Whale", () => runWhoAmI(stage), b);
    document.getElementById("waiOpts").appendChild(b);
  });
}

/* 23. OFFLINE SVG MAP CLICK */
function runMapClick(stage) {
  const locs = window.SPECIAL_DATA.geoLocations;
  const target = locs[Math.floor(Math.random() * locs.length)];
  stage.innerHTML = `
    <div class="q-prompt">🗺️ Tap <strong>${tr(target.name)}</strong> on the World Map</div>
    <svg viewBox="0 0 1000 500" class="svg-stage" id="worldSvg">
      <rect width="1000" height="500" fill="var(--surface-alt)"/>
      <!-- Simplified Continent Shapes -->
      <path d="M150,80 L320,90 L360,220 L260,240 Z" fill="var(--primary-soft)"/>
      <path d="M270,250 L370,270 L340,430 L280,410 Z" fill="var(--primary-soft)"/>
      <path d="M440,70 L600,70 L590,155 L440,155 Z" fill="var(--primary-soft)"/>
      <path d="M430,165 L610,165 L580,380 L470,360 Z" fill="var(--primary-soft)"/>
      <path d="M610,75 L890,85 L860,260 L620,240 Z" fill="var(--primary-soft)"/>
      <path d="M760,310 L890,310 L880,410 L760,410 Z" fill="var(--primary-soft)"/>
      ${locs.map(l => `<circle cx="${l.x}" cy="${l.y}" r="22" fill="var(--primary)" stroke="#fff" stroke-width="3" data-id="${l.id}" style="cursor:pointer"/>`).join("")}
    </svg>
    <div id="fbBox"></div>
  `;
  stage.querySelectorAll("circle").forEach(c => {
    c.onclick = () => {
      const hit = c.getAttribute("data-id") === target.id;
      handleAnswerResult(hit, tr(target.name), () => runMapClick(stage));
    };
  });
}

/* 24. COUNTRY BORDER OUTLINE */
function runBorderGuess(stage) {
  stage.innerHTML = `
    <div class="q-sub">Identify this Country Outline</div>
    <svg viewBox="0 0 200 200" class="svg-stage" style="height:150px">
      <polygon points="75,25 135,25 165,85 110,175 45,120 55,55" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="4"/>
    </svg>
    <div class="options-list" id="bgOpts"></div>
    <div id="fbBox"></div>
  `;
  ["Algeria", "Italy", "Japan", "Chile"].forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === "Algeria", "Algeria", () => runBorderGuess(stage), b);
    document.getElementById("bgOpts").appendChild(b);
  });
}

/* 25. CAPITAL MATCH */
function renderCapitalMatchMode(stage, nextFn) {
  const pairs = window.SPECIAL_DATA.geoLocations.slice(0, 4);
  let selCountry = null;
  let matched = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap a Country, then tap its matching Capital</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="cmGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("cmGrid");
    pairs.forEach(p => {
      const done = matched.includes(p.id);
      const cBtn = document.createElement("button");
      cBtn.className = "grid-cell-btn " + (done ? "solved" : selCountry === p.id ? "selected" : "");
      cBtn.textContent = tr(p.name);
      cBtn.onclick = () => { selCountry = p.id; render(); };

      const capBtn = document.createElement("button");
      capBtn.className = "grid-cell-btn " + (done ? "solved" : "");
      capBtn.textContent = tr(p.capital);
      capBtn.onclick = () => {
        if (selCountry === p.id) {
          matched.push(p.id);
          selCountry = null;
          playCalmTone("good");
          addPoints(15);
          render();
          if (matched.length === pairs.length) handleAnswerResult(true, "All Capitals Matched!", nextFn);
        } else playCalmTone("miss");
      };
      g.appendChild(cBtn);
      g.appendChild(capBtn);
    });
  };
  render();
}

/* 26, 28, 29. HIGHER OR LOWER (GEO & STATS & COMPARE) */
function runHigherLower(stage, isGeo) {
  const locs = window.SPECIAL_DATA.geoLocations;
  const a = locs[0];
  const b = locs[Math.floor(Math.random() * (locs.length - 1)) + 1];
  stage.innerHTML = `
    <div class="q-sub">${isGeo ? "Land Area Comparison (1,000 km²)" : "Population Comparison (Millions)"}</div>
    <div class="q-prompt">${tr(a.name)}: <strong>${isGeo ? a.area : a.pop}</strong><br/>vs<br/>${tr(b.name)}: <strong>?</strong></div>
    <div class="options-list">
      <button class="opt-btn" id="hlHigh">${t("higherWord")}</button>
      <button class="opt-btn" id="hlLow">${t("lowerWord")}</button>
    </div>
    <div id="fbBox"></div>
  `;
  const valA = isGeo ? a.area : a.pop;
  const valB = isGeo ? b.area : b.pop;
  document.getElementById("hlHigh").onclick = (e) => handleAnswerResult(valB >= valA, `${tr(b.name)} = ${valB}`, () => runHigherLower(stage, isGeo), e.target);
  document.getElementById("hlLow").onclick = (e) => handleAnswerResult(valB <= valA, `${tr(b.name)} = ${valB}`, () => runHigherLower(stage, isGeo), e.target);
}

/* 27. DISTANCE GUESS (PIN DROP ON SVG MAP) */
function runDistanceGuess(stage) {
  const locs = window.SPECIAL_DATA.geoLocations;
  const target = locs[Math.floor(Math.random() * locs.length)];
  stage.innerHTML = `
    <div class="q-prompt">📍 Tap anywhere on the map to drop your pin near <strong>${tr(target.capital)}, ${tr(target.name)}</strong></div>
    <svg viewBox="0 0 1000 500" class="svg-stage" id="pinMap" style="cursor:crosshair">
      <rect width="1000" height="500" fill="var(--surface-alt)"/>
      <path d="M150,80 L350,100 L350,410 L200,390 Z" fill="var(--primary-soft)"/>
      <path d="M430,70 L890,85 L860,390 L440,370 Z" fill="var(--primary-soft)"/>
    </svg>
    <div id="fbBox"></div>
  `;
  const svg = document.getElementById("pinMap");
  svg.onclick = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 500;
    const dist = Math.round(Math.hypot(x - target.x, y - target.y) * 12);
    svg.innerHTML += `
      <line x1="${x}" y1="${y}" x2="${target.x}" y2="${target.y}" stroke="var(--primary)" stroke-width="4" stroke-dasharray="8,8"/>
      <circle cx="${x}" cy="${y}" r="14" fill="#e76f51"/>
      <circle cx="${target.x}" cy="${target.y}" r="14" fill="#2a9d8f"/>
    `;
    handleAnswerResult(dist < 1800, `Distance: ~${dist} km`, () => runDistanceGuess(stage));
  };
}

/* 30. ODD ONE OUT */
function renderOddOneOutMode(stage, nextFn) {
  const sets = [
    { opts: ["Mars", "Venus", "Saturn", "Moon"], odd: "Moon", why: "The Moon is a natural satellite, not a planet." },
    { opts: ["Algiers", "Cairo", "Tunis", "Tokyo"], odd: "Tokyo", why: "Tokyo is in Asia; the others are North African capitals." },
    { opts: ["Dolphin", "Whale", "Seal", "Shark"], odd: "Shark", why: "Sharks are fish; the other three are marine mammals." }
  ];
  const s = sets[Math.floor(Math.random() * sets.length)];
  stage.innerHTML = `<div class="q-prompt">🧐 Tap the Odd One Out:</div><div class="options-list" id="oddOpts"></div><div id="fbBox"></div>`;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.odd, `${s.odd} (${s.why})`, nextFn, b);
    document.getElementById("oddOpts").appendChild(b);
  });
}

/* 31. TIMELINE SORT */
function renderTimelineSortMode(stage, nextFn) {
  const events = [
    { yr: 750, label: "Golden Age of Baghdad House of Wisdom (8th C.)" },
    { yr: 1324, label: "Mansa Musa's Famous Pilgrimage (1324)" },
    { yr: 1450, label: "Gutenberg Printing Press (1450)" },
    { yr: 1969, label: "Apollo 11 Moon Landing (1969)" }
  ];
  let shuffled = events.slice().sort(() => Math.random() - 0.5);
  let picked = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap events from EARLIEST to LATEST</div>
      <div class="options-list" id="tlList"></div>
      <div id="fbBox"></div>
    `;
    const box = document.getElementById("tlList");
    shuffled.forEach(ev => {
      const doneIdx = picked.indexOf(ev);
      const b = document.createElement("button");
      b.className = "opt-btn " + (doneIdx >= 0 ? "correct" : "");
      b.textContent = (doneIdx >= 0 ? `#${doneIdx + 1} ` : "") + ev.label;
      b.onclick = () => {
        if (doneIdx >= 0) return;
        picked.push(ev);
        playCalmTone("tap");
        render();
        if (picked.length === events.length) {
          const ok = picked.every((x, i) => i === 0 || x.yr >= picked[i - 1].yr);
          handleAnswerResult(ok, "750 ➔ 1324 ➔ 1450 ➔ 1969", nextFn);
        }
      };
      box.appendChild(b);
    });
  };
  render();
}

/* 32. MEMORY MATCH PAIRS */
function runMatchPairs(stage) {
  const items = ["🇩🇿", "🇩🇿", "🌙", "🌙", "🦊", "🦊", "🌿", "🌿"];
  const deck = items.slice().sort(() => Math.random() - 0.5);
  let open = [];
  let solved = [];
  const render = () => {
    stage.innerHTML = `<div class="q-sub">Flip matching pairs</div><div class="grid-4x4" id="memGrid"></div><div id="fbBox"></div>`;
    const g = document.getElementById("memGrid");
    deck.forEach((icon, idx) => {
      const isUp = open.includes(idx) || solved.includes(idx);
      const b = document.createElement("button");
      b.className = "grid-cell-btn " + (solved.includes(idx) ? "solved" : "");
      b.style.fontSize = "24px";
      b.textContent = isUp ? icon : "❓";
      b.onclick = () => {
        if (isUp || open.length >= 2) return;
        open.push(idx);
        playCalmTone("tap");
        render();
        if (open.length === 2) {
          if (deck[open[0]] === deck[open[1]]) {
            solved.push(open[0], open[1]);
            open = [];
            addPoints(15);
            render();
            if (solved.length === deck.length) handleAnswerResult(true, "All Pairs Matched!", () => runMatchPairs(stage));
          } else {
            setTimeout(() => { open = []; render(); }, 600);
          }
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 33. CONNECTIONS (16 WORDS -> 4 GROUPS) */
function runConnections(stage) {
  const groups = {
    "Planets": ["Mars", "Venus", "Saturn", "Jupiter"],
    "Capitals": ["Algiers", "Paris", "Cairo", "Tokyo"],
    "Oceans": ["Pacific", "Atlantic", "Indian", "Arctic"],
    "Metals": ["Gold", "Silver", "Copper", "Iron"]
  };
  let all = Object.values(groups).flat().sort(() => Math.random() - 0.5);
  let sel = [];
  let solvedGroups = [];

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Select 4 words sharing a hidden group (${solvedGroups.length}/4 solved)</div>
      <div class="grid-4x4" id="connGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("connGrid");
    all.forEach(w => {
      const isSolved = solvedGroups.some(k => groups[k].includes(w));
      const b = document.createElement("button");
      b.className = "grid-cell-btn " + (isSolved ? "solved" : sel.includes(w) ? "selected" : "");
      b.textContent = w;
      b.onclick = () => {
        if (isSolved) return;
        if (sel.includes(w)) sel = sel.filter(x => x !== w);
        else if (sel.length < 4) sel.push(w);
        render();
        if (sel.length === 4) {
          const hitGroup = Object.keys(groups).find(k => sel.every(x => groups[k].includes(x)));
          if (hitGroup) {
            solvedGroups.push(hitGroup);
            sel = [];
            playCalmTone("good");
            addPoints(25);
            render();
            if (solvedGroups.length === 4) handleAnswerResult(true, "All 4 Groups Connected!", () => runConnections(stage));
          } else {
            playCalmTone("miss");
            sel = [];
            setTimeout(render, 400);
          }
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 34. NUMBER PUZZLES */
function runNumberPuzzles(stage) {
  const seqs = [
    { q: "2, 6, 18, 54, ?", ans: "162", opts: ["162", "108", "216", "144"] },
    { q: "1, 1, 2, 3, 5, 8, 13, ?", ans: "21", opts: ["21", "19", "24", "26"] },
    { q: "100, 91, 82, 73, ?", ans: "64", opts: ["64", "62", "65", "54"] }
  ];
  const s = seqs[Math.floor(Math.random() * seqs.length)];
  stage.innerHTML = `<div class="q-prompt">🔢 ${s.q}</div><div class="options-list" id="numOpts"></div><div id="fbBox"></div>`;
  s.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.ans, s.ans, () => runNumberPuzzles(stage), b);
    document.getElementById("numOpts").appendChild(b);
  });
}

/* 35. TIME TRAVEL ADVENTURE */
function runTimeTravel(stage) {
  const eras = ["Ancient Egypt (2500 BCE)", "Golden Age of Islam (900 CE)", "Renaissance (1500 CE)", "Modern Space Age (1969 CE)"];
  let idx = 0;
  const step = () => {
    const item = pickQuestionsForCategory("history", null);
    stage.innerHTML = `
      <div class="pill" style="margin-bottom:10px">🕰️ Era ${idx + 1}/4: ${eras[idx]}</div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="ttOpts"></div>
      <div id="fbBox"></div>
    `;
    (item.opts[State.lang] || item.opts.en).forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        idx = (idx + 1) % eras.length;
        handleAnswerResult(o === tr(item.a), tr(item.a), step, b);
      };
      document.getElementById("ttOpts").appendChild(b);
    });
  };
  step();
}

/* 36. ESCAPE ROOM (LINKED PUZZLES) */
function runEscapeRoom(stage) {
  const locks = [
    { title: "Lock 1/3: Keypad Code", q: "Number of continents on Earth × 100 =", ans: "700", opts: ["700", "500", "800", "600"] },
    { title: "Lock 2/3: Sun Mirror", q: "Which direction does the Sun rise from?", ans: "East", opts: ["East", "West", "North", "South"] },
    { title: "Lock 3/3: Vault Symbol", q: "Chemical symbol for Gold:", ans: "Au", opts: ["Au", "Ag", "Fe", "Cu"] }
  ];
  let stepIdx = 0;
  const render = () => {
    const l = locks[stepIdx];
    stage.innerHTML = `
      <div class="q-sub">🔐 ${l.title}</div>
      <div class="q-prompt">${l.q}</div>
      <div class="options-list" id="erOpts"></div>
      <div id="fbBox"></div>
    `;
    l.opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        const ok = o === l.ans;
        if (ok && stepIdx < 2) { stepIdx++; playCalmTone("good"); addPoints(25); render(); }
        else handleAnswerResult(ok, "Door Unlocked! 🎉", () => runEscapeRoom(stage), b);
      };
      document.getElementById("erOpts").appendChild(b);
    });
  };
  render();
}

/* 37. TREASURE HUNT MAP PIECES */
function runTreasureHunt(stage) {
  let revealed = 0;
  const render = () => {
    const item = pickQuestionsForCategory(null, null);
    stage.innerHTML = `
      <div class="q-sub">🏝️ Map Tiles Revealed: ${revealed}/4</div>
      <div class="grid-4x4" style="margin-bottom:12px">
        ${[0, 1, 2, 3].map(i => `<div class="grid-cell-btn ${i < revealed ? 'solved' : ''}">${i < revealed ? '🗺️💎' : '🌫️ Fog'}</div>`).join("")}
      </div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="thOpts"></div>
      <div id="fbBox"></div>
    `;
    (item.opts[State.lang] || item.opts.en).forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        if (o === tr(item.a)) revealed = Math.min(4, revealed + 1);
        handleAnswerResult(o === tr(item.a), tr(item.a), render, b);
      };
      document.getElementById("thOpts").appendChild(b);
    });
  };
  render();
}

/* 38. SPOT THE DIFFERENCE (INTERACTIVE SVG) */
function runSpotDifference(stage) {
  let found = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap the 3 differences on the lower scene (${found.length}/3 found)</div>
      <svg viewBox="0 0 300 100" class="svg-stage">
        <circle cx="50" cy="40" r="16" fill="#e9c46a"/>
        <rect x="130" y="35" width="40" height="45" fill="#729ea1"/>
        <circle cx="240" cy="50" r="20" fill="#8ab8bc"/>
      </svg>
      <svg viewBox="0 0 300 100" class="svg-stage" id="diffSvg">
        <circle cx="50" cy="40" r="24" fill="#e76f51" data-d="1" style="cursor:pointer"/>
        <rect x="130" y="20" width="40" height="60" fill="#2a9d8f" data-d="2" style="cursor:pointer"/>
        <circle cx="240" cy="50" r="20" fill="#e63946" data-d="3" style="cursor:pointer"/>
      </svg>
      <div id="fbBox"></div>
    `;
    document.getElementById("diffSvg").querySelectorAll("[data-d]").forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute("data-d");
        if (!found.includes(id)) {
          found.push(id);
          playCalmTone("good");
          addPoints(15);
          if (found.length === 3) handleAnswerResult(true, "All 3 Differences Found!", () => runSpotDifference(stage));
          else render();
        }
      };
    });
  };
  render();
}

/* 39. MILLIONAIRE 15 LADDER */
function runMillionaire(stage) {
  let step = 1;
  const render = () => {
    const item = pickQuestionsForCategory(null, null);
    const ans = tr(item.a);
    const opts = (item.opts[State.lang] || item.opts.en).slice();
    stage.innerHTML = `
      <div class="stage-topbar">
        <span class="pill">💎 Step ${step} / 15</span>
        <button class="btn-secondary" id="btn5050">50:50 Lifeline</button>
      </div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="milOpts"></div>
      <div id="fbBox"></div>
    `;
    const box = document.getElementById("milOpts");
    opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        const ok = o === ans;
        if (ok) step = Math.min(15, step + 1);
        else step = step >= 10 ? 10 : step >= 5 ? 5 : 1;
        handleAnswerResult(ok, ans, render, b);
      };
      box.appendChild(b);
    });
    document.getElementById("btn5050").onclick = () => {
      let removed = 0;
      Array.from(box.children).forEach(btn => {
        if (btn.textContent !== ans && removed < 2) {
          btn.style.visibility = "hidden";
          removed++;
        }
      });
    };
  };
  render();
}

/* 40. JEOPARDY BOARD */
function runJeopardy(stage) {
  const cats = ["science", "history", "geography", "sports"];
  let used = [];
  const renderBoard = () => {
    stage.innerHTML = `<div class="q-sub">Tap a Point Tile</div><div class="grid-4x4" id="jpBoard"></div><div id="fbBox"></div>`;
    const g = document.getElementById("jpBoard");
    cats.forEach(c => {
      const h = document.createElement("div");
      h.className = "grid-cell-btn solved";
      h.textContent = c.toUpperCase();
      g.appendChild(h);
    });
    [100, 200, 300].forEach(pts => {
      cats.forEach(c => {
        const key = `${c}_${pts}`;
        const b = document.createElement("button");
        b.className = "grid-cell-btn " + (used.includes(key) ? "solved" : "");
        b.textContent = used.includes(key) ? "✓" : `${pts}`;
        b.onclick = () => {
          if (used.includes(key)) return;
          used.push(key);
          const item = pickQuestionsForCategory(c, null);
          stage.innerHTML = `<div class="q-prompt">${tr(item.q)}</div><div class="options-list" id="jpOpts"></div><div id="fbBox"></div>`;
          (item.opts[State.lang] || item.opts.en).forEach(o => {
            const ob = document.createElement("button");
            ob.className = "opt-btn";
            ob.textContent = o;
            ob.onclick = () => handleAnswerResult(o === tr(item.a), tr(item.a), renderBoard, ob);
            document.getElementById("jpOpts").appendChild(ob);
          });
        };
        g.appendChild(b);
      });
    });
  };
  renderBoard();
}

/* 41. TRUE FACT OR FAKE (SPOT THE 1 FAKE FACT AMONG 3) */
function runTrueOrFake(stage) {
  const statements = [
    { text: "Honey found in ancient Egyptian tombs is still edible.", fake: false },
    { text: "Octopuses have three hearts.", fake: false },
    { text: "The Great Wall of China is the only human structure glowing neon from the Moon.", fake: true }
  ];
  stage.innerHTML = `<div class="q-prompt">🕵️‍♀️ Tap the ONE Fake Statement among these three:</div><div class="options-list" id="tfkOpts"></div><div id="fbBox"></div>`;
  statements.forEach(s => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = s.text;
    b.onclick = () => handleAnswerResult(s.fake === true, statements[2].text, () => runTrueOrFake(stage), b);
    document.getElementById("tfkOpts").appendChild(b);
  });
}

/* INITIALIZATION & EVENT LISTENERS */
window.addEventListener("DOMContentLoaded", () => {
  updateHeaderStats();
  applyLanguageAndTheme();

  // Bottom Navigation
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      clearStageTimer();
      playCalmTone("tap");
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-tab");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      if (target === "viewStats") renderStats();
    });
  });

  // Hub Filter Chips
  document.querySelectorAll("#hubFilterBar .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#hubFilterBar .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      State.hubFilter = chip.getAttribute("data-filter");
      renderModesHub();
    });
  });

  // Search Input
  document.getElementById("searchModes").addEventListener("input", (e) => {
    State.searchQuery = e.target.value;
    renderModesHub();
  });

  // Difficulty Selector
  document.querySelectorAll("#diffSelector .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#diffSelector .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      State.diff = btn.getAttribute("data-diff");
      renderCategories();
    });
  });

  // Question Type Selector
  document.querySelectorAll("#qTypeSelector .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#qTypeSelector .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      State.qtype = chip.getAttribute("data-qtype");
      renderCategories();
    });
  });

  // Settings Language
  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-lang]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      State.lang = btn.getAttribute("data-lang");
      saveState();
      applyLanguageAndTheme();
    });
  });

  // Settings Theme & Sound & Reset
  document.getElementById("btnToggleTheme").onclick = () => {
    State.theme = State.theme === "dark" ? "light" : "dark";
    saveState();
    applyLanguageAndTheme();
  };
  document.getElementById("btnToggleSound").onclick = () => {
    State.sound = !State.sound;
    saveState();
    applyLanguageAndTheme();
  };
  document.getElementById("btnResetData").onclick = () => {
    State.xp = 0; State.streak = 0; State.favorites = []; State.highScores = {};
    saveState();
    renderModesHub();
    renderStats();
  };

  // Quick Play & Exit Stage
  document.getElementById("btnQuickPlay").onclick = () => startCategoryQuiz("general", t("appTitle"));
  document.getElementById("btnExitStage").onclick = () => {
    clearStageTimer();
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("viewHub").classList.add("active");
  };
});
