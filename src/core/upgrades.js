import {
  SHIPS, SKILLS, STORE_ITEMS, storeItem, storeCost, shipUpgradeCost, SHIP_UPGRADE_MAX
} from "../config.js";

/* Aggregate passive bonuses from the skill tree. */
export function getSkillEffects(save) {
  const fx = {
    hpPct: 0, shieldPct: 0, hullRegen: 0,
    missileDamage: 0, missileCd: 0, missileCount: 0,
    damagePct: 0, fireRatePct: 0, pierce: 0,
    critChance: 0, critDamage: 0, coinPct: 0,
    droneCount: 0, droneDamage: 0, droneRate: 0,
    abilityCd: 0, shieldRegen: 0
  };
  for (const id of save.data.skills) {
    const skill = SKILLS.find((s) => s.id === id);
    if (!skill) continue;
    for (const [k, v] of Object.entries(skill.effects)) {
      fx[k] = (fx[k] || 0) + v;
    }
  }
  return fx;
}

/* Full derived combat loadout for the currently selected ship. */
export function getLoadout(save) {
  const ship = save.getShip();
  const up = save.data.shipUpgrades[ship.id] || {};
  const st = save.data.store || {};
  const fx = getSkillEffects(save);

  const maxHp = Math.round(
    ship.base.hp * (1 + 0.08 * (up.hp || 0)) * (1 + fx.hpPct) + (st.hp || 0) * 15
  );
  const maxShield = Math.round(
    ship.base.shield * (1 + 0.08 * (up.shield || 0)) * (1 + fx.shieldPct) + (st.shield || 0) * 10
  );
  const speed = ship.base.speed * (1 + 0.06 * (up.speed || 0));
  const damage = ship.base.damage * (1 + 0.08 * (up.damage || 0)) * (1 + 0.1 * (st.laser || 0)) * (1 + fx.damagePct);
  const fireRate = ship.base.fireRate * (1 + 0.05 * (up.fireRate || 0)) * (1 + fx.fireRatePct);

  const critChance = Math.min(0.75, 0.05 + (ship.id === "phantom" ? 0.13 : 0) + fx.critChance + (st.targeting || 0) * 0.03);
  const critDamage = 1.9 + (ship.id === "phantom" ? 0.35 : 0) + fx.critDamage;

  let multiShot = 1;
  if (st.triple) multiShot = 3;
  else if (st.dual) multiShot = 2;

  const weapon = {
    dual: !!st.dual,
    triple: !!st.triple,
    plasma: !!st.plasma,
    beam: !!st.beam,
    railgun: !!st.railgun,
    pierce: (st.plasma ? 1 : 0) + fx.pierce,
    spread: multiShot === 3 ? 0.13 : multiShot === 2 ? 0.055 : 0
  };

  return {
    ship,
    maxHp,
    maxShield,
    speed,
    damage,
    fireRate,
    critChance,
    critDamage,
    weapon,
    multiShot,
    missileCount: 2 + (st.missileAmmo || 0) + fx.missileCount,
    missileCooldown: Math.max(1.2, 3.1 * (1 + fx.missileCd)),
    missileDamage: damage * 1.7 * (1 + fx.missileDamage),
    shieldRegen: (st.regen || 0) * 1.0 + fx.shieldRegen,
    hullRegen: (st.autoRepair || 0) * 2.0 + fx.hullRegen,
    magnet: 4.5 + (st.magnet || 0) * 4,
    coinBoost: 1 + (st.coinBoost || 0) * 0.12 + fx.coinPct,
    scoreBoost: 1 + (st.scoreBoost || 0) * 0.1,
    revives: st.revive || 0,
    droneCount: (st.droneBay || 0) + fx.droneCount,
    droneDamage: damage * 0.34 * (1 + fx.droneDamage),
    droneRate: fx.droneRate,
    shieldDrones: st.shieldDrone ? 1 : 0,
    repairDrones: st.repairDrone ? 1 : 0,
    abilityCdMult: Math.max(0.55, 1 + fx.abilityCd),
    powers: {
      nuke: st.nuke ? 1 : 0,
      orbital: st.orbital ? 1 : 0,
      timeSlow: st.timeSlow ? 2 : 0
    },
    ability: ship.ability,
    shieldDelay: 3.5
  };
}

