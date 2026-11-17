/* ============================================================
   STELLAR WARS — GAME CONFIGURATION & BALANCE DATA
   ============================================================ */

export const SAVE_KEY = "stellarwars.save.v2";
export const GAME_VERSION = 1;

export const DAILY_REWARD = 250;

/* ------------------------------------------------------------
   SHIPS
   ------------------------------------------------------------ */

export const SHIPS = [
  {
    id: "scout",
    name: "Scout",
    class: "Recon Interceptor",
    model: "scout",
    texture: "scout",
    color: "#4fd8ff",
    size: 3.1,
    unlockLevel: 1,
    desc: "Fast and nimble. Built for pilots who would rather not get hit at all.",
    ability: {
      id: "overdrive",
      name: "Overdrive",
      icon: "⚡",
      desc: "All power to engines. +80% speed and +60% fire rate for 5 seconds.",
      duration: 5,
      cooldown: 18
    },
    base: { hp: 90, shield: 30, speed: 18, damage: 9, fireRate: 7.0 }
  },
  {
    id: "fighter",
    name: "Fighter",
    class: "Multi-Role Strike",
    model: "fighter",
    texture: "fighter",
    color: "#6ff0a0",
    size: 3.3,
    unlockLevel: 2,
    desc: "The workhorse of the fleet. Balanced hull, shields and firepower.",
    ability: {
      id: "barrage",
      name: "Missile Barrage",
      icon: "✦",
      desc: "Launches 12 homing missiles at nearby targets over 3 seconds.",
      duration: 3,
      cooldown: 20
    },
    base: { hp: 120, shield: 50, speed: 15, damage: 11, fireRate: 6.5 }
  },
  {
    id: "destroyer",
    name: "Destroyer",
    class: "Heavy Assault",
    model: "destroyer",
    texture: "destroyer",
    color: "#ffb347",
    size: 3.8,
    unlockLevel: 5,
    desc: "Slow to turn, brutal to face. Its cannon array tears through armor.",
    ability: {
      id: "missileRain",
      name: "Missile Rain",
      icon: "☄",
      desc: "Calls down 24 missiles from orbit across the entire screen.",
      duration: 2,
      cooldown: 22
    },
    base: { hp: 155, shield: 65, speed: 12.5, damage: 16, fireRate: 5.0 }
  },
  {
    id: "titan",
    name: "Titan",
    class: "Siege Dreadnought",
    model: "titan",
    texture: "titan",
    color: "#c08bff",
    size: 4.2,
    unlockLevel: 9,
    desc: "A flying fortress. Enemy fire breaks against its layered plating.",
    ability: {
      id: "fortress",
      name: "Fortress Mode",
      icon: "🛡",
      desc: "Become invulnerable for 6 seconds and restore 40% of shields.",
      duration: 6,
      cooldown: 24
    },
    base: { hp: 220, shield: 90, speed: 10.5, damage: 13, fireRate: 5.5 }
  },
  {
    id: "phantom",
    name: "Phantom",
    class: "Stealth Prototype",
    model: "phantom",
    texture: "phantom",
    color: "#ff6b8a",
    size: 3.4,
    unlockLevel: 14,
    desc: "A ghost in the void. High crit chance and impossible agility.",
    ability: {
      id: "cloak",
      name: "Cloak Field",
      icon: "◈",
      desc: "Vanish for 5 seconds. Attacks cannot hit you and crit chance is doubled.",
      duration: 5,
      cooldown: 20
    },
    base: { hp: 110, shield: 45, speed: 17, damage: 14, fireRate: 7.5 }
  },
  {
    id: "interceptor",
    name: "Interceptor",
    class: "Rapid Response",
    model: "interceptor",
    texture: "interceptor",
    color: "#7bf0ff",
    size: 3.2,
    unlockLevel: 7,
    desc: "A knife-fighter with a warp core. Built to burst down single targets.",
    ability: {
      id: "warpSurge",
      name: "Warp Surge",
      icon: "➤",
      desc: "Overcharge the warp core: +35% speed and +120% fire rate for 4 seconds.",
      duration: 4,
      cooldown: 16
    },
    base: { hp: 105, shield: 40, speed: 19.5, damage: 10, fireRate: 8.2 }
  },
  {
    id: "gunship",
    name: "Gunship",
    class: "Fire Support",
    model: "gunship",
    texture: "gunship",
    color: "#ffcf6b",
    size: 3.6,
    unlockLevel: 12,
    desc: "A mobile battery. Heavy cannons and a reinforced ammunition bay.",
    ability: {
      id: "missileRain",
      name: "Missile Rain",
      icon: "☄",
      desc: "Calls down 24 missiles from orbit across the entire screen.",
      duration: 2,
      cooldown: 22
    },
    base: { hp: 165, shield: 55, speed: 13.5, damage: 15, fireRate: 6.2 }
  },
  {
    id: "dreadnought",
    name: "Dreadnought",
    class: "Fleet Flagship",
    model: "dreadnought",
    texture: "dreadnought",
    color: "#ff8a3d",
    size: 4.4,
    unlockLevel: 18,
    desc: "The flagship of the line. Almost impossible to kill, impossible to ignore.",
    ability: {
      id: "fortress",
      name: "Aegis Protocol",
      icon: "🛡",
      desc: "Become invulnerable for 6 seconds and restore 40% of shields.",
      duration: 6,
      cooldown: 24
    },
    base: { hp: 260, shield: 110, speed: 9.8, damage: 15, fireRate: 5.8 }
  }
];

