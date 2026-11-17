/* ============================================================
   ASSET LOADING — glTF models, textures, normalization
   ============================================================ */

import { engineMounts } from "./ships.js";

const BASE = "assets/models/";

export const PLAYER_MODELS = {
  scout: BASE + "players/scout.glb",
  fighter: BASE + "players/fighter.glb",
  destroyer: BASE + "players/destroyer.glb",
  titan: BASE + "players/titan.glb",
  phantom: BASE + "players/phantom.glb",
  interceptor: BASE + "players/interceptor.glb",
  gunship: BASE + "players/gunship.glb",
  dreadnought: BASE + "players/dreadnought.glb"
};

export const ENEMY_MODELS = {
  drone: BASE + "enemies/drone.glb",
  fighter: BASE + "enemies/fighter.glb",
  bomber: BASE + "enemies/bomber.glb",
  kamikaze: BASE + "enemies/kamikaze.glb",
  escort: BASE + "enemies/escort.glb",
  elite: BASE + "enemies/elite.glb",
  marauder: BASE + "enemies/enemy-1.glb",
  annihilator: BASE + "enemies/enemy-2.glb",
  wraith: BASE + "enemies/enemy-3.glb",
  ironclad: BASE + "enemies/enemy-4.glb"
};

export const MONSTER_MODELS = {
  armabee: BASE + "bosses/armabee.glb",
  armabee_evolved: BASE + "bosses/armabee_evolved.glb",
  alpaking: BASE + "bosses/alpaking.glb",
  alpaking_evolved: BASE + "bosses/alpaking_evolved.glb",
  demon: BASE + "bosses/demon.glb",
  dragon: BASE + "bosses/dragon.glb",
  dragon_evolved: BASE + "bosses/dragon_evolved.glb",
  ghost: BASE + "bosses/ghost.glb",
  ghost_skull: BASE + "bosses/ghost_skull.glb",
  glub: BASE + "bosses/glub.glb",
  glub_evolved: BASE + "bosses/glub_evolved.glb",
  goleling: BASE + "bosses/goleling.glb",
  goleling_evolved: BASE + "bosses/goleling_evolved.glb",
  hywirl: BASE + "bosses/hywirl.glb",
  pigeon: BASE + "bosses/pigeon.glb",
  squidle: BASE + "bosses/squidle.glb",
  tribal: BASE + "bosses/tribal.glb",
  enemy_boss1: BASE + "bosses/enemy-boss1.glb",
  enemy_boss2: BASE + "bosses/enemy-boss2.glb"
};

/**
 * Most player hulls are authored nose +Z; combat points the nose -Z
 * (up-screen), so they need a half turn. The Gunship is authored the
 * other way round, so it stays at zero.
 */
const PLAYER_YAW = {
  scout: Math.PI,
  fighter: Math.PI,
  destroyer: Math.PI,
  // The Titan is authored nose along -X, so a quarter turn (not a half)
  // points it up-screen and puts its four nozzles at the rear.
  titan: -Math.PI / 2,
  phantom: Math.PI,
  interceptor: Math.PI,
  gunship: 0,
  dreadnought: Math.PI
};

/**
 * Enemies fly down-screen (+Z) toward the player. Most of the authored
 * hulls already point +Z; the Ironclad reuses the nose--Z Gunship hull,
 * so it needs a half turn to face its direction of travel.
 */
const ENEMY_YAW = {
  marauder: 0,
  annihilator: 0,
  wraith: 0,
  ironclad: Math.PI
};

/** Bosses face the player (+Z). boss1 is authored facing -Z. */
const MONSTER_YAW = {
  enemy_boss1: Math.PI,
  enemy_boss2: 0
};

export const SHIP_TEXTURES = {
  scout: "assets/textures/scout.png",
  fighter: "assets/textures/fighter.png",
  destroyer: "assets/textures/destroyer.png",
  titan: "assets/textures/titan.png",
  phantom: "assets/textures/phantom.png",
  drone: "assets/textures/enemy_drone.png",
  fighter_enemy: "assets/textures/enemy_fighter.png",
  bomber: "assets/textures/enemy_bomber.png",
  kamikaze: "assets/textures/enemy_kamikaze.png",
  elite: "assets/textures/enemy_elite.png",
  escort: "assets/textures/enemy_escort.png"
};

