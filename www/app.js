/* ============================================================================
   ZENQUIZ PRO - NON-REPEATING DECK ENGINE & UPGRADED 41 MINI-GAMES
   ============================================================================ */

const State = {
  lang: localStorage.getItem("zq_lang") || "en",
  theme: localStorage.getItem("zq_theme") || "light",
  sound: localStorage.getItem("zq_sound") !== "off",
  xp: parseInt(localStorage.getItem("zq_xp") || "0", 10),
  streak: parseInt(localStorage.getItem("zq_streak") || "0", 10),
  favorites: JSON.parse(localStorage.getItem("zq_favs") || "[]"),
  highScores: JSON.parse(localStorage.getItem("zq_scores") || "{}"),
  seenIds: JSON.parse(localStorage.getItem("zq_seen") || "[]"),
  hubFilter: "all",
  searchQuery: "",
  diff: "easy",
  qtype: "mix",
  activeMode: null,
  score: 0,
  timerId: null
};

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
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(270, now + 0.2);
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
  localStorage.setItem("zq_seen", JSON.stringify(State.seenIds));
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

/* ============================================================================
   SMART NON-REPEATING DECK DRAW (Tracks seenIds across all 1,500+ questions)
   ============================================================================ */
function drawUniqueQuestion(catId, diff) {
  const seenSet = new Set(State.seenIds);
  let pool = window.QUESTION_BANK.filter(q =>
    (!catId || q.cat === catId) &&
    (!diff || q.diff === diff) &&
    !seenSet.has(q.id)
  );
  if (pool.length === 0) {
    pool = window.QUESTION_BANK.filter(q => (!catId || q.cat === catId) && !seenSet.has(q.id));
  }
  if (pool.length === 0) {
    pool = window.QUESTION_BANK.filter(q => !seenSet.has(q.id));
  }
  if (pool.length === 0) {
    // Player has finished all 1,500+ questions! Reset deck cleanly.
    State.seenIds = [];
    pool = window.QUESTION_BANK;
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  State.seenIds.push(chosen.id);
  if (State.seenIds.length > 2000) State.seenIds.shift();
  saveState();
  return chosen;
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

function renderCategories() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  window.CATEGORIES.forEach(cat => {
    const count = window.QUESTION_BANK.filter(q => q.cat === cat.id).length;
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="card-top">
        <div class="card-icon">${cat.icon}</div>
        <span class="card-badge">${count}+ Qs</span>
      </div>
      <div>
        <h3>${tr(cat.name)}</h3>
        <p>${t(State.diff)}</p>
      </div>
    `;
    card.addEventListener("click", () => startCategoryQuiz(cat.id, tr(cat.name)));
    grid.appendChild(card);
  });
}

function renderStats() {
  const ov = document.getElementById("statsOverview");
  const list = document.getElementById("highScoresList");
  if (!ov || !list) return;
  const lv = Math.floor(State.xp / 100) + 1;
  ov.innerHTML = `
    <div class="score-row"><strong>📚 Total Question Bank</strong><span>${window.QUESTION_BANK.length} Unique Qs</span></div>
    <div class="score-row"><strong>✅ Unique Questions Seen</strong><span>${State.seenIds.length} / ${window.QUESTION_BANK.length}</span></div>
    <div class="score-row"><strong>⭐ Player Level</strong><span>Lv ${lv} (${State.xp} XP)</span></div>
    <div class="score-row"><strong>🔥 Current Streak</strong><span>${State.streak}</span></div>
    <div class="score-row"><strong>❤️ Favorite Modes</strong><span>${State.favorites.length}</span></div>
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

/* ============================================================================
   7 QUESTION TYPES ENGINE (NO REPEATS)
   ============================================================================ */
function startCategoryQuiz(catId, catName) {
  openStage("cat_" + catId, catName);
  renderNextCategoryQuestion(catId);
}

function renderNextCategoryQuestion(catId) {
  const stage = document.getElementById("stageBody");
  const item = drawUniqueQuestion(catId, State.diff);
  const types = ["mcq", "tf", "blank", "typed", "match", "order", "odd"];
  const chosenType = State.qtype === "mix" ? types[Math.floor(Math.random() * types.length)] : State.qtype;

  const qText = tr(item.q);
  const ansText = tr(item.a);
  const opts = (item.opts[State.lang] || item.opts.en).slice();

  if (chosenType === "mcq") {
    const shuffled = opts.slice().sort(() => Math.random() - 0.5);
    stage.innerHTML = `
      <div class="q-sub">#${item.id.replace("q_","")} · ${t("qtMcq")} · ${t(item.diff)}</div>
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
    const shownAns = showTrue ? ansText : (opts.find(o => o !== ansText) || opts[1]);
    stage.innerHTML = `
      <div class="q-sub">#${item.id.replace("q_","")} · ${t("qtTf")}</div>
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
    const masked = ansText.split("").map((ch, i) => (i === 0 || i === ansText.length - 1 || ch === " " ? ch : "_")).join(" ");
    stage.innerHTML = `
      <div class="q-sub">#${item.id.replace("q_","")} · ${t("qtBlank")}</div>
      <div class="q-prompt">${qText}</div>
      <div style="letter-spacing:3px;text-align:center;font-size:21px;font-weight:700;margin-bottom:14px;color:var(--primary)">${masked}</div>
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
      <div class="q-sub">#${item.id.replace("q_","")} · ${t("qtTyped")} (Hint: ${ansText.slice(0, 2)}...)</div>
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
   ALL 41 GAME MODES DISPATCHER (RANDOMIZED & HARDER)
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
    case "stat_higher_lower": return runHistoryHigherLower(stage);
    case "compare_two": return runElementCompare(stage);
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
    default: return renderNextCategoryQuestion(null);
  }
}

/* 1. TIMED BLITZ (60s) */
function runTimedBlitz(stage) {
  startCountdown(60, () => {
    stage.innerHTML = `<div class="q-prompt">⏱️ 60s Blitz Complete!</div><div class="feedback-banner">${t("score")}: ${State.score}</div>`;
  });
  const nextQ = () => {
    const item = drawUniqueQuestion(null, null);
    const ans = tr(item.a);
    const opts = (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5);
    stage.innerHTML = `<div class="q-sub">#${item.id.replace("q_","")} · ${t(item.diff)}</div><div class="q-prompt">${tr(item.q)}</div><div class="options-list" id="blitzOpts"></div>`;
    opts.forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        if (o === ans) { playCalmTone("good"); addPoints(20); } else playCalmTone("miss");
        nextQ();
      };
      document.getElementById("blitzOpts").appendChild(b);
    });
  };
  nextQ();
}

/* 2 & 7. UNSCRAMBLE (60+ PLACES & HARD SCIENTIFIC WORDS) */
function runUnscramble(stage, isTimedGeo) {
  const pool = isTimedGeo ? window.SPECIAL_DATA.unscrambleGeoPool : window.SPECIAL_DATA.unscrambleWordsPool;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const scrambled = target.split("").sort(() => Math.random() - 0.5);
  let picked = [];
  if (isTimedGeo) startCountdown(10, () => runUnscramble(stage, true));

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">${isTimedGeo ? "⏱️ 10s Geo Unscramble" : "🔤 Scientific & Master Word Unscramble"} (${target.length} letters)</div>
      <div class="q-prompt" style="letter-spacing:3px">${picked.join("") || "_ ".repeat(target.length)}</div>
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

/* 3. TRUE OR FALSE RUSH */
function runTfRush(stage) {
  startCountdown(45, () => {
    stage.innerHTML = `<div class="q-prompt">⚖️ Rush Complete! ${State.score} pts</div>`;
  });
  const nextCard = () => {
    const item = drawUniqueQuestion(null, null);
    const ans = tr(item.a);
    const opts = item.opts[State.lang] || item.opts.en;
    const isTrue = Math.random() > 0.5;
    const shown = isTrue ? ans : (opts.find(x => x !== ans) || opts[1]);
    stage.innerHTML = `
      <div class="q-sub">Swipe Left (${t("falseWord")}) or Right (${t("trueWord")})</div>
      <div class="q-prompt" id="swipeCard" style="padding:24px;background:var(--surface-alt);border-radius:18px;">
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

/* 4. SPEED TAP BUBBLES (DYNAMIC CHALLENGES) */
function runSpeedTap(stage) {
  const modes = [
    { prompt: "Tap ONLY World Capitals! Avoid Country Names!", good: window.SPECIAL_DATA.rawCountries.slice(0, 15).map(c => c[4]), bad: window.SPECIAL_DATA.rawCountries.slice(15, 30).map(c => c[1]) },
    { prompt: "Tap ONLY Chemical Elements! Avoid Planets/Cities!", good: window.SPECIAL_DATA.rawElements.slice(0, 15).map(e => e[2]), bad: ["Jupiter","Saturn","Algiers","Paris","Tokyo","Madrid","Oslo","Cairo"] }
  ];
  const m = modes[Math.floor(Math.random() * modes.length)];
  stage.innerHTML = `
    <div class="q-sub">${m.prompt}</div>
    <div class="falling-arena" id="arena"></div>
    <button class="btn-primary" id="btnRestartFall" style="width:100%">🔄 Next Wave</button>
  `;
  const arena = document.getElementById("arena");
  const gPick = m.good.sort(() => Math.random() - 0.5).slice(0, 4);
  const bPick = m.bad.sort(() => Math.random() - 0.5).slice(0, 4);
  [...gPick, ...bPick].sort(() => Math.random() - 0.5).forEach((label, i) => {
    const el = document.createElement("div");
    el.className = "falling-item";
    el.textContent = label;
    el.style.left = `${6 + (i % 4) * 23}%`;
    let top = -15 - (i * 28);
    el.style.top = `${top}px`;
    const iv = setInterval(() => {
      top += 3.5;
      el.style.top = `${top}px`;
      if (top > 245) clearInterval(iv);
    }, 70);
    el.onclick = () => {
      clearInterval(iv);
      const ok = m.good.includes(label);
      if (ok) { playCalmTone("good"); addPoints(15); el.style.background = "var(--accent-mint)"; }
      else { playCalmTone("miss"); el.style.background = "var(--accent-peach)"; }
      setTimeout(() => el.remove(), 180);
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
  const tasks = [
    { title: "Tap all Countries that use the EURO (€)", check: c => c[7] === "Euro" },
    { title: "Tap all Countries with Population over 50 Million", check: c => c[10] >= 50 },
    { title: "Tap all Countries with Area over 1,000,000 km²", check: c => c[11] >= 1000 }
  ];
  const task = tasks[Math.floor(Math.random() * tasks.length)];
  const sample = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5).slice(0, 16);
  stage.innerHTML = `
    <div class="q-prompt">${task.title}</div>
    <div class="grid-4x4" id="catBlitzGrid"></div>
  `;
  const g = document.getElementById("catBlitzGrid");
  sample.forEach(c => {
    const b = document.createElement("button");
    b.className = "grid-cell-btn";
    b.textContent = State.lang === "ar" ? c[3] : State.lang === "fr" ? c[2] : c[1];
    b.onclick = () => {
      if (task.check(c)) { b.classList.add("solved"); playCalmTone("good"); addPoints(15); }
      else { playCalmTone("miss"); b.style.opacity = "0.35"; }
    };
    g.appendChild(b);
  });
}

/* 6. MASTER SPELLING BEE */
function runSpellingBee(stage) {
  const sets = [
    { good: "Mediterranean", opts: ["Mediterranean", "Mediteranean", "Meditterranean", "Mediteranian"] },
    { good: "Photosynthesis", opts: ["Photosynthesis", "Fotosynthesis", "Photosinthesis", "Photosyntesis"] },
    { good: "Chrysanthemum", opts: ["Chrysanthemum", "Crysanthemum", "Chrysanthamum", "Chrisanthemum"] },
    { good: "Archaeology", opts: ["Archaeology", "Archeaology", "Archaelogy", "Arceology"] },
    { good: "Conscientious", opts: ["Conscientious", "Concientious", "Consciencious", "Consientious"] },
    { good: "Onomatopoeia", opts: ["Onomatopoeia", "Onomatopeia", "Onomotopoeia", "Onomatopoia"] },
    { good: "Kyrgyzstan", opts: ["Kyrgyzstan", "Kyrgystan", "Kirgizstan", "Kyrgyzistan"] },
    { good: "Entrepreneurship", opts: ["Entrepreneurship", "Enterpreneurship", "Entreprenurship", "Entrepreneurhip"] }
  ];
  const s = sets[Math.floor(Math.random() * sets.length)];
  stage.innerHTML = `<div class="q-prompt">🐝 Pick the exact spelling:</div><div class="options-list" id="beeOpts"></div><div id="fbBox"></div>`;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.good, s.good, () => runSpellingBee(stage), b);
    document.getElementById("beeOpts").appendChild(b);
  });
}

/* 8. THEMED WORDLE (28+ WORDS) */
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

/* 9. HANGMAN (50+ WORDS) */
function runHangman(stage) {
  const pool = [...window.SPECIAL_DATA.unscrambleGeoPool, ...window.SPECIAL_DATA.unscrambleWordsPool];
  const target = pool[Math.floor(Math.random() * pool.length)];
  let used = [];
  let misses = 0;
  const render = () => {
    const masked = target.split("").map(c => (used.includes(c) ? c : "_")).join(" ");
    stage.innerHTML = `
      <svg viewBox="0 0 200 120" class="svg-stage" style="height:125px">
        <line x1="20" y1="110" x2="180" y2="110" stroke="var(--primary)" stroke-width="4"/>
        ${misses >= 1 ? '<line x1="60" y1="110" x2="60" y2="20" stroke="var(--primary)" stroke-width="4"/>' : ''}
        ${misses >= 2 ? '<line x1="60" y1="20" x2="120" y2="20" stroke="var(--primary)" stroke-width="4"/>' : ''}
        ${misses >= 3 ? '<circle cx="120" cy="40" r="12" fill="none" stroke="var(--primary)" stroke-width="3"/>' : ''}
        ${misses >= 4 ? '<line x1="120" y1="52" x2="120" y2="82" stroke="var(--primary)" stroke-width="3"/>' : ''}
        ${misses >= 5 ? '<line x1="100" y1="65" x2="140" y2="65" stroke="var(--primary)" stroke-width="3"/>' : ''}
        ${misses >= 6 ? '<line x1="105" y1="98" x2="120" y2="82" stroke="var(--primary)" stroke-width="3"/>' : ''}
      </svg>
      <div class="q-sub">Misses: ${misses} / 6</div>
      <div class="q-prompt" style="letter-spacing:3px">${masked}</div>
      <div class="tile-row" id="hmKeys"></div>
      <div id="fbBox"></div>
    `;
    const kb = document.getElementById("hmKeys");
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(ch => {
      const b = document.createElement("button");
      b.className = "letter-tile";
      b.textContent = ch;
      b.disabled = used.includes(ch);
      if (used.includes(ch)) b.style.opacity = "0.3";
      b.onclick = () => {
        used.push(ch);
        if (!target.includes(ch)) misses++;
        else playCalmTone("tap");
        render();
        if (!target.split("").some(c => !used.includes(c))) {
          handleAnswerResult(true, target, () => runHangman(stage));
        } else if (misses >= 6) {
          handleAnswerResult(false, target, () => runHangman(stage));
        }
      };
      kb.appendChild(b);
    });
  };
  render();
}

/* 10. MISSING LETTERS (DYNAMICALLY BUILT FROM 65 CAPITALS) */
function runMissingLetters(stage) {
  const c = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * window.SPECIAL_DATA.rawCountries.length)];
  const ans = c[4].toUpperCase();
  const masked = ans.split("").map((ch, i) => ("AEIOU".includes(ch) && i > 0 ? "_" : ch)).join(" ");
  const decoys = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(x => x[4].toUpperCase());
  const opts = Array.from(new Set([ans, ...decoys])).slice(0, 4).sort(() => Math.random() - 0.5);
  stage.innerHTML = `
    <div class="q-sub">Fill the missing vowels (${c[1]})</div>
    <div class="q-prompt" style="letter-spacing:4px">${masked}</div>
    <div class="options-list" id="mlOpts"></div>
    <div id="fbBox"></div>
  `;
  opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === ans, ans, () => runMissingLetters(stage), b);
    document.getElementById("mlOpts").appendChild(b);
  });
}

/* 11. THEMED WORD SEARCH */
function runWordSearch(stage) {
  const packs = [
    { theme: "Algerian Cities", words: ["ORAN", "ALGIERS", "BLIDA", "ANNABA", "SETIF"] },
    { theme: "Planets", words: ["MARS", "VENUS", "EARTH", "SATURN", "PLUTO"] },
    { theme: "Precious Elements", words: ["GOLD", "SILVER", "NEON", "IRON", "ZINC"] }
  ];
  const p = packs[Math.floor(Math.random() * packs.length)];
  let found = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Theme: ${p.theme} — Tap each hidden word row (${found.length}/${p.words.length})</div>
      <div class="options-list" id="wsGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("wsGrid");
    p.words.forEach(word => {
      const pad = "XZQWKJBV".slice(0, 9 - word.length);
      const b = document.createElement("button");
      b.className = "opt-btn " + (found.includes(word) ? "correct" : "");
      b.style.letterSpacing = "6px";
      b.style.textAlign = "center";
      b.textContent = pad.slice(0, 2) + word + pad.slice(2);
      b.onclick = () => {
        if (!found.includes(word)) {
          found.push(word);
          playCalmTone("good");
          addPoints(15);
          render();
          if (found.length === p.words.length) handleAnswerResult(true, p.words.join(", "), () => runWordSearch(stage));
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 12. MULTI-PACK MINI CROSSWORD */
function runMiniCrossword(stage) {
  const packs = [
    { c1: "1-Across: Capital of Algeria (7 letters)", a1: "ALGIERS", c2: "2-Across: Chemical symbol for Gold (2 letters)", a2: "AU" },
    { c1: "1-Across: Author of Muqaddimah: Ibn ___ (7 letters)", a1: "KHALDUN", c2: "2-Across: Longest river in Africa (4 letters)", a2: "NILE" },
    { c1: "1-Across: Largest planet in solar system (7 letters)", a1: "JUPITER", c2: "2-Across: Unit of frequency (5 letters)", a2: "HERTZ" }
  ];
  const p = packs[Math.floor(Math.random() * packs.length)];
  stage.innerHTML = `
    <div class="q-sub">${p.c1}<br/>${p.c2}</div>
    <input id="cw1" class="search-input" placeholder="1-Across (${p.a1.length} letters)" />
    <input id="cw2" class="search-input" placeholder="2-Across (${p.a2.length} letters)" />
    <button class="btn-primary" id="cwCheck" style="width:100%">${t("checkBtn")}</button>
    <div id="fbBox"></div>
  `;
  document.getElementById("cwCheck").onclick = () => {
    const v1 = document.getElementById("cw1").value.trim().toUpperCase();
    const v2 = document.getElementById("cw2").value.trim().toUpperCase();
    handleAnswerResult(v1 === p.a1 && v2 === p.a2, `${p.a1} & ${p.a2}`, () => runMiniCrossword(stage));
  };
}

/* 13. ANAGRAM LETTER CHAIN */
function runAnagramChain(stage) {
  const c = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * 20)];
  const prev = c[1].toUpperCase();
  const lastChar = prev.slice(-1);
  const nextCountry = window.SPECIAL_DATA.rawCountries.find(x => x[1].toUpperCase().startsWith(lastChar)) || window.SPECIAL_DATA.rawCountries[0];
  const ans = nextCountry[1].toUpperCase();
  stage.innerHTML = `
    <div class="q-sub">Previous Word: <strong>${prev}</strong> (Ends with <strong>${lastChar}</strong>)</div>
    <div class="q-prompt">Name the Country starting with "${lastChar}" whose capital is ${nextCountry[4]}:</div>
    <input id="acIn" class="search-input" placeholder="Starts with ${lastChar}..." />
    <button class="btn-primary" id="acSub" style="width:100%">${t("checkBtn")}</button>
    <div id="fbBox"></div>
  `;
  document.getElementById("acSub").onclick = () => {
    const val = document.getElementById("acIn").value.trim().toUpperCase();
    handleAnswerResult(val === ans, ans, () => runAnagramChain(stage));
  };
}

/* 14 & 15. GUESS THE HISTORICAL ICON (PROGRESSIVE CLUES & VS BOT) */
function runGuessPerson(stage, vsBot) {
  const p = window.SPECIAL_DATA.peopleClues[Math.floor(Math.random() * window.SPECIAL_DATA.peopleClues.length)];
  const clues = p.clues[State.lang] || p.clues.en;
  const ans = tr(p.ans);
  const opts = p.opts[State.lang] || p.opts.en;
  let shown = 1;

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">${vsBot ? `🤖 SmartBot guesses at Clue 3! (Current Clue: ${shown}/4)` : `Multiplier: ${(5 - shown) * 25} pts`}</div>
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
    { icon: "🕌", ans: "Sacred Mosque / Architecture", opts: ["Sacred Mosque / Architecture", "Observatory", "Suspension Bridge", "Windmill"] },
    { icon: "🪐", ans: "Ringed Gas Giant (Saturn)", opts: ["Ringed Gas Giant (Saturn)", "Red Planet (Mars)", "Comet Nucleus", "Asteroid Belt"] },
    { icon: "🧭", ans: "Magnetic Navigation Compass", opts: ["Magnetic Navigation Compass", "Aneroid Barometer", "Astrolabe", "Seismograph"] },
    { icon: "🧬", ans: "DNA Double Helix", opts: ["DNA Double Helix", "Mitochondria", "Neuron Synapse", "Chloroplast"] }
  ];
  const it = items[Math.floor(Math.random() * items.length)];
  let blur = 14;
  const render = () => {
    stage.innerHTML = `
      <div style="height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-alt);border-radius:16px;margin-bottom:10px">
        <span style="font-size:76px;filter:blur(${blur}px);transform:scale(${1 + blur / 5});transition:all 0.25s ease">${it.icon}</span>
      </div>
      <button class="btn-secondary" id="btnSharpen" style="width:100%;margin-bottom:10px">🔍 Reduce Blur</button>
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
    <div class="q-prompt" style="font-size:42px">${m.emojis}</div>
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
  const sils = [
    { icon: "🐪", ans: "Arabian Dromedary", opts: ["Arabian Dromedary", "African Elephant", "Giraffe", "Moose"] },
    { icon: "🦅", ans: "Golden Eagle / Falcon", opts: ["Golden Eagle / Falcon", "Ostrich", "Pelican", "Albatross"] },
    { icon: "🐋", ans: "Humpback / Blue Whale", opts: ["Humpback / Blue Whale", "Great White Shark", "Manta Ray", "Narwhal"] },
    { icon: "🦂", ans: "Sahara Scorpion", opts: ["Sahara Scorpion", "Stag Beetle", "Tarantula", "Hermit Crab"] }
  ];
  const s = sils[Math.floor(Math.random() * sils.length)];
  stage.innerHTML = `
    <div class="q-sub">Identify this dark silhouette</div>
    <div style="text-align:center;font-size:78px;filter:brightness(0);margin:10px 0">${s.icon}</div>
    <div class="options-list" id="silOpts"></div>
    <div id="fbBox"></div>
  `;
  s.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.ans, s.ans, () => runSilhouette(stage), b);
    document.getElementById("silOpts").appendChild(b);
  });
}

