import { SAVE_KEY, SHIPS, GAME_VERSION } from "../config.js";

const DEFAULT_SAVE = () => ({
  version: GAME_VERSION,
  coins: 350,
  ship: "scout",
  shipUpgrades: {},
  store: {},
  skills: [],
  skillPoints: 2,
  levels: {},
  unlockedLevel: 1,
  bestEndless: 0,
  bestBossRush: 0,
  bestDaily: 0,
  daily: { day: "", best: 0, wins: 0 },
  weekly: { week: "", won: false, best: 0 },
  achievements: {},
  achSeen: {},
  cosmetics: { paint: {}, trail: "cyan" },
  galaxy: { scans: 0 },
  settings: {
    music: 0.45,
    sfx: 0.7,
    autoFire: true,
    quality: "high",
    vibration: true,
    showFps: false
  },
  lastDaily: "",
  stats: { kills: 0, bosses: 0, coinsEarned: 0, runs: 0, playTime: 0, bossRushRuns: 0, dailyRuns: 0 },
  licenses: false
});

function deepMerge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra !== undefined ? extra : base;
  if (typeof base !== "object" || base === null) return extra !== undefined ? extra : base;
  const out = { ...base };
  if (extra && typeof extra === "object") {
    for (const k of Object.keys(extra)) {
      out[k] = deepMerge(base[k], extra[k]);
    }
  }
  return out;
}