export const ICONS = {
  heart: "assets/icons/heart.png",
  shield: "assets/icons/shield.png",
  freeze: "assets/icons/freeze.png",
  star: "assets/icons/star.png",
  coin: "assets/icons/coin.png",
  weapon: "assets/icons/weapon.png",
  missile: "assets/icons/missile.png",
  nuke: "assets/icons/nuke.png",
  orbital: "assets/icons/orbital.png",
  timeSlow: "assets/icons/time_slow.png",
  magnet: "assets/icons/magnet.png",
  crown: "assets/icons/premium.png",
  gem: "assets/icons/gem.png",
  sword: "assets/icons/sword.png",
  ring2: "assets/icons/ring2.png",
  shield_crystal: "assets/icons/shield_crystal.png",
  coin_star: "assets/icons/coin_star.png",
  extra_life: "assets/icons/extra_life.png",
  weapon_rare: "assets/icons/weapon_rare.png",
  score: "assets/icons/score.png",
  speed: "assets/icons/speed.png",
  potion_green: "assets/icons/potion_green.png",
  crystal3: "assets/icons/crystal3.png"
};

/* Import a GLB and return a clean container hierarchy. */
export async function importModel(scene, url, onProgress) {
  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    null, "", url, scene,
    (evt) => {
      if (onProgress && evt && evt.lengthComputable && evt.total > 0) {
        onProgress(Math.min(1, evt.loaded / evt.total));
      }
    },
    ".glb"
  );

  const outer = new BABYLON.TransformNode("model_" + Math.random().toString(36).slice(2), scene);
  const pivot = new BABYLON.TransformNode("pivot_" + outer.name, scene);
  pivot.parent = outer;

  const topLevel = result.meshes.filter((m) => !m.parent);
  for (const node of topLevel) node.parent = pivot;

  // include transform nodes/skeletons under the same pivot where needed
  for (const tr of result.transformNodes || []) {
    if (!tr.parent) tr.parent = pivot;
  }

  outer.metadata = {
    pivot,
    meshes: result.meshes,
    animationGroups: result.animationGroups || [],
    skeletons: result.skeletons || [],
    url
  };

  return outer;
}

function measure(outer) {
  try {
    const { min, max } = outer.getHierarchyBoundingVectors(true);
    return {
      min, max,
      width: Math.max(0.001, max.x - min.x),
      height: Math.max(0.001, max.y - min.y),
      depth: Math.max(0.001, max.z - min.z),
      cx: (min.x + max.x) / 2,
      cy: (min.y + max.y) / 2,
      cz: (min.z + max.z) / 2
    };
  } catch (e) {
    return { min: BABYLON.Vector3.Zero(), max: BABYLON.Vector3.Zero(), width: 1, height: 1, depth: 1, cx: 0, cy: 0, cz: 0 };
  }
}

function swapTexture(scene, outer, textureUrl) {
  const tex = new BABYLON.Texture(textureUrl, scene, false, false);
  // Trilinear + anisotropic sampling keeps hull decals crisp when the model
  // is viewed at a shallow angle or scaled up in combat.
  tex.anisotropicFilteringLevel = 8;
  tex.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  const cache = new Map();

  for (const mesh of outer.metadata.meshes) {
    if (!mesh.material) continue;
    let mat = cache.get(mesh.material);
    if (!mat) {
      mat = mesh.material.clone(mesh.material.name + "_tex");
      if (mat.albedoTexture !== undefined) {
        mat.albedoTexture = tex;
        mat.albedoColor = new BABYLON.Color3(1, 1, 1);
        mat.metallic = 0.08;
        mat.roughness = 0.62;
      } else {
        mat.diffuseTexture = tex;
        mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        mat.specularColor = new BABYLON.Color3(0.18, 0.2, 0.24);
      }
      mat.backFaceCulling = false;
      mat.usePhysicalLightFalloff = false;
      cache.set(mesh.material, mat);
    }
    mesh.material = mat;
  }
  return tex;
}

/**
 * Load a player/enemy ship. Returns { outer, glowInfo, size }.
 * yaw: player ships point up-screen (-Z), enemies point down (+Z).
 */
export async function loadShip(scene, modelKey, textureUrl, desiredSize, enemy = false, onProgress) {
  const url = PLAYER_MODELS[modelKey] || ENEMY_MODELS[modelKey];
  if (!url) throw new Error("Unknown ship model: " + modelKey);
  const outer = await importModel(scene, url, onProgress);
  const pb = measure(outer);

  // Normalise by the longest footprint axis so wide wings and long hulls
  // both fit the desired gameplay size.
  const scale = desiredSize / Math.max(pb.width, pb.depth);
  const pivot = outer.metadata.pivot;
  pivot.position = new BABYLON.Vector3(-pb.cx, -pb.cy, -pb.cz);
  outer.scaling = new BABYLON.Vector3(scale, scale, scale);

  const yaw = enemy ? (ENEMY_YAW[modelKey] || 0) : (PLAYER_YAW[modelKey] ?? 0);
  outer.rotation.y = yaw;

  if (textureUrl) swapTexture(scene, outer, textureUrl);

  outer.metadata.size = desiredSize;
  outer.metadata.baseScale = scale;
  outer.metadata.baseYaw = yaw;
  outer.metadata.radius = desiredSize * 0.34;
  outer.metadata.halfLength = desiredSize * 0.5;
  // Engine mounts stay in local model space; the renderers rotate them by
  // the hull's yaw so trails always stream out of the actual thrusters.
  if (!enemy) outer.metadata.engines = engineMounts(modelKey).map((e) => ({ x: e.x, z: e.z }));
  // Hull meshes are the ones painters should tint; enemy and player hulls both
  // expose their full mesh list, so tinting stays backward compatible.
  outer.metadata.tintMeshes = outer.metadata.meshes;
  return outer;
}

