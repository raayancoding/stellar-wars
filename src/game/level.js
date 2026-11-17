/* ============================================================
   LEVEL SCENE — combat, waves, bosses, campaign/endless/weekly
   ============================================================ */

import {
  ENEMIES, MINI_BOSSES, BOSS_DEFS, bossForLevel, getLevel,
  POWERUPS, rollPowerup, starsForRun, isoWeek, todayKey, TRAILS
} from "../config.js";
import { getLoadout } from "../core/upgrades.js";
import {
  SHIP_TEXTURES, ICONS, loadShip, playIdle, LoadBatch, tintShip, scaleShip
} from "../core/assets.js";
import { FxSystem, makeStarTexture, makeNebulaTexture, makeGalaxyTexture } from "../core/fx.js";
import { attachCinematicPipeline } from "../core/graphics.js";
import { Hud } from "./hud.js";
import { ProjectileSystem, PickupSystem } from "./entities.js";
import { BossController } from "./boss.js";

const ORTHO_H = 27;
const PLAYER_START_Z = 7.4;
const FIELD_TOP = -14.2;
const FIELD_BOTTOM = 9.2;

const ENEMY_TEXTURE = {
  drone: "drone",
  fighter: "fighter_enemy",
  bomber: "bomber",
  kamikaze: "kamikaze",
  escort: "escort",
  elite: "elite"
};