/* 19. GUESS THE FOOTBALLER (12+ LEGENDS) */
function runFootballer(stage) {
  const f = window.SPECIAL_DATA.footballTransfers[Math.floor(Math.random() * window.SPECIAL_DATA.footballTransfers.length)];
  stage.innerHTML = `
    <div class="q-sub">⚽ Club Transfer Career Path:</div>
    <div class="q-prompt">${f.career}</div>
    <div class="options-list" id="fbOpts"></div>
    <div id="fbBox"></div>
  `;
  f.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === f.ans, f.ans, () => runFootballer(stage), b);
    document.getElementById("fbOpts").appendChild(b);
  });
}

/* 20. PIXELATED MONUMENT REVEAL */
function runPixelClear(stage) {
  const mons = [
    { svg: '<polygon points="40,12 12,62 68,62" fill="#e9c46a"/>', ans: "Pyramids of Giza (Egypt)", opts: ["Pyramids of Giza (Egypt)", "Colosseum (Rome)", "Parthenon (Athens)", "Petra (Jordan)"] },
    { svg: '<polygon points="40,8 33,65 47,65" fill="#729ea1"/><rect x="24" y="60" width="32" height="8" fill="#729ea1"/>', ans: "Maqam Echahid / Eiffel Tower", opts: ["Maqam Echahid / Eiffel Tower", "Taj Mahal", "Brandenburg Gate", "Sydney Opera"] }
  ];
  const m = mons[Math.floor(Math.random() * mons.length)];
  stage.innerHTML = `
    <div class="q-sub">Identify the geometric monument silhouette</div>
    <svg viewBox="0 0 80 80" class="svg-stage" style="height:130px">${m.svg}</svg>
    <div class="options-list" id="pxOpts"></div>
    <div id="fbBox"></div>
  `;
  m.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === m.ans, m.ans, () => runPixelClear(stage), b);
    document.getElementById("pxOpts").appendChild(b);
  });
}