export const SHIP_UPGRADES = [
  { key: "hp", label: "Hull", base: 160, stat: "HP", amount: "8%" },
  { key: "shield", label: "Shield", base: 150, stat: "SHIELD", amount: "8%" },
  { key: "speed", label: "Engines", base: 140, stat: "SPEED", amount: "6%" },
  { key: "damage", label: "Damage", base: 200, stat: "DAMAGE", amount: "8%" },
  { key: "fireRate", label: "Fire Rate", base: 220, stat: "FIRE RATE", amount: "5%" }
];

export const SHIP_UPGRADE_MAX = 10;

export function shipUpgradeCost(ship, key, level) {
  const def = SHIP_UPGRADES.find((u) => u.key === key);
  const shipIndex = SHIPS.findIndex((s) => s.id === ship.id);
  return Math.round(def.base * (1 + shipIndex * 0.18) * (1 + level * 0.9) * Math.pow(1.16, level));
}

/* ------------------------------------------------------------
   STORE
   ------------------------------------------------------------ */

export const STORE_CATEGORIES = [
  { id: "weapon", name: "Weapons", icon: "sword", color: "#4fd8ff" },
  { id: "health", name: "Defense", icon: "heart", color: "#ff6b8a" },
  { id: "utility", name: "Utility", icon: "ring2", color: "#6ff0a0" },
  { id: "premium", name: "Premium", icon: "crown", color: "#ffd166" }
];