export class SaveSystem {
  constructor() {
    this.data = DEFAULT_SAVE();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = deepMerge(DEFAULT_SAVE(), parsed);
      }
    } catch (e) {
      console.warn("Save load failed, starting fresh.", e);
      this.data = DEFAULT_SAVE();
    }
    this.data.version = GAME_VERSION;
    this.ensureDefaults();
  }

  ensureDefaults() {
    const d = this.data;
    if (!d.shipUpgrades) d.shipUpgrades = {};
    if (!d.store) d.store = {};
    if (!Array.isArray(d.skills)) d.skills = [];
    if (!d.levels) d.levels = {};
    if (!d.weekly) d.weekly = { week: "", won: false, best: 0 };
    if (!d.stats) d.stats = { kills: 0, bosses: 0, coinsEarned: 0, runs: 0, playTime: 0 };
    if (!d.daily) d.daily = { day: "", best: 0, wins: 0 };
    if (!d.achievements) d.achievements = {};
    if (!d.achSeen) d.achSeen = {};
    if (!d.cosmetics) d.cosmetics = { paint: {}, trail: "cyan" };
    if (!d.cosmetics.paint) d.cosmetics.paint = {};
    if (!d.cosmetics.trail) d.cosmetics.trail = "cyan";
    if (!d.galaxy) d.galaxy = { scans: 0 };
    if (typeof d.bestBossRush !== "number") d.bestBossRush = 0;
    if (typeof d.bestDaily !== "number") d.bestDaily = 0;
    for (const ship of SHIPS) {
      if (!d.shipUpgrades[ship.id]) {
        d.shipUpgrades[ship.id] = { hp: 0, shield: 0, speed: 0, damage: 0, fireRate: 0 };
      }
    }
    if (!SHIPS.some((s) => s.id === d.ship)) d.ship = "scout";
    if (d.unlockedLevel < 1) d.unlockedLevel = 1;
    if (typeof d.skillPoints !== "number") d.skillPoints = 0;
    if (typeof d.stats.bossRushRuns !== "number") d.stats.bossRushRuns = 0;
    if (typeof d.stats.dailyRuns !== "number") d.stats.dailyRuns = 0;
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("Save failed", e);
    }
  }

  reset() {
    this.data = DEFAULT_SAVE();
    this.ensureDefaults();
    this.save();
  }

  get coins() { return Math.floor(this.data.coins || 0); }

  addCoins(amount) {
    const v = Math.max(0, Math.floor(amount));
    this.data.coins = Math.max(0, this.data.coins + v);
    if (v > 0) this.data.stats.coinsEarned = (this.data.stats.coinsEarned || 0) + v;
    this.save();
    return v;
  }

  canAfford(amount) { return this.coins >= amount; }

  spend(amount) {
    amount = Math.max(0, Math.floor(amount));
    if (this.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  /* ---------------- ships ---------------- */
  getShip() {
    return SHIPS.find((s) => s.id === this.data.ship) || SHIPS[0];
  }

  isShipUnlocked(shipId) {
    const ship = SHIPS.find((s) => s.id === shipId);
    if (!ship) return false;
    if (ship.unlockLevel <= 1) return true;
    return this.data.unlockedLevel >= ship.unlockLevel;
  }

  upgradeLevel(shipId, key) {
    return (this.data.shipUpgrades[shipId]?.[key]) || 0;
  }

  setUpgradeLevel(shipId, key, value) {
    if (!this.data.shipUpgrades[shipId]) {
      this.data.shipUpgrades[shipId] = { hp: 0, shield: 0, speed: 0, damage: 0, fireRate: 0 };
    }
    this.data.shipUpgrades[shipId][key] = value;
    this.save();
  }

  selectShip(shipId) {
    if (!this.isShipUnlocked(shipId)) return false;
    this.data.ship = shipId;
    this.save();
    return true;
  }

  /* ---------------- store ---------------- */
  storeLevel(id) {
    return this.data.store?.[id] || 0;
  }

  setStoreLevel(id, level) {
    this.data.store[id] = level;
    this.save();
  }

  /* ---------------- skills ---------------- */
  hasSkill(id) { return this.data.skills.includes(id); }

  addSkill(id) {
    if (!this.hasSkill(id)) {
      this.data.skills.push(id);
      this.save();
    }
  }

  /* ---------------- levels ---------------- */
  levelRecord(n) {
    return this.data.levels[String(n)] || { stars: 0, score: 0, clears: 0 };
  }

  completeLevel(n, stars, score) {
    const key = String(n);
    const rec = this.data.levels[key] || { stars: 0, score: 0, clears: 0 };
    rec.stars = Math.max(rec.stars || 0, stars);
    rec.score = Math.max(rec.score || 0, score);
    rec.clears = (rec.clears || 0) + 1;
    this.data.levels[key] = rec;
    this.data.unlockedLevel = Math.max(this.data.unlockedLevel, Math.min(n + 1, 35));
    this.data.skillPoints += 1;
    this.data.stats.runs += 1;
    this.save();
    return rec;
  }

  recordFailedRun() {
    this.data.stats.runs += 1;
    this.save();
  }

  totalStars() {
    return Object.values(this.data.levels).reduce((a, l) => a + (l.stars || 0), 0);
  }

  completedCount() {
    return Object.values(this.data.levels).filter((l) => (l.clears || 0) > 0).length;
  }

  /* ---------------- daily ---------------- */
  claimDaily(dateKey, reward) {
    if (this.data.lastDaily === dateKey) return 0;
    this.data.lastDaily = dateKey;
    this.addCoins(reward);
    return reward;
  }

  /* ---------------- extra modes ---------------- */
  recordBossRush(bossesDefeated, score) {
    this.data.bestBossRush = Math.max(this.data.bestBossRush || 0, bossesDefeated || 0);
    this.data.stats.bossRushRuns = (this.data.stats.bossRushRuns || 0) + 1;
    this.data.stats.bosses = (this.data.stats.bosses || 0) + (bossesDefeated || 0);
    this.save();
    return this.data.bestBossRush;
  }

  recordDaily(dayKey, score, won) {
    const d = this.data.daily || (this.data.daily = { day: "", best: 0, wins: 0 });
    if (d.day !== dayKey) {
      d.day = dayKey;
      d.best = 0;
      d.wins = 0;
    }
    d.best = Math.max(d.best || 0, Math.floor(score || 0));
    if (won) d.wins = (d.wins || 0) + 1;
    this.data.bestDaily = Math.max(this.data.bestDaily || 0, Math.floor(score || 0));
    this.data.stats.dailyRuns = (this.data.stats.dailyRuns || 0) + 1;
    this.save();
    return d.best;
  }

  /* ---------------- achievements ---------------- */
  hasAchievement(id) {
    return !!(this.data.achievements && this.data.achievements[id]);
  }

  unlockAchievement(id) {
    if (!this.data.achievements) this.data.achievements = {};
    if (this.data.achievements[id]) return false;
    this.data.achievements[id] = Date.now();
    this.save();
    return true;
  }

  /** Achievements earned but not yet viewed in the awards screen. */
  unseenAchievements() {
    const earned = this.data.achievements || {};
    const seen = this.data.achSeen || {};
    return Object.keys(earned).filter((id) => !seen[id]).length;
  }

  markAchievementsSeen() {
    if (!this.data.achSeen) this.data.achSeen = {};
    let changed = false;
    for (const id of Object.keys(this.data.achievements || {})) {
      if (!this.data.achSeen[id]) {
        this.data.achSeen[id] = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  /* ---------------- cosmetics ---------------- */
  paintFor(shipId) {
    return (this.data.cosmetics && this.data.cosmetics.paint && this.data.cosmetics.paint[shipId]) || "";
  }

  setPaint(shipId, color) {
    if (!this.data.cosmetics) this.data.cosmetics = { paint: {}, trail: "cyan" };
    if (!this.data.cosmetics.paint) this.data.cosmetics.paint = {};
    if (color) this.data.cosmetics.paint[shipId] = color;
    else delete this.data.cosmetics.paint[shipId];
    this.save();
  }

  trailColor() {
    return (this.data.cosmetics && this.data.cosmetics.trail) || "cyan";
  }

  setTrail(id) {
    if (!this.data.cosmetics) this.data.cosmetics = { paint: {}, trail: "cyan" };
    this.data.cosmetics.trail = id || "cyan";
    this.save();
  }

  /* ---------------- backup / "cloud" save ---------------- */
  exportCode() {
    try {
      return "SW1:" + btoa(JSON.stringify(this.data));
    } catch (e) {
      return "";
    }
  }

  importCode(code) {
    const raw = String(code || "").trim().replace(/^SW1:/i, "");
    if (!raw) throw new Error("Empty save code");
    const parsed = JSON.parse(atob(raw));
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid save code");
    this.data = deepMerge(DEFAULT_SAVE(), parsed);
    this.data.version = GAME_VERSION;
    this.ensureDefaults();
    this.save();
    return true;
  }

  /* ---------------- settings ---------------- */
  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  }
}