/* 21. FLAG PALETTE GUESS (MULTI-FLAG) */
function runColorGuess(stage) {
  const flags = [
    { colors: ["#006233","#ffffff","#d21034"], ans: "Algeria 🇩🇿", opts: ["Algeria 🇩🇿","France 🇫🇷","Brazil 🇧🇷","Sweden 🇸🇪"] },
    { colors: ["#002395","#ffffff","#ed2939"], ans: "France 🇫🇷", opts: ["France 🇫🇷","Germany 🇩🇪","Algeria 🇩🇿","Brazil 🇧🇷"] },
    { colors: ["#000000","#dd0000","#ffce00"], ans: "Germany 🇩🇪", opts: ["Germany 🇩🇪","Italy 🇮🇹","Japan 🇯🇵","Argentina 🇦🇷"] },
    { colors: ["#009c3b","#ffdf00","#002776"], ans: "Brazil 🇧🇷", opts: ["Brazil 🇧🇷","Spain 🇪🇸","Canada 🇨🇦","Morocco 🇲🇦"] },
    { colors: ["#c1272d","#006233","#c1272d"], ans: "Morocco 🇲🇦", opts: ["Morocco 🇲🇦","Japan 🇯🇵","Sweden 🇸🇪","Greece 🇬🇷"] }
  ];
  const f = flags[Math.floor(Math.random() * flags.length)];
  stage.innerHTML = `
    <div class="q-sub">Identify the nation from its exact color palette:</div>
    <div style="display:flex;height:70px;border-radius:16px;overflow:hidden;border:1px solid var(--border);margin-bottom:14px">
      ${f.colors.map(c => `<div style="flex:1;background:${c}"></div>`).join("")}
    </div>
    <div class="options-list" id="cgOpts"></div>
    <div id="fbBox"></div>
  `;
  f.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === f.ans, f.ans, () => runColorGuess(stage), b);
    document.getElementById("cgOpts").appendChild(b);
  });
}