export const STORE_ITEMS = [
  /* ---------------- weapons ---------------- */
  {
    id: "laser", cat: "weapon", name: "Laser Damage", icon: "sword",
    desc: "Amplifies every shot that leaves your cannons.",
    max: 5, costs: [400, 800, 1500, 2600, 4200], tag: "+10% dmg / lvl"
  },
  {
    id: "dual", cat: "weapon", name: "Dual Cannons", icon: "weapon",
    desc: "Adds a second synchronized cannon to your hull.",
    max: 1, costs: [2400], tag: "2-shot spread", requires: null
  },
  {
    id: "triple", cat: "weapon", name: "Triple Shots", icon: "weapon_rare",
    desc: "Three-way spread. Requires Dual Cannons.",
    max: 1, costs: [4200], tag: "3-shot spread", requires: "dual"
  },
  {
    id: "plasma", cat: "weapon", name: "Plasma Gun", icon: "weapon_rare",
    desc: "Superheated plasma bolts deal +25% damage and pierce one enemy. Requires Laser Lv2.",
    max: 1, costs: [6500], tag: "piercing +25%", requires: "laser:2"
  },
  {
    id: "beam", cat: "weapon", name: "Energy Beam", icon: "gem",
    desc: "Replaces your cannon with a continuous piercing beam. Requires Plasma Gun.",
    max: 1, costs: [9000], tag: "piercing beam", requires: "plasma"
  },
  {
    id: "railgun", cat: "weapon", name: "Railgun", icon: "crystal3",
    desc: "Every 4th shot becomes a tungsten slug that punches through hulls. Requires Energy Beam.",
    max: 1, costs: [8500], tag: "piercing slug", requires: "beam"
  },
  {
    id: "missileAmmo", cat: "weapon", name: "Missile Pods", icon: "missile",
    desc: "Additional homing missiles per volley.",
    max: 3, costs: [1200, 2600, 5000], tag: "+1 missile / lvl"
  },

  /* ---------------- defense ---------------- */
  {
    id: "hp", cat: "health", name: "Hull Plating", icon: "heart",
    desc: "Reinforced alloy increases maximum hull points.",
    max: 5, costs: [350, 700, 1300, 2200, 3500], tag: "+15 HP / lvl"
  },
  {
    id: "shield", cat: "health", name: "Shield Capacitor", icon: "shield",
    desc: "Expands your shield reservoir.",
    max: 5, costs: [400, 800, 1400, 2400, 3800], tag: "+10 shield / lvl"
  },
  {
    id: "regen", cat: "health", name: "Shield Regen", icon: "shield_crystal",
    desc: "Slowly regenerates shields during combat.",
    max: 3, costs: [900, 2000, 3600], tag: "+1 shield/s"
  },
  {
    id: "revive", cat: "health", name: "Emergency Core", icon: "extra_life",
    desc: "Automatically revives you once per mission at 50% hull. Stacks.",
    max: 2, costs: [2600, 5200], tag: "+1 revive / lvl"
  },

  /* ---------------- utility ---------------- */
  {
    id: "magnet", cat: "utility", name: "Coin Magnet", icon: "magnet",
    desc: "Pulls coins and power-ups toward your ship from further away.",
    max: 2, costs: [800, 2000], tag: "+4 pickup range"
  },
  {
    id: "coinBoost", cat: "utility", name: "Coin Booster", icon: "coin_star",
    desc: "Increases the number of credits recovered from every mission.",
    max: 3, costs: [1000, 2200, 4000], tag: "+12% coins"
  },
  {
    id: "scoreBoost", cat: "utility", name: "Score Booster", icon: "score",
    desc: "Boosts mission score for better star ratings and leaderboards.",
    max: 3, costs: [1000, 2200, 4000], tag: "+10% score"
  },
  {
    id: "autoRepair", cat: "utility", name: "Nanite Repair", icon: "potion_green",
    desc: "Repairs 2 hull points per second during battle.",
    max: 2, costs: [1400, 2800], tag: "+2 HP/s"
  },
  {
    id: "targeting", cat: "utility", name: "Targeting Computer", icon: "score",
    desc: "Improves weak-point acquisition on every weapon.",
    max: 3, costs: [900, 1900, 3400], tag: "+3% crit"
  },
  {
    id: "droneBay", cat: "utility", name: "Attack Drone Bay", icon: "missile",
    desc: "Deploys an autonomous attack drone that escorts your ship.",
    max: 2, costs: [1800, 4600], tag: "+1 attack drone"
  },
  {
    id: "shieldDrone", cat: "utility", name: "Shield Drone", icon: "shield_crystal",
    desc: "A support drone that constantly tops up your shield reservoir.",
    max: 1, costs: [3400], tag: "shield support"
  },
  {
    id: "repairDrone", cat: "utility", name: "Repair Drone", icon: "potion_green",
    desc: "A support drone that patches hull damage during combat.",
    max: 1, costs: [3000], tag: "hull repair"
  },

  /* ---------------- premium powers ---------------- */
  {
    id: "nuke", cat: "premium", name: "Nuclear Blast", icon: "nuke",
    desc: "One per mission. Clears enemy fire and scorches every hostile on screen.",
    max: 1, costs: [5000], tag: "1 charge / mission"
  },
  {
    id: "orbital", cat: "premium", name: "Orbital Strike", icon: "orbital",
    desc: "One per mission. Calls a devastating kinetic strike on the strongest target.",
    max: 1, costs: [6500], tag: "1 charge / mission"
  },
  {
    id: "timeSlow", cat: "premium", name: "Time Slow", icon: "time_slow",
    desc: "Two per mission. Slows all hostiles and bullets by 60% for 5 seconds.",
    max: 1, costs: [4000], tag: "2 charges / mission"
  }
];

export function storeItem(id) {
  return STORE_ITEMS.find((i) => i.id === id);
}

export function storeCost(item, level) {
  return item.costs[Math.min(level, item.costs.length - 1)];
}

/* ------------------------------------------------------------
   SKILL TREE
   ------------------------------------------------------------ */

export const SKILL_TREES = [
  { id: "tank", name: "Bulwark", color: "#6ff0a0", icon: "shield" },
  { id: "missile", name: "Payload", color: "#ffb347", icon: "missile" },
  { id: "laser", name: "Overcharge", color: "#4fd8ff", icon: "sword" },
  { id: "crit", name: "Predator", color: "#ff6b8a", icon: "star" },
  { id: "fleet", name: "Fleet Command", color: "#7bffcf", icon: "missile" },
  { id: "engineer", name: "Engineering", color: "#ffd166", icon: "speed" }
];

