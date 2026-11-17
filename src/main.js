/* ============================================================
   STELLAR WARS: LAST DEFENSE — application shell & UI router
   ============================================================ */

import {
  SHIPS, SHIP_UPGRADES, SHIP_UPGRADE_MAX, shipUpgradeCost,
  STORE_CATEGORIES, STORE_ITEMS, storeCost,
  SKILL_TREES, SKILLS,
  ACHIEVEMENTS, PAINTS, TRAILS, LEVELS,
  DAILY_REWARD, getLevel, formatNum, todayKey, isoWeek
} from "./config.js";
import { ICONS } from "./core/assets.js";
import { SaveSystem } from "./core/save.js";
import { AudioSystem } from "./core/audio.js";
import { CheatConsole } from "./core/cheats.js";
import {
  previewShipStats, tryBuyShipUpgrade, tryBuyStoreItem, tryBuySkill, requirementState
} from "./core/upgrades.js";
import { HangarScene } from "./scenes/hangar.js";
import { LevelScene } from "./game/level.js";

const MODE_LABEL = {
  campaign: "CAMPAIGN",
  endless: "ENDLESS",
  weekly: "WEEKLY",
  bossrush: "BOSS RUSH",
  daily: "DAILY",
  training: "TRAINING"
};

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function barPct(value, max) {
  return Math.max(2, Math.min(100, (value / max) * 100));
}

class App {
  constructor() {
    this.canvas = document.getElementById("renderCanvas");
    this.ui = document.getElementById("ui");
    this.loadingEl = document.getElementById("loading");
    this.loadingFill = document.getElementById("loading-fill");
    this.loadingText = document.getElementById("loading-text");
    this.toastLayer = document.getElementById("toast-layer");

    this.save = new SaveSystem();
    this.audio = new AudioSystem(this.save.data.settings);

    this.engine = new BABYLON.Engine(
      this.canvas,
      true,
      { preserveDrawingBuffer: false, stencil: true, antialias: true, powerPreference: "high-performance" },
      true
    );

    const quality = this.save.data.settings.quality || "high";
    this.hangar = new HangarScene(this.engine, quality);

    this.level = null;
    this.runConfig = null;
    this.reported = false;
    this.starting = false;
    this.runToken = 0;
    this.currentScreen = "menu";
    this.storeCat = "weapon";
    this._lastResult = null;
    this.dev = { god: false, speed: 1 };

    this.bindGlobal();
    this.renderLoop();

    this.cheats = new CheatConsole(this);
    this.claimDaily();
    this.showMenu();
  }

  /* ------------------------------------------------------------
     boot / loop
     ------------------------------------------------------------ */

  bindGlobal() {
    this._unlock = () => {
      this.audio.unlock();
      document.removeEventListener("pointerdown", this._unlock);
      document.removeEventListener("keydown", this._unlock);
    };
    document.addEventListener("pointerdown", this._unlock);
    document.addEventListener("keydown", this._unlock);

    window.addEventListener("resize", () => {
      this.engine.resize();
      if (this.hangar) this.hangar.resize();
      if (this.level) this.level.resize();
    });

    document.addEventListener("keydown", (e) => {
      if (e.code !== "Escape" || this.level) return;
      if (this.currentScreen !== "menu") {
        e.preventDefault();
        this.showMenu();
      }
    });

    this.ui.addEventListener("click", (ev) => this.onUiClick(ev));
    this.ui.addEventListener("input", (ev) => this.onUiInput(ev));
    this.wireSettings(this.ui);
  }