/* 22. WHO AM I? (DEDUCTION) */
function runWhoAmI(stage) {
  const el = window.SPECIAL_DATA.rawElements[Math.floor(Math.random() * window.SPECIAL_DATA.rawElements.length)];
  const decoys = window.SPECIAL_DATA.rawElements.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(x => x[2]);
  const opts = Array.from(new Set([el[2], ...decoys])).slice(0, 4).sort(() => Math.random() - 0.5);
  stage.innerHTML = `
    <div class="q-sub">20-Questions Deduction Log:</div>
    <div class="options-list" style="margin-bottom:12px">
      <div class="pill">Q1: Is it a pure chemical element? ➔ YES</div>
      <div class="pill">Q2: Is its atomic number exactly ${el[1]}? ➔ YES</div>
      <div class="pill">Q3: Is its periodic symbol "${el[0]}"? ➔ YES</div>
    </div>
    <div class="options-list" id="waiOpts"></div>
    <div id="fbBox"></div>
  `;
  opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === el[2], el[2], () => runWhoAmI(stage), b);
    document.getElementById("waiOpts").appendChild(b);
  });
}

/* 23. WORLD ATLAS MAP TAP (65 COUNTRIES) */
function runMapClick(stage) {
  const locs = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5).slice(0, 10);
  const target = locs[0];
  const tName = State.lang === "ar" ? target[3] : State.lang === "fr" ? target[2] : target[1];
  stage.innerHTML = `
    <div class="q-prompt">🗺️ Tap the circle located at <strong>${tName} (${target[4]})</strong></div>
    <svg viewBox="0 0 1000 500" class="svg-stage">
      <rect width="1000" height="500" fill="var(--surface-alt)"/>
      <path d="M150,80 L320,90 L360,220 L260,240 Z" fill="var(--primary-soft)"/>
      <path d="M270,250 L370,270 L340,430 L280,410 Z" fill="var(--primary-soft)"/>
      <path d="M440,70 L600,70 L590,155 L440,155 Z" fill="var(--primary-soft)"/>
      <path d="M430,165 L610,165 L580,380 L470,360 Z" fill="var(--primary-soft)"/>
      <path d="M610,75 L890,85 L860,260 L620,240 Z" fill="var(--primary-soft)"/>
      <path d="M760,310 L890,310 L880,410 L760,410 Z" fill="var(--primary-soft)"/>
      ${locs.map(l => `<circle cx="${l[12]}" cy="${l[13]}" r="18" fill="var(--primary)" stroke="#fff" stroke-width="3" data-id="${l[0]}" style="cursor:pointer"/>`).join("")}
    </svg>
    <div id="fbBox"></div>
  `;
  stage.querySelectorAll("circle").forEach(c => {
    c.onclick = () => {
      const hit = c.getAttribute("data-id") === target[0];
      handleAnswerResult(hit, tName, () => runMapClick(stage));
    };
  });
}