/** Campaign sector where each late-game hull first appears. */
const ENEMY_MIN_LEVEL = {
  marauder: 9,
  wraith: 14,
  ironclad: 19,
  annihilator: 23
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class LevelScene {
  constructor(engine, app, opts = {}) {
    this.engine = engine;
    this.app = app;
    this.save = app.save;
    this.audio = app.audio;

    this.mode = opts.mode || "campaign";
    this.levelNumber = clamp(opts.level || 1, 1, 35);
    this.levelDef = getLevel(this.levelNumber);
    this.weeklyKey = isoWeek();
    this.dailyKey = todayKey();
    this.dailySeed = 0;
    if (this.mode === "daily") {
      let h = 0;
      for (let i = 0; i < this.dailyKey.length; i++) h = (h * 31 + this.dailyKey.charCodeAt(i)) >>> 0;
      this.dailySeed = h;
      this.levelNumber = 6 + (h % 24);
      this.levelDef = getLevel(this.levelNumber);
    }
    this.loadout = getLoadout(this.save);
    const trailDef = TRAILS.find((t) => t.id === this.save.trailColor()) || TRAILS[0];
    this.trailColor = trailDef.color;
    this.trailAccent = "#ffffff";

    this.disposed = false;
    this.paused = false;
    this.finished = false;
    this.reported = false;
    this.time = 0;
    this.realTime = 0;
    this.phase = "intro";
    this.phaseTimer = 1.6;
    this.wave = this.mode === "endless" ? 0 : 1;
    this.waveLabel = "";
    this.score = 0;
    this.runCoins = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 1;
    this.boss = null;
    this.enemies = [];
    this.actions = [];
    this.actionIndex = 0;
    this.revivesUsed = 0;
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.powerTimers = {};
    this.slowTimer = 0;
    this.freezeTimer = 0;
    this.blackHole = null;
    this.addTimer = 6;
    this.hpScale = 1;
    this.dmgScale = 1;
    this.speedScale = 1;
    this.weeklyDef = null;
    this.weeklyLevel = 24;
    this.bossRushIndex = 1;
    this.bossRushCleared = 0;
    this.bossRushTotal = 5;
    this.drones = [];
    this.enemyBars = new Map();
    this.training = this.mode === "training";
    this.isTouch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || "ontouchstart" in window;
    this.wavePlan = [];
    this.waveSpawnIndex = 0;
    this.waveSpawnTimer = 0;
    this.pendingAfterBoss = null;
    this.ready = false;

    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = new BABYLON.Color4(0.018, 0.035, 0.075, 1);
    this.scene.autoClear = true;
    this.scene.skipFrustumClipping = true;
    this.scene.blockMaterialDirtyMechanism = false;
    this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new BABYLON.Color3(0.035, 0.065, 0.12);
    this.scene.fogStart = 26;
    this.scene.fogEnd = 70;

    this.buildScene();
    this.buildPlayer();
    this.updateDifficulty();

    this.projectiles = new ProjectileSystem(this.scene, this.fx);
    this.pickups = new PickupSystem(this.scene, this.fx);
    this.projectiles.getTarget = (entry) => this.findMissileTarget(entry);

    this.hud = new Hud(this, app);
    this.bindInput();

    this.templates = {};
    this.visualPools = {};
    this.playerVisual = null;

    if (this.mode === "weekly") this.setupWeekly();
  }

  /* ---------------- scene ---------------- */

  get campaignLike() {
    return this.mode === "campaign" || this.mode === "daily";
  }

  buildScene() {
    const scene = this.scene;

    this.camera = new BABYLON.FreeCamera("gameCam", new BABYLON.Vector3(0, 34, 18), scene);
    this.camera.setTarget(new BABYLON.Vector3(0, 0, -2.5));
    this.camera.inputs.clear();
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 160;
    this.cameraBase = this.camera.position.clone();
    this.updateOrtho();

    const hemi = new BABYLON.HemisphericLight("gameHemi", new BABYLON.Vector3(0.15, 1, -0.2), scene);
    hemi.intensity = 1.55;
    hemi.diffuse = new BABYLON.Color3(0.82, 0.9, 1);
    hemi.groundColor = new BABYLON.Color3(0.22, 0.27, 0.44);

    const key = new BABYLON.DirectionalLight("gameKey", new BABYLON.Vector3(-0.35, -1, 0.55), scene);
    key.intensity = 1.35;
    key.diffuse = new BABYLON.Color3(0.86, 0.94, 1);

    const rim = new BABYLON.PointLight("gameRim", new BABYLON.Vector3(-10, 6, 2), scene);
    rim.intensity = 0.85;
    rim.diffuse = new BABYLON.Color3(0.5, 0.34, 1);
    rim.range = 52;

    const quality = this.save.data.settings.quality || "high";
    this.glow = new BABYLON.GlowLayer("gameGlow", scene, {
      mainTextureFixedSize: quality === "high" ? 1024 : 512,
      blurKernelSize: 32
    });
    this.glow.intensity = 0.42;

    this.fx = new FxSystem(scene);

    // star field ground
    const starTex = makeStarTexture(scene, 512, 340);
    starTex.uScale = 9;
    starTex.vScale = 14;
    starTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    starTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    this.starTex = starTex;

    const ground = BABYLON.MeshBuilder.CreatePlane("starGround", { width: 260, height: 260 }, scene);
    ground.rotation.x = Math.PI / 2;
    ground.position.set(0, -3.2, 0);
    ground.isPickable = false;
    ground.renderingGroupId = 0;
    const gm = new BABYLON.StandardMaterial("starGroundMat", scene);
    gm.disableLighting = true;
    gm.emissiveColor = new BABYLON.Color3(1, 1.02, 1.08);
    gm.diffuseTexture = starTex;
    gm.backFaceCulling = false;
    gm.disableDepthWrite = true;
    gm.freeze();
    ground.material = gm;
    this.ground = ground;

    this.spaceLayers = [];
    for (const layer of [
      { name: "nearStars", count: 180, width: 220, height: 220, y: -3.16, alpha: 0.34, uScale: 5, vScale: 7, speed: 0.0025, parallax: 0.045 },
      { name: "farStars", count: 90, width: 240, height: 240, y: -3.12, alpha: 0.24, uScale: 2.5, vScale: 3.5, speed: 0.0012, parallax: 0.018 }
    ]) {
      const texture = makeStarTexture(scene, 512, layer.count);
      texture.uScale = layer.uScale;
      texture.vScale = layer.vScale;
      texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
      texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

      const mesh = BABYLON.MeshBuilder.CreatePlane(layer.name, {
        width: layer.width,
        height: layer.height
      }, scene);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, layer.y, 0);
      mesh.isPickable = false;
      mesh.renderingGroupId = 0;

      const material = new BABYLON.StandardMaterial(layer.name + "Mat", scene);
      material.disableLighting = true;
      material.emissiveColor = new BABYLON.Color3(0.65, 0.78, 1);
      material.diffuseTexture = texture;
      material.opacityTexture = texture;
      material.alphaMode = BABYLON.Engine.ALPHA_ADD;
      material.alpha = layer.alpha;
      material.backFaceCulling = false;
      material.disableDepthWrite = true;
      mesh.material = material;

      this.spaceLayers.push({ mesh, texture, speed: layer.speed, parallax: layer.parallax });
    }

    const nebTex = makeNebulaTexture(scene, 512);
    nebTex.uScale = 2;
    nebTex.vScale = 2;
    this.nebulaTex = nebTex;
    const neb = BABYLON.MeshBuilder.CreatePlane("gameNebula", { width: 220, height: 220 }, scene);
    neb.rotation.x = Math.PI / 2;
    neb.position.set(0, -3.1, 0);
    neb.isPickable = false;
    neb.renderingGroupId = 0;
    const nm = new BABYLON.StandardMaterial("gameNebulaMat", scene);
    nm.disableLighting = true;
    nm.emissiveColor = new BABYLON.Color3(1, 1, 1);
    nm.diffuseTexture = nebTex;
    nm.opacityTexture = nebTex;
    nm.alphaMode = BABYLON.Engine.ALPHA_ADD;
    nm.alpha = 0.42;
    nm.backFaceCulling = false;
    nm.disableDepthWrite = true;
    nm.freeze();
    neb.material = nm;
    this.nebula = neb;

    const galaxy = BABYLON.MeshBuilder.CreatePlane("spiralGalaxy", { width: 26, height: 26 }, scene);
    galaxy.rotation.x = Math.PI / 2;
    galaxy.position.set(-9, -3.04, -21);
    galaxy.isPickable = false;
    galaxy.renderingGroupId = 0;
    const galaxyMat = new BABYLON.StandardMaterial("spiralGalaxyMat", scene);
    galaxyMat.disableLighting = true;
    galaxyMat.emissiveColor = new BABYLON.Color3(0.75, 0.8, 1);
    this.galaxyTexture = makeGalaxyTexture(scene, 512);
    galaxyMat.diffuseTexture = this.galaxyTexture;
    galaxyMat.opacityTexture = galaxyMat.diffuseTexture;
    galaxyMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    galaxyMat.alpha = 0.2;
    galaxyMat.backFaceCulling = false;
    galaxyMat.disableDepthWrite = true;
    galaxy.material = galaxyMat;
    this.galaxy = galaxy;

    // soft horizon glow band
    const band = BABYLON.MeshBuilder.CreatePlane("horizon", { width: 220, height: 16 }, scene);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, -3.05, -18);
    band.isPickable = false;
    band.renderingGroupId = 0;
    const bm = new BABYLON.StandardMaterial("horizonMat", scene);
    bm.disableLighting = true;
    bm.emissiveColor = new BABYLON.Color3(0.16, 0.24, 0.55);
    bm.opacityTexture = makeStarTexture(scene, 256, 0);
    bm.alphaMode = BABYLON.Engine.ALPHA_ADD;
    bm.alpha = 0.18;
    bm.backFaceCulling = false;
    band.material = bm;

    // Additional space volumetrics for a deeper, more cinematic starfield backdrop.

    // Cinematic post-processing (bloom, ACES tone mapping, vignette, grain).
    this.pipeline = attachCinematicPipeline(scene, quality);
  }

  updateOrtho() {
    const w = this.engine.getRenderWidth();
    const h = Math.max(1, this.engine.getRenderHeight());
    const aspect = w / h;
    this.aspect = aspect;
    this.camera.orthoTop = ORTHO_H / 2;
    this.camera.orthoBottom = -ORTHO_H / 2;
    this.camera.orthoLeft = (-ORTHO_H * aspect) / 2;
    this.camera.orthoRight = (ORTHO_H * aspect) / 2;
    this.halfW = clamp((ORTHO_H * aspect) / 2 - 1.15, 4.6, 16);
    // Portrait phones keep the same 27-unit tall field on a narrow screen, so
    // hulls need explicit upscaling to read clearly (and be easy to hit).
    const base = clamp(this.halfW / 11, 0.62, 1.35);
    const aspectBoost = aspect < 1.0
      ? clamp(1.12 + (1.0 - aspect) * 0.6, 1.05, 1.4)
      : 0;
    // Short viewports (landscape phones, small windows) cram the field into
    // fewer pixels, so hulls must fill proportionally more of it.
    const canvas = this.engine.getRenderingCanvas();
    const cssH = (canvas && canvas.clientHeight) || 900;
    const screenBoost = clamp(820 / Math.max(320, cssH), 1, 1.55);
    this.sizeMul = Math.max(base, aspectBoost) * screenBoost;
    this.fieldX = Math.max(2.2, this.halfW - 0.9);
    if (this.player) {
      this.player.x = clamp(this.player.x, -this.fieldX, this.fieldX);
      this.player.z = clamp(this.player.z, -3.5, FIELD_BOTTOM - 0.8);
      this.player.radius = this.loadout.ship.size * this.sizeMul * 0.28;
    }
  }

  resize() {
    const prev = this.sizeMul;
    this.updateOrtho();
    if (prev && Math.abs(this.sizeMul - prev) > 0.001) {
      this.rescaleVisuals(this.sizeMul / prev);
    }
  }

  rescaleVisuals(ratio) {
    if (!ratio || ratio === 1) return;
    if (this.playerVisual) scaleShip(this.playerVisual, ratio);
    for (const key of Object.keys(this.templates || {})) scaleShip(this.templates[key], ratio);
    for (const e of this.enemies || []) {
      if (e.visual) e.visual.scaling.scaleInPlace(ratio);
    }
    for (const d of this.drones || []) {
      if (d.mesh) d.mesh.scaling.scaleInPlace(ratio);
    }
    this._barHeights = null;
  }

  /* ---------------- player ---------------- */

  buildPlayer() {
    const lo = this.loadout;
    this.player = {
      x: 0,
      z: PLAYER_START_Z,
      vx: 0,
      vz: 0,
      radius: lo.ship.size * this.sizeMul * 0.28,
      hp: lo.maxHp,
      maxHp: lo.maxHp,
      shield: lo.maxShield,
      maxShield: lo.maxShield,
      shieldTimer: 0,
      invuln: 1.4,
      revives: lo.revives,
      abilityCharge: 0.35,
      abilityTimer: 0,
      abilityTick: 0,
      abilityId: lo.ability.id,
      missileCd: 0,
      missileAuto: 0,
      coneTimer: 0,
      powers: { ...lo.powers },
      alive: true,
      damageMult: 1,
      fireRateMult: 1,
      speedMult: 1,
      critBonus: 0,
      fireCd: 0,
      shotCount: 0,
      muzzleSide: 1,
      trailTimer: 0,
      deadT: 0
    };
    this.input = {
      keys: new Set(),
      joyX: 0,
      joyY: 0,
      pointerDown: false,
      target: null,
      fire: false
    };
  }

  bindInput() {
    const canvas = this.engine.getRenderingCanvas();

    this._onKeyDown = (e) => {
      if (e.code === "Escape") {
        if (!this.finished) {
          e.preventDefault();
          this.togglePause();
        }
        return;
      }
      if (this.paused || this.finished) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      this.input.keys.add(e.code);
      if (e.code === "Space") this.input.fire = true;
      if (e.repeat) return;
      if (e.code === "KeyQ") this.useMissile();
      else if (e.code === "KeyE") this.useAbility();
      else if (e.code === "KeyR") this.usePower("nuke");
      else if (e.code === "KeyF") this.usePower("orbital");
      else if (e.code === "KeyG") this.usePower("timeSlow");
    };
    this._onKeyUp = (e) => {
      this.input.keys.delete(e.code);
      if (e.code === "Space") this.input.fire = false;
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    this._onPointerDown = (e) => {
      if (e.target !== canvas || this.paused || this.finished) return;
      this.input.pointerDown = true;
      this.setPointerTarget(e);
    };
    this._onPointerMove = (e) => {
      if (!this.input.pointerDown || this.paused || this.finished) return;
      this.setPointerTarget(e);
    };
    this._onPointerUp = () => {
      this.input.pointerDown = false;
    };
    canvas.addEventListener("pointerdown", this._onPointerDown);
    canvas.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
  }

  setPointerTarget(ev) {
    const rect = this.engine.getRenderingCanvas().getBoundingClientRect();
    const vw = this.engine.getRenderWidth();
    const vh = this.engine.getRenderHeight();
    const px = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * vw;
    const py = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * vh;
    const view = this.camera.getViewMatrix();
    const proj = this.camera.getProjectionMatrix();
    const near = BABYLON.Vector3.Unproject(
      new BABYLON.Vector3(px, py, 0),
      vw,
      vh,
      BABYLON.Matrix.Identity(),
      view,
      proj
    );
    // Orthographic rays are parallel: use near→far rather than camera position.
    const far = BABYLON.Vector3.Unproject(
      new BABYLON.Vector3(px, py, 1),
      vw,
      vh,
      BABYLON.Matrix.Identity(),
      view,
      proj
    );
    const dir = far.subtract(near);
    if (Math.abs(dir.y) < 0.0001) return;
    const t = (0.65 - near.y) / dir.y;
    if (t <= 0) return;
    const point = near.add(dir.scale(t));
    this.input.target = {
      x: clamp(point.x, -this.fieldX, this.fieldX),
      z: clamp(point.z, -3.5, FIELD_BOTTOM - 0.9)
    };
  }

  /* ---------------- loading ---------------- */

  async init(onProgress) {
    // Only preload the hulls this mission can actually spawn. Late-game
    // mission types get the heavy enemy set; early sectors stay light.
    const baseKeys = ["drone", "fighter", "bomber", "kamikaze", "escort", "elite"];
    const lateKeys = ["marauder", "wraith", "ironclad", "annihilator"];
    const unlocked =
      this.mode === "endless" || this.mode === "training"
        ? lateKeys
        : lateKeys.filter((k) => this.levelNumber >= ENEMY_MIN_LEVEL[k]);
    const keys = baseKeys.concat(unlocked);
    const batch = new LoadBatch(keys.length + 1, onProgress);

    const ship = this.loadout.ship;
    const playerProgress = batch.startNext();
    this.playerVisual = await loadShip(
      this.scene,
      ship.model,
      SHIP_TEXTURES[ship.texture],
      ship.size * this.sizeMul,
      false,
      playerProgress
    );
    this.playerVisual.position.set(0, 0.65, PLAYER_START_Z);
    this.playerVisual.metadata.baseYaw = this.playerVisual.rotation.y;
    const paint = this.save.paintFor(ship.id);
    if (paint) tintShip(this.playerVisual, paint, 0.55);

    for (const key of keys) {
      const p = batch.startNext();
      const def = ENEMIES[key];
      const template = await loadShip(
        this.scene,
        key,
        SHIP_TEXTURES[ENEMY_TEXTURE[key]],
        def.size * this.sizeMul,
        true,
        p
      );
      template.setEnabled(false);
      this.templates[key] = template;
    }

    this.buildDrones();
    batch.complete();
    this.hud.updateAbilityIcon();
    this.ready = true;
    return this;
  }

  /* ---------------- companion drones ---------------- */

  buildDrones() {
    const lo = this.loadout;
    const total = (lo.droneCount || 0) + (lo.shieldDrones || 0) + (lo.repairDrones || 0);
    if (total <= 0) return;
    const scene = this.scene;
    const makeMat = (hex) => {
      const m = new BABYLON.StandardMaterial("droneMat" + hex, scene);
      m.disableLighting = true;
      m.emissiveColor = BABYLON.Color3.FromHexString(hex);
      m.diffuseColor = new BABYLON.Color3(0, 0, 0);
      m.specularColor = new BABYLON.Color3(0, 0, 0);
      m.freeze();
      return m;
    };
    const mats = {
      attack: makeMat("#6fe8ff"),
      shield: makeMat("#7fa8ff"),
      repair: makeMat("#6ff0a0")
    };
    const roles = [];
    for (let i = 0; i < (lo.droneCount || 0); i++) roles.push("attack");
    for (let i = 0; i < (lo.shieldDrones || 0); i++) roles.push("shield");
    for (let i = 0; i < (lo.repairDrones || 0); i++) roles.push("repair");

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const mesh = BABYLON.MeshBuilder.CreatePolyhedron("wingman_" + i, { type: 1, size: 0.34 }, scene);
      mesh.material = mats[role];
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      mesh.position.set(0, 0.8, PLAYER_START_Z + 1.2);
      const halo = BABYLON.MeshBuilder.CreateTorus("wingmanHalo_" + i, {
        diameter: 0.95, thickness: 0.06, tessellation: 12
      }, scene);
      halo.parent = mesh;
      halo.rotation.x = Math.PI / 2;
      halo.material = mats[role];
      halo.isPickable = false;
      this.drones.push({
        role,
        mesh,
        halo,
        x: 0,
        z: PLAYER_START_Z + 1.2,
        cd: 0.25 + Math.random() * 0.5,
        trail: 0,
        bob: Math.random() * Math.PI * 2
      });
    }
  }

  updateDrones(dt) {
    const p = this.player;
    if (!this.drones.length || !p) return;
    const lo = this.loadout;
    const alive = p.alive && !this.finished;
    const count = this.drones.length;
    const rate = 1 + (lo.droneRate || 0);

    for (let i = 0; i < count; i++) {
      const d = this.drones[i];
      d.mesh.setEnabled(alive);
      if (!alive) continue;

      const a = this.realTime * 1.35 + (i / count) * Math.PI * 2;
      const tx = p.x + Math.cos(a) * 1.55;
      const tz = p.z + 0.85 + Math.sin(a) * 0.6;
      const k = 1 - Math.exp(-dt * 7);
      d.x += (tx - d.x) * k;
      d.z += (tz - d.z) * k;
      d.bob += dt * 3.4;
      d.mesh.position.set(d.x, 0.78 + Math.sin(d.bob) * 0.06, d.z);
      d.mesh.rotation.y = -a * 0.8;
      d.mesh.rotation.z = Math.sin(d.bob * 0.8) * 0.3;
      d.halo.rotation.z += dt * 2.2;

      d.trail -= dt;
      if (d.trail <= 0) {
        d.trail = 0.16;
        this.fx.spawn({
          x: d.x, z: d.z + 0.25, y: 0.5,
          color: d.role === "attack" ? this.trailColor : d.role === "shield" ? "#7fa8ff" : "#6ff0a0",
          size: 0.24, endSize: 0.03, life: 0.22, alpha: 0.65,
          vx: (Math.random() - 0.5) * 0.6, vz: 1.6, drag: 1.5
        });
      }

      if (d.role === "shield") {
        p.shield = Math.min(p.maxShield, p.shield + 1.15 * dt);
        if (p.shield > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt * 1.8);
      } else if (d.role === "repair") {
        p.hp = Math.min(p.maxHp, p.hp + 1.4 * dt);
      } else {
        d.cd -= dt * rate;
        if (d.cd <= 0) {
          const target = this.findDroneTarget(d);
          if (target) {
            d.cd = 0.42;
            const dx = target.x - d.x;
            const dz = target.z - d.z;
            const dist = Math.hypot(dx, dz) || 1;
            const speed = 36;
            this.projectiles.fire({
              x: d.x,
              z: d.z - 0.15,
              vx: (dx / dist) * speed,
              vz: (dz / dist) * speed,
              damage: lo.droneDamage,
              hostile: false,
              kind: "laser",
              color: "#7bf0ff",
              radius: 0.22,
              scale: 0.8,
              pierce: 0,
              life: 2.2
            });
            this.fx.muzzle(d.x, d.z - 0.2, "#7bf0ff", 0.45);
          }
        }
      }
    }
  }

  findDroneTarget(d) {
    if (this.boss && !this.boss.dead && this.boss.spawned && !this.boss.entering) return this.boss;
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(e.x - d.x, e.z - d.z);
      if (dist < bestD) {
        bestD = dist;
        best = e;
      }
    }
    return bestD < 22 ? best : null;
  }

  start() {
    const title = this.mode === "campaign"
      ? `SECTOR ${String(this.levelNumber).padStart(2, "0")}`
      : this.mode === "endless" ? "ENDLESS SURVIVAL"
        : this.mode === "weekly" ? "WEEKLY CHALLENGE"
          : this.mode === "bossrush" ? "BOSS RUSH"
            : this.mode === "daily" ? "DAILY CHALLENGE"
              : this.mode === "training" ? "TRAINING SIMULATOR" : "DEPLOYMENT";

    const sub = this.mode === "campaign"
      ? this.levelDef.name
      : this.mode === "endless" ? "SURVIVE AS LONG AS YOU CAN"
        : this.mode === "weekly" ? this.weeklyDef?.name || "SIGNATURE TARGET"
          : this.mode === "bossrush" ? "FIVE BOSSES · NO REPRIEVE"
            : this.mode === "daily" ? `TODAY'S SIGNATURE · ${this.levelDef.name}`
              : this.mode === "training" ? "INVULNERABLE · NO REWARDS"
                : "ENGAGE";

    this.audio.play("warp");
    this.hud.banner(title, sub, "ENGAGE", "gold", 2.6);
    this.phase = "intro";
    this.phaseTimer = 1.7;
    if (this.mode === "weekly") this.addTimer = 5;
  }

  /* ---------------- difficulty ---------------- */

  updateDifficulty() {
    if (this.campaignLike) {
      this.hpScale = Math.pow(this.levelDef.hpScale, 0.85) * (this.mode === "daily" ? 1.18 : 1);
      this.dmgScale = this.levelDef.dmgScale * (this.mode === "daily" ? 1.1 : 1);
      this.speedScale = this.levelDef.speedScale;
    } else if (this.mode === "endless" || this.mode === "training") {
      const w = Math.max(0, this.wave - 1);
      this.hpScale = 1 + 0.2 * w + 0.018 * w * w;
      this.dmgScale = Math.min(5.2, 1 + 0.075 * w);
      this.speedScale = Math.min(1.72, 1 + 0.015 * w);
    } else {
      const w = 20;
      this.hpScale = 1 + 0.2 * w + 0.018 * w * w;
      this.dmgScale = Math.min(4.8, 1 + 0.075 * w);
      this.speedScale = Math.min(1.65, 1 + 0.015 * w);
    }
  }

  setupWeekly() {
    let hash = 0;
    for (let i = 0; i < this.weeklyKey.length; i++) hash = (hash * 31 + this.weeklyKey.charCodeAt(i)) >>> 0;
    this.weeklyDef = BOSS_DEFS[hash % BOSS_DEFS.length];
    this.weeklyLevel = 20 + (hash % 8);
  }

  /* ---------------- main loop ---------------- */

  render(dt) {
    if (this.disposed) return;
    if (!this.ready) {
      this.scene.render();
      return;
    }
    dt = Math.min(dt || 0.016, 0.05);
    this.realTime += dt;
    if (!this.paused) this.update(dt);
    if (this.hud) this.hud.update(dt);
    this.scene.render();
  }

  update(dt) {
    this.time += dt;
    this.starTex.vOffset += dt * 0.007;
    this.updateSpaceBackdrop(dt);

    if (this.finished) {
      this.clearEnemyBars();
      this.updateFinished(dt);
      this.fx.update(dt);
      this.updateCamera(dt);
      return;
    }

    this.updatePlayer(dt);
    this.updateDrones(dt);
    this.updatePowerTimers(dt);

    const hostileScale = this.enemyTimeScale();
    this.projectiles.update(dt, hostileScale);
    this.updateEnemies(dt * hostileScale);
    this.updateEnemyBars();
    this.updateBoss(dt * hostileScale);
    this.updatePickups(dt);
    this.updateCollisions(dt);
    this.updateFlow(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.updateWaveLabel();
  }

  updateSpaceBackdrop(dt) {
    const playerX = this.player?.x || 0;
    const playerZ = this.player?.z || 0;
    for (const layer of this.spaceLayers) {
      layer.texture.vOffset += dt * layer.speed;
      layer.mesh.position.x = -playerX * layer.parallax;
      layer.mesh.position.z = playerZ * layer.parallax * 0.35;
    }
    this.nebulaTex.uOffset = Math.sin(this.time * 0.025) * 0.025;
    this.nebulaTex.vOffset = this.time * 0.0015;
    this.galaxyTexture.uOffset = Math.sin(this.time * 0.015) * 0.006;
  }

  enemyTimeScale() {
    let s = 1;
    if (this.slowTimer > 0) s *= 0.4;
    if (this.freezeTimer > 0) s *= 0.25;
    return s;
  }

  updateCamera(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.shakeAmt *= Math.max(0, 1 - dt * 4.5);
      const a = this.shakeAmt;
      this.camera.position.x = this.cameraBase.x + (Math.random() - 0.5) * a;
      this.camera.position.y = this.cameraBase.y + (Math.random() - 0.5) * a;
      this.camera.position.z = this.cameraBase.z + (Math.random() - 0.5) * a * 0.6;
      if (this.shakeT <= 0) this.camera.position.copyFrom(this.cameraBase);
    }
  }

  shake(amount, duration = 0.35) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, duration);
  }

  /* ---------------- player ---------------- */

  updatePlayer(dt) {
    const p = this.player;
    const lo = this.loadout;
    const k = this.input.keys;

    if (!p.alive) {
      this.playerVisual.setEnabled(false);
      return;
    }

    const leftPressed = k.has("KeyA") || k.has("ArrowLeft");
    const rightPressed = k.has("KeyD") || k.has("ArrowRight");
    const upPressed = k.has("KeyW") || k.has("ArrowUp");
    const downPressed = k.has("KeyS") || k.has("ArrowDown");

    // Screen-space intent: +x is right, +z is down the screen.
    let sx = Number(rightPressed) - Number(leftPressed) + this.input.joyX;
    let sz = Number(downPressed) - Number(upPressed) + this.input.joyY;
    const keyMove = Math.abs(sx) > 0.001 || Math.abs(sz) > 0.001;
    if (keyMove) this.input.target = null;

    let speed = lo.speed * p.speedMult;
    // Wider screens cover more world units: scale travel speed with the field
    // so a left-to-right pass always takes about the same time.
    speed *= clamp(this.fieldX / 10.5, 1, 2);
    const overdrive = p.abilityId === "overdrive" && p.abilityTimer > 0;
    if (overdrive) speed *= 1.8;
    if (p.abilityId === "warpSurge" && p.abilityTimer > 0) speed *= 1.35;
    if (this.app?.dev && this.app.dev.speed) speed *= this.app.dev.speed;
    if (this.powerTimers.speed > 0) speed *= 2;

    // Map screen intent onto the camera's real axes. The orthographic gameplay
    // camera is mirrored in world X, so this keeps "right arrow = right on
    // screen" true regardless of how the camera is oriented.
    const camRight = this.camera.getDirection(BABYLON.Axis.X);
    const camUp = this.camera.getDirection(BABYLON.Axis.Y);
    const rLen = Math.hypot(camRight.x, camRight.z) || 1;
    const rightX = camRight.x / rLen;
    const rightZ = camRight.z / rLen;
    const downLen = Math.hypot(camUp.x, camUp.z) || 1;
    const downX = -camUp.x / downLen;
    const downZ = -camUp.z / downLen;

    const len = Math.hypot(sx, sz);
    if (len > 1) {
      sx /= len;
      sz /= len;
    }

    let dvx = (sx * rightX + sz * downX) * speed;
    let dvz = (sx * rightZ + sz * downZ) * speed;
    let rate = keyMove ? 34 : 26;

    if (this.input.target) {
      const tx = this.input.target.x - p.x;
      const tz = this.input.target.z - p.z;
      const dist = Math.hypot(tx, tz);
      if (dist > 0.06) {
        // Move at full speed toward the cursor and only bleed off in the last
        // few centimetres, so the hull tracks the pointer almost 1:1.
        const need = dist / Math.max(dt, 0.0001);
        const spd = Math.min(speed * 1.5, need);
        dvx = (tx / dist) * spd;
        dvz = (tz / dist) * spd;
        rate = 52;
      } else {
        this.input.target = null;
        dvx = 0;
        dvz = 0;
        p.vx = 0;
        p.vz = 0;
      }
    }

    // Frame-rate independent easing (crisp start, minimal glide).
    const smooth = 1 - Math.exp(-dt * rate);
    p.vx += (dvx - p.vx) * smooth;
    p.vz += (dvz - p.vz) * smooth;
    if (Math.abs(p.vx) < 0.015) p.vx = 0;
    if (Math.abs(p.vz) < 0.015) p.vz = 0;

    const wantX = p.x + p.vx * dt;
    const wantZ = p.z + p.vz * dt;
    const nextX = clamp(wantX, -this.fieldX, this.fieldX);
    const nextZ = clamp(wantZ, -3.6, FIELD_BOTTOM - 0.9);
    if (nextX !== wantX) p.vx = 0;
    if (nextZ !== wantZ) p.vz = 0;
    p.x = nextX;
    p.z = nextZ;

    // visual
    const v = this.playerVisual;
    v.setEnabled(true);
    v.position.set(p.x, 0.65 + Math.sin(this.realTime * 2.4) * 0.055, p.z);
    v.rotation.y = v.metadata?.baseYaw || 0;
    const strafe = clamp(-p.vx / Math.max(1, speed), -1, 1);
    const targetBank = clamp(strafe * 0.26, -0.34, 0.34);
    v.rotation.z += (targetBank - v.rotation.z) * Math.min(1, dt * 9);
    v.rotation.x = Math.sin(this.realTime * 1.7) * 0.02;
    const cloaked = p.abilityId === "cloak" && p.abilityTimer > 0;
    v.visibility = cloaked ? 0.32 : p.invuln > 0 && Math.floor(this.realTime * 14) % 2 === 0 ? 0.55 : 1;

    // engine trails — one puff per actual nozzle, so the Scout's four engines
    // stream from the wings instead of the middle of the hull.
    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.042;
      const mounts = v.metadata?.engines;
      const shipSize = v.metadata?.size || lo.ship.size * this.sizeMul;
      const nozzles = mounts && mounts.length ? mounts : [{ x: 0, z: -0.47 }];
      const yaw = v.rotation.y;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      for (let i = 0; i < nozzles.length; i++) {
        const m = nozzles[i];
        const accent = nozzles.length > 1 && i % 2 === 1;
        // Engine mounts are local to the hull; rotate them into world space
        // so trails stay glued to the nozzles even on mirrored models.
        const ox = (m.x * cos + m.z * sin) * shipSize;
        const oz = (m.z * cos - m.x * sin) * shipSize;
        this.fx.spawn({
          x: p.x + ox,
          z: p.z + oz,
          y: 0.4,
          color: accent ? this.trailAccent : this.trailColor,
          size: (accent ? 0.3 : 0.38) * this.sizeMul,
          endSize: 0.03,
          life: accent ? 0.2 : 0.24,
          alpha: accent ? 0.55 : 0.85,
          vx: (Math.random() - 0.5) * 0.35,
          vz: 2.8,
          drag: 1.3
        });
      }
    }

    // timers
    p.invuln = Math.max(0, p.invuln - dt);
    p.missileCd = Math.max(0, p.missileCd - dt);
    p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    p.abilityCharge = Math.min(1, p.abilityCharge + dt / Math.max(4, lo.ability.cooldown * (lo.abilityCdMult || 1)));

    if (p.shield < p.maxShield && p.shieldTimer <= 0) {
      p.shield = Math.min(p.maxShield, p.shield + (0.55 + lo.shieldRegen) * dt);
    }
    if (p.hp < p.maxHp && lo.hullRegen > 0) {
      p.hp = Math.min(p.maxHp, p.hp + lo.hullRegen * dt);
    }

    // ability duration
    if (p.abilityTimer > 0) {
      p.abilityTimer -= dt;
      if (p.abilityId === "barrage") {
        p.abilityTick -= dt;
        if (p.abilityTick <= 0) {
          p.abilityTick = 0.26;
          this.fireMissiles(1, true);
        }
      } else if (p.abilityId === "missileRain") {
        p.abilityTick -= dt;
        if (p.abilityTick <= 0) {
          p.abilityTick = 0.075;
          this.dropRainMissile();
        }
      }
      if (p.abilityTimer <= 0) {
        if (p.abilityId === "cloak") p.critBonus = 0;
        this.hud.toast("ULTIMATE ENDED");
      }
    }

    // fire
    const autoFire = this.save.data.settings.autoFire !== false;
    p.fireCd -= dt;
    if ((autoFire || this.input.fire || this.isTouch) && p.fireCd <= 0) {
      const rate = this.currentFireRate();
      p.fireCd = 1 / Math.max(0.5, rate);
      this.shoot();
    }
  }

  currentFireRate() {
    const p = this.player;
    let rate = this.loadout.fireRate;
    if (p.abilityId === "overdrive" && p.abilityTimer > 0) rate *= 1.6;
    if (p.abilityId === "warpSurge" && p.abilityTimer > 0) rate *= 2.2;
    if (this.powerTimers.plasmaStorm > 0) rate *= 2;
    if (this.loadout.weapon.beam) rate *= 0.55;
    return rate * p.fireRateMult;
  }

  shoot() {
    const p = this.player;
    const lo = this.loadout;
    const w = lo.weapon;
    const storm = this.powerTimers.plasmaStorm > 0;
    const boosted = this.powerTimers.weapon > 0;

    p.shotCount = (p.shotCount || 0) + 1;
    const rail = w.railgun && p.shotCount % 4 === 0;

    const crit = Math.random() < lo.critChance + p.critBonus;
    let damage = lo.damage * p.damageMult * (boosted ? 1.5 : 1) * (crit ? lo.critDamage : 1);
    if (w.plasma && !rail) damage *= 1.25;

    const kind = w.beam ? "beam" : w.plasma ? "plasma" : "laser";
    const color = crit ? "#ffd166" : w.beam ? "#a9f7ff" : w.plasma ? "#c98bff" : "#6fe8ff";
    const pierce = (w.pierce || 0) + (w.beam ? 99 : 0);
    let shots = lo.multiShot;
    if (storm) shots = Math.max(3, shots + 1);

    const z = p.z - 1.55;

    if (rail) {
      this.projectiles.fire({
        x: p.x,
        z,
        vx: 0,
        vz: -62,
        damage: damage * 3.4,
        hostile: false,
        kind: "rail",
        color: "#fff2b0",
        pierce: 6,
        radius: 0.52,
        scale: 1.85,
        life: 4
      });
      this.fx.muzzle(p.x, z, "#fff2b0", 1.9);
      this.fx.spark(p.x, z, "#ffd166", 5, 9, 0.42);
      this.fx.spawn({ x: p.x, z, y: 0.3, color: "#ffffff", size: 1.1, endSize: 0.2, life: 0.14, alpha: 0.95 });
      this.audio.play("beam", 1);
      return;
    }

    for (let i = 0; i < shots; i++) {
      const off = shots === 1 ? 0 : (i - (shots - 1) / 2) * 0.55 * this.sizeMul;
      this.projectiles.fire({
        x: p.x + off,
        z,
        vx: shots === 1 ? 0 : off * 2.6,
        vz: -44,
        damage,
        hostile: false,
        kind,
        color,
        pierce,
        radius: w.beam ? 0.62 : w.plasma ? 0.44 : 0.36,
        scale: w.beam ? 1.15 : w.plasma ? 1.05 : 1,
        life: 4
      });
    }

    this.fx.muzzle(p.x, z, color, w.beam ? 1.2 : 0.8);
    if (crit) this.fx.spark(p.x, z, "#ffd166", 2, 5, 0.3);
    this.audio.play(w.beam ? "beam" : w.plasma ? "shootPlasma" : "shoot");
  }

  fireMissiles(count, automatic = false) {
    const p = this.player;
    const lo = this.loadout;
    if (!p.alive) return;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 0.5 * this.sizeMul;
      const target = this.findMissileTarget();
      this.projectiles.fire({
        x: p.x + off,
        z: p.z - 0.6,
        vx: off * 4 + (Math.random() - 0.5) * 2,
        vz: -18,
        damage: lo.missileDamage,
        hostile: false,
        kind: "missile",
        color: "#ffb347",
        radius: 0.5,
        scale: 1,
        homing: automatic ? 5.2 : 4.4,
        target,
        life: 5
      });
    }
    if (!automatic) {
      this.audio.play("missile");
      this.fx.muzzle(p.x, p.z - 1.2, "#ffcf8a", 1.4);
    }
  }

  dropRainMissile() {
    const x = (Math.random() * 2 - 1) * this.fieldX;
    const target = this.findMissileTarget();
    this.projectiles.fire({
      x,
      z: FIELD_TOP - 1.5,
      vx: (Math.random() - 0.5) * 2,
      vz: 22,
      damage: this.loadout.missileDamage * 0.85,
      hostile: false,
      kind: "missile",
      color: "#ffcf6b",
      radius: 0.5,
      scale: 1.1,
      homing: 2.2,
      target,
      life: 5
    });
  }

  findMissileTarget() {
    if (this.boss && !this.boss.dead) return this.boss;
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  useMissile() {
    if (this.paused || this.finished || !this.player.alive) return;
    if (this.player.missileCd > 0) {
      this.audio.play("error");
      return;
    }
    this.player.missileCd = this.loadout.missileCooldown;
    this.fireMissiles(this.loadout.missileCount, false);
  }

  useAbility() {
    const p = this.player;
    if (this.paused || this.finished || !p.alive) return;
    if (p.abilityCharge < 1) {
      this.hud.toast("ULTIMATE NOT READY");
      this.audio.play("error");
      return;
    }
    const ab = this.loadout.ability;
    p.abilityCharge = 0;
    p.abilityTimer = ab.duration;
    p.abilityTick = 0;
    this.audio.play("ultimate");
    this.hud.banner("ULTIMATE", ab.name, ab.desc, "gold", 2.4);
    this.fx.warp(p.x, p.z, "#c07dff", 2);

    switch (ab.id) {
      case "barrage":
        this.fireMissiles(4, true);
        break;
      case "missileRain":
        this.dropRainMissile();
        break;
      case "fortress":
        p.invuln = Math.max(p.invuln, ab.duration);
        p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.4);
        this.fx.spawn({ x: p.x, z: p.z, y: 0.35, color: "#c07dff", size: 2.4, endSize: 9, life: 0.6, ring: true, alpha: 0.8 });
        break;
      case "warpSurge":
        p.invuln = Math.max(p.invuln, 0.6);
        this.fx.warp(p.x, p.z, "#7bf0ff", 2.2);
        this.fx.shockwave(p.x, p.z, "#7bf0ff", 1.1);
        this.audio.play("warp", 1.2);
        break;
      case "cloak":
        p.invuln = Math.max(p.invuln, ab.duration);
        p.critBonus = 0.35;
        break;
      default:
        break;
    }
  }

  usePower(id) {
    const p = this.player;
    if (this.paused || this.finished || !p.alive) return;
    if ((p.powers[id] || 0) <= 0) {
      this.hud.toast("NO CHARGES LEFT");
      this.audio.play("error");
      return;
    }
    p.powers[id]--;

    if (id === "nuke") {
      this.projectiles.clearHostile();
      const dmg = 650 + this.levelNumber * 45;
      for (const e of [...this.enemies]) {
        if (e.dead) continue;
        this.fx.explosion(e.x, e.z, "#ffd166", 1.2);
        e.hp -= dmg;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
      if (this.boss && !this.boss.dead) {
        this.boss.takeDamage(this.boss.maxHp * 0.06);
        this.fx.explosion(this.boss.x, this.boss.z, "#ffd166", 2.4, true);
      }
      this.audio.play("explodeBig");
      this.shake(1.1, 0.7);
      this.hud.banner("NUCLEAR BLAST", "SECTOR PURGED", "ALL HOSTILES DAMAGED", "gold", 2.2);
    } else if (id === "orbital") {
      const target = this.boss && !this.boss.dead ? this.boss : this.strongestEnemy();
      if (target) {
        for (let i = 0; i < 7; i++) {
          this.fx.explosion(
            target.x + rand(-1.4, 1.4),
            target.z + rand(-1.4, 1.4),
            "#7bd8ff",
            1.6,
            i === 6
          );
        }
        this.fx.spawn({ x: target.x, z: target.z, y: 0.4, color: "#ffffff", size: 4, endSize: 18, life: 0.7, ring: true, alpha: 0.8 });
        if (target === this.boss) target.takeDamage(target.maxHp * 0.16);
        else {
          target.hp -= 1800 + this.levelNumber * 140;
          if (target.hp <= 0) this.killEnemy(target, true);
        }
        this.audio.play("explodeBig");
        this.shake(1.3, 0.8);
        this.hud.banner("ORBITAL STRIKE", "TARGET ANNIHILATED", "", "gold", 2.2);
      }
    } else if (id === "timeSlow") {
      this.slowTimer = 5;
      this.fx.spawn({ x: this.player.x, z: this.player.z, y: 0.3, color: "#7bf0ff", size: 2, endSize: 16, life: 0.6, ring: true, alpha: 0.7 });
      this.audio.play("freeze");
      this.hud.banner("TIME SLOW", "HOSTILES DESTABILIZED", "5 SECONDS", "gold", 2);
    }
  }

  strongestEnemy() {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!best || e.maxHp > best.maxHp) best = e;
    }
    return best;
  }

  /* ---------------- damage ---------------- */

  damagePlayer(amount, raw = false) {
    const p = this.player;
    if (!p.alive || this.finished) return;
    if (this.training) return;
    if (this.app?.dev?.god) {
      p.hp = p.maxHp;
      p.shield = p.maxShield;
      p.invuln = Math.max(p.invuln, 0.2);
      return;
    }
    if (this.powerTimers.invincibility > 0) return;
    if (p.abilityId === "cloak" && p.abilityTimer > 0) return;
    if (!raw && p.invuln > 0) return;

    let dmg = amount;
    if (p.shield > 0) {
      this.fx.shieldHit(p.x, p.z, "#7fa8ff");
      p.shield -= dmg;
      p.shieldTimer = this.loadout.shieldDelay;
      if (p.shield < 0) {
        dmg = -p.shield;
        p.shield = 0;
        p.hp -= dmg;
      }
    } else {
      p.hp -= dmg;
    }

    if (!raw) p.invuln = 0.34;
    this.hud.flashDamage();
    this.audio.play("playerHit");
    this.shake(Math.min(0.8, 0.18 + amount * 0.012), 0.28);

    if (p.hp <= 0) this.playerDeath();
  }

  playerDeath() {
    const p = this.player;
    p.hp = 0;
    if (p.revives > 0) {
      p.revives--;
      this.revivesUsed++;
      p.hp = Math.round(p.maxHp * 0.5);
      p.shield = Math.round(p.maxShield * 0.4);
      p.invuln = 3.2;
      p.abilityTimer = 0;
      this.projectiles.clearHostile();
      this.fx.warp(p.x, p.z, "#ff6b8a", 2.4);
      this.fx.spawn({ x: p.x, z: p.z, y: 0.3, color: "#ff6b8a", size: 2, endSize: 12, life: 0.6, ring: true, alpha: 0.8 });
      this.audio.play("powerup");
      this.hud.banner("EMERGENCY CORE", "HULL RESTORED", `${p.revives} CORE${p.revives === 1 ? "" : "S"} REMAINING`, "gold", 2.4);
      return;
    }

    p.alive = false;
    p.deadT = 0;
    if (this.playerVisual) this.playerVisual.setEnabled(false);
    this.projectiles.clearHostile();
    this.fx.explosion(p.x, p.z, "#6fe8ff", 2.2, true);
    this.fx.explosion(p.x, p.z, "#ff8a5b", 1.4, true);
    this.audio.play("explodeBig");
    this.shake(1.6, 1.1);
    this.finish(false);
  }

  finish(win) {
    if (this.finished) return;
    this.finished = true;
    this.win = !!win;
    this.phase = win ? "victory" : "defeat";
    this.finishDelay = win ? 2.6 : 2.0;
    this.input.target = null;
    if (win) {
      this.audio.play("victory");
      this.hud.banner(
        this.mode === "bossrush" ? "BOSS RUSH CLEARED" : "MISSION COMPLETE",
        this.mode === "bossrush" ? `${this.bossRushCleared} BOSSES DESTROYED` : "SECTOR SECURED",
        "RETURNING TO FLEET",
        "gold",
        3
      );
    } else {
      this.projectiles.clearHostile();
      this.audio.play("defeat");
      this.hud.banner("SHIP DESTROYED", "MISSION FAILED", this.mode === "endless" ? "RUN ENDED" : "RETRY AVAILABLE", "warn", 3);
    }
  }

  updateFinished(dt) {
    this.finishDelay -= dt;
    if (this.boss && this.boss.spawned) this.boss.update(dt);
    if (this.win && this.boss && Math.random() < dt * 4) {
      this.fx.explosion(this.boss.x, this.boss.z, "#ffd166", 1.2);
    }
    if (this.finishDelay <= 0 && !this.reported) {
      this.reported = true;
      this.app.finishRun(this.buildResult());
    }
  }

  buildResult() {
    const p = this.player;
    const hullPct = p.maxHp > 0 ? Math.max(0, p.hp) / p.maxHp : 0;
    const stars = this.win ? starsForRun({ win: true, hullPct, revivesUsed: this.revivesUsed }) : 0;
    let bonus = 0;
    if (this.win) {
      if (this.mode === "campaign") {
        bonus = Math.round((150 + this.levelNumber * 26) * (0.7 + stars * 0.32) * this.loadout.coinBoost);
      } else if (this.mode === "daily") {
        bonus = Math.round((260 + this.levelNumber * 30) * (0.7 + stars * 0.32) * this.loadout.coinBoost);
      } else if (this.mode === "endless") {
        bonus = Math.round((this.wave * 45 + this.score * 0.012) * this.loadout.coinBoost);
      } else if (this.mode === "bossrush") {
        bonus = Math.round((this.bossRushCleared * 90 + this.score * 0.01) * this.loadout.coinBoost);
      } else {
        bonus = Math.round(1400 * this.loadout.coinBoost);
      }
    }
    const training = this.mode === "training";
    const coinsOut = training ? 0 : Math.floor(this.runCoins + bonus);
    return {
      mode: this.mode,
      level: this.levelNumber,
      weeklyKey: this.weeklyKey,
      dailyKey: this.dailyKey,
      win: training ? false : this.win,
      training,
      stars: training ? 0 : stars,
      score: Math.floor(this.score),
      kills: this.kills,
      coins: training ? 0 : coinsOut,
      collected: training ? 0 : Math.floor(this.runCoins),
      bonus: training ? 0 : bonus,
      hullPct,
      revivesUsed: this.revivesUsed,
      bestCombo: this.bestCombo,
      wave: this.wave,
      bosses: this.mode === "bossrush" ? this.bossRushCleared : (this.win ? 1 : 0),
      bossRushCleared: this.bossRushCleared,
      bossRushTotal: this.bossRushTotal,
      duration: Math.floor(this.time),
      bossName: this.boss ? this.boss.name : null
    };
  }

  /* ---------------- waves ---------------- */

  beginCampaign() {
    this.actions = [
      { type: "wave", wave: 1 },
      { type: "wave", wave: 2 },
      { type: "mini" },
      { type: "wave", wave: 4 },
      { type: "wave", wave: 5 },
      { type: "boss" }
    ];
    this.actionIndex = -1;
    this.nextAction();
  }

  nextAction() {
    if (this.finished || this.disposed) return;
    this.actionIndex++;
    const action = this.actions[this.actionIndex];
    if (!action) {
      this.finish(true);
      return;
    }
    if (action.type === "wave") this.startWave(action.wave);
    else if (action.type === "mini") this.startMiniBoss();
    else if (action.type === "boss") this.startFinalBoss();
  }

  buildWavePlan(wave) {
    const plan = [];
    let count;
    if (this.campaignLike) {
      count = Math.round((4 + wave * 1.25) * this.levelDef.countScale);
    } else {
      count = Math.min(16, 4 + Math.floor(wave * 0.85));
    }
    const types = ["drone", "drone", "fighter"];
    if (wave >= 2) types.push("kamikaze");
    if (wave >= 3) types.push("fighter", "bomber");
    if (wave >= 4) types.push("escort", "fighter");
    if (wave >= 5) types.push("bomber", "escort", "kamikaze");
    const n = this.campaignLike ? this.levelNumber : wave;
    if (n >= 8) types.push("elite");

    // Late-game hulls join the rotation sector by sector. They hit much
    // harder and soak far more damage than the starter raiders, so open one
    // new class per wave instead of dumping every class into wave 1.
    const lateKeys = ["marauder", "wraith", "ironclad", "annihilator"];
    const openLate = lateKeys.filter((k) => this.templates[k] && n >= ENEMY_MIN_LEVEL[k]);
    const lateCount = Math.min(openLate.length, Math.max(1, wave));
    for (const key of openLate.slice(0, lateCount)) types.push(key, key);
    const pool = types.filter((t) => this.templates[t]);
    const eliteCap = 1 + Math.floor(Math.max(0, n - 8) / 9);
    let elites = 0;
    for (let i = 0; i < count; i++) {
      let type = pick(pool.length ? pool : ["drone"]);
      if (type === "elite") {
        if (elites >= eliteCap || Math.random() < 0.42) {
          type = this.templates.escort ? "escort" : "fighter";
        } else {
          elites++;
        }
      }
      plan.push(type);
    }
    return plan;
  }

  startWave(wave) {
    this.wave = wave;
    this.phase = "wave";
    this.wavePlan = this.buildWavePlan(wave);
    this.waveSpawnIndex = 0;
    this.waveSpawnTimer = 0;
    this.updateDifficulty();
    const waveTitle = this.mode === "campaign" ? `WAVE ${wave}`
      : this.mode === "daily" ? `DAILY WAVE ${wave}` : "INCOMING";
    this.hud.banner(
      waveTitle,
      this.campaignLike ? this.levelDef.name : `WAVE ${wave}`,
      "HOSTILES DETECTED",
      "",
      1.8
    );
    this.audio.play("alarm", 0.65);
  }

  updateWave(dt) {
    if (this.phase !== "wave") return;
    const plan = this.wavePlan;
    this.waveSpawnTimer -= dt;
    const interval = Math.max(0.24, 0.66 - this.wave * 0.018);
    while (this.waveSpawnIndex < plan.length && this.waveSpawnTimer <= 0) {
      const type = plan[this.waveSpawnIndex];
      const margin = 1.2;
      const x = rand(-this.fieldX + margin, this.fieldX - margin);
      const z = FIELD_TOP - rand(0, 2.4);
      this.spawnEnemy(type, x, z);
      this.waveSpawnIndex++;
      this.waveSpawnTimer += interval;
    }
    if (this.waveSpawnIndex >= plan.length) {
      const alive = this.enemies.some((e) => !e.dead);
      if (!alive) {
        const reward = 180 + this.wave * 60;
        this.score += reward;
        this.phase = "break";
        this.phaseTimer = 1.6;
        this.hud.banner("WAVE CLEAR", `WAVE ${this.wave}`, `+${reward} SCORE`, "gold", 1.6);
        this.audio.play("powerup", 0.8);
      }
    }
  }

  startEndlessWave() {
    if (this.finished || this.disposed) return;
    this.wave = Math.max(1, this.wave + 1);
    this.updateDifficulty();
    if (this.wave % 5 === 0) {
      this.startFinalBoss();
    } else if (this.wave % 3 === 0) {
      this.startMiniBoss();
    } else {
      this.startWave(this.wave);
    }
  }

  updateFlow(dt) {
    if (this.mode === "weekly") this.updateWeeklyAdds(dt);

    if (this.phase === "intro") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.campaignLike) this.beginCampaign();
        else if (this.mode === "endless" || this.mode === "training") this.startEndlessWave();
        else if (this.mode === "bossrush") this.startBossRush();
        else this.startFinalBoss();
      }
    } else if (this.phase === "wave") {
      this.updateWave(dt);
    } else if (this.phase === "break") {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.campaignLike) this.nextAction();
        else if (this.mode === "bossrush") this.spawnBossRushBoss();
        else this.startEndlessWave();
      }
    }
  }

  /* ---------------- bosses ---------------- */

  startMiniBoss() {
    if (this.finished || this.disposed || this.boss) return;
    const def = this.campaignLike
      ? this.levelDef.miniBoss
      : MINI_BOSSES[Math.floor(Math.random() * MINI_BOSSES.length)];
    const cycle = this.campaignLike ? this.levelNumber : this.wave;
    const hp = this.campaignLike
      ? Math.round(650 + cycle * 185 + Math.pow(cycle, 1.8) * 18)
      : Math.round(750 + this.wave * 300 + Math.pow(this.wave, 1.7) * 15);
    const boss = new BossController(this, {
      def,
      id: "mini_" + (def.model || "boss"),
      name: def.name,
      model: def.model,
      tone: def.tone,
      size: def.size,
      isMini: true,
      hp,
      level: cycle,
      attacks: cycle >= 6 ? ["fan", "aimed", "ring"] : ["fan", "aimed"]
    });
    this.pendingAfterBoss = "resume";
    this.phase = "bossLoading";
    this.hud.banner("WARNING", def.name.toUpperCase(), "ELITE TARGET INBOUND", "warn", 2.6);
    this.audio.play("bossPhase", 0.8);
    boss.load().then(() => {
      if (this.disposed || this.finished || this.boss) return;
      this.boss = boss;
      boss.spawn();
      this.phase = "mini";
    }).catch((err) => {
      console.error("Mini boss failed to load", err);
      this.pendingAfterBoss = null;
      this.phase = "break";
      this.phaseTimer = 1;
    });
  }

  startFinalBoss() {
    if (this.finished || this.disposed || this.boss) return;
    let def;
    let hp;
    let name;
    if (this.mode === "weekly") {
      def = this.weeklyDef || BOSS_DEFS[0];
      const base = bossForLevel(this.weeklyLevel);
      hp = Math.round(base.hp * 1.35);
      name = def.name;
    } else if (this.mode === "endless") {
      def = bossForLevel(10 + this.wave * 2);
      hp = Math.round(1400 + this.wave * 520);
      name = def.name;
    } else {
      def = this.levelDef.boss;
      hp = def.hp;
      name = def.name;
    }
    const boss = new BossController(this, {
      def,
      id: def.id || "boss",
      name,
      model: def.model,
      tone: def.tone,
      size: def.size,
      isMini: false,
      hp,
      level: this.campaignLike ? this.levelNumber : this.weeklyLevel,
      phaseThresholds: this.campaignLike ? def.phaseThresholds : [0.72, 0.45, 0.2],
      attacks: def.attacks
    });
    this.pendingAfterBoss = "victory";
    this.phase = "bossLoading";
    this.hud.banner(
      "WARNING",
      name.toUpperCase(),
      this.mode === "weekly" ? "WEEKLY SIGNATURE TARGET"
        : this.mode === "daily" ? "DAILY SIGNATURE TARGET" : "FINAL BOSS INBOUND",
      "warn",
      3
    );
    this.audio.play("alarm");
    boss.load().then(() => {
      if (this.disposed || this.finished || this.boss) return;
      this.boss = boss;
      boss.spawn();
      this.phase = "boss";
    }).catch((err) => {
      console.error("Boss failed to load", err);
      this.phase = "break";
      this.phaseTimer = 1;
    });
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    b.update(dt);
    if (!b.removeReady) return;
    const isMini = b.isMini;
    b.dispose();
    this.boss = null;
    this.pendingAfterBoss = null;
    this.clearHostileBullets();
    if (this.disposed || this.finished) return;
    if (this.mode === "weekly") {
      this.finish(true);
      return;
    }
    if (this.mode === "bossrush") {
      this.bossRushCleared = Math.max(this.bossRushCleared, this.bossRushIndex);
      if (this.bossRushIndex >= this.bossRushTotal) {
        this.finish(true);
        return;
      }
      this.bossRushIndex++;
      this.phase = "break";
      this.phaseTimer = 2.4;
      this.hud.toast(`BOSS ${this.bossRushIndex - 1}/${this.bossRushTotal} DESTROYED — NEXT TARGET INBOUND`);
      return;
    }
    if (!isMini && this.campaignLike) {
      this.finish(true);
      return;
    }
    this.phase = "break";
    this.phaseTimer = isMini ? 1.5 : 2.2;
    this.hud.toast(isMini ? "ELITE DESTROYED" : "BOSS DESTROYED — NEXT WAVE INCOMING");
  }

  /* ---------------- boss rush ---------------- */

  startBossRush() {
    if (this.finished || this.disposed) return;
    this.phase = "break";
    this.phaseTimer = 1.4;
    this.hud.banner("BOSS RUSH", "FIVE TARGETS", "NO REPRIEVE", "warn", 2.2);
    this.audio.play("alarm", 0.9);
  }

  spawnBossRushBoss() {
    if (this.finished || this.disposed || this.boss) return;
    const index = this.bossRushIndex;
    if (index > this.bossRushTotal) {
      this.finish(true);
      return;
    }
    const def = bossForLevel(5 + index * 4);
    const hp = Math.round(1500 + index * 1150 + this.score * 0.05);
    const boss = new BossController(this, {
      def,
      id: "rush_" + (def.model || index),
      name: `${index}/${this.bossRushTotal} · ${def.name}`,
      model: def.model,
      tone: def.tone,
      size: def.size * (1 + index * 0.035),
      isMini: false,
      hp,
      level: 6 + index * 4,
      phaseThresholds: [0.74, 0.48, 0.22],
      attacks: index >= 4
        ? [...new Set([...(def.attacks || []), "ring", "beam", "spiral"])]
        : def.attacks
    });
    this.pendingAfterBoss = "resume";
    this.phase = "bossLoading";
    this.hud.banner("WARNING", `TARGET ${index} OF ${this.bossRushTotal}`, def.name.toUpperCase(), "warn", 2.4);
    this.audio.play("bossPhase", 1);
    boss.load().then(() => {
      if (this.disposed || this.finished || this.boss) return;
      this.boss = boss;
      boss.spawn();
      this.phase = "boss";
    }).catch((err) => {
      console.error("Boss rush boss failed to load", err);
      this.phase = "break";
      this.phaseTimer = 1;
    });
  }

  onBossPhase(boss) {
    if (this.disposed) return;
    this.clearHostileBullets();
    this.fx.warp(boss.x, boss.z, boss.tone, 2.6);
    this.fx.explosion(boss.x, boss.z, boss.tone, 1.6, true);
    this.audio.play("bossPhase");
    this.shake(0.9, 0.6);
    this.hud.banner("PHASE SHIFT", boss.name.toUpperCase(), `PHASE ${boss.phase + 1}`, "warn", 2.2);
    if (!boss.isMini && boss.phase >= 1) {
      this.spawnAdds("drone", 2, boss.x, boss.z + 2);
    }
  }

  onBossDeath(boss) {
    if (this.disposed) return;
    this.clearHostileBullets();
    this.score += boss.isMini ? 2600 : 9000;
    this.runCoins += boss.isMini
      ? Math.round(45 * this.loadout.coinBoost)
      : Math.round(160 * this.loadout.coinBoost);
    this.kills++;
    this.audio.play("explodeBig");
    for (const e of [...this.enemies]) {
      if (!e.dead) this.killEnemy(e, true, { noReward: true, noDrop: true });
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.hud.banner(
      boss.isMini ? "ELITE DESTROYED" : "TARGET DESTROYED",
      boss.name.toUpperCase(),
      boss.isMini ? "SECTOR ADVANCE" : "SECTOR SECURED",
      "gold",
      2.6
    );
  }

  updateWeeklyAdds(dt) {
    if (!this.boss || this.boss.dead) return;
    this.addTimer -= dt;
    if (this.addTimer > 0) return;
    this.addTimer = 8.5 + Math.random() * 3;
    this.spawnAdds(pick(["drone", "fighter", "kamikaze"]), 2, rand(-this.fieldX + 2, this.fieldX - 2), FIELD_TOP + 2);
  }

  /* ---------------- enemies ---------------- */

  acquireVisual(type) {
    const pool = this.visualPools[type] || (this.visualPools[type] = []);
    let v = pool.pop();
    if (v) {
      v.setEnabled(true);
      return v;
    }
    const template = this.templates[type];
    if (!template) return null;
    v = template.clone("enemy_" + type);
    v.metadata = { ...(template.metadata || {}) };
    v.setEnabled(true);
    return v;
  }

  releaseVisual(type, v) {
    if (!v) return;
    v.setEnabled(false);
    const pool = this.visualPools[type] || (this.visualPools[type] = []);
    if (pool.length < 16) pool.push(v);
    else v.dispose(false, false);
  }

  spawnEnemy(type, x, z, opts = {}) {
    const def = ENEMIES[type];
    if (!def) return null;
    const visual = this.acquireVisual(type);
    if (!visual) return null;
    const hp = Math.round(def.hp * this.hpScale * (opts.hpMul || 1));
    const sx = clamp(x, -this.fieldX, this.fieldX);
    const e = {
      type,
      def,
      visual,
      baseYaw: this.templates[type] ? this.templates[type].rotation.y : visual.rotation.y,
      x: sx,
      z,
      baseX: sx,
      radius: def.radius * this.sizeMul * 1.05,
      hp,
      maxHp: hp,
      damage: def.damage * this.dmgScale,
      speed: def.speed * this.speedScale,
      movement: def.movement,
      holdZ: def.holdZ ? rand(def.holdZ[0], def.holdZ[1]) : rand(-8, -2.5),
      fireDef: def.fire,
      fireTimer: rand(0.55, 1.7),
      age: 0,
      phase: Math.random() * Math.PI * 2,
      flashTimer: 0,
      dead: false
    };
    visual.position.set(e.x, 0.55, e.z);
    visual.rotation.y = e.baseYaw;
    visual.rotation.z = 0;
    visual.visibility = 1;
    this.enemies.push(e);
    if (!opts.silent) this.audio.play("warp", 0.25);
    return e;
  }

  spawnAdds(type, count, x, z) {
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * 2.3;
      this.spawnEnemy(type, clamp(x + off, -this.fieldX, this.fieldX), clamp(z, FIELD_TOP + 1, 1.5), {
        hpMul: 0.72,
        silent: true
      });
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.age += dt;
      e.flashTimer = Math.max(0, e.flashTimer - dt);
      const mv = e.movement;

      if (mv === "sine") {
        e.z += e.speed * dt;
        e.x = e.baseX + Math.sin(e.age * 1.7 + e.phase) * (1.4 + this.sizeMul * 0.5);
      } else if (mv === "dive") {
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const d = Math.hypot(dx, dz) || 1;
        e.x += (dx / d) * e.speed * dt;
        e.z += (dz / d) * e.speed * dt;
      } else {
        if (e.z < e.holdZ) {
          e.z = Math.min(e.holdZ, e.z + e.speed * dt);
        } else {
          e.z = e.holdZ + Math.sin(e.age * 0.9 + e.phase) * 0.35;
        }
        const amp = mv === "weave" ? 3.1 : mv === "mini" ? 1.2 : 2.1;
        e.x = e.baseX + Math.sin(e.age * (mv === "weave" ? 1.6 : 0.62) + e.phase) * amp;
      }

      e.x = clamp(e.x, -this.fieldX, this.fieldX);

      const v = e.visual;
      if (v) {
        v.position.set(e.x, 0.55 + Math.sin(e.age * 2.1 + e.phase) * 0.05, e.z);
        if (mv === "dive" && p.alive) {
          v.rotation.y = e.baseYaw + Math.atan2(p.x - e.x, p.z - e.z);
        } else {
          v.rotation.y = e.baseYaw;
        }
        v.rotation.z = Math.sin(e.age * 1.4 + e.phase) * 0.1;
        v.visibility = e.flashTimer > 0 ? 0.55 : 1;
      }

      if (e.fireDef && p.alive && e.z > FIELD_TOP + 1.4 && e.z < p.z - 0.5 && !this.finished) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          this.enemyFire(e);
          e.fireTimer = e.fireDef.interval * rand(0.82, 1.25);
        }
      }

      if (e.z > FIELD_BOTTOM + 5) {
        e.dead = true;
        this.releaseVisual(e.type, e.visual);
      }
    }
    if (this.enemies.some((e) => e.dead)) {
      this.enemies = this.enemies.filter((e) => !e.dead);
    }
  }

  /* ---------------- enemy health bars (DOM overlay) ---------------- */

  updateEnemyBars() {
    const layer = this.hud && this.hud.enemyBarsEl;
    if (!layer) return;
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    const cssScale = this.engine.getHardwareScalingLevel();
    const viewport = this.camera.viewport.toGlobal(w, h);
    const transform = this.scene.getTransformMatrix();
    const alive = new Set();
    const tmp = new BABYLON.Vector3();

    for (const e of this.enemies) {
      if (e.dead || !e.visual) continue;
      alive.add(e);
      let el = this.enemyBars.get(e);
      if (!el) {
        el = document.createElement("div");
        el.className = "ebar";
        el.innerHTML = "<span></span>";
        layer.appendChild(el);
        this.enemyBars.set(e, el);
      }

      const worldSize = (e.def.size || 2) * this.sizeMul;
      const barY = 0.55 + this.enemyBarHeight(e.type) * 0.5 + 0.22;
      tmp.set(e.x, barY, e.z);
      const pos = BABYLON.Vector3.Project(tmp, BABYLON.Matrix.Identity(), transform, viewport);
      const pct = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
      const width = Math.round(clamp(worldSize * 7.5, 16, 48));

      if (pos.z < 0 || pos.z > 1) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";
      el.style.width = width + "px";
      el.style.transform =
        `translate(-50%, -50%) translate(${Math.round(pos.x * cssScale)}px, ${Math.round(pos.y * cssScale)}px)`;
      el.style.setProperty("--hp", (pct * 100).toFixed(1) + "%");
      el.classList.toggle("low", pct <= 0.3);
      el.classList.toggle("elite", e.type === "elite");
    }

    for (const [e, el] of this.enemyBars) {
      if (!alive.has(e)) {
        el.remove();
        this.enemyBars.delete(e);
      }
    }
  }

  /** Cached world height per enemy type, used to float the health bar. */
  enemyBarHeight(type) {
    if (!this._barHeights) this._barHeights = {};
    if (this._barHeights[type] == null) {
      const template = this.templates && this.templates[type];
      let height = 1.6;
      if (template) {
        try {
          const bb = template.getHierarchyBoundingVectors(true);
          height = Math.max(0.4, bb.max.y - bb.min.y);
        } catch (err) { /* use fallback */ }
      }
      this._barHeights[type] = height;
    }
    return this._barHeights[type];
  }

  clearEnemyBars() {
    if (!this.enemyBars) return;
    for (const el of this.enemyBars.values()) el.remove();
    this.enemyBars.clear();
  }

  enemyFire(e) {
    const fd = e.fireDef;
    const p = this.player;
    const base = Math.atan2(p.x - e.x, p.z - e.z);
    const color = e.type === "bomber" ? "#ffd166"
      : e.type === "escort" || e.type === "marauder" ? "#c07dff"
        : e.type === "annihilator" ? "#ff9f43"
          : e.type === "ironclad" ? "#ff4f5e"
            : e.type === "elite" ? "#7bf0ff" : "#ff6b8a";
    const n = fd.count || 1;
    const spread = fd.spread || 0.14;
    const total = fd.kind === "fan" ? spread : spread * Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const offset = n === 1 ? 0 : (i - (n - 1) / 2) * (total / Math.max(1, n - 1));
      const a = base + offset;
      this.projectiles.fire({
        x: e.x + Math.sin(a) * 0.8,
        z: e.z + 1,
        vx: Math.sin(a) * fd.speed,
        vz: Math.cos(a) * fd.speed,
        damage: fd.damage * this.dmgScale,
        hostile: true,
        kind: fd.kind === "fan" ? "orb" : "enemy",
        color,
        radius: 0.34,
        scale: fd.kind === "fan" ? 1.05 : 0.95,
        life: 8
      });
    }
    if (Math.random() < 0.55) this.audio.play("eshoot", 0.5);
  }

  killEnemy(e, silent = false, opts = {}) {
    if (!e || e.dead) return;
    e.dead = true;
    this.releaseVisual(e.type, e.visual);
    const color = e.type === "bomber" ? "#ffd166" : e.type === "elite" ? "#7bf0ff" : "#ff9f43";
    this.fx.explosion(e.x, e.z, color, e.type === "elite" ? 1.7 : 0.85, e.type === "elite");
    if (!silent) {
      this.audio.play(e.type === "elite" ? "explodeBig" : "explode", 0.8);
      this.shake(e.type === "elite" ? 0.55 : 0.12, 0.22);
    }
    if (opts.noReward) return;

    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 2.8;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const comboMult = 1 + (this.combo - 1) * 0.1;
    this.score += e.def.score * comboMult;
    const coinBoost = this.powerTimers.coinMult > 0 ? 2 : 1;
    this.runCoins += Math.max(1, Math.round(e.def.coins * this.loadout.coinBoost * coinBoost));
    this.kills++;
    this.player.abilityCharge = Math.min(1, this.player.abilityCharge + 0.035);

    const dropChance = e.def.dropChance != null
      ? e.def.dropChance
      : e.type === "elite" ? 0.85 : 0.1;
    if (!opts.noDrop && Math.random() < dropChance) this.spawnPowerup(e.x, e.z);
  }

  spawnPowerup(x, z) {
    const def = rollPowerup();
    const icon = ICONS[def.icon] || ICONS.star;
    this.pickups.spawn("powerup", x, z, {
      icon,
      size: 1.35,
      glow: true,
      color: def.color,
      data: def,
      vz: 1.1,
      life: 16
    });
  }

  /* ---------------- pickups & power-ups ---------------- */

  updatePickups(dt) {
    const magnet = 3.2 + this.sizeMul * 0.4;
    this.pickups.update(dt, this.player, magnet, (e) => {
      if (e.kind === "powerup" && e.data) this.applyPowerup(e.data);
      else if (e.kind === "coin") this.runCoins += e.value || 1;
      else if (e.kind === "score") this.score += e.value || 100;
    });
  }

  applyPowerup(def) {
    const p = this.player;
    const t = this.powerTimers;
    switch (def.id) {
      case "health":
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
        break;
      case "shield":
        p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.4);
        p.shieldTimer = this.loadout.shieldDelay;
        break;
      case "weapon": t.weapon = 12; break;
      case "score": this.score += 300; break;
      case "freeze": this.freezeTimer = 5; break;
      case "missiles": t.missiles = 8; break;
      case "speed": t.speed = 8; break;
      case "coinMult": t.coinMult = 10; break;
      case "plasmaStorm": t.plasmaStorm = 10; break;
      case "invincibility": t.invincibility = 5; break;
      case "blackHole":
        this.blackHole = { x: p.x, z: p.z - 4, life: 3, tick: 0 };
        this.fx.warp(p.x, p.z - 4, "#a26bff", 3);
        break;
      default:
        break;
    }
    this.audio.play("powerup");
    this.fx.pickup(p.x, p.z, def.color || "#ffd166");
    this.hud.toast(`${def.name.toUpperCase()} — ${def.desc}`);
  }

  updatePowerTimers(dt) {
    const t = this.powerTimers;
    for (const key of Object.keys(t)) {
      if (t[key] > 0) t[key] = Math.max(0, t[key] - dt);
    }
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.freezeTimer = Math.max(0, this.freezeTimer - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    const p = this.player;
    if (t.missiles > 0 && p.alive) {
      p.missileAuto -= dt;
      if (p.missileAuto <= 0) {
        p.missileAuto = 1.35;
        this.fireMissiles(1, true);
      }
    }

    if (this.blackHole) this.updateBlackHole(dt);
  }

  updateBlackHole(dt) {
    const bh = this.blackHole;
    bh.life -= dt;
    bh.tick -= dt;
    const radius = 8.5;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = bh.x - e.x;
      const dz = bh.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < radius) {
        const pull = 1 - d / radius;
        e.x += (dx / d) * (5 + 11 * pull) * dt;
        e.z += (dz / d) * (5 + 11 * pull) * dt;
        e.hp -= 55 * dt;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      const d = Math.hypot(bh.x - this.boss.x, bh.z - this.boss.z);
      if (d < radius + this.boss.radius * 0.5) this.boss.takeDamage(70 * dt);
    }
    if (bh.tick <= 0) {
      bh.tick = 0.14;
      this.fx.spawn({
        x: bh.x, z: bh.z, y: 0.2, color: "#a26bff",
        size: 1.2, endSize: 0.1, life: 0.4, alpha: 0.7
      });
      this.fx.spawn({
        x: bh.x, z: bh.z, y: 0.3, color: "#7b5cff",
        size: 3.4, endSize: 8.5, life: 0.35, ring: true, alpha: 0.5
      });
    }
    if (bh.life <= 0) this.blackHole = null;
  }

  /* ---------------- collisions ---------------- */

  updateCollisions(dt) {
    const p = this.player;
    const boss = this.boss;

    for (const pr of this.projectiles.list) {
      if (pr.dead) continue;
      if (!pr.hostile) {
        if (boss && boss.spawned && !boss.dead && !boss.entering && !boss.removeReady) {
          if (Math.hypot(pr.x - boss.x, pr.z - boss.z) < boss.radius + pr.radius) {
            boss.takeDamage(pr.damage);
            this.fx.spark(pr.x, pr.z, pr.color, 2, 5, 0.3);
            this.audio.play("hit", 0.45);
            if (pr.pierce > 0) pr.pierce--;
            else this.projectiles.remove(pr);
            continue;
          }
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(pr.x - e.x, pr.z - e.z) < e.radius + pr.radius) {
            e.hp -= pr.damage;
            e.flashTimer = 0.11;
            this.fx.spark(pr.x, pr.z, pr.color, 2, 6, 0.28);
            if (e.hp <= 0) this.killEnemy(e);
            if (pr.pierce > 0) {
              pr.pierce--;
            } else {
              this.projectiles.remove(pr);
              break;
            }
          }
        }
      } else if (p.alive) {
        if (Math.hypot(pr.x - p.x, pr.z - p.z) < p.radius + pr.radius) {
          this.damagePlayer(pr.damage);
          this.projectiles.remove(pr);
        }
      }
    }

    if (!p.alive || this.finished) return;

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius * 0.82 + p.radius) {
        this.damagePlayer(e.damage * (e.type === "kamikaze" ? 1.5 : 0.8));
        if (e.type === "kamikaze") {
          this.killEnemy(e, true, { noReward: true, noDrop: true });
        } else {
          e.z -= 1.6;
        }
      }
    }
  }

  clearHostileBullets() {
    return this.projectiles.clearHostile();
  }

  /* ---------------- HUD / lifecycle ---------------- */

  updateWaveLabel() {
    let label;
    if (this.mode === "weekly") {
      label = "WEEKLY <b>BOSS</b>";
    } else if (this.mode === "bossrush") {
      label = `BOSS <b>${Math.min(this.bossRushIndex, this.bossRushTotal)}</b> / ${this.bossRushTotal}`;
    } else if (this.mode === "training") {
      label = `WAVE <b>${Math.max(1, this.wave)}</b>`;
    } else if (this.phase === "mini" || this.phase === "bossLoading" || (this.boss && this.boss.isMini)) {
      label = "ELITE <b>TARGET</b>";
    } else if (this.phase === "boss" || (this.boss && !this.boss.isMini)) {
      label = "FINAL <b>BOSS</b>";
    } else if (this.mode === "campaign") {
      label = `WAVE <b>${this.wave}</b> / 5`;
    } else if (this.mode === "daily") {
      label = `DAILY <b>${this.wave}</b> / 5`;
    } else {
      label = `WAVE <b>${Math.max(1, this.wave)}</b>`;
    }
    if (label !== this.waveLabel) this.waveLabel = label;
  }

  togglePause() {
    if (this.finished || this.disposed) return;
    if (this.paused) {
      this.resume();
      return;
    }
    this.paused = true;
    this.input.joyX = 0;
    this.input.joyY = 0;
    this.input.target = null;
    this.audio.play("click");
    this.hud.showPause();
  }

  resume() {
    if (this.disposed) return;
    this.paused = false;
    this.hud.hidePause();
    this.audio.play("click");
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("resize", this._onResize);
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      canvas.removeEventListener("pointerdown", this._onPointerDown);
      canvas.removeEventListener("pointermove", this._onPointerMove);
    }

    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }
    if (this.projectiles) this.projectiles.dispose();
    if (this.pickups) this.pickups.dispose();
    this.clearEnemyBars();
    if (this.hud) this.hud.dispose();

    for (const d of this.drones || []) {
      if (d.halo) d.halo.dispose(false, false);
      if (d.mesh) d.mesh.dispose(false, false);
    }
    this.drones = [];

    for (const key of Object.keys(this.visualPools || {})) {
      for (const v of this.visualPools[key]) v.dispose(false, false);
      this.visualPools[key].length = 0;
    }
    for (const key of Object.keys(this.templates || {})) {
      const t = this.templates[key];
      if (t) t.dispose(false, false);
    }
    this.templates = {};

    if (this.scene) this.scene.dispose();
    this.scene = null;
  }
}