/* For the garage: preview stats for any ship (not just selected). */
export function previewShipStats(save, ship) {
  const up = save.data.shipUpgrades[ship.id] || {};
  const st = save.data.store || {};
  const fx = getSkillEffects(save);
  const maxHp = Math.round(ship.base.hp * (1 + 0.08 * (up.hp || 0)) * (1 + fx.hpPct) + (st.hp || 0) * 15);
  const maxShield = Math.round(ship.base.shield * (1 + 0.08 * (up.shield || 0)) * (1 + fx.shieldPct) + (st.shield || 0) * 10);
  return {
    hp: maxHp,
    shield: maxShield,
    speed: ship.base.speed * (1 + 0.06 * (up.speed || 0)),
    damage: ship.base.damage * (1 + 0.08 * (up.damage || 0)) * (1 + 0.1 * (st.laser || 0)) * (1 + fx.damagePct),
    fireRate: ship.base.fireRate * (1 + 0.05 * (up.fireRate || 0)) * (1 + fx.fireRatePct),
    upgrade: up
  };
}

/* ---------------- store purchase rules ---------------- */

export function requirementState(save, item) {
  if (!item.requires) return { ok: true };
  const req = item.requires;
  if (req === "dual") {
    return save.storeLevel("dual") ? { ok: true } : { ok: false, text: "Requires Dual Cannons" };
  }
  if (req === "plasma") {
    return save.storeLevel("plasma") ? { ok: true } : { ok: false, text: "Requires Plasma Gun" };
  }
  if (req.startsWith("laser:")) {
    const lvl = parseInt(req.split(":")[1], 10);
    return save.storeLevel("laser") >= lvl ? { ok: true } : { ok: false, text: `Requires Laser Lv${lvl}` };
  }
  return { ok: true };
}

export function tryBuyStoreItem(save, item) {
  const level = save.storeLevel(item.id);
  if (level >= item.max) return { ok: false, reason: "maxed" };
  const req = requirementState(save, item);
  if (!req.ok) return { ok: false, reason: "locked", text: req.text };
  const cost = storeCost(item, level);
  if (!save.canAfford(cost)) return { ok: false, reason: "coins", text: "Not enough credits" };
  save.spend(cost);
  save.setStoreLevel(item.id, level + 1);
  save.save();
  return { ok: true, cost, level: level + 1 };
}

export function tryBuyShipUpgrade(save, ship, key) {
  const level = save.upgradeLevel(ship.id, key);
  if (level >= SHIP_UPGRADE_MAX) return { ok: false, reason: "maxed" };
  const cost = shipUpgradeCost(ship, key, level);
  if (!save.canAfford(cost)) return { ok: false, reason: "coins", text: "Not enough credits" };
  save.spend(cost);
  save.setUpgradeLevel(ship.id, key, level + 1);
  return { ok: true, cost, level: level + 1 };
}

export function tryBuySkill(save, skill) {
  if (save.hasSkill(skill.id)) return { ok: false, reason: "owned" };
  if ((save.data.skillPoints || 0) < skill.cost) return { ok: false, reason: "points", text: "No skill points" };
  // tier gating
  const treeSkills = SKILLS.filter((s) => s.tree === skill.tree).sort((a, b) => a.tier - b.tier);
  const idx = treeSkills.findIndex((s) => s.id === skill.id);
  if (idx > 0) {
    const prev = treeSkills[idx - 1];
    if (!save.hasSkill(prev.id)) return { ok: false, reason: "tier", text: `Unlock ${prev.name} first` };
  }
  save.data.skillPoints -= skill.cost;
  save.addSkill(skill.id);
  save.save();
  return { ok: true };
}

export function storeItemById(id) {
  return STORE_ITEMS.find((i) => i.id === id) || storeItem(id);
}

export function nextUnlock(save) {
  return SHIPS.find((s) => !save.isShipUnlocked(s.id)) || null;
}