/* 24. COUNTRY BORDER OUTLINE */
function runBorderGuess(stage) {
  const shapes = [
    { pts: "75,25 135,25 165,85 110,175 45,120 55,55", ans: "Algeria", opts: ["Algeria","Italy","Chile","Japan"] },
    { pts: "90,20 115,30 140,140 155,165 130,180 105,90", ans: "Italy", opts: ["Italy","Algeria","Brazil","Egypt"] },
    { pts: "45,45 155,45 155,155 45,155", ans: "Egypt", opts: ["Egypt","Norway","Cuba","Vietnam"] }
  ];
  const s = shapes[Math.floor(Math.random() * shapes.length)];
  stage.innerHTML = `
    <div class="q-sub">Identify this Sovereign Border Polygon</div>
    <svg viewBox="0 0 200 200" class="svg-stage" style="height:150px">
      <polygon points="${s.pts}" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="4"/>
    </svg>
    <div class="options-list" id="bgOpts"></div>
    <div id="fbBox"></div>
  `;
  s.opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.ans, s.ans, () => runBorderGuess(stage), b);
    document.getElementById("bgOpts").appendChild(b);
  });
}

/* 25. 65-NATION CAPITAL MATCH (ENDLESS RANDOM PAIRS) */
function renderCapitalMatchMode(stage, nextFn) {
  const pairs = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5).slice(0, 5);
  const shuffledCaps = pairs.slice().sort(() => Math.random() - 0.5);
  let selCountry = null;
  let matched = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap a Country on the left, then tap its matching Capital on the right</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="cmGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("cmGrid");
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      const cp = shuffledCaps[i];
      const doneL = matched.includes(p[0]);
      const doneR = matched.includes(cp[0]);

      const cBtn = document.createElement("button");
      cBtn.className = "grid-cell-btn " + (doneL ? "solved" : selCountry === p[0] ? "selected" : "");
      cBtn.textContent = State.lang === "ar" ? p[3] : State.lang === "fr" ? p[2] : p[1];
      cBtn.onclick = () => { selCountry = p[0]; render(); };

      const capBtn = document.createElement("button");
      capBtn.className = "grid-cell-btn " + (doneR ? "solved" : "");
      capBtn.textContent = State.lang === "ar" ? cp[6] : State.lang === "fr" ? cp[5] : cp[4];
      capBtn.onclick = () => {
        if (selCountry === cp[0]) {
          matched.push(cp[0]);
          selCountry = null;
          playCalmTone("good");
          addPoints(15);
          render();
          if (matched.length === pairs.length) handleAnswerResult(true, "5/5 Capitals Matched!", nextFn);
        } else playCalmTone("miss");
      };
      g.appendChild(cBtn);
      g.appendChild(capBtn);
    }
  };
  render();
}