/**
 * Resize an already-loaded ship in place (used when the viewport changes and
 * the gameplay scale factor shifts). Keeps hit radius metadata in sync.
 */
export function scaleShip(outer, factor) {
  if (!outer || !Number.isFinite(factor) || factor <= 0 || factor === 1) return;
  outer.scaling.scaleInPlace(factor);
  if (outer.metadata) {
    outer.metadata.size = (outer.metadata.size || 1) * factor;
    outer.metadata.radius = (outer.metadata.radius || 1) * factor;
    outer.metadata.halfLength = (outer.metadata.halfLength || 1) * factor;
  }
}

/**
 * Load a monster (boss/mini-boss). Monsters are upright, normalized to height.
 */
export async function loadMonster(scene, modelKey, desiredSize, onProgress) {
  const url = MONSTER_MODELS[modelKey];
  if (!url) throw new Error("Unknown monster model: " + modelKey);
  const outer = await importModel(scene, url, onProgress);
  const pb = measure(outer);
  const scale = desiredSize / Math.max(pb.height, pb.width * 0.9);

  const pivot = outer.metadata.pivot;
  pivot.position = new BABYLON.Vector3(-pb.cx, -pb.min.y, -pb.cz);
  outer.scaling = new BABYLON.Vector3(scale, scale, scale);
  // Bosses should face the player at +Z; a couple of the authored hulls
  // are modelled the other way round.
  outer.rotation.y = MONSTER_YAW[modelKey] || 0;

  outer.metadata.size = desiredSize;
  outer.metadata.baseYaw = outer.rotation.y;
  outer.metadata.radius = desiredSize * 0.32;
  outer.metadata.animations = outer.metadata.animationGroups || [];

  return outer;
}

/**
 * Tint a loaded ship without replacing its texture. Works for PBR and
 * Standard materials because the tint multiplies the albedo/diffuse map.
 */
export function tintShip(outer, hex, strength = 0.55) {
  if (!outer || !hex) return;
  let tint;
  try {
    tint = BABYLON.Color3.FromHexString(hex);
  } catch (e) {
    return;
  }
  const s = Math.max(0, Math.min(1, strength));
  const k = 1 - s;
  const tinted = new BABYLON.Color3(k + tint.r * s, k + tint.g * s, k + tint.b * s);
  const emissive = new BABYLON.Color3(tint.r * 0.1 * s, tint.g * 0.1 * s, tint.b * 0.1 * s);
  const meshes = outer.metadata?.tintMeshes || outer.metadata?.meshes || [];
  for (const mesh of meshes) {
    const mat = mesh.material;
    if (!mat) continue;
    if (mat.albedoColor !== undefined) {
      mat.albedoColor = tinted;
      if (mat.emissiveColor !== undefined) mat.emissiveColor = emissive;
    } else if (mat.diffuseColor !== undefined) {
      mat.diffuseColor = tinted;
      if (mat.emissiveColor !== undefined) mat.emissiveColor = emissive;
    }
  }
}

export function playIdle(outer, speed = 1) {
  const groups = outer?.metadata?.animationGroups || [];
  const idle = groups.find((g) => /flying_idle|idle/i.test(g.name)) || groups[0];
  if (idle) {
    idle.stop();
    idle.start(true, speed);
  }
}

export function playDeath(outer) {
  const groups = outer?.metadata?.animationGroups || [];
  const death = groups.find((g) => /death/i.test(g.name));
  if (death) {
    groups.forEach((g) => g.stop());
    death.start(false, 1.15);
    return death;
  }
  return null;
}

export function stopAnimations(outer) {
  const groups = outer?.metadata?.animationGroups || [];
  groups.forEach((g) => g.stop());
}

/**
 * Load track helper — aggregates progress across sequential tasks.
 */
export class LoadBatch {
  constructor(count, onProgress) {
    this.count = Math.max(1, count);
    this.done = 0;
    this.onProgress = onProgress || (() => {});
    this.currentRatio = 0;
    this.onProgress(0);
  }
  startNext() {
    this.done += 1;
    this.currentRatio = 0;
    this.emit();
    return (ratio) => {
      this.currentRatio = Math.max(0, Math.min(1, ratio || 0));
      this.emit();
    };
  }
  emit() {
    const total = (this.done + this.currentRatio) / this.count;
    this.onProgress(Math.min(0.99, total));
  }
  complete() {
    this.onProgress(1);
  }
}