  renderLoop() {
    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      if (this.level) this.level.render(dt);
      else if (this.hangar) this.hangar.render(dt);
    });
  }

  claimDaily() {
    try {
      const reward = this.save.claimDaily(todayKey(), DAILY_REWARD);
      if (reward > 0) {
        this.toast(`DAILY SUPPLY DROP +${reward} CREDITS`, "gold", ICONS.coin);
      }
    } catch (e) {
      console.warn("Daily reward failed", e);
    }
  }

  /* ------------------------------------------------------------
     run lifecycle
     ------------------------------------------------------------ */

  async startRun(mode, levelNumber) {
    if (this.starting) return;
    if (mode === "endless" && this.save.data.unlockedLevel < 2) {
      this.toast("CLEAR SECTOR 1 TO UNLOCK ENDLESS", "bad");
      return;
    }
    if (mode === "weekly" && this.save.data.unlockedLevel < 5) {
      this.toast("CLEAR SECTOR 4 TO UNLOCK WEEKLY BOSS", "bad");
      return;
    }
    if (mode === "bossrush" && this.save.data.unlockedLevel < 3) {
      this.toast("CLEAR SECTOR 2 TO UNLOCK BOSS RUSH", "bad");
      return;
    }
    if (mode === "daily" && this.save.data.unlockedLevel < 2) {
      this.toast("CLEAR SECTOR 1 TO UNLOCK DAILY CHALLENGE", "bad");
      return;
    }

    this.starting = true;
    this.audio.unlock();
    this.audio.play("click");
    this.endRun();
    const token = ++this.runToken;

    const level = Math.max(1, Math.min(LEVELS.length, levelNumber || 1));
    this.runConfig = { mode, level };
    this.reported = false;
    this._lastResult = null;

    this.ui.classList.add("hidden");
    this.showLoading(
      mode === "campaign" ? `DEPLOYING TO SECTOR ${String(level).padStart(2, "0")}`
        : mode === "bossrush" ? "DEPLOYING TO THE GAUNTLET"
          : mode === "daily" ? "LOADING DAILY SIGNATURE"
            : mode === "training" ? "SPINNING UP SIMULATOR" : "DEPLOYING"
    );
    this.hideResult();

    const scene = new LevelScene(this.engine, this, { mode, level });
    this.level = scene;

    try {
      await scene.init((p) => {
        const pct = Math.max(0, Math.min(1, p || 0));
        this.loadingFill.style.width = `${Math.round(pct * 100)}%`;
        this.loadingText.textContent = `LOADING ${Math.round(pct * 100)}%`;
      });
    } catch (err) {
      console.error("Failed to start mission", err);
      this.hideLoading();
      this.level = null;
      this.runConfig = null;
      try { scene.dispose(); } catch (e) { /* ignore */ }
      this.showMenu();
      this.toast("LAUNCH FAILED — CHECK ASSETS", "bad");
      this.starting = false;
      return;
    }

    if (this.level !== scene || token !== this.runToken) {
      this.starting = false;
      try { scene.dispose(); } catch (e) { /* ignore */ }
      return;
    }

    this.loadingFill.style.width = "100%";
    this.hideLoading();
    scene.start();
    this.audio.startMusic("battle");
    this.starting = false;
  }

  finishRun(result) {
    if (this.reported) return;
    this.reported = true;
    this._lastResult = result;

    const save = this.save;
    const mode = result.mode;
    const won = !!result.win;
    const coins = Math.max(0, Math.floor(result.coins || 0));
    const training = mode === "training" || result.training;

    if (training) {
      this.audio.play("click");
      this.toast("SIMULATION ENDED — NO REWARDS", "dim");
      this.checkAchievements();
      this.showResult(result);
      return;
    }

    save.data.stats.kills = (save.data.stats.kills || 0) + (result.kills || 0);
    save.data.stats.playTime = (save.data.stats.playTime || 0) + (result.duration || 0);
    save.data.stats.coinsEarned = (save.data.stats.coinsEarned || 0) + coins;

    if (mode === "campaign") {
      if (won) save.completeLevel(result.level, result.stars || 0, result.score || 0);
      else save.recordFailedRun();
      if (won) save.data.stats.bosses = (save.data.stats.bosses || 0) + 1;
    } else if (mode === "endless") {
      save.recordFailedRun();
      save.data.bestEndless = Math.max(save.data.bestEndless || 0, result.wave || 0);
    } else if (mode === "weekly") {
      save.recordFailedRun();
      if (won) {
        const prev = save.data.weekly || {};
        save.data.weekly = {
          week: result.weeklyKey,
          won: true,
          best: Math.max(prev.week === result.weeklyKey ? prev.best || 0 : 0, result.score || 0)
        };
        save.data.stats.bosses = (save.data.stats.bosses || 0) + 1;
      }
    } else if (mode === "bossrush") {
      save.recordBossRush(result.bossRushCleared || result.bosses || 0, result.score || 0);
      if (won) this.toast("BOSS RUSH CLEARED", "good");
    } else if (mode === "daily") {
      save.recordDaily(result.dailyKey || todayKey(), result.score || 0, won);
      if (won) save.data.stats.bosses = (save.data.stats.bosses || 0) + 1;
    } else {
      save.recordFailedRun();
    }

    save.save();
    save.addCoins(coins);
    if (won) this.audio.play("victory", 0.8);
    this.checkAchievements();
    this.showResult(result);
  }

  checkAchievements() {
    const save = this.save;
    const d = save.data;
    const stats = d.stats || {};
    const unlockedLevel = d.unlockedLevel || 1;
    const stars = save.totalStars();
    const ships = SHIPS.filter((s) => save.isShipUnlocked(s.id)).length;
    const storeItems = Object.keys(d.store || {}).length;
    const maxedShip = SHIPS.some((s) => {
      const up = d.shipUpgrades?.[s.id] || {};
      return ["hp", "shield", "speed", "damage", "fireRate"].every((k) => (up[k] || 0) >= SHIP_UPGRADE_MAX);
    });
    const flags = {
      first_blood: (stats.kills || 0) >= 1,
      hunter: (stats.kills || 0) >= 100,
      exterminator: (stats.kills || 0) >= 500,
      legend_kills: (stats.kills || 0) >= 2000,
      first_boss: (stats.bosses || 0) >= 1,
      boss_hunter: (stats.bosses || 0) >= 10,
      boss_legend: (stats.bosses || 0) >= 30,
      sector_1: unlockedLevel > 1,
      sector_10: unlockedLevel > 10,
      sector_20: unlockedLevel > 20,
      sector_30: (d.levels && d.levels[30] && d.levels[30].stars > 0) || unlockedLevel > 30,
      stars_30: stars >= 30,
      stars_90: stars >= 90,
      endless_5: (d.bestEndless || 0) >= 5,
      endless_15: (d.bestEndless || 0) >= 15,
      weekly_clear: !!(d.weekly && d.weekly.won),
      bossrush_3: (d.bestBossRush || 0) >= 3,
      bossrush_5: (d.bestBossRush || 0) >= 5,
      daily_1: !!(d.daily && (d.daily.wins || 0) > 0),
      collector: ships >= 5,
      fully_upgraded: maxedShip,
      fleet_commander: (d.store?.droneBay || 0) >= 2 || (d.skills || []).includes("fleet1"),
      skill_master: SKILLS.every((s) => save.hasSkill(s.id)),
      rich: (stats.coinsEarned || 0) >= 10000,
      painted: Object.keys(d.cosmetics?.paint || {}).length > 0
    };
    let gained = 0;
    for (const ach of ACHIEVEMENTS) {
      if (flags[ach.id] && !save.hasAchievement(ach.id)) {
        save.unlockAchievement(ach.id);
        this.toast(`AWARD UNLOCKED · ${ach.name}`, "gold", ICONS[ach.icon] || ICONS.star);
        gained++;
      }
    }
    return gained;
  }

  restartRun() {
    const cfg = this.runConfig;
    if (!cfg) {
      this.showMenu();
      return;
    }
    this.endRun();
    this.startRun(cfg.mode, cfg.level);
  }

  quitRun() {
    this.showMenu();
  }

  endRun() {
    this.runToken = (this.runToken || 0) + 1;
    this.hideResult();
    if (this.level) {
      try { this.level.dispose(); } catch (e) { console.warn("Level dispose failed", e); }
      this.level = null;
    }
    this.runConfig = null;
    this.reported = false;
    this.hideLoading();
    this.audio.stopMusic();
  }

  /* ------------------------------------------------------------
     screens
     ------------------------------------------------------------ */

  renderScreen(html) {
    this.ui.innerHTML = html;
    this.ui.classList.remove("hidden");
  }

  topbar(withBack) {
    const achCount = this.save.unseenAchievements();
    return `
      <div class="topbar">
        <div class="brand">STELLAR WARS<small>LAST DEFENSE</small></div>
        <div class="topbar-right">
          <div class="pill gold"><img src="${ICONS.coin}" alt="" /><span data-coins>${this.save.coins.toLocaleString("en-US")}</span></div>
          <button class="icon-btn" data-act="galaxy" title="Galaxy Map">✺</button>
          <button class="icon-btn" data-act="achievements" title="Awards">★${achCount ? `<i class="icon-badge">${achCount}</i>` : ""}</button>
          <button class="icon-btn" data-act="settings" title="Settings">⚙</button>
          ${withBack ? `<button class="icon-btn" data-act="menu" title="Back">←</button>` : ""}
        </div>
      </div>`;
  }

  refreshCoins() {
    this.ui.querySelectorAll("[data-coins]").forEach((el) => {
      el.textContent = this.save.coins.toLocaleString("en-US");
    });
  }

  prepHangar(ship) {
    if (!this.hangar) return null;
    this.hangar.setPaint(this.save.paintFor(ship.id));
    return this.hangar.setShip(ship.model, ship.texture);
  }

  showMenu() {
    this.endRun();
    this.currentScreen = "menu";
    const ship = this.save.getShip();
    let shipLoad = null;
    if (this.hangar) {
      this.hangar.setMode("menu");
      shipLoad = this.prepHangar(ship);
    }
    this.audio.startMusic("menu");

    const unlocked = this.save.data.unlockedLevel || 1;
    const stars = this.save.totalStars();
    const weeklyDone = this.save.data.weekly?.week === this.weekKey() && this.save.data.weekly?.won;

    this.renderScreen(`
      <div class="screen menu-screen">
        ${this.topbar(false)}
        <div class="menu-hero">
          <div class="logo-wrap">
            <div class="logo-kicker">SECTOR DEFENSE PROTOCOL</div>
            <h1 class="logo">STELLAR WARS</h1>
            <div class="logo-sub">LAST DEFENSE</div>
          </div>
        </div>
        <div class="menu-actions">
          <button class="btn primary" data-act="play"><span class="ico">▶</span> CONTINUE — SECTOR ${String(unlocked).padStart(2, "0")}</button>
          <div class="menu-row">
            <button class="btn" data-act="levels"><span class="ico">◈</span> LEVELS</button>
            <button class="btn" data-act="garage"><span class="ico">⬢</span> GARAGE</button>
          </div>
          <div class="menu-row">
            <button class="btn" data-act="bossrush"><span class="ico">☠</span> BOSS RUSH</button>
            <button class="btn" data-act="daily"><span class="ico">✦</span> DAILY</button>
          </div>
          <div class="menu-row">
            <button class="btn" data-act="endless"><span class="ico">∞</span> ENDLESS</button>
            <button class="btn" data-act="weekly"><span class="ico">◆</span> WEEKLY</button>
          </div>
          <div class="menu-grid">
            <button class="btn ghost" data-act="store"><span class="ico">▣</span> STORE</button>
            <button class="btn ghost" data-act="skills"><span class="ico">✧</span> SKILLS</button>
            <button class="btn ghost" data-act="galaxy"><span class="ico">✺</span> GALAXY</button>
            <button class="btn ghost" data-act="achievements"><span class="ico">★</span> AWARDS</button>
          </div>
        </div>
        <div class="menu-footer">
          <div class="hint">
            <span><kbd>WASD</kbd> MOVE</span>
            <span><kbd>Q</kbd> MISSILES</span>
            <span><kbd>E</kbd> ULTIMATE</span>
            <span><kbd>ESC</kbd> PAUSE</span>
          </div>
          <div>★ ${stars} / 90 · ${weeklyDone ? "WEEKLY CLEARED" : this.weekKey()}</div>
        </div>
        <div class="menu-badge">STELLAR WARS // ${esc(ship.name)} CLASS</div>
      </div>`);

    // First boot: keep the overlay up until the menu has painted and the hero
    // hull is in the bay, with a fallback so a slow asset never blocks play.
    if (this.loadingEl && !this.loadingEl.classList.contains("hidden")) {
      const done = () => {
        clearTimeout(this._bootHideTimer);
        this._bootHideTimer = null;
        this.hideLoading();
      };
      this._bootHideTimer = setTimeout(done, 4500);
      if (shipLoad && typeof shipLoad.then === "function") {
        shipLoad.then(done, done);
      } else {
        done();
      }
    }
  }

  weekKey() {
    return isoWeek();
  }

  showLevels() {
    this.audio.play("click");
    this.currentScreen = "levels";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("menu");
      this.prepHangar(ship);
    }
    const unlocked = this.save.data.unlockedLevel || 1;

    const cards = Array.from({ length: LEVELS.length }, (_, i) => {
      const n = i + 1;
      const lvl = getLevel(n);
      const rec = this.save.levelRecord(n);
      const locked = n > unlocked;
      const stars = rec.stars || 0;
      const diff = Math.max(1, Math.round(n / 6));
      const tone = lvl.boss.tone || "#4fd8ff";
      return `
        <div class="level-card ${locked ? "locked" : ""}" data-level="${n}"
             style="--tone:${tone};--tone-soft:${tone}33" data-boss="${esc(lvl.boss.name)}">
          ${n % 5 === 0 ? `<div class="milestone-badge">BOSS</div>` : ""}
          <div class="lv-top">
            <div class="level-num">SECTOR<b>${String(n).padStart(2, "0")}</b></div>
            <div class="level-stars">${[0, 1, 2].map((s) => `<span class="${s < stars ? "on" : ""}">★</span>`).join("")}</div>
          </div>
          <div class="lv-body">
            <div class="sector">${esc(lvl.name)}</div>
            <div class="boss">${esc(lvl.boss.name)}</div>
          </div>
          <div class="diff">${[0, 1, 2, 3, 4].map((d) => `<i class="${d < diff ? "on" : ""}"></i>`).join("")}</div>
          ${locked ? `<div class="lock">▣</div>` : ""}
        </div>`;
    }).join("");

    const endlessLocked = unlocked < 2;
    const weeklyLocked = unlocked < 5;
    const bossRushLocked = unlocked < 3;
    const dailyLocked = unlocked < 2;
    const weeklyDone = this.save.data.weekly?.week === this.weekKey() && this.save.data.weekly?.won;
    const dailyDone = (this.save.data.daily?.wins || 0) > 0 && this.save.data.daily?.day === todayKey();

    this.renderScreen(`
      <div class="screen levels-screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>SECTOR</span> SELECT</h2>
            <div class="sub">${LEVELS.length} SECTORS · ${this.save.completedCount()} CLEARED · ★ ${this.save.totalStars()}</div>
          </div>
          <div class="page-actions">
            <div class="pill dim">BEST ENDLESS · WAVE ${this.save.data.bestEndless || 0}</div>
            <div class="pill dim">BOSS RUSH · ${this.save.data.bestBossRush || 0}/5</div>
          </div>
        </div>
        <div class="level-scroll scroll-y">
          <div class="level-grid">${cards}</div>
          <div class="extra-modes">
            <div class="mode-card ${endlessLocked ? "locked" : ""}" data-act="endless">
              <div class="badge">${endlessLocked ? "CLEAR SECTOR 1 TO UNLOCK" : `BEST WAVE ${this.save.data.bestEndless || 0}`}</div>
              <h4>∞ ENDLESS SURVIVAL</h4>
              <p>Waves scale forever. Boss every fifth wave. Keep the line.</p>
              <div class="mode-icon">∞</div>
            </div>
            <div class="mode-card ${weeklyLocked ? "locked" : ""}" data-act="weekly">
              <div class="badge">${weeklyLocked ? "CLEAR SECTOR 4 TO UNLOCK" : weeklyDone ? "CLEARED THIS WEEK" : "NEW SIGNATURE TARGET"}</div>
              <h4>☠ WEEKLY BOSS</h4>
              <p>A rotating elite target with premium rewards. One attempt per run.</p>
              <div class="mode-icon">☠</div>
            </div>
            <div class="mode-card ${bossRushLocked ? "locked" : ""}" data-act="bossrush">
              <div class="badge">${bossRushLocked ? "CLEAR SECTOR 2 TO UNLOCK" : `BEST ${this.save.data.bestBossRush || 0} / 5`}</div>
              <h4>⚔ BOSS RUSH</h4>
              <p>Five bosses back to back. No waves, no breathing room, scaling rewards.</p>
              <div class="mode-icon">⚔</div>
            </div>
            <div class="mode-card ${dailyLocked ? "locked" : ""}" data-act="daily">
              <div class="badge">${dailyLocked ? "CLEAR SECTOR 1 TO UNLOCK" : dailyDone ? "TODAY'S RUN SCORED" : "NEW DAILY SIGNATURE"}</div>
              <h4>✦ DAILY CHALLENGE</h4>
              <p>A deterministic mission chosen by today's date. Same run for every pilot.</p>
              <div class="mode-icon">✦</div>
            </div>
            <div class="mode-card training" data-act="training">
              <div class="badge">ALWAYS AVAILABLE</div>
              <h4>◎ TRAINING SIMULATOR</h4>
              <p>Invulnerable target practice. Endless waves, no rewards, no pressure.</p>
              <div class="mode-icon">◎</div>
            </div>
          </div>
        </div>
      </div>`);
  }

  showGarage() {
    this.audio.play("click");
    this.currentScreen = "garage";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("garage");
      this.prepHangar(ship);
    }
    this.renderGarage();
  }

  renderGarage() {
    const ship = this.save.getShip();
    const unlocked = this.save.isShipUnlocked(ship.id);
    const stats = previewShipStats(this.save, ship);
    const up = stats.upgrade || {};
    const members = [
      { key: "hp", label: "HULL", value: Math.round(stats.hp), ref: 320, suffix: "HP" },
      { key: "shield", label: "SHIELD", value: Math.round(stats.shield), ref: 150, suffix: "SP" },
      { key: "speed", label: "ENGINES", value: stats.speed.toFixed(1), ref: 24, suffix: "SPD" },
      { key: "damage", label: "DAMAGE", value: stats.damage.toFixed(1), ref: 34, suffix: "DMG" },
      { key: "fireRate", label: "FIRE RATE", value: stats.fireRate.toFixed(1), ref: 10, suffix: "/S" }
    ];

    const statRows = members.map((m) => {
      const lvl = up[m.key] || 0;
      const maxed = lvl >= SHIP_UPGRADE_MAX;
      const cost = shipUpgradeCost(ship, m.key, lvl);
      const val = typeof m.value === "number" ? m.value : Number(m.value);
      return `
        <div class="stat-row">
          <div class="stat-label"><span>${m.label}</span><b>${m.value} <i>LV ${lvl}</i></b></div>
          <div class="stat-bar"><span style="width:${barPct(val, m.ref)}%"></span></div>
          <button class="btn stat-up" data-upgrade="${m.key}" ${maxed || !unlocked ? "disabled" : ""}>
            <span>${maxed ? "MAXED" : "UPGRADE"}</span>
            ${maxed ? "" : `<span class="cost"><img src="${ICONS.coin}" alt="" />${formatNum(cost)}</span>`}
          </button>
        </div>`;
    }).join("");

    const chips = SHIPS.map((s) => {
      const open = this.save.isShipUnlocked(s.id);
      return `
        <button class="ship-chip ${s.id === ship.id ? "active" : ""} ${open ? "" : "locked"}"
                data-ship="${s.id}" style="--chip:${s.color}" title="${open ? esc(s.name) : `Unlocks after clearing sector ${s.unlockLevel}`}">
          <span class="dot">${open ? "◆" : "▣"}</span>
          <span>${esc(s.name)}</span>
        </button>`;
    }).join("");

    const ability = ship.ability;
    const paint = this.save.paintFor(ship.id);
    const trailId = this.save.trailColor();
    const paintSwatches = PAINTS.map((p) => `
      <button class="swatch ${p.color ? "" : "factory"} ${(p.color || "") === paint ? "active" : ""}"
              data-paint="${esc(p.color)}" title="${esc(p.name)}"
              style="${p.color ? `--sw:${p.color}` : ""}">${p.color ? "" : "◌"}</button>`).join("");
    const trailSwatches = TRAILS.map((t) => `
      <button class="swatch trail ${t.id === trailId ? "active" : ""}" data-trail="${t.id}"
              title="${esc(t.name)}" style="--sw:${t.color}"></button>`).join("");
    const cosmetics = `
      <div class="cos-block">
        <div class="cos-head"><span>HULL PAINT</span><i>${esc((PAINTS.find((p) => p.color === paint) || PAINTS[0]).name)}</i></div>
        <div class="swatch-row">${paintSwatches}</div>
        <div class="cos-head"><span>ENGINE TRAIL</span><i>${esc((TRAILS.find((t) => t.id === trailId) || TRAILS[0]).name)}</i></div>
        <div class="swatch-row">${trailSwatches}</div>
      </div>`;
    const unlockNote = unlocked ? `
      <div class="garage-footer">
        <button class="btn primary wide" data-act="selectShip">${ship.id === this.save.data.ship ? "EQUIPPED" : "EQUIP SHIP"}</button>
        <button class="btn" data-act="menu">BACK</button>
      </div>` : `
      <div class="garage-unlock">
        LOCKED · CLEAR SECTOR ${ship.unlockLevel} TO UNLOCK<br />
        CURRENT PROGRESS: SECTOR ${this.save.data.unlockedLevel}
      </div>`;

    this.renderScreen(`
      <div class="screen garage-screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>GARAGE</span> BAY</h2>
            <div class="sub">${esc(ship.class)} · ${unlocked ? "READY FOR DEPLOYMENT" : "HULL LOCKED"}</div>
          </div>
          <div class="page-actions">
            <button class="btn small" data-act="skills">SKILL TREE</button>
            <button class="btn small" data-act="store">STORE</button>
          </div>
        </div>
        <div class="garage-layout">
          <div class="garage-stage">
            <div class="ship-name-plate">
              <div class="cat">${esc(ship.class)}</div>
              <h3>${esc(ship.name)}</h3>
              <div class="ability-line">ULTIMATE <b>${esc(ability.name)}</b></div>
            </div>
            <div class="ship-rail">${chips}</div>
          </div>
          <div class="garage-panel glass">
            <div class="garage-panel-head">
              <div>
                <h3>SHIP SYSTEMS</h3>
                <span class="tier">${unlocked ? "ALL SYSTEMS NOMINAL" : "ACCESS DENIED"}</span>
              </div>
              <div class="pill dim">${this.save.data.shipUpgrades[ship.id] ? Object.values(this.save.data.shipUpgrades[ship.id]).reduce((a, b) => a + b, 0) : 0} / 50</div>
            </div>
            <div class="stat-list scroll-y">${statRows}</div>
            <div class="ability-card">
              <div class="a-head"><span>${ability.icon} ${esc(ability.name)}</span><span class="key">E</span></div>
              <p>${esc(ability.desc)}</p>
            </div>
            ${cosmetics}
            ${unlockNote}
          </div>
        </div>
        <div class="credit-note">Ship artwork &amp; models: Quaternius (CC0). Ship upgrades persist across all missions.</div>
      </div>`);
  }

  showStore() {
    this.audio.play("click");
    this.currentScreen = "store";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("garage");
      this.prepHangar(ship);
    }
    this.renderStore();
  }

  renderStore() {
    const cat = STORE_CATEGORIES.find((c) => c.id === this.storeCat) || STORE_CATEGORIES[0];
    const tabs = STORE_CATEGORIES.map((c) => `
      <button class="tab ${c.id === cat.id ? "active" : ""}" data-tab="${c.id}">
        <img src="${ICONS[c.icon] || ICONS.star}" alt="" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" />${c.name}
      </button>`).join("");

    const cards = STORE_ITEMS.filter((i) => i.cat === cat.id).map((item) => {
      const lvl = this.save.storeLevel(item.id);
      const maxed = lvl >= item.max;
      const req = requirementState(this.save, item);
      const cost = maxed ? 0 : storeCost(item, lvl);
      const buyable = !maxed && req.ok;
      const pips = Array.from({ length: item.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("");
      const status = maxed ? "MAXED" : !req.ok ? req.text : item.tag;
      return `
        <div class="store-card ${lvl > 0 ? "owned" : ""} ${maxed ? "maxed" : ""} ${req.ok ? "" : "locked"}">
          <div class="store-card-head">
            <div class="store-icon"><img src="${ICONS[item.icon] || ICONS.star}" alt="" /></div>
            <div>
              <h4>${esc(item.name)}</h4>
              <p class="desc">${esc(item.desc)}</p>
              <div class="pips">${pips}</div>
            </div>
          </div>
          <div class="store-card-foot">
            <span class="store-tag ${maxed ? "good" : req.ok ? "" : "warn"}">${esc(status)}</span>
            <button class="btn small" data-buy="${item.id}" ${buyable ? "" : "disabled"}>
              ${maxed ? "MAXED" : req.ok ? `<img src="${ICONS.coin}" alt="" style="width:13px;height:13px" />${formatNum(cost)}` : "LOCKED"}
            </button>
          </div>
        </div>`;
    }).join("");

    this.renderScreen(`
      <div class="screen store-screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>FLEET</span> STORE</h2>
            <div class="sub">Permanent upgrades · ${this.save.coins.toLocaleString("en-US")} CREDITS AVAILABLE</div>
          </div>
          <div class="page-actions">
            <button class="btn small" data-act="garage">GARAGE</button>
          </div>
        </div>
        <div class="store-page">
          <div class="tabbar">${tabs}</div>
          <div class="store-scroll scroll-y"><div class="store-grid">${cards || "<div class='kicker'>NO ITEMS IN THIS CATEGORY</div>"}</div></div>
        </div>
        <div class="credit-note">Store upgrades apply to every ship. Premium powers carry one or two charges per mission.</div>
      </div>`);
  }

  showSkills() {
    this.audio.play("click");
    this.currentScreen = "skills";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("menu");
      this.prepHangar(ship);
    }
    const points = this.save.data.skillPoints || 0;

    const trees = SKILL_TREES.map((tree) => {
      const skills = SKILLS.filter((s) => s.tree === tree.id).sort((a, b) => a.tier - b.tier);
      const nodes = skills.map((skill, idx) => {
        const owned = this.save.hasSkill(skill.id);
        const prev = idx > 0 ? skills[idx - 1] : null;
        const tierOk = !prev || this.save.hasSkill(prev.id);
        const canBuy = !owned && tierOk && points >= skill.cost;
        return `
          <button class="skill-node ${owned ? "owned" : ""} ${!owned && !canBuy ? "disabled" : ""}" data-skill="${skill.id}">
            <b><span class="tier-dot"></span>${esc(skill.name)}</b>
            <span>${esc(skill.desc)}</span>
            <span style="color:${owned ? "var(--green)" : "var(--gold)"};margin-top:4px">${owned ? "OWNED" : tierOk ? `${skill.cost} PT` : "TIER LOCKED"}</span>
          </button>`;
      }).join("");
      return `
        <div class="skill-tree" style="--tree-color:${tree.color}">
          <h5>${esc(tree.name)}</h5>
          ${nodes}
        </div>`;
    }).join("");

    this.renderScreen(`
      <div class="screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>SKILL</span> TREE</h2>
            <div class="sub">PASSIVE BONUSES · EARN 1 POINT PER SECTOR CLEAR</div>
          </div>
          <div class="page-actions"><button class="btn small" data-act="garage">GARAGE</button></div>
        </div>
        <div class="skill-points">
          <span>AVAILABLE SKILL POINTS</span><b>${points}</b>
        </div>
        <div class="scroll-y" style="flex:1;min-height:0;padding-bottom:16px">
          <div class="skill-grid">${trees}</div>
        </div>
      </div>`);
  }

  showGalaxy() {
    this.audio.play("click");
    this.currentScreen = "galaxy";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("menu");
      this.prepHangar(ship);
    }
    const unlocked = this.save.data.unlockedLevel || 1;
    const stars = this.save.totalStars();
    const scans = this.save.data.galaxy?.scans || 0;
    if (this.save.data.galaxy) this.save.data.galaxy.scans = Math.max(scans, this.save.completedCount());
    this.save.save();

    const galaxyRows = Math.ceil(LEVELS.length / 10);
    const rowGap = 66 / Math.max(1, galaxyRows - 1);
    const points = Array.from({ length: LEVELS.length }, (_, i) => {
      const row = Math.floor(i / 10);
      const col = i % 10;
      const c = row % 2 === 0 ? col : 9 - col;
      return { x: 7 + c * 9.6, y: 17 + row * rowGap + Math.sin(i * 1.5) * 4 };
    });
    let path = "";
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      path += (i === 0 ? "M" : "L") + p.x.toFixed(2) + " " + p.y.toFixed(2) + " ";
    }
    const lines = `<svg class="galaxy-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" />
    </svg>`;

    const nodes = Array.from({ length: LEVELS.length }, (_, i) => {
      const n = i + 1;
      const rec = this.save.levelRecord(n);
      const locked = n > unlocked;
      const cleared = (rec.stars || 0) > 0;
      const current = n === unlocked && !cleared;
      const p = points[i];
      const tone = getLevel(n).boss.tone || "#4fe3ff";
      return `
        <button class="galaxy-node ${locked ? "locked" : ""} ${cleared ? "cleared" : ""} ${current ? "current" : ""}"
                data-level="${n}" style="left:${p.x}%;top:${p.y}%;--tone:${tone}"
                title="SECTOR ${String(n).padStart(2, "0")} · ${esc(getLevel(n).name)}">
          <span class="gn-num">${String(n).padStart(2, "0")}</span>
          <span class="gn-stars">${[0, 1, 2].map((s) => `<i class="${s < (rec.stars || 0) ? "on" : ""}">★</i>`).join("")}</span>
        </button>`;
    }).join("");

    this.renderScreen(`
      <div class="screen galaxy-screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>GALAXY</span> MAP</h2>
            <div class="sub">STAR ROUTE · ${this.save.completedCount()} / ${LEVELS.length} SECTORS SURVEYED · ★ ${stars}</div>
          </div>
          <div class="page-actions">
            <button class="btn small" data-act="levels">SECTOR LIST</button>
            <button class="btn small" data-act="achievements">AWARDS</button>
          </div>
        </div>
        <div class="galaxy-layout">
          <div class="galaxy-map glass">
            ${lines}
            <div class="galaxy-core"></div>
            ${nodes}
            <div class="galaxy-legend">
              <span><i class="lg cleared"></i> SECURED</span>
              <span><i class="lg current"></i> FRONTIER</span>
              <span><i class="lg locked"></i> UNCHARTED</span>
            </div>
          </div>
          <div class="galaxy-panel glass">
            <h3>FLEET RECORD</h3>
            <div class="galaxy-stats">
              <div><span>SECTORS CLEARED</span><b>${this.save.completedCount()} / ${LEVELS.length}</b></div>
              <div><span>STARS EARNED</span><b>${stars} / ${LEVELS.length * 3}</b></div>
              <div><span>HOSTILES DESTROYED</span><b>${(this.save.data.stats.kills || 0).toLocaleString("en-US")}</b></div>
              <div><span>BOSSES DEFEATED</span><b>${(this.save.data.stats.bosses || 0).toLocaleString("en-US")}</b></div>
              <div><span>BEST ENDLESS</span><b>WAVE ${this.save.data.bestEndless || 0}</b></div>
              <div><span>BOSS RUSH</span><b>${this.save.data.bestBossRush || 0} / 5</b></div>
              <div><span>DAILY BEST</span><b>${formatNum(this.save.data.daily?.best || 0)}</b></div>
              <div><span>FLIGHT TIME</span><b>${Math.floor((this.save.data.stats.playTime || 0) / 60)} MIN</b></div>
            </div>
            <div class="galaxy-actions">
              <button class="btn primary" data-act="play">DEPLOY TO FRONTIER</button>
              <button class="btn" data-act="menu">BACK TO FLEET</button>
            </div>
          </div>
        </div>
      </div>`);
  }

  showAchievements() {
    this.audio.play("click");
    this.currentScreen = "achievements";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("menu");
      this.prepHangar(ship);
    }
    this.checkAchievements();
    // Opening the awards screen clears the "new awards" ribbon badge.
    this.save.markAchievementsSeen();
    const got = ACHIEVEMENTS.filter((a) => this.save.hasAchievement(a.id)).length;
    const cards = ACHIEVEMENTS.map((a) => {
      const owned = this.save.hasAchievement(a.id);
      return `
        <div class="ach-card ${owned ? "owned" : ""} tier-${a.tier}">
          <div class="ach-icon"><img src="${ICONS[a.icon] || ICONS.star}" alt="" /></div>
          <div class="ach-copy">
            <h4>${esc(a.name)}</h4>
            <p>${esc(a.desc)}</p>
            <span class="ach-tier">${a.tier.toUpperCase()} ${owned ? "· UNLOCKED" : ""}</span>
          </div>
        </div>`;
    }).join("");

    const pct = Math.round((got / ACHIEVEMENTS.length) * 100);
    this.renderScreen(`
      <div class="screen achievements-screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>PILOT</span> AWARDS</h2>
            <div class="sub">${got} / ${ACHIEVEMENTS.length} UNLOCKED · ${pct}% COMPLETE</div>
          </div>
          <div class="page-actions">
            <div class="pill dim">★ ${this.save.totalStars()} STARS</div>
            <button class="btn small" data-act="galaxy">GALAXY</button>
          </div>
        </div>
        <div class="ach-progress"><span style="width:${Math.max(2, pct)}%"></span></div>
        <div class="ach-scroll scroll-y"><div class="ach-grid">${cards}</div></div>
      </div>`);
  }

  showSettings() {
    this.currentScreen = "settings";
    const ship = this.save.getShip();
    if (this.hangar) {
      this.hangar.setMode("menu");
      this.prepHangar(ship);
    }
    this.renderScreen(`
      <div class="screen">
        ${this.topbar(true)}
        <div class="page-head">
          <div>
            <h2 class="section-title"><span>SYSTEM</span> SETTINGS</h2>
            <div class="sub">AUDIO · CONTROLS · DISPLAY</div>
          </div>
        </div>
        <div class="settings-page">
          <div class="settings-panel glass">
            ${this.settingsRows(false)}
            <div class="credit-note" style="margin-top:6px">
              3D models, textures and item icons by Quaternius (CC0). Babylon.js rendering.
              Save data is stored locally in your browser.
            </div>
          </div>
        </div>
      </div>`);
  }

  settingsRows(inModal) {
    const s = this.save.data.settings || {};
    return `
      <div class="setting-row">
        <div class="setting-copy"><strong>Music Volume</strong><span>Procedural battle soundtrack</span></div>
        <input class="slider" type="range" min="0" max="100" value="${Math.round((s.music ?? 0.45) * 100)}" data-setting="music" />
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Sound Effects</strong><span>Weapons, impacts, UI</span></div>
        <input class="slider" type="range" min="0" max="100" value="${Math.round((s.sfx ?? 0.7) * 100)}" data-setting="sfx" />
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Auto Fire</strong><span>Cannons fire without holding a key</span></div>
        <button class="toggle ${s.autoFire !== false ? "on" : ""}" data-toggle-setting="autoFire"></button>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Vibration</strong><span>Haptic feedback on supported devices</span></div>
        <button class="toggle ${s.vibration !== false ? "on" : ""}" data-toggle-setting="vibration"></button>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Render Quality</strong><span>Glow resolution and hardware scaling</span></div>
        <div class="seg">
          <button data-quality="low" class="${s.quality === "low" ? "active" : ""}">LOW</button>
          <button data-quality="high" class="${s.quality !== "low" ? "active" : ""}">HIGH</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Save Backup</strong><span>Export/import a portable save code (works offline)</span></div>
        <div class="save-actions">
          <button class="btn small" data-save-export>EXPORT</button>
          <button class="btn small" data-save-import>IMPORT</button>
        </div>
      </div>
      <textarea class="save-code" data-save-code spellcheck="false" placeholder="SW1:… paste a backup code here, then press IMPORT"></textarea>
      ${inModal ? "" : `
      <div class="setting-row">
        <div class="setting-copy"><strong>Pilot Record</strong><span>${this.save.completedCount()} sectors cleared · ${this.save.totalStars()} stars · ${this.save.data.stats.kills || 0} kills</span></div>
        <button class="btn small danger" data-reset>RESET</button>
      </div>`}`;
  }

  openSettingsOverlay() {
    const layer = this.openModal("SETTINGS", this.settingsRows(true), "");
    this.wireSettings(layer);
  }

  /* ------------------------------------------------------------
     result screen
     ------------------------------------------------------------ */

  showResult(result) {
    this.hideResult();
    const mode = result.mode;
    const won = !!result.win;
    const isCampaign = mode === "campaign";
    const stars = result.stars || 0;
    const header = won
      ? (isCampaign ? "SECTOR SECURED"
        : mode === "weekly" ? "BOSS DEFEATED"
          : mode === "bossrush" ? "GAUNTLET CLEARED"
            : mode === "daily" ? "DAILY CLEARED"
              : "RUN COMPLETE")
      : mode === "training" ? "SIMULATION ENDED" : "MISSION FAILED";
    const sub = isCampaign
      ? `${getLevel(result.level).name.toUpperCase()} · SECTOR ${String(result.level).padStart(2, "0")}`
      : mode === "weekly" ? "WEEKLY SIGNATURE TARGET"
        : mode === "bossrush" ? `${result.bossRushCleared || 0} / ${result.bossRushTotal || 5} BOSSES DESTROYED`
          : mode === "daily" ? `DAILY · SECTOR ${String(result.level).padStart(2, "0")} · ${getLevel(result.level).name.toUpperCase()}`
            : mode === "training" ? `TRAINING SIMULATOR · WAVE ${result.wave}`
              : `ENDLESS SURVIVAL · WAVE ${result.wave}`;

    const actionList = [];
    if (won && isCampaign && result.level < LEVELS.length) {
      actionList.push({ id: "next", label: "NEXT SECTOR", primary: true });
    } else if (won && isCampaign) {
      actionList.push({ id: "levels", label: "LEVEL SELECT", primary: true });
    } else {
      actionList.push({ id: "retry", label: won ? "PLAY AGAIN" : "RETRY MISSION", primary: true });
    }
    actionList.push({ id: "home", label: "HOME" });
    actionList.push({ id: "garage", label: "GARAGE" });
    if (isCampaign) actionList.push({ id: "levels", label: "LEVELS" });

    const actions = actionList.map((a) => `
      <button class="btn ${a.primary ? "primary" : ""}" data-result="${a.id}">${a.label}</button>`).join("");

    const layer = document.createElement("div");
    layer.className = "result-layer";
    layer.id = "result-layer";
    layer.innerHTML = `
      <div class="result-card glass">
        <div class="result-kicker">${MODE_LABEL[mode] || "MISSION"} ${won ? "COMPLETE" : mode === "training" ? "ENDED" : "FAILED"}</div>
        <h2 class="${won ? "win" : "lose"}">${header}</h2>
        <div class="result-sub">${esc(sub)}</div>
        <div class="result-stars ${mode !== "campaign" && mode !== "daily" ? "muted" : ""}">${[0, 1, 2].map((i) => `<span class="star ${i < stars ? "lit" : ""}">★</span>`).join("")}</div>
        <div class="result-stats">
          <div class="result-stat"><span>SCORE</span><b>${formatNum(result.score)}</b></div>
          <div class="result-stat"><span>KILLS</span><b>${result.kills}</b></div>
          <div class="result-stat"><span>${mode === "bossrush" ? "BOSSES" : "WAVE"}</span><b>${mode === "bossrush" ? (result.bossRushCleared || 0) : result.wave}</b></div>
          <div class="result-stat"><span>BEST COMBO</span><b>×${(result.bestCombo || 1).toFixed(1)}</b></div>
        </div>
        ${result.training || mode === "training" ? `
        <div class="result-rewards training">
          <div class="result-reward-row"><span>SIMULATOR RUN COMPLETE</span><b>NO REWARDS</b></div>
        </div>` : `
        <div class="result-rewards">
          <div class="result-reward-row"><span>CREDITS COLLECTED</span><b><img src="${ICONS.coin}" alt="" />${formatNum(result.collected || 0)}</b></div>
          <div class="result-reward-row"><span>MISSION BONUS</span><b><img src="${ICONS.coin}" alt="" />${formatNum(result.bonus || 0)}</b></div>
          <div class="result-reward-row"><span>TOTAL CREDITS</span><b><img src="${ICONS.coin}" alt="" />${formatNum(result.coins || 0)}</b></div>
        </div>`}
        <div class="result-actions">${actions}</div>
        <div class="result-note">
          ${won && isCampaign ? "3 STARS NEED 75% HULL REMAINING AND NO EMERGENCY CORES USED. +1 SKILL POINT EARNED." : ""}
          ${mode === "daily" ? "ONE DAILY SIGNATURE RUN IS SCORED EACH DAY." : ""}
          ${mode === "bossrush" ? "BOSS RUSH REWARDS SCALE WITH BOSSES DEFEATED." : ""}
        </div>
      </div>`;

    layer.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-result]");
      if (!btn) return;
      this.audio.play("click");
      const action = btn.dataset.result;
      if (action === "next") {
        this.endRun();
        this.startRun("campaign", Math.min(LEVELS.length, result.level + 1));
      } else if (action === "retry") {
        this.endRun();
        this.startRun(mode, result.level);
      } else if (action === "home") {
        this.showMenu();
      } else if (action === "levels") {
        this.endRun();
        this.showLevels();
      } else if (action === "garage") {
        this.endRun();
        this.showGarage();
      }
    });
    document.body.appendChild(layer);
    this._lastResult = result;
  }

  hideResult() {
    document.querySelectorAll("#result-layer, .result-layer").forEach((el) => el.remove());
  }

  /* ------------------------------------------------------------
     generic UI events
     ------------------------------------------------------------ */

  onUiClick(ev) {
    const buy = ev.target.closest("[data-buy]");
    if (buy) {
      const item = STORE_ITEMS.find((i) => i.id === buy.dataset.buy);
      if (!item) return;
      const res = tryBuyStoreItem(this.save, item);
      if (res.ok) {
        this.audio.play("purchase");
        this.toast(`${item.name.toUpperCase()} UPGRADED`, "good");
        this.renderStore();
      } else {
        this.audio.play("error");
        this.toast(res.text || (res.reason === "coins" ? "NOT ENOUGH CREDITS" : "UNAVAILABLE"), "bad");
      }
      return;
    }

    const up = ev.target.closest("[data-upgrade]");
    if (up) {
      const ship = this.save.getShip();
      const res = tryBuyShipUpgrade(this.save, ship, up.dataset.upgrade);
      if (res.ok) {
        this.audio.play("purchase");
        this.toast(`${ship.name.toUpperCase()} SYSTEM UPGRADED`, "good");
        this.renderGarage();
      } else {
        this.audio.play("error");
        this.toast(res.text || (res.reason === "coins" ? "NOT ENOUGH CREDITS" : "MAX LEVEL"), "bad");
      }
      return;
    }

    const paintBtn = ev.target.closest("[data-paint]");
    if (paintBtn) {
      const ship = this.save.getShip();
      const color = paintBtn.dataset.paint || "";
      this.save.setPaint(ship.id, color);
      if (this.hangar) this.hangar.setPaint(color);
      this.audio.play("click");
      this.toast(color ? `${ship.name.toUpperCase()} REPAINTED` : "FACTORY PAINT RESTORED", "good");
      this.checkAchievements();
      this.renderGarage();
      return;
    }

    const trailBtn = ev.target.closest("[data-trail]");
    if (trailBtn) {
      const trail = TRAILS.find((t) => t.id === trailBtn.dataset.trail);
      if (!trail) return;
      this.save.setTrail(trail.id);
      this.audio.play("click");
      this.toast(`ENGINE TRAIL · ${trail.name.toUpperCase()}`, "good");
      this.renderGarage();
      return;
    }

    const chip = ev.target.closest("[data-ship]");
    if (chip) {
      const id = chip.dataset.ship;
      const ship = SHIPS.find((s) => s.id === id);
      if (!ship) return;
      if (!this.save.isShipUnlocked(id)) {
        this.toast(`LOCKED · CLEAR SECTOR ${ship.unlockLevel}`, "bad");
        this.audio.play("error");
        return;
      }
      this.save.selectShip(id);
      this.audio.play("click");
      if (this.hangar) this.prepHangar(ship);
      this.renderGarage();
      return;
    }

    const tab = ev.target.closest("[data-tab]");
    if (tab) {
      this.storeCat = tab.dataset.tab;
      this.audio.play("click");
      this.renderStore();
      return;
    }

    const skill = ev.target.closest("[data-skill]");
    if (skill) {
      const def = SKILLS.find((s) => s.id === skill.dataset.skill);
      if (!def) return;
      const res = tryBuySkill(this.save, def);
      if (res.ok) {
        this.audio.play("purchase");
        this.toast(`${def.name.toUpperCase()} UNLOCKED`, "good");
        this.showSkills();
      } else {
        this.audio.play("error");
        this.toast(res.text || (res.reason === "owned" ? "ALREADY OWNED" : "NO SKILL POINTS"), "bad");
      }
      return;
    }

    const lvl = ev.target.closest("[data-level]");
    if (lvl) {
      const n = Number(lvl.dataset.level);
      if (n > this.save.data.unlockedLevel) {
        this.audio.play("error");
        this.toast("SECTOR LOCKED — CLEAR THE PREVIOUS SECTOR", "bad");
        return;
      }
      this.startRun("campaign", n);
      return;
    }

    const act = ev.target.closest("[data-act]");
    if (!act) return;
    const a = act.dataset.act;
    this.audio.play("click");
    switch (a) {
      case "play": {
        const n = Math.min(LEVELS.length, this.save.data.unlockedLevel || 1);
        this.startRun("campaign", n);
        break;
      }
      case "levels": this.showLevels(); break;
      case "garage": this.showGarage(); break;
      case "store": this.showStore(); break;
      case "skills": this.showSkills(); break;
      case "settings": this.showSettings(); break;
      case "menu": this.showMenu(); break;
      case "endless":
        if (this.save.data.unlockedLevel < 2) {
          this.toast("CLEAR SECTOR 1 TO UNLOCK ENDLESS", "bad");
          this.audio.play("error");
        } else this.startRun("endless", 1);
        break;
      case "weekly":
        if (this.save.data.unlockedLevel < 5) {
          this.toast("CLEAR SECTOR 4 TO UNLOCK WEEKLY BOSS", "bad");
          this.audio.play("error");
        } else this.startRun("weekly", 1);
        break;
      case "bossrush":
        if (this.save.data.unlockedLevel < 3) {
          this.toast("CLEAR SECTOR 2 TO UNLOCK BOSS RUSH", "bad");
          this.audio.play("error");
        } else this.startRun("bossrush", 1);
        break;
      case "daily":
        if (this.save.data.unlockedLevel < 2) {
          this.toast("CLEAR SECTOR 1 TO UNLOCK DAILY CHALLENGE", "bad");
          this.audio.play("error");
        } else this.startRun("daily", 1);
        break;
      case "training":
        this.startRun("training", 1);
        break;
      case "galaxy": this.showGalaxy(); break;
      case "achievements": this.showAchievements(); break;
      case "selectShip":
        this.toast(`${this.save.getShip().name.toUpperCase()} EQUIPPED`, "good");
        break;
      default: break;
    }
  }

  onUiInput(ev) {
    const slider = ev.target.closest("input[data-setting]");
    if (!slider) return;
    this.applySetting(slider.dataset.setting, Number(slider.value) / 100);
  }

  wireSettings(root) {
    root.addEventListener("click", (ev) => {
      const toggle = ev.target.closest("[data-toggle-setting]");
      if (toggle) {
        const key = toggle.dataset.toggleSetting;
        const next = !this.save.data.settings[key];
        this.applySetting(key, next);
        toggle.classList.toggle("on", next);
        this.audio.play("click");
        return;
      }
      const q = ev.target.closest("[data-quality]");
      if (q) {
        this.applySetting("quality", q.dataset.quality);
        root.querySelectorAll("[data-quality]").forEach((b) => b.classList.toggle("active", b === q));
        this.audio.play("click");
        return;
      }
      if (ev.target.closest("[data-save-export]")) {
        const code = this.save.exportCode();
        const box = root.querySelector("[data-save-code]");
        if (box) box.value = code;
        if (navigator.clipboard && code) {
          navigator.clipboard.writeText(code).catch(() => { /* clipboard blocked */ });
        }
        this.toast("SAVE CODE EXPORTED", "good");
        this.audio.play("click");
        return;
      }
      if (ev.target.closest("[data-save-import]")) {
        const box = root.querySelector("[data-save-code]");
        const code = box ? box.value.trim() : "";
        if (!code) {
          this.toast("PASTE A SAVE CODE FIRST", "bad");
          this.audio.play("error");
          return;
        }
        try {
          this.save.importCode(code);
          this.refreshCoins();
          this.toast("SAVE RESTORED", "good");
          this.showMenu();
        } catch (err) {
          console.warn("Save import failed", err);
          this.toast("INVALID SAVE CODE", "bad");
          this.audio.play("error");
        }
        return;
      }
      if (ev.target.closest("[data-reset]")) {
        if (window.confirm("Reset all campaign progress, ships, upgrades and credits?")) {
          this.save.reset();
          this.toast("PILOT RECORD ERASED", "bad");
          this.showMenu();
        }
      }
    });
    root.addEventListener("input", (ev) => {
      const slider = ev.target.closest("input[data-setting]");
      if (!slider) return;
      this.applySetting(slider.dataset.setting, Number(slider.value) / 100);
    });
  }

  applySetting(name, value) {
    const settings = this.save.data.settings;
    if (name === "music" || name === "sfx") {
      settings[name] = Math.max(0, Math.min(1, value));
      this.save.save();
      this.audio.setSettings(settings);
    } else if (name === "quality") {
      this.save.setSetting("quality", value);
      this.engine.setHardwareScalingLevel(value === "low" ? 1.15 : 1);
    } else {
      this.save.setSetting(name, !!value);
    }
  }

  /* ------------------------------------------------------------
     overlays
     ------------------------------------------------------------ */

  openModal(title, body, foot) {
    const layer = document.createElement("div");
    layer.className = "modal-layer";
    layer.innerHTML = `
      <div class="modal glass">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="modal-close" data-close aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>`;
    layer.addEventListener("click", (ev) => {
      if (ev.target === layer || ev.target.closest("[data-close]")) layer.remove();
    });
    document.body.appendChild(layer);
    return layer;
  }

  showLoading(text) {
    this.loadingEl.classList.remove("boot");
    this.loadingEl.classList.remove("hidden");
    this.loadingFill.style.width = "0%";
    this.loadingText.textContent = text || "INITIALIZING";
  }

  hideLoading() {
    this.loadingEl.classList.add("hidden");
  }

  toast(text, cls = "", icon) {
    if (!this.toastLayer) return;
    const el = document.createElement("div");
    el.className = "toast " + cls;
    el.innerHTML = `${icon ? `<img src="${icon}" alt="" />` : ""}<span>${esc(text)}</span>`;
    this.toastLayer.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, 2400);
  }
}

/* ------------------------------------------------------------
   BOOT
   ------------------------------------------------------------ */

function boot() {
  const fail = (err) => {
    console.error("Stellar Wars boot failure", err);
    const loading = document.getElementById("loading");
    const text = document.getElementById("loading-text");
    if (loading && text) {
      loading.classList.remove("hidden");
      loading.classList.remove("boot");
      text.textContent = "BOOT FAILURE — " + (err && err.message ? err.message : "UNKNOWN ERROR");
    }
  };

  const start = () => {
    try {
      if (!window.BABYLON) throw new Error("Babylon.js failed to load");
      window.stellarApp = new App();
      if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("sw.js").catch((err) => {
            console.warn("Offline cache unavailable", err);
          });
        });
      }
    } catch (err) {
      fail(err);
    }
  };

  // Let the boot overlay paint before the engine, scenes and asset batch are
  // constructed, so the first thing the player sees is the loading bar.
  requestAnimationFrame(() => requestAnimationFrame(start));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();