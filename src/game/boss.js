/* ============================================================
   BOSS — mini-boss & final boss controller (multi-phase AI)
   ============================================================ */

import { loadMonster, playIdle } from "../core/assets.js";

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export class BossController {
  constructor(game, opts) {
    this.game = game;
    this.def = opts.def;
    this.id = opts.id || this.def.id || "boss";
    this.name = opts.name || this.def.name || "BOSS";
    this.isMini = !!opts.isMini;
    this.model = opts.model || this.def.model;
    this.tone = opts.tone || this.def.tone || "#ff5b6b";
    this.maxHp = Math.max(1, Math.round(opts.hp));
    this.hp = this.maxHp;
    this.size = (opts.size || this.def.size || 10) * game.sizeMul * (this.isMini ? 0.62 : 0.68);
    this.radius = Math.max(1.8, this.size * 0.3);
    this.attacks = (opts.attacks || this.def.attacks || ["fan", "aimed"]).slice();
    this.phaseThresholds = opts.phaseThresholds || (this.isMini ? [0.5] : [0.72, 0.45, 0.2]);
    this.phase = 0;
    this.level = opts.level || 1;
    // Late-game bosses hit substantially harder than early ones; dmgScale
    // alone is not enough once the player has maxed hull and shields.
    this.dmg = 8 * (game.dmgScale || 1) * (1 + this.level * 0.025);

    this.x = 0;
    this.z = -6.2;
    this.baseZ = -6.2;
    this.y = 0.35;
    this.time = Math.random() * 10;
    this.phaseTime = 0;
    this.attackTimer = 2.2;
    this.state = null;
    this.lastAttack = "";
    this.dead = false;
    this.deathT = 0;
    this.removeReady = false;
    this.entering = true;
    this.enterT = 0;
    this.charging = false;
    this.beam = null;
    this.beamMat = null;
    this.outer = null;
    this.animPlaying = false;
    this.spawned = false;
  }

  async load() {
    this.outer = await loadMonster(this.game.scene, this.model, this.size);
    this.outer.setEnabled(false);
  }

  spawn() {
    if (!this.outer) return;
    this.spawned = true;
    this.outer.setEnabled(true);
    this.outer.position.set(0, 0.35, -20);
    this.x = 0;
    this.z = -20;
    playIdle(this.outer, 1.05);
    this.game.fx.warp(0, -13, this.tone, 2.4);
    this.game.audio.play("alarm");
    this.entering = true;
    this.enterT = 0;
  }

  get color() {
    return this.tone;
  }

  angleToPlayer() {
    const p = this.game.player;
    return Math.atan2(p.x - this.x, p.z - this.z);
  }

  shot(angle, speed, damage, opts = {}) {
    const vx = Math.sin(angle) * speed;
    const vz = Math.cos(angle) * speed;
    return this.game.projectiles.fire({
      x: this.x + (opts.ox || 0) + Math.sin(angle) * 1.2,
      z: this.z + (opts.oz || 1.6),
      vx,
      vz,
      damage: damage ?? this.dmg,
      hostile: true,
      color: opts.color || this.tone,
      kind: opts.kind || "enemy",
      radius: opts.radius || 0.55,
      scale: opts.scale || 1.15,
      life: 8
    });
  }

  volley(count, spread, speed, damage, opts = {}) {
    const base = this.angleToPlayer();
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread + (opts.jitter ? (Math.random() - 0.5) * opts.jitter : 0);
      this.shot(a, speed, damage, opts);
    }
    this.game.audio.play("eshoot", 1.1);
  }

  ring(count, speed, damage, offset = 0, opts = {}) {
    for (let i = 0; i < count; i++) {
      this.shot(offset + (i / count) * TAU, speed, damage, opts);
    }
    this.game.audio.play("eshoot", 1.2);
  }

  pickAttack() {
    const pool = this.attacks.filter((a) => a !== this.lastAttack);
    const type = (pool.length ? pool : this.attacks)[Math.floor(Math.random() * (pool.length ? pool.length : this.attacks.length))];
    this.lastAttack = type;
    return type;
  }

  startAttack(type) {
    const s = { type, t: 0, dur: 0.6, tick: 0, fired: 0, phase: "start" };
    this.state = s;

    const rank = Math.max(0, Math.floor((this.level - 1) / 8));
    switch (type) {
      case "fan":
        this.volley((this.isMini ? 7 : 9) + rank, 0.13, 15, this.dmg);
        s.dur = 0.45;
        break;
      case "aimed":
        s.dur = 0.75;
        this.game.audio.play("eshoot", 1.1);
        break;
      case "ring":
        this.ring((this.isMini ? 16 : 22) + rank * 2, 11, this.dmg * 0.9, Math.random() * TAU);
        if (!this.isMini && this.phase >= 1) {
          setTimeout(() => {
            if (!this.dead && this.game && !this.game.finished && !this.game.disposed) {
              this.ring(16, 8.5, this.dmg * 0.8, Math.random() * TAU);
            }
          }, 220);
        }
        s.dur = 0.55;
        break;
      case "spiral":
        s.dur = 2.1;
        s.angle = Math.random() * TAU;
        s.dir = Math.random() < 0.5 ? 1 : -1;
        break;
      case "summon":
        this.summon();
        s.dur = 0.9;
        break;
      case "missileRain":
        s.dur = 1.6;
        this.game.audio.play("alarm", 0.8);
        break;
      case "beam":
        s.dur = 2.0;
        s.phase = "warn";
        this.createBeam();
        this.game.audio.play("alarm", 0.9);
        break;
      case "charge":
        s.dur = 2.4;
        s.phase = "warn";
        s.originZ = this.z;
        this.charging = true;
        this.game.audio.play("alarm", 1.1);
        break;
      case "teleport":
        s.dur = 1.1;
        s.phase = "fade";
        break;
      default:
        this.volley(5, 0.16, 13, this.dmg);
        s.dur = 0.5;
        break;
    }

    const speedUp = this.isMini ? 0 : this.phase * 0.28;
    const base = this.isMini ? 2.1 : 2.5;
    const levelRush = Math.max(0, this.level - 10) * 0.018;
    this.attackTimer = Math.max(0.7, base - speedUp - levelRush + Math.random() * 0.7);
  }

  summon() {
    const game = this.game;
    const heavy = this.phase >= 2 ? ["marauder", "wraith", "ironclad"] : [];
    const types = (this.phase >= 2 ? ["fighter", "escort", "kamikaze", ...heavy] : ["drone", "fighter"])
      .filter((t) => game.templates && game.templates[t]);
    if (!types.length) types.push("drone");
    const type = types[Math.floor(Math.random() * types.length)];
    const count = this.isMini ? 2 : 2 + this.phase;
    for (let i = 0; i < count; i++) {
      const x = clamp(this.x + (i - (count - 1) / 2) * 3.4, -game.halfW + 2, game.halfW - 2);
      game.spawnAdds(type, 1, x, this.z + 1.5 + Math.random() * 1.5);
    }
    this.game.audio.play("warp");
    this.game.fx.warp(this.x, this.z, this.tone, 1.5);
  }

  updateState(dt) {
    const s = this.state;
    if (!s) return;
    s.t += dt;
    const p = this.game.player;

    switch (s.type) {
      case "aimed": {
        s.tick -= dt;
        if (s.tick <= 0 && s.fired < 3) {
          s.tick = 0.16;
          s.fired++;
          this.volley(this.isMini ? 1 : 2, 0.07, 18, this.dmg * 0.9, { jitter: 0.05 });
        }
        break;
      }
      case "spiral": {
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick = 0.075;
          s.angle += 0.34 * s.dir;
          const arms = this.isMini ? 1 : 2 + (this.phase >= 2 ? 1 : 0);
          for (let a = 0; a < arms; a++) {
            this.shot(s.angle + (a / arms) * TAU, 11.5, this.dmg * 0.85, { radius: 0.5 });
          }
          if (Math.random() < 0.5) this.game.audio.play("eshoot", 0.7);
        }
        break;
      }
      case "missileRain": {
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick = 0.13;
          this.game.audio.play("eshoot", 0.7);
          const x = (Math.random() * 2 - 1) * (this.game.halfW - 2);
          this.game.fx.spawn({
            x, z: 8.5, y: 0.12, color: "#ff5b6b", size: 0.7, endSize: 3.4,
            life: 0.55, ring: true, alpha: 0.7, rotation: 0
          });
          this.game.projectiles.fire({
            x, z: this.game.fieldTop - 2.5, vx: 0, vz: 21, damage: this.dmg * 1.1,
            hostile: true, color: this.tone, kind: "missile", radius: 0.6, scale: 1.25, life: 7
          });
        }
        break;
      }
      case "beam": {
        if (s.phase === "warn") {
          if (s.t > 0.85) {
            s.phase = "fire";
            this.game.audio.play("beam", 1.4);
            this.game.shake(0.5, 0.5);
          }
        } else if (s.phase === "fire") {
          if (p.alive && Math.abs(p.x - this.x) < 1.9 && s.t < 1.75) {
            this.game.damagePlayer(this.dmg * 0.8 * dt, true);
          }
          if (s.t > 1.8) s.phase = "done";
        }
        this.updateBeamVisual(s);
        break;
      }
      case "charge": {
        if (s.phase === "warn" && s.t > 0.55) {
          s.phase = "dash";
          this.game.audio.play("warp");
        } else if (s.phase === "dash") {
          this.z = Math.min(this.game.fieldBottom - 2, this.z + 30 * dt);
          if (s.t > 1.35) {
            s.phase = "return";
            this.charging = false;
          }
        } else if (s.phase === "return") {
          this.z += (this.baseZ - this.z) * Math.min(1, dt * 4.5);
        }
        if (s.t > 1.2 && s.phase !== "return") {
          s.phase = "return";
          this.charging = false;
        }
        break;
      }
      case "teleport": {
        if (s.phase === "fade") {
          if (this.outer) this.outer.visibility = Math.max(0, 1 - s.t / 0.25);
          if (s.t > 0.32) {
            s.phase = "move";
            this.x = (Math.random() * 2 - 1) * Math.min(this.game.halfW * 0.62, 9);
            this.z = -7.5 + Math.random() * 2.5;
            if (this.outer) this.outer.visibility = 1;
            this.game.fx.warp(this.x, this.z, this.tone, 1.8);
            this.ring(14, 9, this.dmg * 0.7, Math.random() * TAU);
            this.game.audio.play("warp", 1.2);
          }
        }
        break;
      }
      default:
        break;
    }

    if (s.t >= s.dur) {
      if (s.type === "beam") this.destroyBeam();
      if (s.type === "charge") {
        this.charging = false;
        this.z = this.baseZ;
      }
      if (s.type === "teleport" && this.outer) this.outer.visibility = 1;
      this.state = null;
    }
  }

  createBeam() {
    this.destroyBeam();
    const scene = this.game.scene;
    const length = this.game.fieldBottom - this.z + 12;
    const beam = BABYLON.MeshBuilder.CreateBox("bossBeam", { width: 3.8, height: 0.5, depth: length }, scene);
    beam.isPickable = false;
    beam.renderingGroupId = 2;
    beam.alwaysSelectAsActiveMesh = true;
    beam.position.set(this.x, 0.75, this.z + length / 2 - 1);
    beam.scaling.x = 0.14;
    const m = new BABYLON.StandardMaterial("bossBeamMat", scene);
    m.disableLighting = true;
    const c = BABYLON.Color3.FromHexString(this.tone);
    m.emissiveColor = new BABYLON.Color3(c.r * 2.1 + 0.2, c.g * 2.1 + 0.1, c.b * 2.1 + 0.1);
    m.diffuseColor = new BABYLON.Color3(0, 0, 0);
    m.specularColor = new BABYLON.Color3(0, 0, 0);
    m.alphaMode = BABYLON.Engine.ALPHA_ADD;
    m.alpha = 0.35;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    beam.material = m;
    this.beam = beam;
    this.beamMat = m;
  }

  updateBeamVisual(s) {
    if (!this.beam) return;
    if (s.phase === "warn") {
      this.beam.scaling.x = 0.14 + Math.sin(s.t * 34) * 0.05;
      if (this.beamMat) this.beamMat.alpha = 0.3 + Math.sin(s.t * 26) * 0.18;
    } else if (s.phase === "fire") {
      this.beam.scaling.x = 1.2;
      if (this.beamMat) this.beamMat.alpha = 0.85;
    } else {
      this.beam.scaling.x = Math.max(0, this.beam.scaling.x - 0.1);
      if (this.beamMat) this.beamMat.alpha = Math.max(0, this.beamMat.alpha - 0.08);
    }
  }

  destroyBeam() {
    if (this.beam) {
      this.beam.dispose(false, false);
      if (this.beamMat) this.beamMat.dispose();
      this.beam = null;
      this.beamMat = null;
    }
  }

  takeDamage(amount) {
    if (this.dead || this.entering) return;
    this.hp -= amount;
    const frac = this.hp / this.maxHp;
    while (this.phase < this.phaseThresholds.length && frac <= this.phaseThresholds[this.phase]) {
      this.phase++;
      this.game.onBossPhase(this);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    this.state = null;
    this.charging = false;
    this.destroyBeam();
    this.game.onBossDeath(this);
  }

  update(dt) {
    if (this.removeReady) return;

    if (this.dead) {
      this.deathT += dt;
      if (this.outer) {
        this.outer.visibility = Math.max(0.05, 1 - this.deathT / 2.2);
        this.outer.position.y = 0.35 + this.deathT * 0.4;
      }
      if (Math.random() < dt * 12) {
        this.game.fx.explosion(
          this.x + (Math.random() - 0.5) * this.size * 0.7,
          this.z + (Math.random() - 0.5) * 1.6,
          Math.random() > 0.5 ? this.tone : "#ffd166",
          1.2 + Math.random(),
          Math.random() < 0.25
        );
      }
      if (this.deathT > (this.isMini ? 1.7 : 2.5)) {
        this.removeReady = true;
        if (this.outer) this.outer.setEnabled(false);
        this.game.fx.explosion(this.x, this.z, this.tone, 3.2, true);
        this.game.audio.play("explodeBig");
        this.game.shake(1.4, 0.8);
      }
      return;
    }

    this.time += dt;

    if (this.entering) {
      this.enterT += dt;
      const k = Math.min(1, this.enterT / 1.5);
      const ease = 1 - Math.pow(1 - k, 3);
      this.z = -20 + (this.baseZ + 20) * ease;
      this.x = Math.sin(this.enterT * 5) * (1 - k) * 2;
      if (this.outer) {
        this.outer.position.set(this.x, this.y, this.z);
        this.outer.rotation.y = Math.sin(this.enterT * 2) * 0.08;
      }
      if (k >= 1) {
        this.entering = false;
        this.attackTimer = 1.6;
        this.game.hud.banner("HOSTILE SIGNATURE", this.name, this.isMini ? "ELITE TARGET" : "FINAL BOSS", this.isMini ? "warn" : "warn", 2.8);
      }
      return;
    }

    if (!this.charging) {
      const holding = this.state && (
        (this.state.type === "teleport" && this.state.phase !== "start") ||
        this.state.type === "beam"
      );
      if (!holding) {
        this.x = Math.sin(this.time * 0.42) * Math.min(this.game.halfW * 0.52, 8.5);
        this.z = this.baseZ + Math.sin(this.time * 0.8) * 0.75;
        this.x += Math.sin(this.time * 1.7) * 0.55;
      }
    }

    if (this.outer) {
      this.outer.position.set(this.x, this.y + Math.sin(this.time * 1.8) * 0.12, this.z);
      this.outer.rotation.y = Math.sin(this.time * 0.7) * 0.1;
      this.outer.rotation.z = Math.sin(this.time * 1.3) * 0.035;
    }

    if (this.state) {
      this.updateState(dt);
    } else {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.startAttack(this.pickAttack());
      }
    }
  }

  dispose() {
    this.destroyBeam();
    if (this.outer) {
      this.outer.dispose(false, false);
      this.outer = null;
    }
    this.spawned = false;
  }
}