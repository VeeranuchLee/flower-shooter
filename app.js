/* ============================================================================
   Petal Kingdom — a unicorn / flower / princess flower-shooter
   ----------------------------------------------------------------------------
   Plain ES2018. No build step, no dependencies. Everything the player sees in
   the interactive playfield pieces are drawn with canvas paths, so they stay
   crisp from a 9.7" iPad up to a 24" desktop screen. Three illustrated realm
   backgrounds provide progression without changing the game geometry.

   Generated artwork (background, helper character, win banner, icons) is
   OPTIONAL and loads through ASSET_SLOTS below. Every slot has a code-drawn
   fallback, so the game is complete and playable with zero image files.

   Sections
     1.  Config + flower definitions
     2.  Level table
     3.  Storage / audio / small helpers
     4.  Optional art slots
     5.  Grid maths (hex layout, neighbours)
     6.  Game class — state, input, simulation
     7.  Rendering
     8.  UI wiring + boot
   ========================================================================== */

(function () {
  "use strict";

  /* ==========================================================================
     1. CONFIG + FLOWER DEFINITIONS
     ====================================================================== */

  var CONFIG = {
    cols: 10,               // playfield is always 10 columns wide
    maxPlayAspect: 0.82,    // playfield width <= canvasHeight * this
    shooterZone: 2.15,      // height reserved under the grid, in cell diameters
    dangerPad: 2.75,        // danger line sits this many diameters above bottom
    speed: 0.0295,          // projectile travel, in playfield widths per ms
    minAimDeg: 14,          // shots may not go flatter than this off horizontal
    snapTolerance: 0.86,    // collision distance as a fraction of cell diameter
    maxRows: 16,            // hard cap so the grid array cannot grow forever
    popScore: 10,
    dropScore: 25,
    comboBonus: 12
  };

  // Seven flower types. Each has a distinct HUE *and* a distinct silhouette, so
  // they stay tellable apart for colour-blind players and at small cell sizes.
  // A level never uses more than six at once.
  var FLOWERS = [
    {
      id: "rose", name: "Rose",
      petal: "round", petals: 5, phase: 0,
      base: "#F8467F", light: "#FF9CC4", dark: "#C21C58",
      center: "#FFE07A", centerEdge: "#E9A93B"
    },
    {
      id: "sun", name: "Sunflower",
      petal: "ray", petals: 12, phase: 0.12,
      base: "#FFC22E", light: "#FFE29A", dark: "#D18E00",
      center: "#8A5A22", centerEdge: "#5E3A12"
    },
    {
      id: "sky", name: "Bluebell",
      petal: "point", petals: 5, phase: 0.3,
      base: "#3E9BF0", light: "#9CD0FF", dark: "#1662B4",
      center: "#EAF6FF", centerEdge: "#8FC2EC"
    },
    {
      id: "violet", name: "Violet",
      petal: "heart", petals: 5, phase: 0.6,
      base: "#A45BE2", light: "#D2A7F7", dark: "#7231AE",
      center: "#FFF0AE", centerEdge: "#D8B54A"
    },
    {
      id: "mint", name: "Clover Bloom",
      petal: "clover", petals: 4, phase: Math.PI / 4,
      base: "#2CC08A", light: "#8CE7C4", dark: "#12855C",
      center: "#FFFBE4", centerEdge: "#B9D9BD"
    },
    {
      id: "flame", name: "Tulip",
      petal: "cup", petals: 3, phase: Math.PI,
      base: "#F4622F", light: "#FFA madre", dark: "#B93A12",
      center: "#FFD9A8", centerEdge: "#D98A45"
    },
    {
      id: "snow", name: "Snow Daisy",
      petal: "thin", petals: 8, phase: 0.2,
      base: "#FFFFFF", light: "#FFFFFF", dark: "#B9AECB",
      center: "#FFD84D", centerEdge: "#D9A417"
    }
  ];
  // (typo guard — keep the palette strictly valid CSS)
  FLOWERS[5].light = "#FFA766";

  var RAINBOW_ID = "rainbow"; // wildcard bloom, matches any neighbour colour

  function flowerById(id) {
    for (var i = 0; i < FLOWERS.length; i++) if (FLOWERS[i].id === id) return FLOWERS[i];
    return null;
  }

  /* ==========================================================================
     2. LEVEL TABLE
     ====================================================================== */

  // pattern: how the opening garden is laid out
  //   full     — every cell filled
  //   checker  — alternating gaps, airier
  //   arch     — a rounded canopy, open at the sides
  //   hearts   — clustered heart shapes with gaps
  //   columns  — vertical stripes
  // par: shots for three stars. dropEvery: shots between ceiling descents.
  var LEVELS = [
    { name: "Rosebud Lawn",    rows: 4, colors: 3, pattern: "full",    dropEvery: 12, par: 16, rainbow: 0 },
    { name: "Daisy Hill",      rows: 4, colors: 3, pattern: "checker", dropEvery: 11, par: 16, rainbow: 0 },
    { name: "Bluebell Brook",  rows: 5, colors: 4, pattern: "full",    dropEvery: 10, par: 22, rainbow: 0 },
    { name: "Tulip Terrace",   rows: 5, colors: 4, pattern: "arch",    dropEvery: 10, par: 22, rainbow: 0.05 },
    { name: "Clover Court",    rows: 5, colors: 4, pattern: "columns", dropEvery: 9,  par: 24, rainbow: 0.05 },
    { name: "Violet Veranda",  rows: 6, colors: 5, pattern: "full",    dropEvery: 9,  par: 28, rainbow: 0.05 },
    { name: "Sunbeam Steps",   rows: 6, colors: 5, pattern: "hearts",  dropEvery: 8,  par: 28, rainbow: 0.06 },
    { name: "Rainbow Ramparts",rows: 6, colors: 5, pattern: "checker", dropEvery: 8,  par: 30, rainbow: 0.08 },
    { name: "Moonpetal Moat",  rows: 7, colors: 5, pattern: "arch",    dropEvery: 8,  par: 32, rainbow: 0.06 },
    { name: "Crystal Conserv.",rows: 7, colors: 6, pattern: "full",    dropEvery: 7,  par: 36, rainbow: 0.06 },
    { name: "Starlight Spire", rows: 7, colors: 6, pattern: "hearts",  dropEvery: 7,  par: 36, rainbow: 0.08 },
    { name: "Unicorn Crown",   rows: 8, colors: 6, pattern: "full",    dropEvery: 6,  par: 42, rainbow: 0.08 }
  ];

  var ARCADE_LEVELS = [
    { name: "Score Sprint", rows: 5, colors: 4, pattern: "checker", dropEvery: 8, par: 12, rainbow: .05, objective: "score", target: 450, maxShots: 18 },
    { name: "Petal Pop", rows: 5, colors: 4, pattern: "hearts", dropEvery: 8, par: 13, rainbow: .06, objective: "pop", target: 18, maxShots: 20 },
    { name: "Big Drop", rows: 6, colors: 4, pattern: "arch", dropEvery: 7, par: 14, rainbow: .06, objective: "drop", target: 10, maxShots: 20 },
    { name: "Royal Rush", rows: 6, colors: 5, pattern: "columns", dropEvery: 7, par: 16, rainbow: .08, objective: "score", target: 900, maxShots: 24 },
    { name: "Heart Breaker", rows: 6, colors: 5, pattern: "hearts", dropEvery: 6, par: 17, rainbow: .08, objective: "pop", target: 32, maxShots: 25 },
    { name: "Castle Cascade", rows: 7, colors: 5, pattern: "arch", dropEvery: 6, par: 18, rainbow: .09, objective: "drop", target: 18, maxShots: 26 },
    { name: "Rainbow Rally", rows: 7, colors: 6, pattern: "checker", dropEvery: 5, par: 20, rainbow: .14, objective: "score", target: 1500, maxShots: 30 },
    { name: "Crown Challenge", rows: 8, colors: 6, pattern: "full", dropEvery: 5, par: 22, rainbow: .12, objective: "clear", target: 0, maxShots: 34 }
  ];

  // Fixed maps use R=rose, S=sun, B=sky, V=violet, M=mint, F=flame,
  // W=snow and .=empty. Rows are clipped to the active offset-hex length.
  var PUZZLE_LEVELS = [
    { name: "Three Little Blooms", colors: 3, shots: 6, par: 3, map: ["RRR.......", "...BBB....", "......SSS."] },
    { name: "Hanging Heart", colors: 4, shots: 8, par: 5, map: ["...VV.....", "..VRRV....", "..RRRR....", "...RR....."] },
    { name: "Blue Bridge", colors: 4, shots: 9, par: 6, map: ["BBBBBBBBBB", "R..SS..RR.", "R..SS..RR.", "...MM....."] },
    { name: "Tulip Towers", colors: 6, shots: 10, par: 7, map: ["FF..FF..FF", "FF..FF..F.", ".V..V..V..", ".M..M..M.."] },
    { name: "Rainbow Arch", colors: 6, shots: 11, par: 8, rainbow: .08, map: ["RRSSBBVVMM", "R........M", ".S......V.", "..B....B..", "...VMMV..."] },
    { name: "Snowflake Gate", colors: 6, shots: 12, par: 9, map: ["WWWWWWWWWW", "W..BB..WW.", ".W.BB.W...", "..WSSW....", "...MM....."] },
    { name: "Crystal Crown", colors: 6, shots: 13, par: 10, rainbow: .1, map: ["V.V.V.V.V.", ".VVVVVVVV.", "..SSSSSS..", "...BBBB...", "....MM...."] },
    { name: "Perfect Garden", colors: 6, shots: 15, par: 11, rainbow: .12, map: ["RRSSBBVVMM", "RRS.BB.VM.", ".FFSSMMVV.", "..BBWWBB..", "...MMMM..."] }
  ];

  var MODE_INFO = {
    classic: { name: "Classic", stageWord: "Garden", levels: LEVELS, background: "backgroundSecret" },
    arcade:  { name: "Arcade",  stageWord: "Challenge", levels: ARCADE_LEVELS, background: "backgroundDawn" },
    puzzle:  { name: "Puzzle",  stageWord: "Puzzle", levels: PUZZLE_LEVELS, background: "backgroundGlass" }
  };

  function levelsForMode(mode) { return (MODE_INFO[mode] || MODE_INFO.classic).levels; }

  function objectiveText(lv, mode) {
    if (mode === "puzzle") return "Clear the map in " + lv.shots + " shots.";
    if (mode !== "arcade") return "Clear every flower.";
    if (lv.objective === "score") return "Score " + lv.target + " points.";
    if (lv.objective === "pop") return "Pop " + lv.target + " flowers.";
    if (lv.objective === "drop") return "Drop " + lv.target + " hanging flowers.";
    return "Clear the whole challenge.";
  }

  var CHEERS = [
    "Beautiful bloom!", "The garden is glowing!", "Lovely petals!",
    "Sparkle power!", "Royal gardening!", "Three in a row!"
  ];
  var BIG_CHEERS = [
    "Wonderful! A whole bunch fell!", "Magnificent!", "The unicorn is dancing!",
    "That was a big one!"
  ];

  /* ==========================================================================
     3. STORAGE / AUDIO / HELPERS
     ====================================================================== */

  var STORE_KEY = "petal-kingdom-progress-v1";

  var Store = {
    read: function () {
      try {
        var raw = window.localStorage.getItem(STORE_KEY);
        if (!raw) return freshProgress();
        var data = JSON.parse(raw);
        // Non-destructive v1 migration: old stars/unlocked become Classic.
        var classic = data.classic || { stars: data.stars || {}, unlocked: data.unlocked || 1 };
        return {
          classic: { stars: classic.stars || {}, unlocked: classic.unlocked || 1 },
          arcade: data.arcade || { stars: {}, unlocked: 1 },
          puzzle: data.puzzle || { stars: {}, unlocked: 1, bestRemaining: {} },
          sound: data.sound !== false,
          sparkle: data.sparkle !== false
        };
      } catch (e) {
        return freshProgress();
      }
    },
    write: function (data) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
      catch (e) { /* private browsing — progress simply is not kept */ }
    }
  };

  function freshProgress() {
    return {
      classic: { stars: {}, unlocked: 1 },
      arcade: { stars: {}, unlocked: 1 },
      puzzle: { stars: {}, unlocked: 1, bestRemaining: {} },
      sound: true,
      sparkle: true
    };
  }

  // Small synthesised cue set. No audio files to ship, and it matches the
  // Web-Audio approach used elsewhere in this project.
  var Audio1 = {
    ctx: null,
    on: true,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
      }
      if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
      return this.ctx;
    },
    tone: function (freq, dur, type, vol, delay) {
      if (!this.on) return;
      var ctx = this.ensure();
      if (!ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.14, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    },
    shoot: function () { this.tone(520, 0.09, "triangle", 0.08); },
    stick: function () { this.tone(300, 0.07, "sine", 0.07); },
    bounce: function () { this.tone(400, 0.05, "sine", 0.05); },
    pop: function (n) {
      var base = 620;
      var count = Math.min(n || 3, 6);
      for (var i = 0; i < count; i++) {
        this.tone(base * Math.pow(1.14, i), 0.16, "sine", 0.11, i * 0.045);
      }
    },
    drop: function () {
      this.tone(880, 0.22, "triangle", 0.10, 0);
      this.tone(1170, 0.26, "triangle", 0.09, 0.08);
      this.tone(1480, 0.34, "sine", 0.09, 0.16);
    },
    descend: function () { this.tone(180, 0.26, "sawtooth", 0.06); },
    win: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) this.tone(notes[i], 0.42, "triangle", 0.12, i * 0.13);
    },
    lose: function () {
      this.tone(392, 0.3, "sine", 0.10, 0);
      this.tone(311, 0.42, "sine", 0.10, 0.16);
    }
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rand(arr.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ==========================================================================
     4. OPTIONAL ART SLOTS
     --------------------------------------------------------------------------
     Drop the generated PNGs into flower-shooter/assets/art/ using exactly these
     file names and they are picked up automatically on next load. Any file that
     is missing simply keeps its code-drawn fallback — nothing breaks.
     See ASSET-PLAN.md for sizes and prompt guidance.
     ====================================================================== */

  var ASSET_SLOTS = {
    backgroundSecret: "./assets/art/garden-background-secret.png",       // Gardens 1-4
    backgroundDawn:   "./assets/art/garden-background-dawn.png",         // Gardens 5-8
    backgroundGlass:  "./assets/art/garden-background-greenhouse.png",   // Gardens 9-12
    background: "./assets/art/garden-background.png", // legacy single-background fallback
    castle:     "./assets/art/castle-band.png",       // 2048x520, transparent, sits on horizon
    helperIdle: "./assets/art/helper-idle.png",       // 768x768, transparent unicorn
    helperCheer:"./assets/art/helper-cheer.png",      // 768x768, transparent
    helperWorry:"./assets/art/helper-worry.png",      // 768x768, transparent
    winBanner:  "./assets/art/win-banner.png",        // 1024x1024, celebration
    titleCard:  "./assets/art/title-card.png"         // 1536x1024, title art
  };

  var Art = { images: {}, ready: {} };

  function backgroundKeyForMode(mode) {
    return (MODE_INFO[mode] || MODE_INFO.classic).background;
  }
  // Retained for older review tools; its former garden-range mapping remains.
  function backgroundKeyForLevel(index) {
    if (index >= 8) return "backgroundGlass";
    if (index >= 4) return "backgroundDawn";
    return "backgroundSecret";
  }

  function loadArt() {
    Object.keys(ASSET_SLOTS).forEach(function (key) {
      var img = new Image();
      img.onload = function () {
        Art.images[key] = img;
        Art.ready[key] = true;
        applyDomArt(key);
      };
      img.onerror = function () { Art.ready[key] = false; };
      img.src = ASSET_SLOTS[key];
    });
  }

  function applyDomArt(key) {
    if (key === "titleCard") {
      var art = document.querySelector(".title-art");
      if (art) {
        art.style.backgroundImage = 'url("' + ASSET_SLOTS.titleCard + '")';
        var crest = art.querySelector(".title-crest");
        if (crest) crest.style.display = "none";
      }
    }
    if (key === "helperIdle") {
      var fig = document.getElementById("helperFigure");
      if (fig) {
        fig.dataset.hasArt = "true";
        fig.style.backgroundImage = 'url("' + ASSET_SLOTS.helperIdle + '")';
      }
    }
  }

  function setHelperMood(mood) {
    var fig = document.getElementById("helperFigure");
    if (!fig) return;
    fig.dataset.mood = mood;
    var key = mood === "cheer" ? "helperCheer" : (mood === "worry" ? "helperWorry" : "helperIdle");
    if (Art.ready[key]) fig.style.backgroundImage = 'url("' + ASSET_SLOTS[key] + '")';
    else if (Art.ready.helperIdle) fig.style.backgroundImage = 'url("' + ASSET_SLOTS.helperIdle + '")';
  }

  var helperTimer = null;
  function helperSay(text, mood) {
    var el = document.getElementById("helperSay");
    setHelperMood(mood || "idle");
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-visible");
    if (helperTimer) clearTimeout(helperTimer);
    helperTimer = setTimeout(function () {
      el.classList.remove("is-visible");
      setHelperMood("idle");
    }, 2200);
  }

  /* ==========================================================================
     5. GRID MATHS
     --------------------------------------------------------------------------
     Offset hex grid. A row is either "flush" (cols cells, starting at x = R) or
     "shifted" (cols-1 cells, starting at x = 2R). `parity` records which of the
     two the top row currently is, so that pushing a new row on top does not
     move any existing flower sideways.
     ====================================================================== */

  function isShiftedRow(r, parity) { return ((r + parity) % 2) === 1; }
  function rowLength(r, parity, cols) { return isShiftedRow(r, parity) ? cols - 1 : cols; }

  // Neighbours in offset coordinates. Derived from the pixel positions:
  // a flush row's diagonal neighbours are (c-1, c); a shifted row's are (c, c+1).
  function neighbourCells(r, c, parity) {
    var shifted = isShiftedRow(r, parity);
    var dUp = shifted ? [c, c + 1] : [c - 1, c];
    return [
      [r, c - 1], [r, c + 1],
      [r - 1, dUp[0]], [r - 1, dUp[1]],
      [r + 1, dUp[0]], [r + 1, dUp[1]]
    ];
  }

  /* ==========================================================================
     6. GAME
     ====================================================================== */

  function Game(canvas, nextCanvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext("2d");
    this.cb = callbacks || {};

    this.grid = [];          // grid[r][c] = null | { id, popT, fallT, vy, vx, spin }
    this.parity = 0;
    this.particles = [];
    this.fallers = [];
    this.projectile = null;
    this.current = null;
    this.next = null;
    this.palette = [];

    this.aimAngle = -Math.PI / 2;
    this.aiming = false;
    this.pointerActive = false;
    this.pointerMoved = false;
    this.pointerStart = null;

    this.state = "idle";     // idle | playing | won | lost | paused
    this.mode = "classic";
    this.levelIndex = 0;
    this.score = 0;
    this.shots = 0;
    this.sinceDrop = 0;
    this.sparkle = true;
    this.shakeT = 0;
    this.time = 0;
    this.lastFrame = 0;
    this.rafId = null;

    this.layout = { d: 40, r: 20, rowH: 34, left: 0, top: 0, width: 400, height: 600, danger: 500 };

    this.bindInput();
  }

  /* ---------- layout -------------------------------------------------- */

  Game.prototype.resize = function () {
    var cv = this.canvas;
    var rect = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(200, Math.round(rect.width));
    var h = Math.max(200, Math.round(rect.height));

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var playW = Math.min(w, h * CONFIG.maxPlayAspect);
    var d = playW / CONFIG.cols;

    this.layout = {
      d: d,
      r: d / 2,
      rowH: d * 0.866,
      left: (w - playW) / 2,
      // A little headroom so the tallest petals are not shaved off by the top
      // edge, and so the ivy band has somewhere to sit.
      top: d * 0.13,
      width: playW,
      height: h,
      cw: w,
      ch: h,
      shooterY: h - d * CONFIG.shooterZone * 0.5,
      danger: h - d * CONFIG.dangerPad
    };

    // Next-flower preview canvas
    var nrect = this.nextCanvas.getBoundingClientRect();
    this.nextCanvas.width = Math.round(Math.max(24, nrect.width) * dpr);
    this.nextCanvas.height = Math.round(Math.max(24, nrect.height) * dpr);
    this.nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.nextSize = { w: Math.max(24, nrect.width), h: Math.max(24, nrect.height) };

    this.draw();
  };

  Game.prototype.cellCenter = function (r, c) {
    var L = this.layout;
    var x = L.left + L.r + c * L.d + (isShiftedRow(r, this.parity) ? L.r : 0);
    var y = L.top + L.r + r * L.rowH;
    return { x: x, y: y };
  };

  /* ---------- level setup --------------------------------------------- */

  Game.prototype.startLevel = function (index, mode) {
    this.mode = mode || this.mode || "classic";
    var table = levelsForMode(this.mode);
    this.levelIndex = clamp(index, 0, table.length - 1);
    var lv = table[this.levelIndex];

    this.palette = FLOWERS.slice(0, lv.colors).map(function (f) { return f.id; });
    this.grid = [];
    this.parity = 0;
    this.particles = [];
    this.fallers = [];
    this.projectile = null;
    this.score = 0;
    this.shots = 0;
    this.sinceDrop = 0;
    this.poppedTotal = 0;
    this.droppedTotal = 0;
    this.shotLimit = this.mode === "puzzle" ? lv.shots : (lv.maxShots || 0);
    this.shakeT = 0;
    this.aimAngle = -Math.PI / 2;

    if (this.mode === "puzzle") this.buildFixedGarden(lv);
    else this.buildOpeningGarden(lv);
    this.current = this.rollFlower(lv);
    this.next = this.rollFlower(lv);

    this.state = "playing";
    this.reportHud();
    this.run();
    helperSay(this.mode === "classic" ? ("Let's grow " + lv.name + "!") : objectiveText(lv, this.mode), "idle");
  };

  Game.prototype.currentLevel = function () {
    return levelsForMode(this.mode)[this.levelIndex];
  };

  Game.prototype.buildFixedGarden = function (lv) {
    var ids = { R: "rose", S: "sun", B: "sky", V: "violet", M: "mint", F: "flame", W: "snow" };
    this.grid = [];
    for (var r = 0; r < lv.map.length; r++) {
      var len = rowLength(r, this.parity, CONFIG.cols);
      var source = lv.map[r] || "";
      var row = new Array(len);
      for (var c = 0; c < len; c++) {
        row[c] = ids[source.charAt(c)] ? { id: ids[source.charAt(c)], popT: 0, born: 0 } : null;
      }
      this.grid.push(row);
    }
  };

  Game.prototype.buildOpeningGarden = function (lv) {
    var cols = CONFIG.cols;
    for (var r = 0; r < lv.rows; r++) {
      var len = rowLength(r, this.parity, cols);
      var row = new Array(len);
      for (var c = 0; c < len; c++) {
        row[c] = this.patternWants(lv.pattern, r, c, len, lv.rows)
          ? { id: pick(this.palette), popT: 0, born: 0 }
          : null;
      }
      this.grid.push(row);
    }
    this.ensureNoTinyOrphans();
  };

  Game.prototype.patternWants = function (pattern, r, c, len, rows) {
    switch (pattern) {
      case "checker":
        return !((r + c) % 3 === 2);
      case "arch": {
        var mid = (len - 1) / 2;
        var reach = mid - (rows - 1 - r) * 0.42;
        return Math.abs(c - mid) <= reach + 0.6;
      }
      case "hearts": {
        var block = Math.floor(c / 3);
        var within = c - block * 3;
        if (r % 3 === 2) return within !== 1;
        return true;
      }
      case "columns":
        return (c % 4) !== 3;
      case "full":
      default:
        return true;
    }
  };

  // A pattern can leave a single flower with no same-colour company anywhere,
  // which is un-clearable. Re-colour lone cells to match a neighbour.
  Game.prototype.ensureNoTinyOrphans = function () {
    var counts = {};
    this.forEachCell(function (cell) {
      if (cell) counts[cell.id] = (counts[cell.id] || 0) + 1;
    });
    var self = this;
    Object.keys(counts).forEach(function (id) {
      if (counts[id] >= 3) return;
      self.forEachCell(function (cell, r, c) {
        if (cell && cell.id === id) {
          var nb = neighbourCells(r, c, self.parity);
          for (var i = 0; i < nb.length; i++) {
            var other = self.cellAt(nb[i][0], nb[i][1]);
            if (other && other.id !== id) { cell.id = other.id; return; }
          }
          cell.id = pick(self.palette);
        }
      });
    });
  };

  Game.prototype.forEachCell = function (fn) {
    for (var r = 0; r < this.grid.length; r++) {
      var row = this.grid[r];
      for (var c = 0; c < row.length; c++) fn(row[c], r, c);
    }
  };

  Game.prototype.cellAt = function (r, c) {
    if (r < 0 || r >= this.grid.length) return null;
    var row = this.grid[r];
    if (!row || c < 0 || c >= row.length) return null;
    return row[c];
  };

  Game.prototype.setCell = function (r, c, val) {
    while (this.grid.length <= r && this.grid.length < CONFIG.maxRows) {
      this.grid.push(new Array(rowLength(this.grid.length, this.parity, CONFIG.cols)).fill(null));
    }
    if (r < 0 || r >= this.grid.length) return false;
    var row = this.grid[r];
    if (c < 0 || c >= row.length) return false;
    row[c] = val;
    return true;
  };

  // Only offer colours that are actually still on the board, so the player is
  // never handed a flower that cannot possibly match anything.
  Game.prototype.rollFlower = function (lv) {
    lv = lv || this.currentLevel();
    if (lv.rainbow && Math.random() < lv.rainbow) return RAINBOW_ID;

    var live = {};
    var any = false;
    this.forEachCell(function (cell) {
      if (cell && cell.id !== RAINBOW_ID) { live[cell.id] = true; any = true; }
    });
    var options = any ? Object.keys(live) : this.palette.slice();
    if (!options.length) options = this.palette.slice();
    return pick(options);
  };

  /* ---------- input ---------------------------------------------------- */

  Game.prototype.bindInput = function () {
    var self = this;
    var cv = this.canvas;

    function localPoint(ev) {
      var rect = cv.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function aimAt(p) {
      var origin = self.shooterOrigin();
      var dx = p.x - origin.x;
      var dy = p.y - origin.y;
      if (dy > -4) dy = -4;                 // never aim downward
      var a = Math.atan2(dy, dx);
      var lim = CONFIG.minAimDeg * Math.PI / 180;
      // keep the shot between (180 - lim) and (0 + lim), measured upward
      if (a > -lim) a = -lim;
      if (a < -Math.PI + lim) a = -Math.PI + lim;
      self.aimAngle = a;
      self.aiming = true;
    }

    cv.addEventListener("pointerdown", function (ev) {
      if (self.state !== "playing") return;
      cv.setPointerCapture && cv.setPointerCapture(ev.pointerId);
      self.pointerActive = true;
      self.pointerMoved = false;
      self.pointerStart = localPoint(ev);
      aimAt(self.pointerStart);
      ev.preventDefault();
    }, { passive: false });

    cv.addEventListener("pointermove", function (ev) {
      if (self.state !== "playing") return;
      var p = localPoint(ev);
      if (self.pointerActive) {
        var dx = p.x - self.pointerStart.x, dy = p.y - self.pointerStart.y;
        if (dx * dx + dy * dy > 64) self.pointerMoved = true;
        aimAt(p);
        ev.preventDefault();
      } else if (ev.pointerType === "mouse") {
        aimAt(p);                            // desktop hover-aim
      }
    }, { passive: false });

    function release(ev) {
      if (!self.pointerActive) return;
      self.pointerActive = false;
      if (self.state !== "playing") return;
      aimAt(localPoint(ev));
      self.shoot();
      ev.preventDefault();
    }
    cv.addEventListener("pointerup", release, { passive: false });
    cv.addEventListener("pointercancel", function () { self.pointerActive = false; });

    cv.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse" && !self.pointerActive) self.aiming = false;
    });

    // Keyboard: arrows aim, space / enter shoots, S swaps.
    cv.setAttribute("tabindex", "0");
    window.addEventListener("keydown", function (ev) {
      if (self.state !== "playing") return;
      var step = ev.shiftKey ? 0.012 : 0.045;
      if (ev.key === "ArrowLeft")  { self.aimAngle = clamp(self.aimAngle - step, -Math.PI + 0.24, -0.24); self.aiming = true; ev.preventDefault(); }
      if (ev.key === "ArrowRight") { self.aimAngle = clamp(self.aimAngle + step, -Math.PI + 0.24, -0.24); self.aiming = true; ev.preventDefault(); }
      if (ev.key === " " || ev.key === "Enter") { self.shoot(); ev.preventDefault(); }
      if (ev.key === "s" || ev.key === "S") { self.swap(); }
    });
  };

  Game.prototype.shooterOrigin = function () {
    var L = this.layout;
    return { x: L.left + L.width / 2, y: L.shooterY };
  };

  Game.prototype.swap = function () {
    if (this.state !== "playing" || this.projectile) return;
    var t = this.current; this.current = this.next; this.next = t;
    Audio1.tone(660, 0.07, "triangle", 0.06);
    this.drawNext();
  };

  Game.prototype.shoot = function () {
    if (this.state !== "playing" || this.projectile) return;
    var origin = this.shooterOrigin();
    var L = this.layout;
    var speed = CONFIG.speed * L.width;    // px per ms, scales with playfield
    this.projectile = {
      x: origin.x, y: origin.y,
      vx: Math.cos(this.aimAngle) * speed,
      vy: Math.sin(this.aimAngle) * speed,
      id: this.current,
      spin: 0
    };
    this.current = this.next;
    this.next = this.rollFlower();
    this.shots++;
    this.sinceDrop++;
    Audio1.shoot();
    this.drawNext();
    this.reportHud();
  };

  /* ---------- simulation ---------------------------------------------- */

  Game.prototype.run = function () {
    if (this.rafId) return;
    var self = this;
    this.lastFrame = performance.now();
    var loop = function (now) {
      var dt = Math.min(now - self.lastFrame, 48);
      self.lastFrame = now;
      self.time += dt;
      self.update(dt);
      self.draw();
      self.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  };

  Game.prototype.stop = function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  };

  Game.prototype.update = function (dt) {
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    this.updateParticles(dt);
    this.updateFallers(dt);
    this.updatePops(dt);
    if (this.state === "playing") this.updateProjectile(dt);
  };

  Game.prototype.updateProjectile = function (dt) {
    var p = this.projectile;
    if (!p) return;
    var L = this.layout;
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt / (L.r * 0.5)));
    var sdt = dt / steps;

    for (var s = 0; s < steps; s++) {
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      p.spin += sdt * 0.006;

      // side walls
      if (p.x < L.left + L.r) { p.x = L.left + L.r; p.vx = Math.abs(p.vx); Audio1.bounce(); }
      if (p.x > L.left + L.width - L.r) { p.x = L.left + L.width - L.r; p.vx = -Math.abs(p.vx); Audio1.bounce(); }

      // ceiling
      if (p.y <= L.top + L.r) { p.y = L.top + L.r; this.landProjectile(); return; }

      // flowers
      var hit = this.findCollision(p.x, p.y);
      if (hit) { this.landProjectile(hit); return; }
    }
  };

  Game.prototype.findCollision = function (x, y) {
    var L = this.layout;
    var limit = L.d * CONFIG.snapTolerance;
    var limitSq = limit * limit;
    var approxRow = Math.round((y - L.top - L.r) / L.rowH);
    var best = null, bestSq = Infinity;

    for (var r = approxRow - 2; r <= approxRow + 2; r++) {
      if (r < 0 || r >= this.grid.length) continue;
      var row = this.grid[r];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (!cell || cell.popT > 0) continue;
        var p = this.cellCenter(r, c);
        var dx = p.x - x, dy = p.y - y;
        var dsq = dx * dx + dy * dy;
        if (dsq < limitSq && dsq < bestSq) { bestSq = dsq; best = { r: r, c: c }; }
      }
    }
    return best;
  };

  // Choose the free cell nearest the projectile — preferring cells adjacent to
  // whatever it collided with, so a flower never snaps to a detached spot.
  Game.prototype.chooseLandingCell = function (x, y, hit) {
    var candidates = [];
    var self = this;

    function consider(r, c) {
      if (r < 0 || r >= CONFIG.maxRows) return;
      var len = rowLength(r, self.parity, CONFIG.cols);
      if (c < 0 || c >= len) return;
      if (self.cellAt(r, c)) return;
      candidates.push({ r: r, c: c });
    }

    if (hit) {
      var nb = neighbourCells(hit.r, hit.c, this.parity);
      for (var i = 0; i < nb.length; i++) consider(nb[i][0], nb[i][1]);
    } else {
      // ceiling hit — land on row 0
      var L0 = this.layout;
      var approx = Math.round((x - L0.left - L0.r - (isShiftedRow(0, this.parity) ? L0.r : 0)) / L0.d);
      for (var k = -2; k <= 2; k++) consider(0, approx + k);
    }

    if (!candidates.length) {
      // fall back to a wider sweep around the projectile
      var Lb = this.layout;
      var rApprox = Math.round((y - Lb.top - Lb.r) / Lb.rowH);
      for (var r2 = rApprox - 1; r2 <= rApprox + 1; r2++) {
        var len2 = rowLength(r2, this.parity, CONFIG.cols);
        for (var c2 = 0; c2 < len2; c2++) consider(r2, c2);
      }
    }
    if (!candidates.length) return null;

    var best = null, bestSq = Infinity;
    for (var j = 0; j < candidates.length; j++) {
      var p = this.cellCenter(candidates[j].r, candidates[j].c);
      var dx = p.x - x, dy = p.y - y;
      var dsq = dx * dx + dy * dy;
      if (dsq < bestSq) { bestSq = dsq; best = candidates[j]; }
    }
    return best;
  };

  Game.prototype.landProjectile = function (hit) {
    var p = this.projectile;
    this.projectile = null;
    if (!p) return;

    var spot = this.chooseLandingCell(p.x, p.y, hit);
    if (!spot) { this.afterTurn(0, 0); return; }

    var id = p.id;
    if (id === RAINBOW_ID) id = this.resolveRainbow(spot);

    this.setCell(spot.r, spot.c, { id: id, popT: 0, born: this.time });
    Audio1.stick();

    var group = this.matchGroup(spot.r, spot.c);
    if (group.length >= 3) {
      this.popGroup(group);
      var dropped = this.dropFloaters();
      this.afterTurn(group.length, dropped);
    } else {
      this.afterTurn(0, 0);
    }
  };

  // A rainbow bloom becomes whichever neighbouring colour clears the most.
  // We actually try each candidate colour in the landing cell and measure the
  // group it would form, rather than just counting touching neighbours — a tie
  // on neighbour count often hides a much larger cluster behind one of them.
  Game.prototype.resolveRainbow = function (spot) {
    var nb = neighbourCells(spot.r, spot.c, this.parity);
    var tally = {};
    for (var i = 0; i < nb.length; i++) {
      var cell = this.cellAt(nb[i][0], nb[i][1]);
      if (cell && cell.popT <= 0 && cell.id !== RAINBOW_ID) {
        tally[cell.id] = (tally[cell.id] || 0) + 1;
      }
    }
    var ids = Object.keys(tally);
    if (!ids.length) return pick(this.palette);

    var probe = this.cellAt(spot.r, spot.c);
    var restore = probe ? probe.id : null;
    var placed = false;
    if (!probe) { this.setCell(spot.r, spot.c, { id: ids[0], popT: 0, born: this.time }); placed = true; }

    var bestId = ids[0], bestScore = -1;
    for (var k = 0; k < ids.length; k++) {
      this.cellAt(spot.r, spot.c).id = ids[k];
      var size = this.matchGroup(spot.r, spot.c).length;
      // group size dominates; neighbour count only breaks ties
      var score = size * 100 + tally[ids[k]];
      if (score > bestScore) { bestScore = score; bestId = ids[k]; }
    }

    if (placed) this.setCell(spot.r, spot.c, null);
    else if (restore !== null) this.cellAt(spot.r, spot.c).id = restore;
    return bestId;
  };

  Game.prototype.matchGroup = function (r0, c0) {
    var start = this.cellAt(r0, c0);
    if (!start) return [];
    var target = start.id;
    var seen = {};
    var stack = [[r0, c0]];
    var out = [];
    while (stack.length) {
      var cur = stack.pop();
      var key = cur[0] + ":" + cur[1];
      if (seen[key]) continue;
      seen[key] = true;
      var cell = this.cellAt(cur[0], cur[1]);
      if (!cell || cell.id !== target || cell.popT > 0) continue;
      out.push({ r: cur[0], c: cur[1] });
      var nb = neighbourCells(cur[0], cur[1], this.parity);
      for (var i = 0; i < nb.length; i++) stack.push(nb[i]);
    }
    return out;
  };

  Game.prototype.popGroup = function (group) {
    for (var i = 0; i < group.length; i++) {
      var cell = this.cellAt(group[i].r, group[i].c);
      if (!cell) continue;
      cell.popT = 1;
      var pos = this.cellCenter(group[i].r, group[i].c);
      this.spawnPetalBurst(pos.x, pos.y, cell.id);
    }
    Audio1.pop(group.length);
    this.score += group.length * CONFIG.popScore;
    if (group.length > 3) this.score += (group.length - 3) * CONFIG.comboBonus;
    this.shakeT = Math.min(220, 60 + group.length * 18);
  };

  // Anything no longer connected to the ceiling row falls away.
  Game.prototype.dropFloaters = function () {
    var anchored = {};
    var stack = [];
    var c;
    for (c = 0; c < rowLength(0, this.parity, CONFIG.cols); c++) {
      var top = this.cellAt(0, c);
      if (top && top.popT <= 0) stack.push([0, c]);
    }
    while (stack.length) {
      var cur = stack.pop();
      var key = cur[0] + ":" + cur[1];
      if (anchored[key]) continue;
      var cell = this.cellAt(cur[0], cur[1]);
      if (!cell || cell.popT > 0) continue;
      anchored[key] = true;
      var nb = neighbourCells(cur[0], cur[1], this.parity);
      for (var i = 0; i < nb.length; i++) stack.push(nb[i]);
    }

    var dropped = 0;
    for (var r = 0; r < this.grid.length; r++) {
      var row = this.grid[r];
      for (c = 0; c < row.length; c++) {
        var cl = row[c];
        if (!cl || cl.popT > 0) continue;
        if (!anchored[r + ":" + c]) {
          var pos = this.cellCenter(r, c);
          this.fallers.push({
            x: pos.x, y: pos.y, id: cl.id,
            vx: (Math.random() - 0.5) * 0.12,
            vy: -0.05 - Math.random() * 0.06,
            spin: (Math.random() - 0.5) * 0.008,
            rot: 0, life: 0
          });
          row[c] = null;
          dropped++;
        }
      }
    }
    if (dropped) {
      Audio1.drop();
      this.score += dropped * CONFIG.dropScore;
    }
    return dropped;
  };

  Game.prototype.afterTurn = function (popped, dropped) {
    this.poppedTotal += popped || 0;
    this.droppedTotal += dropped || 0;
    if (dropped >= 4) helperSay(pick(BIG_CHEERS), "cheer");
    else if (popped >= 3) helperSay(pick(CHEERS), "cheer");

    var lv = this.currentLevel();
    if (this.mode !== "puzzle" && this.sinceDrop >= lv.dropEvery) {
      this.sinceDrop = 0;
      this.pushCeilingRow();
    }

    this.reportHud();

    var self = this;
    // let pops finish before judging the board
    setTimeout(function () { self.judge(); }, 340);
  };

  Game.prototype.pushCeilingRow = function () {
    if (this.grid.length >= CONFIG.maxRows) return;
    this.parity = 1 - this.parity;
    var len = rowLength(0, this.parity, CONFIG.cols);
    var row = new Array(len);
    for (var c = 0; c < len; c++) {
      row[c] = { id: pick(this.palette), popT: 0, born: this.time };
    }
    this.grid.unshift(row);
    Audio1.descend();
    helperSay("The garden is growing!", "worry");
  };

  Game.prototype.updatePops = function (dt) {
    for (var r = 0; r < this.grid.length; r++) {
      var row = this.grid[r];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (cell && cell.popT > 0) {
          cell.popT -= dt / 200;
          if (cell.popT <= 0) row[c] = null;
        }
      }
    }
    // trim trailing empty rows so the grid array cannot creep
    while (this.grid.length > 1) {
      var last = this.grid[this.grid.length - 1];
      var empty = true;
      for (var i = 0; i < last.length; i++) if (last[i]) { empty = false; break; }
      if (!empty) break;
      this.grid.pop();
    }
  };

  Game.prototype.countFlowers = function () {
    var n = 0;
    this.forEachCell(function (cell) { if (cell && cell.popT <= 0) n++; });
    return n;
  };

  Game.prototype.lowestFlowerY = function () {
    var lowest = -Infinity;
    var self = this;
    this.forEachCell(function (cell, r, c) {
      if (cell && cell.popT <= 0) {
        var y = self.cellCenter(r, c).y;
        if (y > lowest) lowest = y;
      }
    });
    return lowest;
  };

  Game.prototype.judge = function () {
    if (this.state !== "playing") return;
    var lv = this.currentLevel();
    var empty = this.countFlowers() === 0;
    if (this.mode === "arcade") {
      var met = lv.objective === "score" ? this.score >= lv.target
        : lv.objective === "pop" ? this.poppedTotal >= lv.target
        : lv.objective === "drop" ? this.droppedTotal >= lv.target
        : empty;
      if (met) { this.finishLevel(true); return; }
      if (lv.maxShots && this.shots >= lv.maxShots) { this.finishLevel(false); return; }
    } else if (empty) { this.finishLevel(true); return; }
    if (this.mode === "puzzle" && this.shots >= this.shotLimit) { this.finishLevel(false); return; }
    if (this.lowestFlowerY() + this.layout.r > this.layout.danger) { this.finishLevel(false); }
  };

  Game.prototype.starsEarned = function () {
    var par = this.currentLevel().par;
    if (this.shots <= par) return 3;
    if (this.shots <= Math.round(par * 1.4)) return 2;
    return 1;
  };

  Game.prototype.finishLevel = function (won) {
    this.state = won ? "won" : "lost";
    this.projectile = null;
    if (won) { Audio1.win(); setHelperMood("cheer"); }
    else { Audio1.lose(); setHelperMood("worry"); }
    if (this.cb.onFinish) this.cb.onFinish(won, this.score, won ? this.starsEarned() : 0, this.shots);
  };

  Game.prototype.reportHud = function () {
    if (this.cb.onHud) {
      var lv = this.currentLevel();
      var goal = this.countFlowers();
      var goalLabel = "Flowers left";
      if (this.mode === "puzzle") { goal = Math.max(0, this.shotLimit - this.shots); goalLabel = "Shots left"; }
      if (this.mode === "arcade") {
        goalLabel = lv.objective === "score" ? "Score goal" : (lv.objective === "pop" ? "Pop goal" : (lv.objective === "drop" ? "Drop goal" : "Flowers left"));
        goal = lv.objective === "score" ? (this.score + "/" + lv.target)
          : lv.objective === "pop" ? (this.poppedTotal + "/" + lv.target)
          : lv.objective === "drop" ? (this.droppedTotal + "/" + lv.target)
          : this.countFlowers();
      }
      this.cb.onHud({
        level: this.levelIndex + 1,
        score: this.score,
        left: goal,
        goalLabel: goalLabel,
        stageLabel: (MODE_INFO[this.mode] || MODE_INFO.classic).stageWord,
        mode: this.mode,
        shots: this.shots,
        untilDrop: lv.dropEvery ? Math.max(0, lv.dropEvery - this.sinceDrop) : null
      });
    }
  };

  /* ---------- particles ------------------------------------------------ */

  Game.prototype.spawnPetalBurst = function (x, y, id) {
    var def = flowerById(id) || FLOWERS[0];
    var n = this.sparkle ? def.petals : Math.min(def.petals, 4);
    var L = this.layout;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      var sp = (0.10 + Math.random() * 0.14) * (L.d / 50);
      this.particles.push({
        kind: "petal", shape: def.petal,
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05,
        rot: a, spin: (Math.random() - 0.5) * 0.012,
        size: L.r * (0.34 + Math.random() * 0.16),
        color: def.base, edge: def.dark,
        life: 0, max: 620 + Math.random() * 260
      });
    }
    if (!this.sparkle) return;
    for (var s = 0; s < 6; s++) {
      var sa = Math.random() * Math.PI * 2;
      this.particles.push({
        kind: "spark",
        x: x, y: y,
        vx: Math.cos(sa) * 0.16, vy: Math.sin(sa) * 0.16 - 0.04,
        size: L.r * (0.10 + Math.random() * 0.10),
        color: "#FFFFFF",
        life: 0, max: 380 + Math.random() * 200
      });
    }
  };

  Game.prototype.updateParticles = function (dt) {
    var g = 0.00042 * (this.layout.d / 50);
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
  };

  Game.prototype.updateFallers = function (dt) {
    var g = 0.0012 * (this.layout.d / 50);
    for (var i = this.fallers.length - 1; i >= 0; i--) {
      var f = this.fallers[i];
      f.life += dt;
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.y - this.layout.r > this.layout.ch || f.life > 2600) this.fallers.splice(i, 1);
    }
  };

  /* ==========================================================================
     7. RENDERING
     ====================================================================== */

  Game.prototype.draw = function () {
    var ctx = this.ctx, L = this.layout;
    ctx.clearRect(0, 0, L.cw, L.ch);

    ctx.save();
    if (this.shakeT > 0) {
      var k = this.shakeT / 220;
      ctx.translate((Math.random() - 0.5) * 5 * k, (Math.random() - 0.5) * 5 * k);
    }

    this.drawBackground(ctx, L);
    this.drawPlayfieldFrame(ctx, L);
    this.drawGrid(ctx, L);
    this.drawFallers(ctx);
    this.drawDangerLine(ctx, L);
    if (this.state === "playing" && !this.projectile && this.aiming) this.drawAim(ctx, L);
    this.drawProjectile(ctx, L);
    this.drawShooter(ctx, L);
    this.drawParticles(ctx);

    ctx.restore();
  };

  Game.prototype.drawBackground = function (ctx, L) {
    var key = backgroundKeyForMode(this.mode);
    var readyKey = Art.ready[key] ? key : (Art.ready.background ? "background" : null);
    if (readyKey) {
      var img = Art.images[readyKey];
      // cover-fit
      var s = Math.max(L.cw / img.width, L.ch / img.height);
      var w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (L.cw - w) / 2, (L.ch - h) / 2, w, h);
    } else {
      this.drawFallbackScene(ctx, L);
    }
    if (Art.ready.castle) {
      var ci = Art.images.castle;
      var cw = L.cw, ch = ci.height * (L.cw / ci.width);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(ci, 0, L.ch * 0.52 - ch * 0.6, cw, ch);
      ctx.globalAlpha = 1;
    }
  };

  // Code-drawn stand-in scene: sky, sun-glow, rolling meadow, castle silhouette.
  Game.prototype.drawFallbackScene = function (ctx, L) {
    var sky = ctx.createLinearGradient(0, 0, 0, L.ch);
    sky.addColorStop(0, "#FFDCF0");
    sky.addColorStop(0.42, "#EBCCFF");
    sky.addColorStop(0.72, "#CFE8FF");
    sky.addColorStop(1, "#BFF0D8");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, L.cw, L.ch);

    // soft sun glow
    var gx = L.cw * 0.18, gy = L.ch * 0.16, gr = Math.max(L.cw, L.ch) * 0.32;
    var glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, "rgba(255,255,255,0.85)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();

    // drifting clouds
    var t = this.time * 0.00004;
    for (var i = 0; i < 4; i++) {
      var cx = ((t * (0.5 + i * 0.18) + i * 0.31) % 1.3 - 0.15) * L.cw;
      var cy = L.ch * (0.10 + i * 0.075);
      var cr = L.cw * (0.05 + i * 0.012);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.arc(cx + cr * 0.85, cy + cr * 0.15, cr * 0.75, 0, Math.PI * 2);
      ctx.arc(cx - cr * 0.8, cy + cr * 0.2, cr * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // castle silhouette on the horizon — kept small so it reads as distance
    var hy = L.ch * 0.63;
    ctx.fillStyle = "rgba(186,148,220,0.34)";
    this.drawCastle(ctx, L.cw * 0.5, hy, Math.min(L.cw * 0.24, L.ch * 0.34));

    // meadow hills
    var hills = [
      { y: hy + L.ch * 0.02, col: "#A9E6A8", amp: L.ch * 0.05 },
      { y: hy + L.ch * 0.11, col: "#8FDC96", amp: L.ch * 0.06 },
      { y: hy + L.ch * 0.22, col: "#75CE85", amp: L.ch * 0.05 }
    ];
    for (var h = 0; h < hills.length; h++) {
      var hd = hills[h];
      ctx.fillStyle = hd.col;
      ctx.beginPath();
      ctx.moveTo(0, L.ch);
      ctx.lineTo(0, hd.y);
      for (var x = 0; x <= L.cw; x += L.cw / 16) {
        ctx.lineTo(x, hd.y + Math.sin(x / L.cw * Math.PI * (1.6 + h * 0.7) + h) * hd.amp);
      }
      ctx.lineTo(L.cw, L.ch);
      ctx.closePath();
      ctx.fill();
    }
  };

  Game.prototype.drawCastle = function (ctx, cx, baseY, width) {
    var w = width, hRoof = w * 0.34;
    function tower(x, tw, th) {
      ctx.fillRect(x - tw / 2, baseY - th, tw, th);
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.62, baseY - th);
      ctx.lineTo(x, baseY - th - hRoof * (tw / (w * 0.16)));
      ctx.lineTo(x + tw * 0.62, baseY - th);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(cx - w * 0.34, baseY - w * 0.30, w * 0.68, w * 0.30);
    tower(cx - w * 0.36, w * 0.15, w * 0.44);
    tower(cx + w * 0.36, w * 0.15, w * 0.44);
    tower(cx, w * 0.19, w * 0.60);
  };

  Game.prototype.drawPlayfieldFrame = function (ctx, L) {
    // gentle vertical band marking the play column, plus vine edges
    var band = ctx.createLinearGradient(L.left, 0, L.left + L.width, 0);
    band.addColorStop(0, "rgba(255,255,255,0.30)");
    band.addColorStop(0.5, "rgba(255,255,255,0.10)");
    band.addColorStop(1, "rgba(255,255,255,0.30)");
    ctx.fillStyle = band;
    ctx.fillRect(L.left, 0, L.width, L.ch);

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = Math.max(2, L.d * 0.05);
    ctx.beginPath();
    ctx.moveTo(L.left, 0); ctx.lineTo(L.left, L.ch);
    ctx.moveTo(L.left + L.width, 0); ctx.lineTo(L.left + L.width, L.ch);
    ctx.stroke();

    // Ceiling ivy band. It turns rose and pulses when a descent is one shot
    // away, so the pressure is visible before it happens.
    var lv = this.currentLevel() || LEVELS[0];
    var soon = this.mode !== "puzzle" && this.state === "playing" && (lv.dropEvery - this.sinceDrop) <= 1;
    var pulse = soon ? 0.5 + 0.5 * Math.sin(this.time * 0.008) : 0;
    var bandH = Math.max(5, L.top);
    ctx.fillStyle = soon ? "rgba(226,96,152," + (0.55 + pulse * 0.4) + ")" : "rgba(112,186,120,0.75)";
    ctx.fillRect(L.left, 0, L.width, bandH);
    ctx.fillStyle = soon ? "rgba(255,225,238,0.75)" : "rgba(226,248,226,0.75)";
    for (var i = 0; i < CONFIG.cols * 2; i++) {
      var lx = L.left + (i + 0.5) * (L.width / (CONFIG.cols * 2));
      ctx.beginPath();
      ctx.ellipse(lx, bandH * 0.72, bandH * 0.42, bandH * 0.60, i % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Game.prototype.drawGrid = function (ctx, L) {
    for (var r = 0; r < this.grid.length; r++) {
      var row = this.grid[r];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (!cell) continue;
        var p = this.cellCenter(r, c);
        if (p.y < -L.d || p.y > L.ch + L.d) continue;
        var scale = 1, alpha = 1;
        if (cell.popT > 0) { scale = 0.6 + cell.popT * 0.7; alpha = cell.popT; }
        else if (this.time - cell.born < 220) {
          var t = (this.time - cell.born) / 220;
          scale = 0.7 + 0.3 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.12;
        }
        drawFlower(ctx, p.x, p.y, L.r * 0.95 * scale, cell.id, this.time, alpha, this.sparkle);
      }
    }
  };

  Game.prototype.drawFallers = function (ctx) {
    var L = this.layout;
    for (var i = 0; i < this.fallers.length; i++) {
      var f = this.fallers[i];
      var a = clamp(1 - (f.life - 900) / 900, 0, 1);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawFlower(ctx, 0, 0, L.r * 0.95, f.id, this.time, a, false);
      ctx.restore();
    }
  };

  Game.prototype.drawDangerLine = function (ctx, L) {
    var y = L.danger;
    var lowest = this.lowestFlowerY();
    var close = lowest > y - L.d * 2;
    ctx.save();
    ctx.setLineDash([L.d * 0.22, L.d * 0.18]);
    ctx.lineWidth = Math.max(2, L.d * 0.055);
    ctx.strokeStyle = close
      ? "rgba(233,80,120," + (0.55 + 0.45 * Math.sin(this.time * 0.009)) + ")"
      : "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(L.left, y);
    ctx.lineTo(L.left + L.width, y);
    ctx.stroke();
    ctx.restore();
  };

  Game.prototype.drawShooter = function (ctx, L) {
    var o = this.shooterOrigin();
    var R = L.r;

    // pedestal — a small stone planter the flower sits in
    ctx.save();
    ctx.fillStyle = "rgba(74,35,80,0.16)";
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + R * 1.25, R * 1.5, R * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    var pot = ctx.createLinearGradient(o.x, o.y + R * 0.4, o.x, o.y + R * 1.5);
    pot.addColorStop(0, "#FFF2FA");
    pot.addColorStop(1, "#E4BFDC");
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.moveTo(o.x - R * 1.15, o.y + R * 0.45);
    ctx.lineTo(o.x + R * 1.15, o.y + R * 0.45);
    ctx.lineTo(o.x + R * 0.82, o.y + R * 1.35);
    ctx.lineTo(o.x - R * 0.82, o.y + R * 1.35);
    ctx.closePath();
    ctx.fill();

    // little gold crown on the planter rim
    ctx.fillStyle = "#FFC94D";
    ctx.beginPath();
    ctx.moveTo(o.x - R * 0.55, o.y + R * 0.5);
    ctx.lineTo(o.x - R * 0.55, o.y + R * 0.16);
    ctx.lineTo(o.x - R * 0.28, o.y + R * 0.40);
    ctx.lineTo(o.x, o.y + R * 0.10);
    ctx.lineTo(o.x + R * 0.28, o.y + R * 0.40);
    ctx.lineTo(o.x + R * 0.55, o.y + R * 0.16);
    ctx.lineTo(o.x + R * 0.55, o.y + R * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.current && !this.projectile) {
      var bob = Math.sin(this.time * 0.004) * R * 0.05;
      drawFlower(ctx, o.x, o.y - R * 0.15 + bob, R * 0.98, this.current, this.time, 1, this.sparkle);
    }
  };

  Game.prototype.drawProjectile = function (ctx, L) {
    var p = this.projectile;
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    drawFlower(ctx, 0, 0, L.r * 0.95, p.id, this.time, 1, this.sparkle);
    ctx.restore();
  };

  // Dotted aim path, previewing up to two wall bounces.
  Game.prototype.traceAim = function () {
    var L = this.layout;
    var o = this.shooterOrigin();
    var x = o.x, y = o.y;
    var vx = Math.cos(this.aimAngle), vy = Math.sin(this.aimAngle);
    var step = L.d * 0.22;
    var pts = [];
    var bounces = 0;
    for (var i = 0; i < 460; i++) {
      x += vx * step;
      y += vy * step;
      if (x < L.left + L.r) { x = L.left + L.r; vx = Math.abs(vx); bounces++; }
      if (x > L.left + L.width - L.r) { x = L.left + L.width - L.r; vx = -Math.abs(vx); bounces++; }
      if (bounces > 2) break;
      if (y <= L.top + L.r) { pts.push({ x: x, y: L.top + L.r }); break; }
      pts.push({ x: x, y: y });
      if (this.findCollision(x, y)) break;
    }
    return pts;
  };

  Game.prototype.drawAim = function (ctx, L) {
    var pts = this.traceAim();
    if (!pts.length) return;
    var end = pts[pts.length - 1];

    ctx.save();
    for (var i = 0; i < pts.length; i += 2) {
      var t = i / pts.length;
      var rr = L.d * (0.075 - t * 0.035);
      if (rr <= 0.4) break;
      ctx.globalAlpha = 0.85 - t * 0.30;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    // landing marker
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 0.008);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(2, L.d * 0.05);
    ctx.beginPath();
    ctx.arc(end.x, end.y, L.r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Game.prototype.drawParticles = function (ctx) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var a = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(p.x, p.y);
      if (p.kind === "spark") {
        ctx.fillStyle = p.color;
        drawSparkle(ctx, p.size * (0.6 + a * 0.6));
      } else {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.edge;
        ctx.lineWidth = Math.max(1, p.size * 0.12);
        petalPath(ctx, p.shape, p.size);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  Game.prototype.drawNext = function () {
    var ctx = this.nextCtx;
    var s = this.nextSize || { w: 48, h: 48 };
    ctx.clearRect(0, 0, s.w, s.h);
    if (!this.next) return;
    drawFlower(ctx, s.w / 2, s.h / 2, Math.min(s.w, s.h) * 0.44, this.next, this.time, 1, false);
  };

  /* ---------- flower drawing ------------------------------------------ */

  // Petal outlines, all drawn pointing "up" from the flower centre.
  function petalPath(ctx, shape, R) {
    ctx.beginPath();
    switch (shape) {
      case "round":
        ctx.ellipse(0, -R * 0.55, R * 0.42, R * 0.58, 0, 0, Math.PI * 2);
        break;
      case "ray":
        ctx.ellipse(0, -R * 0.60, R * 0.15, R * 0.62, 0, 0, Math.PI * 2);
        break;
      case "thin":
        ctx.ellipse(0, -R * 0.58, R * 0.19, R * 0.60, 0, 0, Math.PI * 2);
        break;
      case "clover":
        ctx.arc(0, -R * 0.52, R * 0.50, 0, Math.PI * 2);
        break;
      case "point":
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-R * 0.52, -R * 0.34, -R * 0.34, -R * 1.06, 0, -R * 1.12);
        ctx.bezierCurveTo(R * 0.34, -R * 1.06, R * 0.52, -R * 0.34, 0, 0);
        break;
      case "heart":
        ctx.moveTo(0, -R * 0.18);
        ctx.bezierCurveTo(-R * 0.30, -R * 0.72, -R * 0.72, -R * 0.70, -R * 0.52, -R * 1.00);
        ctx.bezierCurveTo(-R * 0.34, -R * 1.20, -R * 0.10, -R * 1.02, 0, -R * 0.84);
        ctx.bezierCurveTo(R * 0.10, -R * 1.02, R * 0.34, -R * 1.20, R * 0.52, -R * 1.00);
        ctx.bezierCurveTo(R * 0.72, -R * 0.70, R * 0.30, -R * 0.72, 0, -R * 0.18);
        break;
      case "cup":
        ctx.moveTo(-R * 0.44, 0);
        ctx.bezierCurveTo(-R * 0.62, -R * 0.62, -R * 0.40, -R * 1.10, 0, -R * 1.10);
        ctx.bezierCurveTo(R * 0.40, -R * 1.10, R * 0.62, -R * 0.62, R * 0.44, 0);
        ctx.bezierCurveTo(R * 0.22, R * 0.16, -R * 0.22, R * 0.16, -R * 0.44, 0);
        break;
      default:
        ctx.ellipse(0, -R * 0.55, R * 0.40, R * 0.55, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
  }

  function drawSparkle(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0);
    ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s);
    ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0);
    ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s);
    ctx.closePath();
    ctx.fill();
  }

  function drawFlower(ctx, x, y, R, id, time, alpha, sparkle) {
    if (R <= 0.5) return;
    var rainbow = (id === RAINBOW_ID);
    var def = rainbow ? FLOWERS[0] : (flowerById(id) || FLOWERS[0]);

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha);

    // contact shadow keeps flowers readable against a busy background
    ctx.fillStyle = "rgba(74,35,80,0.18)";
    ctx.beginPath();
    ctx.ellipse(R * 0.10, R * 0.22, R * 0.86, R * 0.80, 0, 0, Math.PI * 2);
    ctx.fill();

    var n = def.petals;
    var wobble = rainbow ? Math.sin(time * 0.003) * 0.10 : 0;

    for (var i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * Math.PI * 2 + def.phase + wobble);

      var fill;
      if (rainbow) {
        var hue = (i / n) * 360 + time * 0.06;
        fill = "hsl(" + (hue % 360) + ", 88%, 66%)";
        ctx.fillStyle = fill;
        ctx.strokeStyle = "hsl(" + (hue % 360) + ", 70%, 44%)";
      } else {
        var grad = ctx.createLinearGradient(0, -R * 1.05, 0, 0);
        grad.addColorStop(0, def.light);
        grad.addColorStop(0.55, def.base);
        grad.addColorStop(1, def.dark);
        ctx.fillStyle = grad;
        ctx.strokeStyle = def.dark;
      }
      ctx.lineWidth = Math.max(1, R * 0.075);
      ctx.lineJoin = "round";
      petalPath(ctx, def.petal, R);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // centre disc
    var cg = ctx.createRadialGradient(-R * 0.10, -R * 0.12, R * 0.02, 0, 0, R * 0.36);
    cg.addColorStop(0, rainbow ? "#FFFFFF" : def.center);
    cg.addColorStop(1, rainbow ? "#FFE9A8" : def.centerEdge);
    ctx.fillStyle = cg;
    ctx.strokeStyle = rainbow ? "#D8A63C" : def.centerEdge;
    ctx.lineWidth = Math.max(1, R * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // highlight
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(-R * 0.13, -R * 0.16, R * 0.10, R * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fill();

    if (rainbow && sparkle) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#FFFFFF";
      ctx.save();
      ctx.translate(R * 0.55, -R * 0.6);
      ctx.rotate(time * 0.004);
      drawSparkle(ctx, R * 0.22);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ==========================================================================
     8. UI WIRING + BOOT
     ====================================================================== */

  var el = {};
  var progress = Store.read();
  var game = null;
  var activeMode = "classic";

  function $(id) { return document.getElementById(id); }

  function showScreen(name) {
    ["titleScreen", "modeScreen", "levelScreen", "gameScreen"].forEach(function (id) {
      var node = $(id);
      if (node) node.classList.toggle("is-active", id === name);
    });
  }

  function hideOverlay() { el.overlay.hidden = true; }

  function showOverlay(opts) {
    el.overlayTitle.textContent = opts.title || "";
    el.overlayText.textContent = opts.text || "";
    el.overlayEmoji.textContent = opts.emoji || "🌸";
    el.overlayArt.dataset.hasArt = opts.useWinArt && Art.ready.winBanner ? "true" : "false";
    el.overlayArt.style.backgroundImage =
      (opts.useWinArt && Art.ready.winBanner) ? 'url("' + ASSET_SLOTS.winBanner + '")' : "none";

    if (typeof opts.stars === "number") {
      el.overlayStars.hidden = false;
      var stars = el.overlayStars.querySelectorAll(".star");
      for (var i = 0; i < stars.length; i++) {
        stars[i].classList.toggle("is-earned", i < opts.stars);
      }
    } else {
      el.overlayStars.hidden = true;
    }

    el.overlayButtons.innerHTML = "";
    (opts.buttons || []).forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "big-button" + (b.ghost ? " big-button--ghost" : "");
      btn.innerHTML = '<span class="big-button__label"></span>';
      btn.querySelector(".big-button__label").textContent = b.label;
      btn.addEventListener("click", b.onClick);
      el.overlayButtons.appendChild(btn);
    });

    el.overlay.hidden = false;
  }

  function buildLevelGrid() {
    var grid = el.levelGrid;
    grid.innerHTML = "";
    var info = MODE_INFO[activeMode];
    var track = progress[activeMode];
    el.modePill.textContent = info.name;
    el.modePill.dataset.mode = activeMode;
    el.levelTitle.textContent = activeMode === "classic" ? "Choose a garden" : (activeMode === "arcade" ? "Choose a challenge" : "Choose a puzzle");
    info.levels.forEach(function (lv, i) {
      var locked = (i + 1) > track.unlocked;
      var card = document.createElement("button");
      card.type = "button";
      card.className = "level-card";
      card.setAttribute("role", "listitem");
      card.dataset.locked = locked ? "true" : "false";
      card.disabled = locked;
      card.setAttribute("aria-label",
        locked ? (info.stageWord + " " + (i + 1) + ", " + lv.name + ", locked")
               : (info.stageWord + " " + (i + 1) + ", " + lv.name));

      var num = document.createElement("span");
      num.textContent = locked ? "🔒" : String(i + 1);

      var name = document.createElement("span");
      name.className = "card-name";
      name.textContent = lv.name;

      var stars = document.createElement("span");
      stars.className = "card-stars";
      var earned = track.stars[i] || 0;
      for (var s = 0; s < 3; s++) {
        var st = document.createElement("span");
        st.textContent = "★";
        if (s < earned) st.className = "earned";
        stars.appendChild(st);
      }

      card.appendChild(num);
      card.appendChild(name);
      if (activeMode !== "classic") {
        var objective = document.createElement("span");
        objective.className = "card-objective";
        objective.textContent = objectiveText(lv, activeMode);
        card.appendChild(objective);
      }
      card.appendChild(stars);
      card.addEventListener("click", function () {
        if (locked) return;
        startGame(i);
      });
      grid.appendChild(card);
    });
  }

  function startGame(index) {
    showScreen("gameScreen");
    hideOverlay();
    requestAnimationFrame(function () {
      game.sparkle = progress.sparkle;
      game.resize();
      game.startLevel(index, activeMode);
    });
  }

  function onHud(info) {
    el.hudStageLabel.textContent = info.stageLabel;
    el.hudLevel.textContent = String(info.level);
    el.hudScore.textContent = String(info.score);
    el.hudGoalLabel.textContent = info.goalLabel;
    el.hudGoal.textContent = String(info.left);
  }

  function onFinish(won, score, stars, shots) {
    var idx = game.levelIndex;
    var mode = game.mode;
    var table = levelsForMode(mode);
    var track = progress[mode];
    if (won) {
      track.stars[idx] = Math.max(track.stars[idx] || 0, stars);
      track.unlocked = Math.max(track.unlocked, Math.min(idx + 2, table.length));
      if (mode === "puzzle") {
        track.bestRemaining = track.bestRemaining || {};
        track.bestRemaining[idx] = Math.max(track.bestRemaining[idx] || 0, Math.max(0, game.shotLimit - shots));
      }
      Store.write(progress);
      buildLevelGrid();

      var hasNext = idx + 1 < table.length;
      showOverlay({
        title: mode === "classic" ? "The garden bloomed!" : (mode === "arcade" ? "Challenge complete!" : "Puzzle solved!"),
        text: "Score " + score + " · " + shots + " flowers used",
        emoji: "👑",
        stars: stars,
        useWinArt: true,
        buttons: [
          hasNext
            ? { label: "Next " + MODE_INFO[mode].stageWord.toLowerCase(), onClick: function () { hideOverlay(); startGame(idx + 1); } }
            : { label: "Play again", onClick: function () { hideOverlay(); startGame(idx); } },
          { label: "Choose stage", ghost: true, onClick: function () { hideOverlay(); game.stop(); showScreen("levelScreen"); } }
        ]
      });
    } else {
      showOverlay({
        title: mode === "puzzle" ? "Out of shots" : (mode === "arcade" ? "Challenge over" : "The garden grew too tall"),
        text: mode === "puzzle" ? "Look for a drop that clears several flowers at once." : (mode === "arcade" ? "Try the objective again and build bigger matches." : "Try again — aim for groups of three of the same flower."),
        emoji: "🌱",
        buttons: [
          { label: "Try again", onClick: function () { hideOverlay(); startGame(idx); } },
          { label: "Choose stage", ghost: true, onClick: function () { hideOverlay(); game.stop(); showScreen("levelScreen"); } }
        ]
      });
    }
  }

  function pauseGame() {
    if (!game || game.state !== "playing") return;
    game.state = "paused";
    showOverlay({
      title: "Paused",
      text: "Take your time.",
      emoji: "🌼",
      buttons: [
        { label: "Keep playing", onClick: function () { hideOverlay(); game.state = "playing"; } },
        { label: "Start over", ghost: true, onClick: function () { hideOverlay(); startGame(game.levelIndex); } },
        { label: "Choose stage", ghost: true, onClick: function () { hideOverlay(); game.stop(); showScreen("levelScreen"); } }
      ]
    });
  }

  function setSound(on) {
    progress.sound = on;
    Audio1.on = on;
    Store.write(progress);
    [el.soundButton, el.titleSoundButton].forEach(function (b) {
      if (!b) return;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var icon = b.querySelector("span[aria-hidden]");
      if (icon) icon.textContent = on ? "🔊" : "🔇";
      var label = b.querySelector(".chip-label");
      if (label) label.textContent = on ? "Sound on" : "Sound off";
      if (b === el.soundButton) b.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    });
  }

  function setSparkle(on) {
    progress.sparkle = on;
    Store.write(progress);
    if (game) game.sparkle = on;
    var b = el.titleMotionButton;
    if (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var label = b.querySelector(".chip-label");
      if (label) label.textContent = on ? "Full sparkle" : "Calm mode";
    }
  }

  function boot() {
    el.overlay = $("overlay");
    el.overlayTitle = $("overlayTitle");
    el.overlayText = $("overlayText");
    el.overlayEmoji = $("overlayEmoji");
    el.overlayArt = $("overlayArt");
    el.overlayStars = $("overlayStars");
    el.overlayButtons = $("overlayButtons");
    el.levelGrid = $("levelGrid");
    el.modePill = $("modePill");
    el.levelTitle = $("levelTitle");
    el.hudStageLabel = $("hudStageLabel");
    el.hudLevel = $("hudLevel");
    el.hudScore = $("hudScore");
    el.hudGoal = $("hudGoal");
    el.hudGoalLabel = $("hudGoalLabel");
    el.soundButton = $("soundButton");
    el.titleSoundButton = $("titleSoundButton");
    el.titleMotionButton = $("titleMotionButton");

    loadArt();

    game = new Game($("gameCanvas"), $("nextCanvas"), { onHud: onHud, onFinish: onFinish });
    game.sparkle = progress.sparkle;

    buildLevelGrid();
    setSound(progress.sound);
    setSparkle(progress.sparkle);

    $("playButton").addEventListener("click", function () {
      Audio1.ensure();
      showScreen("modeScreen");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".mode-card[data-mode]"), function (button) {
      button.addEventListener("click", function () {
        activeMode = button.dataset.mode;
        buildLevelGrid();
        showScreen("levelScreen");
      });
    });
    $("howButton").addEventListener("click", function () {
      showOverlay({
        title: "How to play",
        text: "Aim with your finger or the mouse, then let go to send the flower flying. "
            + "Touch three or more of the same flower together and they bloom away. "
            + "Anything left hanging falls too. Clear the whole garden before it grows past the dotted line!",
        emoji: "🦄",
        buttons: [{ label: "Got it", onClick: hideOverlay }]
      });
    });
    $("modeBackButton").addEventListener("click", function () { showScreen("titleScreen"); });
    $("levelBackButton").addEventListener("click", function () { showScreen("modeScreen"); });
    $("pauseButton").addEventListener("click", pauseGame);
    $("swapButton").addEventListener("click", function () { game.swap(); });
    el.soundButton.addEventListener("click", function () { setSound(!progress.sound); });
    el.titleSoundButton.addEventListener("click", function () { setSound(!progress.sound); });
    el.titleMotionButton.addEventListener("click", function () { setSparkle(!progress.sparkle); });

    var resizeTimer = null;
    function scheduleResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (game) game.resize(); }, 90);
    }
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleResize);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && game && game.state === "playing") pauseGame();
    });

    // stop iOS double-tap zoom / rubber-band inside the app shell
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
    document.addEventListener("touchmove", function (e) {
      if (e.target && e.target.closest && e.target.closest(".level-grid, .overlay-card")) return;
      e.preventDefault();
    }, { passive: false });

    showScreen("titleScreen");

    // Offline install is a bonus, never a requirement — the game runs fine from
    // a plain file:// double-click, where service workers are unavailable.
    try {
      if (navigator.serviceWorker && location.protocol.indexOf("http") === 0) {
        navigator.serviceWorker.register("./service-worker.js").catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Exposed purely so the headless verification harness can exercise the rules.
  window.PetalKingdom = {
    Game: Game, LEVELS: LEVELS, ARCADE_LEVELS: ARCADE_LEVELS, PUZZLE_LEVELS: PUZZLE_LEVELS,
    MODE_INFO: MODE_INFO, FLOWERS: FLOWERS, CONFIG: CONFIG,
    neighbourCells: neighbourCells, rowLength: rowLength, isShiftedRow: isShiftedRow,
    drawFlower: drawFlower, RAINBOW_ID: RAINBOW_ID,
    ASSET_SLOTS: ASSET_SLOTS, backgroundKeyForLevel: backgroundKeyForLevel,
    backgroundKeyForMode: backgroundKeyForMode, levelsForMode: levelsForMode,
    setArtForTesting: function (key, image) {
      Art.images[key] = image;
      Art.ready[key] = !!image;
    },
    getGame: function () { return game; }
  };
})();