export const SKILLS = [
  { id: "tank1", tree: "tank", tier: 1, name: "Reinforced Hull", desc: "+10% maximum hull.", cost: 1, effects: { hpPct: 0.1 } },
  { id: "tank2", tree: "tank", tier: 2, name: "Ablative Shields", desc: "+15% maximum shield.", cost: 1, effects: { shieldPct: 0.15 } },
  { id: "tank3", tree: "tank", tier: 3, name: "Auto-Repair", desc: "Regenerate 1.5 hull per second.", cost: 2, effects: { hullRegen: 1.5 } },

  { id: "missile1", tree: "missile", tier: 1, name: "Warhead Tuning", desc: "+35% missile damage.", cost: 1, effects: { missileDamage: 0.35 } },
  { id: "missile2", tree: "missile", tier: 2, name: "Fast Loaders", desc: "Missile cooldown -25%.", cost: 1, effects: { missileCd: -0.25 } },
  { id: "missile3", tree: "missile", tier: 3, name: "Saturation", desc: "+2 missiles per volley.", cost: 2, effects: { missileCount: 2 } },

  { id: "laser1", tree: "laser", tier: 1, name: "Focused Lenses", desc: "+10% laser damage.", cost: 1, effects: { damagePct: 0.1 } },
  { id: "laser2", tree: "laser", tier: 2, name: "Cooling Coils", desc: "+10% fire rate.", cost: 1, effects: { fireRatePct: 0.1 } },
  { id: "laser3", tree: "laser", tier: 3, name: "Piercing Rounds", desc: "Shots pierce +1 enemy.", cost: 2, effects: { pierce: 1 } },

  { id: "crit1", tree: "crit", tier: 1, name: "Weak Points", desc: "+8% critical chance.", cost: 1, effects: { critChance: 0.08 } },
  { id: "crit2", tree: "crit", tier: 2, name: "Executioner", desc: "+75% critical damage.", cost: 1, effects: { critDamage: 0.75 } },
  { id: "crit3", tree: "crit", tier: 3, name: "Blood Money", desc: "+20% credits earned.", cost: 2, effects: { coinPct: 0.2 } },

  { id: "fleet1", tree: "fleet", tier: 1, name: "Drone Uplink", desc: "Deploy 1 additional attack drone.", cost: 2, effects: { droneCount: 1 } },
  { id: "fleet2", tree: "fleet", tier: 2, name: "Wingman Calibration", desc: "+35% drone damage.", cost: 1, effects: { droneDamage: 0.35 } },
  { id: "fleet3", tree: "fleet", tier: 3, name: "Fleet Coordination", desc: "Drones fire 30% faster.", cost: 2, effects: { droneRate: 0.3 } },

  { id: "eng1", tree: "engineer", tier: 1, name: "Reactor Tuning", desc: "Ultimate recharges 15% faster.", cost: 1, effects: { abilityCd: -0.15 } },
  { id: "eng2", tree: "engineer", tier: 2, name: "Shield Harmonizer", desc: "+1 shield regeneration per second.", cost: 1, effects: { shieldRegen: 1 } },
  { id: "eng3", tree: "engineer", tier: 3, name: "Emergency Protocols", desc: "+8% hull and +8% shield.", cost: 2, effects: { hpPct: 0.08, shieldPct: 0.08 } }
];

/* ------------------------------------------------------------
   ACHIEVEMENTS
   ------------------------------------------------------------ */