/* 26. GEO HIGHER OR LOWER (4,000+ COMBINATIONS) */
function runHigherLower(stage) {
  const locs = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5);
  const a = locs[0];
  const b = locs[1];
  const byArea = Math.random() > 0.5;
  const valA = byArea ? a[11] : a[10];
  const valB = byArea ? b[11] : b[10];
  const nA = State.lang === "ar" ? a[3] : State.lang === "fr" ? a[2] : a[1];
  const nB = State.lang === "ar" ? b[3] : State.lang === "fr" ? b[2] : b[1];

  stage.innerHTML = `
    <div class="q-sub">${byArea ? "🌍 Land Area (in 1,000 km²)" : "👥 Population (in Millions)"}</div>
    <div class="q-prompt">${nA}: <strong>${valA.toLocaleString()}</strong><br/>vs<br/>${nB}: <strong>?</strong></div>
    <div class="options-list">
      <button class="opt-btn" id="hlHigh">${t("higherWord")}</button>
      <button class="opt-btn" id="hlLow">${t("lowerWord")}</button>
    </div>
    <div id="fbBox"></div>
  `;
  document.getElementById("hlHigh").onclick = (e) => handleAnswerResult(valB >= valA, `${nB} = ${valB.toLocaleString()}`, () => runHigherLower(stage), e.target);
  document.getElementById("hlLow").onclick = (e) => handleAnswerResult(valB <= valA, `${nB} = ${valB.toLocaleString()}`, () => runHigherLower(stage), e.target);
}

/* 27. DISTANCE GUESS (PIN DROP ON 65 CAPITALS) */
function runDistanceGuess(stage) {
  const locs = window.SPECIAL_DATA.rawCountries;
  const target = locs[Math.floor(Math.random() * locs.length)];
  const tName = State.lang === "ar" ? `${target[6]} (${target[3]})` : `${target[4]} (${target[1]})`;
  stage.innerHTML = `
    <div class="q-prompt">📍 Drop your pin within 950 km of <strong>${tName}</strong></div>
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
    const dist = Math.round(Math.hypot(x - target[12], y - target[13]) * 11);
    svg.innerHTML += `
      <line x1="${x}" y1="${y}" x2="${target[12]}" y2="${target[13]}" stroke="var(--primary)" stroke-width="4" stroke-dasharray="8,8"/>
      <circle cx="${x}" cy="${y}" r="14" fill="#e76f51"/>
      <circle cx="${target[12]}" cy="${target[13]}" r="14" fill="#2a9d8f"/>
    `;
    handleAnswerResult(dist <= 950, `Distance error: ~${dist} km`, () => runDistanceGuess(stage));
  };
}

/* 28. HISTORY YEAR HIGHER OR LOWER */
function runHistoryHigherLower(stage) {
  const h = window.SPECIAL_DATA.rawHistory.slice().sort(() => Math.random() - 0.5);
  const a = h[0];
  const b = h[1];
  const evA = State.lang === "ar" ? a[3] : State.lang === "fr" ? a[2] : a[1];
  const evB = State.lang === "ar" ? b[3] : State.lang === "fr" ? b[2] : b[1];
  stage.innerHTML = `
    <div class="q-sub">⏳ Historical Year Comparison</div>
    <div class="q-prompt">${evA}: <strong>Year ${a[0]}</strong><br/>vs<br/>${evB}: <strong>Later (Higher) or Earlier (Lower)?</strong></div>
    <div class="options-list">
      <button class="opt-btn" id="hhHigh">${t("higherWord")} (Later Year)</button>
      <button class="opt-btn" id="hhLow">${t("lowerWord")} (Earlier Year)</button>
    </div>
    <div id="fbBox"></div>
  `;
  document.getElementById("hhHigh").onclick = (e) => handleAnswerResult(b[0] >= a[0], `Year ${b[0]}`, () => runHistoryHigherLower(stage), e.target);
  document.getElementById("hhLow").onclick = (e) => handleAnswerResult(b[0] <= a[0], `Year ${b[0]}`, () => runHistoryHigherLower(stage), e.target);
}

/* 29. ELEMENT ATOMIC NUMBER DUEL */
function runElementCompare(stage) {
  const els = window.SPECIAL_DATA.rawElements.slice().sort(() => Math.random() - 0.5);
  const a = els[0];
  const b = els[1];
  stage.innerHTML = `
    <div class="q-sub">⚔️ Which Chemical Element has the HIGHER Atomic Number?</div>
    <div class="options-list">
      <button class="opt-btn" id="elA">${a[2]} (${a[0]})</button>
      <button class="opt-btn" id="elB">${b[2]} (${b[0]})</button>
    </div>
    <div id="fbBox"></div>
  `;
  document.getElementById("elA").onclick = (e) => handleAnswerResult(a[1] > b[1], `${a[2]}=${a[1]}, ${b[2]}=${b[1]}`, () => runElementCompare(stage), e.target);
  document.getElementById("elB").onclick = (e) => handleAnswerResult(b[1] > a[1], `${a[2]}=${a[1]}, ${b[2]}=${b[1]}`, () => runElementCompare(stage), e.target);
}

/* 30. EXPERT ODD ONE OUT */
function renderOddOneOutMode(stage, nextFn) {
  const sets = [
    { opts: ["Algiers", "Tunis", "Rabat", "Casablanca"], odd: "Casablanca", why: "Casablanca is not a national capital." },
    { opts: ["Helium", "Neon", "Argon", "Nitrogen"], odd: "Nitrogen", why: "Nitrogen is not a Noble Gas." },
    { opts: ["Ibn Sina", "Al-Razi", "Ibn al-Nafis", "Vasco da Gama"], odd: "Vasco da Gama", why: "Vasco da Gama was a Portuguese navigator, not a Golden Age physician." },
    { opts: ["Femur", "Tibia", "Fibula", "Cerebellum"], odd: "Cerebellum", why: "Cerebellum is part of the brain, not a leg bone." },
    { opts: ["Joule", "Watt", "Pascal", "Kelvin"], odd: "Kelvin", why: "Kelvin is a base SI unit; the others are derived units named after European physicists." },
    { opts: ["Oran", "Constantine", "Annaba", "Marrakech"], odd: "Marrakech", why: "Marrakech is in Morocco; the others are Algerian wilayas." }
  ];
  const s = sets[Math.floor(Math.random() * sets.length)];
  stage.innerHTML = `<div class="q-prompt">🧐 Tap the Odd One Out:</div><div class="options-list" id="oddOpts"></div><div id="fbBox"></div>`;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.odd, `${s.odd} — ${s.why}`, nextFn, b);
    document.getElementById("oddOpts").appendChild(b);
  });
}

/* 31. DYNAMIC TIMELINE SORT (PULLS 4 RANDOM MILESTONES FROM 55 EVENTS) */
function renderTimelineSortMode(stage, nextFn) {
  const sample = window.SPECIAL_DATA.rawHistory.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  let picked = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">⏳ Tap historical milestones from EARLIEST to LATEST</div>
      <div class="options-list" id="tlList"></div>
      <div id="fbBox"></div>
    `;
    const box = document.getElementById("tlList");
    sample.forEach(ev => {
      const doneIdx = picked.indexOf(ev);
      const label = State.lang === "ar" ? ev[3] : State.lang === "fr" ? ev[2] : ev[1];
      const b = document.createElement("button");
      b.className = "opt-btn " + (doneIdx >= 0 ? "correct" : "");
      b.textContent = (doneIdx >= 0 ? `#${doneIdx + 1} (${ev[0]}) — ` : "") + label;
      b.onclick = () => {
        if (doneIdx >= 0) return;
        picked.push(ev);
        playCalmTone("tap");
        render();
        if (picked.length === 4) {
          const ok = picked.every((x, i) => i === 0 || x[0] >= picked[i - 1][0]);
          const correctOrder = sample.slice().sort((a, b) => a[0] - b[0]).map(x => x[0]).join(" ➔ ");
          handleAnswerResult(ok, correctOrder, nextFn);
        }
      };
      box.appendChild(b);
    });
  };
  render();
}

