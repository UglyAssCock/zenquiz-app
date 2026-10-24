/* ============================================================================
   ZENQUIZ PRO - UPGRADED ENGINE (34 MODES, REAL MAPS, WORDLE KB, UNDO/REDO,
   BOT MEMORY DUEL, SUDDEN-DEATH MILLIONAIRE, SIZE IT UP & WEIGHT IT UP)
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
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.22);
    }
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.26);
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

/* SMART NON-REPEATING QUESTION DRAW */
function drawUniqueQuestion(catId, diff) {
  const seenSet = new Set(State.seenIds);
  let pool = window.QUESTION_BANK.filter(q =>
    (!catId || q.cat === catId) &&
    (!diff || q.diff === diff) &&
    !seenSet.has(q.id)
  );
  if (pool.length === 0) pool = window.QUESTION_BANK.filter(q => (!catId || q.cat === catId) && !seenSet.has(q.id));
  if (pool.length === 0) pool = window.QUESTION_BANK.filter(q => !seenSet.has(q.id));
  if (pool.length === 0) {
    State.seenIds = [];
    pool = window.QUESTION_BANK;
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  State.seenIds.push(chosen.id);
  if (State.seenIds.length > 5000) State.seenIds.shift();
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
    <div class="score-row"><strong>📚 Total Offline Questions</strong><span>${window.QUESTION_BANK.length.toLocaleString()} Unique Qs</span></div>
    <div class="score-row"><strong>✅ Unique Questions Answered</strong><span>${State.seenIds.length} / ${window.QUESTION_BANK.length}</span></div>
    <div class="score-row"><strong>⭐ Player Level</strong><span>Lv ${lv} (${State.xp} XP)</span></div>
    <div class="score-row"><strong>🔥 Current Streak</strong><span>${State.streak}</span></div>
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
   7 QUESTION TYPES ENGINE (MCQ, TF, BLANK, TYPED, MATCH, ORDER, ODD ONE OUT)
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
      <div class="q-sub">#${item.id.replace("q_","")} · ${t("qtTyped")} (Starts with: ${ansText.slice(0, 2)}...)</div>
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

function handleAnswerResult(isCorrect, detailText, nextCallback, btnEl, extraExplanation) {
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
        <div>${isCorrect ? t("correctMsg") : t("wrongMsg") + detailText}</div>
        ${extraExplanation ? `<div style="margin-top:8px;font-size:13px;font-weight:500;opacity:0.92">💡 ${extraExplanation}</div>` : ""}
        <button class="btn-primary" style="margin-top:10px" id="btnNextQ">${t("nextBtn")}</button>
      </div>
    `;
    document.getElementById("btnNextQ").onclick = nextCallback;
  }
}

/* ============================================================================
   34 GAME MODES DISPATCHER
   ============================================================================ */
function startMode(modeId, titleText) {
  openStage(modeId, titleText);
  const stage = document.getElementById("stageBody");

  switch (modeId) {
    case "timed_blitz": return runTimedBlitz(stage);
    case "unscramble_geo": return runUnscramble(stage, true);
    case "tf_rush": return runTfRush(stage);
    case "category_blitz": return runCategoryBlitz(stage);
    case "spelling_bee": return runSpellingBee(stage);
    case "unscramble_words": return runUnscramble(stage, false);
    case "wordle_theme": return runWordle(stage);
    case "hangman": return runHangman(stage);
    case "mini_crossword": return runMiniCrossword(stage);
    case "guess_person": return runGuessPerson(stage, false);
    case "guess_vs_bot": return runGuessPerson(stage, true);
    case "guess_movie_emoji": return runMovieEmoji(stage);
    case "guess_footballer": return runFootballer(stage);
    case "color_guess": return runColorGuess(stage);
    case "who_am_i": return runWhoAmI(stage);
    case "map_click": return runMapClick(stage);
    case "border_guess": return runBorderGuess(stage);
    case "capital_match": return renderCapitalMatchMode(stage, () => startMode(modeId, titleText));
    case "geo_higher_lower": return runHigherLower(stage);
    case "distance_guess": return runDistanceGuess(stage);
    case "size_it_up": return runSizeOrWeight(stage, "size");
    case "weight_it_up": return runSizeOrWeight(stage, "weight");
    case "stat_higher_lower": return runHistoryHigherLower(stage);
    case "compare_two": return runElementCompare(stage);
    case "odd_one_out": return renderOddOneOutMode(stage, () => startMode(modeId, titleText));
    case "timeline_sort": return renderTimelineSortMode(stage, () => startMode(modeId, titleText));
    case "match_pairs": return runMatchPairsVsBot(stage);
    case "connections": return runConnections(stage);
    case "number_puzzles": return runNumberPuzzles(stage);
    case "time_travel": return runTimeTravel(stage);
    case "escape_room": return runEscapeRoom(stage);
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

/* 2 & 6. UNSCRAMBLE WITH FULL UNDO / REDO / CLEAR STACK */
function runUnscramble(stage, isTimedGeo) {
  const pool = isTimedGeo ? window.SPECIAL_DATA.unscrambleGeoPool : window.SPECIAL_DATA.unscrambleWordsPool;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const initialScrambled = target.split("").sort(() => Math.random() - 0.5);

  let history = [{ picked: [], scrambled: initialScrambled.slice() }];
  let hIdx = 0;

  if (isTimedGeo) startCountdown(15, () => runUnscramble(stage, true));

  const render = () => {
    const curr = history[hIdx];
    stage.innerHTML = `
      <div class="q-sub">${isTimedGeo ? "⏱️ 15s World City/Country Unscramble" : "🔤 Master Scientific Unscramble"} (${target.length} letters)</div>
      <div class="q-prompt" style="letter-spacing:3px;min-height:36px">${curr.picked.join("") || "_ ".repeat(target.length)}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px">
        <button class="btn-secondary" id="btnUndo" ${hIdx === 0 ? "disabled style='opacity:0.4'" : ""}>↩️ Undo</button>
        <button class="btn-secondary" id="btnRedo" ${hIdx >= history.length - 1 ? "disabled style='opacity:0.4'" : ""}>↪️ Redo</button>
        <button class="btn-secondary" id="btnClear" ${curr.picked.length === 0 ? "disabled style='opacity:0.4'" : ""}>🗑️ Clear</button>
      </div>
      <div class="tile-row" id="scrTiles"></div>
      <div id="fbBox"></div>
    `;

    document.getElementById("btnUndo").onclick = () => {
      if (hIdx > 0) { hIdx--; playCalmTone("tap"); render(); }
    };
    document.getElementById("btnRedo").onclick = () => {
      if (hIdx < history.length - 1) { hIdx++; playCalmTone("tap"); render(); }
    };
    document.getElementById("btnClear").onclick = () => {
      if (curr.picked.length > 0) {
        history = history.slice(0, hIdx + 1);
        history.push({ picked: [], scrambled: initialScrambled.slice() });
        hIdx++;
        playCalmTone("tap");
        render();
      }
    };

    const row = document.getElementById("scrTiles");
    curr.scrambled.forEach((ch, idx) => {
      if (ch === null) return;
      const b = document.createElement("button");
      b.className = "letter-tile";
      b.textContent = ch;
      b.onclick = () => {
        const nextPicked = curr.picked.concat(ch);
        const nextScrambled = curr.scrambled.slice();
        nextScrambled[idx] = null;
        history = history.slice(0, hIdx + 1);
        history.push({ picked: nextPicked, scrambled: nextScrambled });
        hIdx++;
        playCalmTone("tap");
        render();
        if (nextPicked.length === target.length) {
          clearStageTimer();
          handleAnswerResult(nextPicked.join("") === target, target, () => runUnscramble(stage, isTimedGeo));
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

/* 4. CATEGORY BLITZ (30s) */
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

/* 5. MASTER SPELLING BEE */
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

/* 7. THEMED WORDLE WITH FULL INTERACTIVE ON-SCREEN KEYBOARD */
function runWordle(stage) {
  const entry = window.SPECIAL_DATA.words5[Math.floor(Math.random() * window.SPECIAL_DATA.words5.length)];
  const target = entry.word;
  let guesses = [];
  let currentGuess = "";
  let gameOver = false;

  const kbRows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];

  const getKeyStatus = (letter) => {
    let status = "";
    guesses.forEach(g => {
      for (let i = 0; i < 5; i++) {
        if (g[i] === letter) {
          if (target[i] === letter) status = "hit";
          else if (target.includes(letter) && status !== "hit") status = "near";
          else if (!status) status = "miss";
        }
      }
    });
    return status;
  };

  const handleKey = (key) => {
    if (gameOver) return;
    if (key === "⌫") {
      currentGuess = currentGuess.slice(0, -1);
      playCalmTone("tap");
      render();
    } else if (key === "ENTER") {
      if (currentGuess.length !== 5) return;
      guesses.push(currentGuess);
      const won = currentGuess === target;
      currentGuess = "";
      if (won || guesses.length >= 6) {
        gameOver = true;
        render();
        handleAnswerResult(won, target, () => runWordle(stage));
      } else {
        playCalmTone("tap");
        render();
      }
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      currentGuess += key;
      playCalmTone("tap");
      render();
    }
  };

  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">Theme: <strong>${entry.theme}</strong> — ${tr(entry.clue)}</div>
      <div class="wordle-grid" id="wGrid"></div>
      <div id="wKeyboard" style="display:flex;flex-direction:column;gap:6px;margin-top:12px"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("wGrid");
    for (let r = 0; r < 6; r++) {
      const isCurrentRow = r === guesses.length && !gameOver;
      const word = guesses[r] || (isCurrentRow ? currentGuess.padEnd(5, " ") : "     ");
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "wordle-cell";
        const ch = word[c];
        cell.textContent = ch;
        if (guesses[r]) {
          if (ch === target[c]) cell.classList.add("hit");
          else if (target.includes(ch)) cell.classList.add("near");
          else cell.classList.add("miss");
        } else if (isCurrentRow && ch !== " ") {
          cell.style.borderColor = "var(--primary)";
        }
        g.appendChild(cell);
      }
    }

    const kbContainer = document.getElementById("wKeyboard");
    kbRows.forEach(row => {
      const rDiv = document.createElement("div");
      rDiv.style.cssText = "display:flex;justify-content:center;gap:4px;";
      row.forEach(k => {
        const btn = document.createElement("button");
        const st = k.length === 1 ? getKeyStatus(k) : "";
        btn.className = "letter-tile " + (st ? "wordle-cell " + st : "");
        btn.style.cssText = `min-width:${k.length > 1 ? "58px" : "31px"};height:42px;padding:0 6px;font-size:${k.length > 1 ? "12px" : "15px"};border-radius:8px;`;
        btn.textContent = k;
        btn.onclick = () => handleKey(k);
        rDiv.appendChild(btn);
      });
      kbContainer.appendChild(rDiv);
    });
  };
  render();
}

/* 8. HANGMAN */
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

/* 9. MULTI-PACK CROSSWORD */
function runMiniCrossword(stage) {
  const packs = [
    { c1: "1-Across: Capital of Japan (5 letters)", a1: "TOKYO", c2: "2-Across: Chemical symbol for Gold (2 letters)", a2: "AU" },
    { c1: "1-Across: Planet famous for rings (6 letters)", a1: "SATURN", c2: "2-Across: Unit of frequency (5 letters)", a2: "HERTZ" },
    { c1: "1-Across: Largest planet in solar system (7 letters)", a1: "JUPITER", c2: "2-Across: Smallest bone in human ear (6 letters)", a2: "STAPES" }
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

/* 10 & 11. GUESS THE GLOBAL ICON (PROGRESSIVE CLUES & VS BOT) */
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

/* 12. HARD CINEMA EMOJI */
function runMovieEmoji(stage) {
  const m = window.SPECIAL_DATA.movieEmojis[Math.floor(Math.random() * window.SPECIAL_DATA.movieEmojis.length)];
  stage.innerHTML = `
    <div class="q-sub">🎬 Decode the film plot from these 5 emojis:</div>
    <div class="q-prompt" style="font-size:40px;letter-spacing:6px">${m.emojis}</div>
    <div class="options-list" id="meOpts"></div>
    <div id="fbBox"></div>
  `;
  m.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === m.ans, m.ans, () => runMovieEmoji(stage), b);
    document.getElementById("meOpts").appendChild(b);
  });
}

/* 13. PRO FOOTBALLER CAREER PATH */
function runFootballer(stage) {
  const f = window.SPECIAL_DATA.footballTransfers[Math.floor(Math.random() * window.SPECIAL_DATA.footballTransfers.length)];
  stage.innerHTML = `
    <div class="q-sub">⚽ Senior Club &amp; Loan Transfer History:</div>
    <div class="q-prompt" style="font-size:16px;line-height:1.6">${f.career}</div>
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

/* 14. FLAG PALETTE GUESS */
function runColorGuess(stage) {
  const flags = [
    { colors: ["#002395","#ffffff","#ed2939"], ans: "France 🇫🇷", opts: ["France 🇫🇷","Germany 🇩🇪","Netherlands 🇳🇱","Italy 🇮🇹"] },
    { colors: ["#000000","#dd0000","#ffce00"], ans: "Germany 🇩🇪", opts: ["Germany 🇩🇪","Belgium 🇧🇪","Spain 🇪🇸","Sweden 🇸🇪"] },
    { colors: ["#009246","#ffffff","#ce2b37"], ans: "Italy 🇮🇹", opts: ["Italy 🇮🇹","Mexico 🇲🇽","Ireland 🇮🇪","Hungary 🇭🇺"] },
    { colors: ["#009c3b","#ffdf00","#002776"], ans: "Brazil 🇧🇷", opts: ["Brazil 🇧🇷","Argentina 🇦🇷","Colombia 🇨🇴","Australia 🇦🇺"] },
    { colors: ["#005293","#fecb00","#005293"], ans: "Sweden 🇸🇪", opts: ["Sweden 🇸🇪","Ukraine 🇺🇦","Finland 🇫🇮","Greece 🇬🇷"] },
    { colors: ["#ae1c28","#ffffff","#21468b"], ans: "Netherlands 🇳🇱", opts: ["Netherlands 🇳🇱","France 🇫🇷","Russia 🇷🇺","Thailand 🇹🇭"] }
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

/* 15. WHO AM I? */
function runWhoAmI(stage) {
  const el = window.SPECIAL_DATA.rawElements[Math.floor(Math.random() * window.SPECIAL_DATA.rawElements.length)];
  const decoys = window.SPECIAL_DATA.rawElements.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(x => x[2]);
  const opts = Array.from(new Set([el[2], ...decoys])).slice(0, 4).sort(() => Math.random() - 0.5);
  stage.innerHTML = `
    <div class="q-sub">20-Questions Deduction Log:</div>
    <div class="options-list" style="margin-bottom:12px">
      <div class="pill">Q1: Is it a pure chemical element? ➔ YES</div>
      <div class="pill">Q2: Is its atomic number ${el[1]}? ➔ YES</div>
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

/* HELPER: Convert Real (Latitude, Longitude) to 1000x500 Equirectangular SVG Map */
function latLonToSvg(lat, lon) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function renderWorldMapBackdrop() {
  // Uses high-resolution GeoJSON paths injected by build-apk.yml if available, else multi-polygon REAL_WORLD_MAP_PATHS
  const paths = (window.REAL_GEOJSON_WORLD && window.REAL_GEOJSON_WORLD.length > 0)
    ? window.REAL_GEOJSON_WORLD
    : window.REAL_WORLD_MAP_PATHS;
  const gridLines = [100,200,300,400].map(y => `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>`).join("") +
                    [200,400,600,800].map(x => `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>`).join("");
  return `
    <rect width="1000" height="500" fill="var(--surface-alt)"/>
    ${gridLines}
    ${paths.map(p => `<path d="${p.d}" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="1.5"/>`).join("")}
  `;
}

/* 16. REAL WORLD ATLAS MAP TAP */
function runMapClick(stage) {
  const locs = window.SPECIAL_DATA.rawCountries.slice().sort(() => Math.random() - 0.5).slice(0, 12);
  const target = locs[0];
  const tName = State.lang === "ar" ? target[3] : State.lang === "fr" ? target[2] : target[1];
  stage.innerHTML = `
    <div class="q-prompt">🗺️ Tap <strong>${tName} (${target[4]})</strong> on the World Atlas</div>
    <svg viewBox="0 0 1000 500" class="svg-stage">
      ${renderWorldMapBackdrop()}
      ${locs.map(l => {
        const pt = latLonToSvg(l[12], l[13]);
        return `<circle cx="${pt.x}" cy="${pt.y}" r="14" fill="var(--primary)" stroke="#fff" stroke-width="2.5" data-id="${l[0]}" style="cursor:pointer"/>`;
      }).join("")}
    </svg>
    <div id="fbBox"></div>
  `;
  stage.querySelectorAll("circle").forEach(c => {
    c.onclick = () => {
      const hit = c.getAttribute("data-id") === target[0];
      handleAnswerResult(hit, `${tName} (${target[4]})`, () => runMapClick(stage));
    };
  });
}

/* 17. REAL COUNTRY BORDER OUTLINE */
function runBorderGuess(stage) {
  const pool = (window.REAL_GEOJSON_OUTLINES && window.REAL_GEOJSON_OUTLINES.length > 0)
    ? window.REAL_GEOJSON_OUTLINES
    : window.REAL_COUNTRY_OUTLINES;
  const s = pool[Math.floor(Math.random() * pool.length)];
  stage.innerHTML = `
    <div class="q-sub">🗾 Identify this country from its geographic border outline</div>
    <svg viewBox="0 0 240 210" class="svg-stage" style="height:175px">
      <line x1="0" y1="105" x2="240" y2="105" stroke="var(--border)" stroke-dasharray="4,4"/>
      <line x1="120" y1="0" x2="120" y2="210" stroke="var(--border)" stroke-dasharray="4,4"/>
      <path d="${s.path}" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="3.5" stroke-linejoin="round"/>
    </svg>
    <div class="options-list" id="bgOpts"></div>
    <div id="fbBox"></div>
  `;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.ans, s.ans, () => runBorderGuess(stage), b, s.hint);
    document.getElementById("bgOpts").appendChild(b);
  });
}

/* 18. WORLD CAPITAL MATCH */
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

/* 19. GEO HIGHER OR LOWER */
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

/* 20. GEO PIN DROP PRECISION (REAL HAVERSINE GREAT-CIRCLE DISTANCE IN KM) */
function runDistanceGuess(stage) {
  const locs = window.SPECIAL_DATA.rawCountries;
  const target = locs[Math.floor(Math.random() * locs.length)];
  const tName = State.lang === "ar" ? `${target[6]} (${target[3]})` : `${target[4]}, ${target[1]}`;
  const targetPt = latLonToSvg(target[12], target[13]);

  stage.innerHTML = `
    <div class="q-prompt">📍 Drop your pin within 1,200 km of <strong>${tName}</strong></div>
    <svg viewBox="0 0 1000 500" class="svg-stage" id="pinMap" style="cursor:crosshair">
      ${renderWorldMapBackdrop()}
    </svg>
    <div id="fbBox"></div>
  `;
  const svg = document.getElementById("pinMap");
  svg.onclick = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 500;
    const userLon = (x / 1000) * 360 - 180;
    const userLat = 90 - (y / 500) * 180;

    // Haversine Great-Circle Distance Formula (km)
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(target[12] - userLat);
    const dLon = toRad(target[13] - userLon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userLat)) * Math.cos(toRad(target[12])) * Math.sin(dLon / 2) ** 2;
    const km = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    svg.innerHTML += `
      <line x1="${x}" y1="${y}" x2="${targetPt.x}" y2="${targetPt.y}" stroke="var(--primary)" stroke-width="3.5" stroke-dasharray="7,7"/>
      <circle cx="${x}" cy="${y}" r="11" fill="#e76f51" stroke="#fff" stroke-width="2"/>
      <circle cx="${targetPt.x}" cy="${targetPt.y}" r="11" fill="#2a9d8f" stroke="#fff" stroke-width="2"/>
    `;
    handleAnswerResult(km <= 1200, `Great-Circle Distance: ${km.toLocaleString()} km`, () => runDistanceGuess(stage));
  };
}

/* 21 & 22. SIZE IT UP! & WEIGHT IT UP! (Compare Anything Across Heights, Areas, Lengths & Weights) */
function runSizeOrWeight(stage, modeType) {
  const groups = modeType === "size" ? ["height_m", "area_km2", "length_km"] : ["weight_kg", "weight_tons"];
  const chosenGroup = groups[Math.floor(Math.random() * groups.length)];
  const pool = window.COMPARE_METRICS_POOL.filter(x => x.group === chosenGroup).sort(() => Math.random() - 0.5);
  const itemA = pool[0];
  const itemB = pool[1];

  const questionTitle = modeType === "size"
    ? (chosenGroup === "height_m" ? "📏 Which one is TALLER / HIGHER?" : chosenGroup === "area_km2" ? "📐 Which one covers a LARGER AREA?" : "📏 Which one is LONGER / WIDER?")
    : "🏋️ Which one is HEAVIER?";

  stage.innerHTML = `
    <div class="q-sub">${modeType === "size" ? "📏 Size It Up!" : "🏋️ Weight It Up!"} · (${itemA.unit})</div>
    <div class="q-prompt">${questionTitle}</div>
    <div class="options-list">
      <button class="opt-btn" id="cmpA" style="display:flex;justify-content:space-between;align-items:center;padding:18px">
        <span>${itemA.icon} ${itemA.name}</span>
        <span class="pill">Tap</span>
      </button>
      <button class="opt-btn" id="cmpB" style="display:flex;justify-content:space-between;align-items:center;padding:18px">
        <span>${itemB.icon} ${itemB.name}</span>
        <span class="pill">Tap</span>
      </button>
    </div>
    <div id="fbBox"></div>
  `;

  const explain = `${itemA.name}: ${itemA.val.toLocaleString()} ${itemA.unit} vs ${itemB.name}: ${itemB.val.toLocaleString()} ${itemB.unit}`;
  document.getElementById("cmpA").onclick = (e) => {
    handleAnswerResult(itemA.val >= itemB.val, itemB.name, () => runSizeOrWeight(stage, modeType), e.currentTarget, explain);
  };
  document.getElementById("cmpB").onclick = (e) => {
    handleAnswerResult(itemB.val >= itemA.val, itemA.name, () => runSizeOrWeight(stage, modeType), e.currentTarget, explain);
  };
}

/* 23. HISTORY YEAR HIGHER OR LOWER */
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

/* 24. ELEMENT ATOMIC NUMBER DUEL */
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
  const exp = `${a[2]} = Atomic #${a[1]} | ${b[2]} = Atomic #${b[1]}`;
  document.getElementById("elA").onclick = (e) => handleAnswerResult(a[1] > b[1], b[2], () => runElementCompare(stage), e.target, exp);
  document.getElementById("elB").onclick = (e) => handleAnswerResult(b[1] > a[1], a[2], () => runElementCompare(stage), e.target, exp);
}

/* 25. EXPERT ODD ONE OUT (ALWAYS EXPLAINS RESULT EVEN WHEN RIGHT!) */
function renderOddOneOutMode(stage, nextFn) {
  const sets = window.SPECIAL_DATA.oddOneOutPacks;
  const s = sets[Math.floor(Math.random() * sets.length)];
  stage.innerHTML = `<div class="q-prompt">🧐 Tap the Odd One Out:</div><div class="options-list" id="oddOpts"></div><div id="fbBox"></div>`;
  s.opts.slice().sort(() => Math.random() - 0.5).forEach(o => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => handleAnswerResult(o === s.odd, s.odd, nextFn, b, s.why);
    document.getElementById("oddOpts").appendChild(b);
  });
}

/* 26. DYNAMIC TIMELINE SORT */
function renderTimelineSortMode(stage, nextFn) {
  const sample = window.SPECIAL_DATA.rawHistory.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  let picked = [];
  const render = () => {
    stage.innerHTML = `
      <div class="q-sub">📜 Tap historical milestones from EARLIEST to LATEST</div>
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
          const correctOrder = sample.slice().sort((a, b) => a[0] - b[0]).map(x => `${x[0]}`).join(" ➔ ");
          handleAnswerResult(ok, correctOrder, nextFn);
        }
      };
      box.appendChild(b);
    });
  };
  render();
}

/* 27. MEMORY MATCH DUEL VS SMART BOT */
function runMatchPairsVsBot(stage) {
  const els = window.SPECIAL_DATA.rawElements.slice().sort(() => Math.random() - 0.5).slice(0, 8);
  const cards = [];
  els.forEach(e => {
    cards.push({ id: e[0], label: `${e[0]}` });
    cards.push({ id: e[0], label: `${e[2]}` });
  });
  const deck = cards.sort(() => Math.random() - 0.5);

  let open = [];
  let solved = [];
  let turn = "player"; // "player" or "bot"
  let pScore = 0;
  let bScore = 0;
  let botMemory = {}; // index -> card.id

  const checkFinish = () => {
    if (solved.length === deck.length) {
      const won = pScore >= bScore;
      handleAnswerResult(won, `Final Score — You: ${pScore} | SmartBot: ${bScore}`, () => runMatchPairsVsBot(stage), null, won ? "You outsmarted SmartBot's memory!" : "SmartBot won this round!");
      return true;
    }
    return false;
  };

  const botTakeTurn = () => {
    if (checkFinish() || turn !== "bot") return;
    const avail = deck.map((_, i) => i).filter(i => !solved.includes(i));
    if (avail.length < 2) return;

    // Bot checks if it knows any matching pair in botMemory
    let pick1 = null, pick2 = null;
    const seenIndices = Object.keys(botMemory).map(Number).filter(i => !solved.includes(i));
    for (let i = 0; i < seenIndices.length; i++) {
      for (let j = i + 1; j < seenIndices.length; j++) {
        if (botMemory[seenIndices[i]] === botMemory[seenIndices[j]] && Math.random() < 0.75) {
          pick1 = seenIndices[i];
          pick2 = seenIndices[j];
          break;
        }
      }
    }
    if (pick1 === null) {
      const unknown = avail.filter(i => !(i in botMemory));
      pick1 = unknown.length > 0 ? unknown[Math.floor(Math.random() * unknown.length)] : avail[0];
      botMemory[pick1] = deck[pick1].id;
      const mate = seenIndices.find(i => i !== pick1 && botMemory[i] === deck[pick1].id);
      if (mate !== undefined && Math.random() < 0.75) {
        pick2 = mate;
      } else {
        const rem = avail.filter(i => i !== pick1);
        pick2 = rem[Math.floor(Math.random() * rem.length)];
      }
      botMemory[pick2] = deck[pick2].id;
    }

    open = [pick1];
    render();
    setTimeout(() => {
      open = [pick1, pick2];
      render();
      setTimeout(() => {
        if (deck[pick1].id === deck[pick2].id) {
          solved.push(pick1, pick2);
          bScore++;
          open = [];
          playCalmTone("miss");
          render();
          if (!checkFinish()) setTimeout(botTakeTurn, 650);
        } else {
          open = [];
          turn = "player";
          render();
        }
      }, 850);
    }, 550);
  };

  const render = () => {
    stage.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="pill" style="background:${turn === 'player' ? 'var(--accent-mint)' : 'var(--surface-alt)'}">🧑 You: ${pScore}</span>
        <span class="q-sub" style="margin:0">${turn === "player" ? "Your Turn!" : "🤖 SmartBot is flipping..."}</span>
        <span class="pill" style="background:${turn === 'bot' ? 'var(--accent-peach)' : 'var(--surface-alt)'}">🤖 Bot: ${bScore}</span>
      </div>
      <div class="grid-4x4" id="memGrid"></div>
      <div id="fbBox"></div>
    `;
    const g = document.getElementById("memGrid");
    deck.forEach((card, idx) => {
      const isUp = open.includes(idx) || solved.includes(idx);
      const b = document.createElement("button");
      b.className = "grid-cell-btn " + (solved.includes(idx) ? "solved" : open.includes(idx) ? "selected" : "");
      b.style.minHeight = "54px";
      b.textContent = isUp ? card.label : "❓";
      b.onclick = () => {
        if (turn !== "player" || isUp || open.length >= 2) return;
        open.push(idx);
        botMemory[idx] = deck[idx].id;
        playCalmTone("tap");
        render();
        if (open.length === 2) {
          const [c1, c2] = open;
          if (deck[c1].id === deck[c2].id) {
            solved.push(c1, c2);
            pScore++;
            open = [];
            playCalmTone("good");
            addPoints(20);
            render();
            checkFinish();
          } else {
            setTimeout(() => {
              open = [];
              turn = "bot";
              render();
              setTimeout(botTakeTurn, 600);
            }, 800);
          }
        }
      };
      g.appendChild(b);
    });
  };
  render();
}

/* 28. CONNECTIONS (16 WORDS) */
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

/* 29. HARD NUMBER PUZZLES */
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

/* 30. TIME TRAVEL ODYSSEY */
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

/* 31. 5-LOCK VAULT ESCAPE ROOM */
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

/* 32. MILLIONAIRE 15 LADDER (SUDDEN DEATH — 1 WRONG ANSWER AND YOU'RE OUT!) */
function runMillionaire(stage) {
  const prizes = [
    "$100","$200","$300","$500","$1,000",
    "$2,000","$4,000","$8,000","$16,000","$32,000",
    "$64,000","$125,000","$250,000","$500,000","$1,000,000"
  ];
  let step = 1;
  let used5050 = false;
  let usedSkip = false;

  const render = () => {
    const tier = step <= 5 ? "easy" : step <= 10 ? "medium" : "hard";
    const item = drawUniqueQuestion(null, tier);
    const ans = tr(item.a);
    const opts = (item.opts[State.lang] || item.opts.en).slice().sort(() => Math.random() - 0.5);

    stage.innerHTML = `
      <div class="stage-topbar" style="flex-wrap:wrap;gap:6px">
        <span class="pill">💎 Step ${step}/15 · <strong>${prizes[step - 1]}</strong></span>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" id="btn5050" ${used5050 ? "disabled style='opacity:0.4'" : ""}>50:50</button>
          <button class="btn-secondary" id="btnSkip" ${usedSkip ? "disabled style='opacity:0.4'" : ""}>🔄 Swap Q</button>
        </div>
      </div>
      <div class="q-sub">Sudden Death Mode (${t(tier)}) — 1 Wrong Answer = Eliminated!</div>
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
        if (o === ans) {
          b.classList.add("correct");
          playCalmTone("good");
          addPoints(step * 15);
          if (step === 15) {
            stage.innerHTML = `
              <div class="q-prompt">🏆 $1,000,000 CHAMPION!</div>
              <div class="feedback-banner">
                You conquered all 15 steps without a single mistake!
                <button class="btn-primary" style="margin-top:12px;width:100%" id="btnNewMil">🔄 Play Again</button>
              </div>
            `;
            document.getElementById("btnNewMil").onclick = () => runMillionaire(stage);
          } else {
            step++;
            setTimeout(render, 550);
          }
        } else {
          // SUDDEN DEATH ELIMINATION
          b.classList.add("wrong");
          playCalmTone("miss");
          State.streak = 0;
          saveState();
          const fb = document.getElementById("fbBox");
          fb.innerHTML = `
            <div class="feedback-banner" style="background:var(--accent-peach)">
              <div style="font-size:18px;font-weight:800">💥 YOU'RE OUT AT STEP ${step} (${prizes[step - 1]})!</div>
              <div style="margin-top:6px">Correct Answer: <strong>${ans}</strong></div>
              <button class="btn-primary" style="margin-top:12px;width:100%" id="btnRestartMil">🔄 Start New Run from Step 1 ($100)</button>
            </div>
          `;
          Array.from(box.children).forEach(btn => { btn.disabled = true; });
          document.getElementById("btnRestartMil").onclick = () => runMillionaire(stage);
        }
      };
      box.appendChild(b);
    });

    document.getElementById("btn5050").onclick = () => {
      if (used5050) return;
      used5050 = true;
      document.getElementById("btn5050").disabled = true;
      document.getElementById("btn5050").style.opacity = "0.4";
      let removed = 0;
      Array.from(box.children).forEach(btn => {
        if (btn.textContent !== ans && removed < 2) {
          btn.style.visibility = "hidden";
          removed++;
        }
      });
    };

    document.getElementById("btnSkip").onclick = () => {
      if (usedSkip) return;
      usedSkip = true;
      render();
    };
  };
  render();
}

/* 33. PRO JEOPARDY BOARD */
function runJeopardy(stage) {
  const cats = ["science", "history", "geography", "math"];
  let used = [];
  const renderBoard = () => {
    stage.innerHTML = `<div class="q-sub">🎛️ Pick Category &amp; Point Difficulty</div><div class="grid-4x4" id="jpBoard"></div><div id="fbBox"></div>`;
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

/* 34. SPOT THE FAKE FACT */
function runTrueOrFake(stage) {
  const c1 = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * 30)];
  const c2 = window.SPECIAL_DATA.rawCountries[Math.floor(Math.random() * 30) + 30];
  const fakeCap = window.SPECIAL_DATA.rawCountries[12][4];
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
    b.onclick = () => handleAnswerResult(s.fake === true, `${c2[1]}'s capital is ${c2[4]} (${c2[7]})`, () => runTrueOrFake(stage), b);
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