export const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", desc: "Destroy your first hostile.", icon: "sword", tier: "bronze" },
  { id: "hunter", name: "Hunter", desc: "Destroy 100 hostiles.", icon: "star", tier: "bronze" },
  { id: "exterminator", name: "Exterminator", desc: "Destroy 500 hostiles.", icon: "weapon_rare", tier: "silver" },
  { id: "legend_kills", name: "Void Legend", desc: "Destroy 2,000 hostiles.", icon: "crown", tier: "gold" },
  { id: "first_boss", name: "Giant Slayer", desc: "Defeat your first boss.", icon: "crystal3", tier: "bronze" },
  { id: "boss_hunter", name: "Boss Hunter", desc: "Defeat 10 bosses.", icon: "gem", tier: "silver" },
  { id: "boss_legend", name: "Titan Breaker", desc: "Defeat 30 bosses.", icon: "crown", tier: "gold" },
  { id: "sector_1", name: "First Contact", desc: "Clear Sector 01.", icon: "score", tier: "bronze" },
  { id: "sector_10", name: "Deep Space", desc: "Clear 10 sectors.", icon: "gem", tier: "silver" },
  { id: "sector_20", name: "Outer Rim", desc: "Clear 20 sectors.", icon: "weapon_rare", tier: "gold" },
  { id: "sector_30", name: "Last Defense", desc: "Complete the campaign.", icon: "crown", tier: "platinum" },
  { id: "stars_30", name: "Constellation", desc: "Earn 30 stars.", icon: "star", tier: "silver" },
  { id: "stars_90", name: "Perfect Sky", desc: "Earn all 90 stars.", icon: "crown", tier: "platinum" },
  { id: "endless_5", name: "Survivor", desc: "Reach wave 5 in Endless.", icon: "shield", tier: "bronze" },
  { id: "endless_15", name: "Last Ship Standing", desc: "Reach wave 15 in Endless.", icon: "extra_life", tier: "gold" },
  { id: "weekly_clear", name: "Weekly Champion", desc: "Clear a Weekly Boss.", icon: "crown", tier: "silver" },
  { id: "bossrush_3", name: "Gauntlet", desc: "Defeat 3 bosses in a single Boss Rush.", icon: "sword", tier: "silver" },
  { id: "bossrush_5", name: "Rush Hour", desc: "Clear Boss Rush.", icon: "crown", tier: "gold" },
  { id: "daily_1", name: "Daily Duty", desc: "Clear a Daily Challenge.", icon: "score", tier: "bronze" },
  { id: "collector", name: "Fleet Collector", desc: "Unlock 5 ships.", icon: "ring2", tier: "silver" },
  { id: "fully_upgraded", name: "Peak Performance", desc: "Max every upgrade on one ship.", icon: "speed", tier: "silver" },
  { id: "fleet_commander", name: "Fleet Commander", desc: "Deploy two attack drones at once.", icon: "missile", tier: "gold" },
  { id: "skill_master", name: "Skill Master", desc: "Unlock every skill.", icon: "gem", tier: "gold" },
  { id: "rich", name: "War Chest", desc: "Earn 10,000 credits in total.", icon: "coin_star", tier: "silver" },
  { id: "painted", name: "Custom Job", desc: "Apply a custom hull paint.", icon: "ring2", tier: "bronze" }
];

/* ------------------------------------------------------------
   COSMETICS
   ------------------------------------------------------------ */

export const PAINTS = [
  { id: "factory", name: "Factory", color: "" },
  { id: "cyan", name: "Ion Cyan", color: "#4fe3ff" },
  { id: "violet", name: "Void Violet", color: "#a26bff" },
  { id: "pink", name: "Nova Pink", color: "#ff4f9e" },
  { id: "gold", name: "Solar Gold", color: "#ffd166" },
  { id: "green", name: "Aegis Green", color: "#5ff0a0" },
  { id: "red", name: "Crimson", color: "#ff5566" },
  { id: "white", name: "Ghost White", color: "#eaf4ff" }
];

export const TRAILS = [
  { id: "cyan", name: "Ion", color: "#6fe8ff" },
  { id: "violet", name: "Void", color: "#b388ff" },
  { id: "gold", name: "Solar", color: "#ffd166" },
  { id: "green", name: "Aegis", color: "#5ff0a0" },
  { id: "pink", name: "Nova", color: "#ff6b8a" },
  { id: "white", name: "Ghost", color: "#eaf4ff" }
];

/* ------------------------------------------------------------
   POWER-UPS
   ------------------------------------------------------------ */

export const POWERUP_RARITY = {
  common: { name: "Common", color: "#6ff0a0", glow: "rgba(95,240,160,0.7)", ring: 0x44cc88 },
  rare: { name: "Rare", color: "#4fc3ff", glow: "rgba(79,195,255,0.75)", ring: 0x2288dd },
  epic: { name: "Epic", color: "#c07dff", glow: "rgba(192,125,255,0.85)", ring: 0x9955ee }
};

export const POWERUPS = [
  { id: "health", name: "Health Pack", icon: "heart", rarity: "common", weight: 20, color: "#ff5b6b", desc: "+30 HULL" },
  { id: "shield", name: "Shield Cell", icon: "shield", rarity: "common", weight: 16, color: "#7fa8ff", desc: "+25 SHIELD" },
  { id: "weapon", name: "Weapon Boost", icon: "weapon", rarity: "common", weight: 14, color: "#ffcf6b", desc: "POWER +1 · 12s" },
  { id: "score", name: "Data Core", icon: "star", rarity: "common", weight: 9, color: "#ffd166", desc: "+300 SCORE" },

  { id: "freeze", name: "Freeze Bomb", icon: "freeze", rarity: "rare", weight: 10, color: "#7bf0ff", desc: "FREEZE · 5s" },
  { id: "missiles", name: "Missile Swarm", icon: "missile", rarity: "rare", weight: 9, color: "#ff9f43", desc: "AUTO MISSILES · 8s" },
  { id: "speed", name: "Speed Boost", icon: "speed", rarity: "rare", weight: 8, color: "#6ff0a0", desc: "2× SPEED · 8s" },
  { id: "coinMult", name: "Coin Surge", icon: "coin_star", rarity: "rare", weight: 8, color: "#ffd166", desc: "2× COINS · 10s" },

  { id: "plasmaStorm", name: "Plasma Storm", icon: "weapon_rare", rarity: "epic", weight: 5, color: "#c07dff", desc: "ARSENAL BURST" },
  { id: "invincibility", name: "Invincibility", icon: "shield_crystal", rarity: "epic", weight: 4, color: "#ffe9a8", desc: "INVULNERABLE · 5s" },
  { id: "blackHole", name: "Black Hole", icon: "gem", rarity: "epic", weight: 4, color: "#a26bff", desc: "SINGULARITY · 3s" }
];