/* 32. ELEMENT & SYMBOL MEMORY MATCH */
function runMatchPairs(stage) {
  const els = window.SPECIAL_DATA.rawElements.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  const cards = [];
  els.forEach(e => {
    cards.push({ id: e[0], label: e[0] });
    cards.push({ id: e[0], label: e[2] });
  });
  const deck = cards.sort(() => Math.random() - 0.5);
  let open = [];
  let solved = [];
  const render = () => {
    stage.innerHTML = `<div class="q-sub">🃏 Match each Element with its Chemical Symbol</div><div class="grid-4x4" id="memGrid"></div><div id="fbBox"></div>`;
    const g = document.getElementById("memGrid");
    deck.forEach((card, idx) => {
      const isUp = open.includes(idx) || solved.includes(idx);
      const b = document.createElement("button");
      b.className = "grid-cell-btn " + (solved.includes(idx) ? "solved" : "");
      b.textContent = isUp ? card.label : "❓";
      b.onclick = () => {
        if (isUp || open.length >= 2) return;
        open.push(idx);
        playCalmTone("tap");
        render();
        if (open.length === 2) {
          if (deck[open[0]].id === deck[open[1]].id) {
            solved.push(open[0], open[1]);
            open = [];
            addPoints(20);
            render();
            if (solved.length === deck.length) handleAnswerResult(true, "All Elements Paired!", () => runMatchPairs(stage));
          } else {
            setTimeout(() => { open = []; render(); }, 650);
          }
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 33. CONNECTIONS (MULTI-BOARD) */
function runConnections(stage) {
  const groups = window.SPECIAL_DATA.connectionsPacks[Math.floor(Math.random() * window.SPECIAL_DATA.connectionsPacks.length)];
  let all = Object.values(groups).flat().sort(() => Math.random() - 0.5);
  let sel = [];
  let solvedGroups = [];

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">🕸️ Group 16 words into 4 categories (${solvedGroups.length}/4 solved)</div>
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
            if (solvedGroups.length === 4) handleAnswerResult(true, Object.keys(groups).join(" · "), () => runConnections(stage));
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

/* 34. HARD NUMBER PUZZLES */
function runNumberPuzzles(stage) {
  const item = drawUniqueQuestion("math", "hard");
  const ans = tr(item.a);
  const opts = (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5);
  stage.innerHTML = `<div class="q-prompt">🔢 ${tr(item.q)}</div><div class="options-list" id="numOpts"></div><div id="fbBox"></div>`;
  opts.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === ans, ans, () => runNumberPuzzles(stage), b);
    document.getElementById("numOpts").appendChild(b);
  });
}

/* 35. TIME TRAVEL ODYSSEY */
function runTimeTravel(stage) {
  let eraIdx = 1;
  const step = () => {
    const item = drawUniqueQuestion("history", null);
    const ans = tr(item.a);
    stage.innerHTML = `
      <div class="pill" style="margin-bottom:10px">🕰️ Time Portal #${eraIdx} · ${t(item.diff)}</div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="ttOpts"></div>
      <div id="fbBox"></div>
    `;
    (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5).forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        eraIdx++;
        handleAnswerResult(o === ans, ans, step, b);
      };
      document.getElementById("ttOpts").appendChild(b);
    });
  };
  step();
}

/* 36. 5-LOCK VAULT ESCAPE ROOM */
function runEscapeRoom(stage) {
  let lock = 1;
  const render = () => {
    const diff = lock <= 2 ? "easy" : lock <= 4 ? "medium" : "hard";
    const item = drawUniqueQuestion(null, diff);
    const ans = tr(item.a);
    stage.innerHTML = `
      <div class="q-sub">🔐 Vault Lock ${lock} of 5 (${t(diff)}) — Wrong answer resets to Lock 1!</div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="erOpts"></div>
      <div id="fbBox"></div>
    `;
    (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5).forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        const ok = o === ans;
        if (ok && lock < 5) { lock++; playCalmTone("good"); addPoints(25); render(); }
        else if (ok && lock === 5) { handleAnswerResult(true, "All 5 Vault Locks Cracked! 🏆", () => runEscapeRoom(stage), b); }
        else { lock = 1; handleAnswerResult(false, ans, render, b); }
      };
      document.getElementById("erOpts").appendChild(b);
    });
  };
  render();
}

/* 37. 9-TILE TREASURE HUNT */
function runTreasureHunt(stage) {
  let revealed = 0;
  const render = () => {
    const item = drawUniqueQuestion(null, revealed < 3 ? "easy" : revealed < 6 ? "medium" : "hard");
    const ans = tr(item.a);
    stage.innerHTML = `
      <div class="q-sub">🏝️ Treasure Map Sectors Unlocked: ${revealed} / 8</div>
      <div class="grid-4x4" style="margin-bottom:12px">
        ${[0,1,2,3,4,5,6,7].map(i => `<div class="grid-cell-btn ${i < revealed ? 'solved' : ''}">${i < revealed ? '🗺️💎' : '🌫️'}</div>`).join("")}
      </div>
      <div class="q-prompt">${tr(item.q)}</div>
      <div class="options-list" id="thOpts"></div>
      <div id="fbBox"></div>
    `;
    (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5).forEach(o => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.textContent = o;
      b.onclick = () => {
        if (o === ans) revealed = Math.min(8, revealed + 1);
        handleAnswerResult(o === ans, ans, render, b);
      };
      document.getElementById("thOpts").appendChild(b);
    });
  };
  render();
}