export function rollPowerup() {
  const total = POWERUPS.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * total;
  for (const p of POWERUPS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return POWERUPS[0];
}

/* ------------------------------------------------------------
   ENEMIES
   ------------------------------------------------------------ */

export const ENEMIES = {
  drone: {
    key: "drone", name: "Drone", model: "drone", size: 1.7, radius: 0.95,
    hp: 22, damage: 6, speed: 5.6, score: 55, coins: 1,
    movement: "sine", fire: null
  },
  fighter: {
    key: "fighter", name: "Raider", model: "fighter", size: 2.3, radius: 1.15,
    hp: 58, damage: 8, speed: 3.4, score: 120, coins: 2,
    movement: "hover", holdZ: [-7.5, -2.5],
    fire: { kind: "aimed", interval: 1.9, count: 1, speed: 19, damage: 7, spread: 0 }
  },
  bomber: {
    key: "bomber", name: "Bomber", model: "bomber", size: 3.2, radius: 1.6,
    hp: 165, damage: 10, speed: 1.9, score: 260, coins: 4,
    movement: "hover", holdZ: [-8.5, -3.5],
    fire: { kind: "fan", interval: 2.6, count: 5, speed: 15, damage: 9, spread: 1.1 }
  },
  kamikaze: {
    key: "kamikaze", name: "Kamikaze", model: "kamikaze", size: 2.1, radius: 1.0,
    hp: 42, damage: 18, speed: 6.5, score: 150, coins: 2,
    movement: "dive", fire: null
  },
  escort: {
    key: "escort", name: "Escort", model: "escort", size: 2.6, radius: 1.25,
    hp: 90, damage: 9, speed: 4.2, score: 200, coins: 3,
    movement: "weave", holdZ: [-9, -4],
    fire: { kind: "aimed", interval: 1.6, count: 2, speed: 22, damage: 8, spread: 0.18 }
  },
  elite: {
    key: "elite", name: "Elite", model: "elite", size: 4.4, radius: 2.3,
    hp: 850, damage: 12, speed: 1.8, score: 900, coins: 14,
    movement: "mini", fire: null
  },

  /* ---------------- late-game hostiles ---------------- */
  marauder: {
    key: "marauder", name: "Marauder", model: "marauder", size: 2.9, radius: 1.5,
    hp: 300, damage: 22, speed: 4.6, score: 520, coins: 7,
    movement: "weave", holdZ: [-9.5, -4], dropChance: 0.22,
    fire: { kind: "aimed", interval: 1.35, count: 2, speed: 24, damage: 17, spread: 0.16 }
  },
  wraith: {
    key: "wraith", name: "Wraith", model: "wraith", size: 2.5, radius: 1.2,
    hp: 220, damage: 32, speed: 7.4, score: 480, coins: 6,
    movement: "dive", dropChance: 0.2,
    fire: null
  },
  ironclad: {
    key: "ironclad", name: "Ironclad", model: "ironclad", size: 3.7, radius: 1.9,
    hp: 700, damage: 24, speed: 3.1, score: 820, coins: 12,
    movement: "hover", holdZ: [-8.5, -3], dropChance: 0.35,
    fire: { kind: "aimed", interval: 1.65, count: 3, speed: 22, damage: 16, spread: 0.18 }
  },
  annihilator: {
    key: "annihilator", name: "Annihilator", model: "annihilator", size: 4.3, radius: 2.4,
    hp: 1300, damage: 30, speed: 1.7, score: 1500, coins: 22,
    movement: "hover", holdZ: [-8, -3], dropChance: 0.65,
    fire: { kind: "fan", interval: 2.0, count: 7, speed: 17, damage: 20, spread: 1.35 }
  }
};

export const MINI_BOSSES = [
  { name: "Hive Warden", model: "armabee", size: 6.5, tone: "#7bffcf" },
  { name: "Glub Ravager", model: "glub", size: 6.8, tone: "#8dff6b" },
  { name: "Stone Sentinel", model: "goleling", size: 7.0, tone: "#ffc46b" },
  { name: "Phantom Hound", model: "ghost", size: 6.6, tone: "#c9b6ff" },
  { name: "Void Squid", model: "squidle", size: 7.0, tone: "#ff87d1" },
  { name: "Sky Pigeon", model: "pigeon", size: 6.2, tone: "#b8c8ff" }
];

/* ------------------------------------------------------------
   BOSSES
   ------------------------------------------------------------ */

export const BOSS_DEFS = [
  {
    id: "alien_cruiser", name: "Alien Cruiser", model: "alpaking_evolved",
    size: 10, tone: "#7dffc4", attacks: ["fan", "aimed", "charge"],
    desc: "A living bio-cruiser that lashes out with plasma spores."
  },
  {
    id: "nebula_stinger", name: "Nebula Stinger", model: "armabee_evolved",
    size: 9.5, tone: "#ffe45e", attacks: ["fan", "ring", "summon"],
    desc: "A hive admiral flanked by endless swarms."
  },
  {
    id: "rogue_behemoth", name: "Rogue Behemoth", model: "goleling_evolved",
    size: 10, tone: "#ffb347", attacks: ["aimed", "missileRain", "ring"],
    desc: "A planet-buster turned pirate. Heavy armor, heavier ordnance."
  },
  {
    id: "void_reaper", name: "Void Reaper", model: "ghost_skull",
    size: 10, tone: "#c9a6ff", attacks: ["teleport", "beam", "fan"],
    desc: "It phases through reality and strikes from impossible angles."
  },
  {
    id: "destroyer_titan", name: "Destroyer Titan", model: "dragon",
    size: 11, tone: "#ff8a3d", attacks: ["missileRain", "summon", "fan", "beam"],
    desc: "A draconic siege engine that rains fire from above."
  },
  {
    id: "plasma_wyrm", name: "Plasma Wyrm", model: "dragon_evolved",
    size: 11.5, tone: "#54e6ff", attacks: ["beam", "spiral", "ring", "charge"],
    desc: "A serpent of living plasma. Its breath cuts the void."
  },
  {
    id: "asteroid_devourer", name: "Asteroid Devourer", model: "glub_evolved",
    size: 11, tone: "#86ff6b", attacks: ["ring", "fan", "summon", "aimed"],
    desc: "It eats worlds. You are a snack."
  },
  {
    id: "crimson_warlord", name: "Crimson Warlord", model: "demon",
    size: 10, tone: "#ff5b6b", attacks: ["charge", "fan", "aimed", "ring"],
    desc: "A demon prince of the outer dark, hungry for starships."
  },
  {
    id: "abyssal_queen", name: "Abyssal Queen", model: "squidle",
    size: 11, tone: "#ff7ad9", attacks: ["spiral", "ring", "aimed", "summon"],
    desc: "Her tendrils reach across dimensions to drag ships down."
  },
  {
    id: "void_emperor", name: "Void Emperor", model: "tribal",
    size: 11.5, tone: "#ff9f43", attacks: ["teleport", "beam", "summon", "spiral", "ring"],
    desc: "The throne of the void. It has consumed a thousand fleets."
  },
  {
    id: "galactic_nemesis", name: "Galactic Nemesis", model: "hywirl",
    size: 12, tone: "#6fe8ff", attacks: ["beam", "missileRain", "teleport", "spiral", "ring"],
    desc: "The last defense is its only obstacle."
  },
  {
    id: "spectral_sovereign", name: "Spectral Sovereign", model: "ghost",
    size: 10.5, tone: "#b8c8ff", attacks: ["teleport", "fan", "beam", "ring"],
    desc: "A dead king with an undead armada."
  },

  /* ---------------- late-campaign warships ---------------- */
  {
    id: "vanguard_colossus", name: "Vanguard Colossus", model: "enemy_boss1",
    size: 12, tone: "#b07bff", attacks: ["fan", "ring", "beam", "summon"],
    desc: "A bio-mechanical siege beast that shrugs off entire salvos."
  },
  {
    id: "obsidian_tyrant", name: "Obsidian Tyrant", model: "enemy_boss2",
    size: 12.5, tone: "#ff8a3d", attacks: ["aimed", "missileRain", "charge", "ring"],
    desc: "An armoured warlord hull built to break fortified lines."
  },
  {
    id: "synth_overlord", name: "Synth Overlord", model: "enemy_boss2",
    size: 12.8, tone: "#54e6ff", attacks: ["beam", "spiral", "teleport", "ring", "fan"],
    desc: "A machine intelligence wearing a warship like a body."
  },
  {
    id: "void_leviathan", name: "Void Leviathan", model: "enemy_boss1",
    size: 13.5, tone: "#ff5bd0", attacks: ["spiral", "ring", "summon", "charge", "beam"],
    desc: "The thing the outer dark is afraid of."
  }
];

/** High sectors cycle through the dedicated warship bosses. */
const LATE_BOSS_IDS = ["vanguard_colossus", "obsidian_tyrant", "synth_overlord", "void_leviathan"];
const EARLY_BOSS_COUNT = BOSS_DEFS.length - LATE_BOSS_IDS.length;

export const SECTOR_NAMES = [
  "Kepler Outpost", "Nebula Gate", "Rust Belt", "Cinder Reach", "Titan's Wake",
  "Ion Expanse", "Broken Moon", "Serpent's Eye", "Abyssal Rift", "Void Throne",
  "Ghost Nebula", "Hive World", "Obsidian Drift", "Solar Graveyard", "Crimson Verge",
  "Silent Expanse", "Deep Dark", "Behemoth Belt", "Echo Chamber", "Overlord's Gate",
  "Radiant Fall", "Static Fields", "The Maw", "Trinity Cluster", "Black Sun",
  "Event Horizon", "Shattered Crown", "Final Orbit", "Last Light", "Omega Sector",
  "Ashfall Divide", "Iron Cradle", "Null Expanse", "Shatterlight", "The Last Horizon"
];

const MILESTONE_BOSS = {
  5: "destroyer_titan",
  10: "void_emperor",
  15: "vanguard_colossus",
  20: "obsidian_tyrant",
  25: "synth_overlord",
  30: "void_leviathan",
  35: "void_leviathan"
};

export function bossForLevel(n) {
  const isMilestone = !!MILESTONE_BOSS[n];
  const latePool = LATE_BOSS_IDS.map((id) => BOSS_DEFS.find((b) => b.id === id));
  let prime;
  if (n >= 13) {
    prime = latePool[(n - 13) % latePool.length];
  } else {
    prime = BOSS_DEFS[(n - 1) % EARLY_BOSS_COUNT];
  }
  let def = prime;
  if (isMilestone) {
    def = BOSS_DEFS.find((b) => b.id === MILESTONE_BOSS[n]) || prime;
  }
  const cycle = n >= 13
    ? Math.floor((n - 13) / latePool.length)
    : Math.floor((n - 1) / EARLY_BOSS_COUNT);
  let name = def.name;
  if (n === 20) name = "Galaxy Overlord";
  else if (n === 30) name = "Galactic Nemesis";
  else if (n === 35) name = "Omega Nemesis";
  else if (cycle > 0) name = `${def.name} MK ${cycle + 1}`;

  // Boss health ramps hard past the mid campaign: a fully upgraded ship
  // should need sustained fire and clean dodging to bring one down.
  const lateFactor = 1 + Math.max(0, n - 14) * 0.2;
  return {
    ...def,
    name,
    level: n,
    phaseThresholds: n >= 20 ? [0.78, 0.55, 0.32, 0.12] : [0.72, 0.45, 0.2],
    hp: Math.round((900 + 400 * n + Math.pow(n, 1.7) * 45) * lateFactor),
    scale: 1 + Math.min(n, 35) * 0.012
  };
}

export const LEVELS = Array.from({ length: 35 }, (_, i) => {
  const n = i + 1;
  const boss = bossForLevel(n);
  return {
    n,
    name: SECTOR_NAMES[i] || `Sector ${n}`,
    boss,
    waves: 5,
    miniBoss: MINI_BOSSES[(n - 1) % MINI_BOSSES.length],
    hpScale: 1 + 0.36 * (n - 1) + 0.014 * Math.pow(n - 1, 2),
    dmgScale: Math.min(5.2, 1 + 0.15 * (n - 1)),
    speedScale: Math.min(1.72, 1 + 0.02 * (n - 1)),
    countScale: Math.min(2.25, 1 + 0.03 * (n - 1))
  };
});

export function getLevel(n) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, n - 1))];
}

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

export function formatNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function starsForRun({ win, hullPct, revivesUsed }) {
  if (!win) return 0;
  if (hullPct >= 0.75 && revivesUsed === 0) return 3;
  if (hullPct >= 0.4) return 2;
  return 1;
}