/* 38. 5-POINT SPOT THE DIFFERENCE */
function runSpotDifference(stage) {
  let found = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Tap all 5 differences on the lower canvas (${found.length}/5 found)</div>
      <svg viewBox="0 0 320 100" class="svg-stage">
        <circle cx="40" cy="35" r="14" fill="#e9c46a"/>
        <rect x="95" y="30" width="32" height="45" fill="#729ea1"/>
        <polygon points="175,20 155,75 195,75" fill="#2a9d8f"/>
        <circle cx="240" cy="50" r="18" fill="#8ab8bc"/>
        <rect x="280" y="25" width="22" height="50" fill="#d4a373"/>
      </svg>
      <svg viewBox="0 0 320 100" class="svg-stage" id="diffSvg">
        <circle cx="40" cy="35" r="22" fill="#e76f51" data-d="1" style="cursor:pointer"/>
        <rect x="95" y="15" width="32" height="60" fill="#264653" data-d="2" style="cursor:pointer"/>
        <polygon points="175,35 155,75 195,75" fill="#e9c46a" data-d="3" style="cursor:pointer"/>
        <circle cx="240" cy="50" r="18" fill="#e63946" data-d="4" style="cursor:pointer"/>
        <rect x="280" y="45" width="22" height="30" fill="#68b684" data-d="5" style="cursor:pointer"/>
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
          if (found.length === 5) handleAnswerResult(true, "5/5 Differences Spotted!", () => runSpotDifference(stage));
          else render();
        }
      };
    });
  };
  render();
}

/* 39. MILLIONAIRE 15 LADDER (SCALES EASY -> MEDIUM -> HARD) */
function runMillionaire(stage) {
  let step = 1;
  const render = () => {
    const tier = step <= 5 ? "easy" : step <= 10 ? "medium" : "hard";
    const item = drawUniqueQuestion(null, tier);
    const ans = tr(item.a);
    const opts = (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5);
    stage.innerHTML = `
      <div class="stage-topbar">
        <span class="pill">💎 Step ${step}/15 · ${t(tier)}</span>
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
        else step = step > 10 ? 10 : step > 5 ? 5 : 1;
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

/* 40. PRO JEOPARDY BOARD (100=EASY, 300=MEDIUM, 500=HARD) */
function runJeopardy(stage) {
  const cats = ["science", "history", "geography", "math"];
  let used = [];
  const renderBoard = () => {
    stage.innerHTML = `<div class="q-sub">🎛️ Pick Category &amp; Difficulty Value</div><div class="grid-4x4" id="jpBoard"></div><div id="fbBox"></div>`;
    const g = document.getElementById("jpBoard");
    cats.forEach(c => {
      const h = document.createElement("div");
      h.className = "grid-cell-btn solved";
      h.textContent = c.toUpperCase();
      g.appendChild(h);
    });
    [100, 300, 500].forEach(pts => {
      const tier = pts === 100 ? "easy" : pts === 300 ? "medium" : "hard";
      cats.forEach(c => {
        const key = `${c}_${pts}`;
        const b = document.createElement("button");
        b.className = "grid-cell-btn " + (used.includes(key) ? "solved" : "");
        b.textContent = used.includes(key) ? "✓" : `${pts}`;
        b.onclick = () => {
          if (used.includes(key)) return;
          used.push(key);
          const item = drawUniqueQuestion(c, tier);
          const ans = tr(item.a);
          stage.innerHTML = `<div class="q-sub">${c.toUpperCase()} · ${pts} pts (${t(tier)})</div><div class="q-prompt">${tr(item.q)}</div><div class="options-list" id="jpOpts"></div><div id="fbBox"></div>`;
          (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5).forEach(o => {
            const ob = document.createElement("button");
            ob.className = "opt-btn";
            ob.textContent = o;
            ob.onclick = () => handleAnswerResult(o === ans, ans, renderBoard, ob);
            document.getElementById("jpOpts").appendChild(ob);
          });
        };
        g.appendChild(b);
      });
    });
  };
  renderBoard();
}

/* 41. SPOT THE FAKE FACT (DYNAMICALLY GENERATED FROM REAL + ALTERED ENCYCLOPEDIA FACTS) */
function runTrueOrFake(stage) {
  const c1 = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * 30)];
  const c2 = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * 30) + 30];
  const fakeCap = window.SPECIAL_DATA.rawCountries[10][4];
  const statements = [
    { text: `The official capital city of ${c1[1]} is ${c1[4]}.`, fake: false },
    { text: `The official currency of ${c2[1]} is the ${c2[7]}.`, fake: false },
    { text: `The official capital city of ${c2[1]} is ${fakeCap} and its currency is the Yen.`, fake: true }
  ].sort(() => Math.random() - 0.5);

  stage.innerHTML = `<div class="q-prompt">🕵️‍♀️ Spot the ONE Fake Statement among these three:</div><div class="options-list" id="tfkOpts"></div><div id="fbBox"></div>`;
  statements.forEach(s => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = s.text;
    b.onclick = () => handleAnswerResult(s.fake === true, `${c2[1]}'s capital is ${c2[4]}`, () => runTrueOrFake(stage), b);
    document.getElementById("tfkOpts").appendChild(b);
  });
}

/* INITIALIZATION */
window.addEventListener("DOMContentLoaded", () => {
  updateHeaderStats();
  applyLanguageAndTheme();

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

  document.querySelectorAll("#hubFilterBar .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#hubFilterBar .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      State.hubFilter = chip.getAttribute("data-filter");
      renderModesHub();
    });
  });

  document.getElementById("searchModes").addEventListener("input", (e) => {
    State.searchQuery = e.target.value;
    renderModesHub();
  });

  document.querySelectorAll("#diffSelector .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#diffSelector .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      State.diff = btn.getAttribute("data-diff");
      renderCategories();
    });
  });

  document.querySelectorAll("#qTypeSelector .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#qTypeSelector .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      State.qtype = chip.getAttribute("data-qtype");
      renderCategories();
    });
  });

  document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-lang]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      State.lang = btn.getAttribute("data-lang");
      saveState();
      applyLanguageAndTheme();
    });
  });

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
    State.xp = 0; State.streak = 0; State.favorites = []; State.highScores = {}; State.seenIds = [];
    saveState();
    renderModesHub();
    renderStats();
  };

  document.getElementById("btnQuickPlay").onclick = () => startCategoryQuiz(null, t("appTitle"));
  document.getElementById("btnExitStage").onclick = () => {
    clearStageTimer();
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("viewHub").classList.add("active");
  };
});
