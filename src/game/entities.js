/* ============================================================
   ENTITIES — projectiles, pickups, shared materials
   ============================================================ */

const BULLET_GEO = {
  laser:   { height: 1.5, radius: 0.13 },
  plasma:  { height: 1.8, radius: 0.22 },
  beam:    { height: 3.4, radius: 0.15 },
  rail:    { height: 3.2, radius: 0.26 },
  enemy:   { height: 0.95, radius: 0.17 },
  missile: { height: 1.8, radius: 0.19 },
  orb:     { height: 0.6, radius: 0.26 }
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export class ProjectileSystem {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.list = [];
    this.pools = {};
    this.bases = {};
    this.mats = new Map();
    this.getTarget = null;
    this.bounds = { minZ: -24, maxZ: 16, maxX: 36 };
  }

  material(color) {
    if (this.mats.has(color)) return this.mats.get(color);
    const m = new BABYLON.StandardMaterial("bulletMat_" + color, this.scene);
    m.disableLighting = true;
    const c = BABYLON.Color3.FromHexString(color);
    m.emissiveColor = new BABYLON.Color3(c.r * 1.7, c.g * 1.7, c.b * 1.7);
    m.diffuseColor = new BABYLON.Color3(0, 0, 0);
    m.specularColor = new BABYLON.Color3(0, 0, 0);
    m.backFaceCulling = false;
    this.mats.set(color, m);
    return m;
  }

  _base(kind) {
    if (this.bases[kind]) return this.bases[kind];
    const g = BULLET_GEO[kind] || BULLET_GEO.laser;
    const mesh = BABYLON.MeshBuilder.CreateCapsule(
      "bulletBase_" + kind,
      { height: g.height + g.radius * 2, radius: g.radius, tessellation: 8, subdivisions: 1 },
      this.scene
    );
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.doNotSyncBoundingInfo = true;
    mesh.setEnabled(false);
    this.bases[kind] = mesh;
    this.pools[kind] = this.pools[kind] || [];
    return mesh;
  }

  _acquire(kind, color) {
    const base = this._base(kind);
    const pool = this.pools[kind];
    let mesh = pool.pop();
    if (!mesh) {
      mesh = base.clone("bullet_" + kind);
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.doNotSyncBoundingInfo = true;
    }
    mesh.material = this.material(color);
    mesh.setEnabled(true);
    mesh.isVisible = true;
    return mesh;
  }

  _orient(mesh, vx, vz) {
    const yaw = Math.atan2(vx, vz);
    mesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(yaw, Math.PI / 2, 0);
  }

  fire(o) {
    const kind = o.kind || "laser";
    const color = o.color || "#6fe8ff";
    const mesh = this._acquire(kind, color);
    const scale = o.scale || 1;
    mesh.position.set(o.x, o.y ?? 0.62, o.z);
    mesh.scaling.set(scale, scale, scale);
    this._orient(mesh, o.vx, o.vz);

    const entry = {
      mesh,
      kind,
      color,
      x: o.x,
      z: o.z,
      y: o.y ?? 0.62,
      vx: o.vx,
      vz: o.vz,
      speed: Math.hypot(o.vx, o.vz) || 1,
      damage: o.damage || 1,
      radius: (o.radius || 0.35) * scale,
      hostile: !!o.hostile,
      pierce: o.pierce || 0,
      life: o.life || 7,
      homing: o.homing || 0,
      target: o.target || null,
      crit: !!o.crit,
      dead: false,
      trailTimer: 0,
      scale
    };
    this.list.push(entry);
    return entry;
  }

  remove(entry) {
    if (entry.dead) return;
    entry.dead = true;
    entry.mesh.setEnabled(false);
    const pool = this.pools[entry.kind];
    if (pool && pool.length < 90) pool.push(entry.mesh);
  }

  update(dt, hostileScale = 1) {
    const b = this.bounds;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) {
        this.list.splice(i, 1);
        continue;
      }
      const step = e.hostile ? dt * hostileScale : dt;

      if (e.homing > 0) {
        let t = e.target;
        if (!t || t.dead) {
          t = this.getTarget ? this.getTarget(e) : null;
          e.target = t;
        }
        if (t) {
          const dx = t.x - e.x;
          const dz = t.z - e.z;
          const want = Math.atan2(dx, dz);
          let cur = Math.atan2(e.vx, e.vz);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = e.homing * step;
          cur += clamp(diff, -turn, turn);
          e.vx = Math.sin(cur) * e.speed;
          e.vz = Math.cos(cur) * e.speed;
          this._orient(e.mesh, e.vx, e.vz);
        }
      }

      e.x += e.vx * step;
      e.z += e.vz * step;
      e.life -= step;
      e.mesh.position.set(e.x, e.y, e.z);

      if (e.kind === "missile") {
        e.trailTimer -= step;
        if (e.trailTimer <= 0 && this.fx) {
          e.trailTimer = 0.026;
          this.fx.trail(e.x, e.z, e.hostile ? "#ff9f43" : "#7bd8ff", 0.5);
          this.fx.spawn({
            x: e.x, z: e.z, y: e.y, color: "#ffd9a0", size: 0.5,
            endSize: 0.05, life: 0.22, alpha: 0.7, vx: (Math.random() - 0.5) * 1.5,
            vz: (Math.random() - 0.5) * 1.5
          });
        }
      }

      if (e.kind === "rail") {
        e.trailTimer -= step;
        if (e.trailTimer <= 0 && this.fx) {
          e.trailTimer = 0.03;
          this.fx.spawn({
            x: e.x + (Math.random() - 0.5) * 0.4, z: e.z + 1.4, y: e.y,
            color: "#fff2b0", size: 0.55, endSize: 0.04, life: 0.2, alpha: 0.8
          });
          this.fx.spawn({
            x: e.x, z: e.z + 2.3, y: e.y,
            color: "#ffd166", size: 0.3, endSize: 0.02, life: 0.26, alpha: 0.5
          });
        }
      }

      if (
        e.life <= 0 ||
        e.z < b.minZ || e.z > b.maxZ ||
        e.x < -b.maxX || e.x > b.maxX
      ) {
        this.remove(e);
        this.list.splice(i, 1);
      }
    }
  }

  clearHostile() {
    let n = 0;
    for (const e of this.list) {
      if (e.hostile && !e.dead) {
        if (this.fx) this.fx.spark(e.x, e.z, "#ffd166", 1, 3, 0.3);
        this.remove(e);
        n++;
      }
    }
    this.list = this.list.filter((e) => !e.dead);
    return n;
  }

  clearAll() {
    for (const e of this.list) this.remove(e);
    this.list.length = 0;
  }

  hostileCount() {
    return this.list.reduce((a, e) => a + (e.hostile && !e.dead ? 1 : 0), 0);
  }

  dispose() {
    this.clearAll();
  }
}

/* ------------------------------------------------------------
   PICKUPS
   ------------------------------------------------------------ */

function radialTexture(scene) {
  const size = 96;
  const tex = new BABYLON.DynamicTexture("pickupGlow", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

export class PickupSystem {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.list = [];
    this.matCache = new Map();
    this.glowTex = radialTexture(scene);
    this.time = 0;
  }

  iconMaterial(url) {
    if (this.matCache.has(url)) return this.matCache.get(url);
    const tex = new BABYLON.Texture(url, this.scene, false, false);
    tex.hasAlpha = true;
    const m = new BABYLON.StandardMaterial("pickMat_" + this.matCache.size, this.scene);
    m.disableLighting = true;
    m.diffuseTexture = tex;
    m.opacityTexture = tex;
    m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    m.diffuseColor = new BABYLON.Color3(1, 1, 1);
    m.specularColor = new BABYLON.Color3(0, 0, 0);
    m.backFaceCulling = false;
    m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    m.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    m.disableDepthWrite = true;
    this.matCache.set(url, m);
    return m;
  }

  haloMaterial(color) {
    const key = "halo_" + color;
    if (this.matCache.has(key)) return this.matCache.get(key);
    const m = new BABYLON.StandardMaterial(key, this.scene);
    m.disableLighting = true;
    const c = BABYLON.Color3.FromHexString(color);
    m.emissiveColor = new BABYLON.Color3(c.r * 1.4, c.g * 1.4, c.b * 1.4);
    m.diffuseColor = new BABYLON.Color3(0, 0, 0);
    m.specularColor = new BABYLON.Color3(0, 0, 0);
    m.opacityTexture = this.glowTex;
    m.alphaMode = BABYLON.Engine.ALPHA_ADD;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    this.matCache.set(key, m);
    return m;
  }

  spawn(kind, x, z, opts = {}) {
    const url = opts.icon;
    if (!url) return null;
    const mesh = BABYLON.MeshBuilder.CreatePlane("pickup", { size: opts.size || 1.3 }, this.scene);
    mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    mesh.material = this.iconMaterial(url);
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.position.set(x, 0.85, z);

    let halo = null;
    if (opts.glow) {
      halo = BABYLON.MeshBuilder.CreatePlane("pickupHalo", { size: (opts.size || 1.3) * 2.1 }, this.scene);
      halo.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      halo.material = this.haloMaterial(opts.color || "#ffd166");
      halo.isPickable = false;
      halo.renderingGroupId = 1;
      halo.alwaysSelectAsActiveMesh = true;
      halo.position = mesh.position.clone();
      halo.visibility = 0.55;
    }

    const e = {
      kind,
      mesh,
      halo,
      x,
      z,
      vx: opts.vx || 0,
      vz: opts.vz ?? 1.3,
      value: opts.value || 0,
      data: opts.data || null,
      radius: opts.size || 1.3,
      phase: Math.random() * Math.PI * 2,
      life: opts.life || 14,
      dead: false,
      spin: (Math.random() - 0.5) * 1.6
    };
    this.list.push(e);
    return e;
  }

  update(dt, player, magnet, onCollect) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) {
        this.list.splice(i, 1);
        continue;
      }
      e.life -= dt;
      if (e.life <= 0) {
        this.remove(e);
        continue;
      }

      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < magnet) {
        const pull = 1 - dist / magnet;
        const sp = 6 + 34 * pull;
        e.vx = (dx / Math.max(0.001, dist)) * sp;
        e.vz = (dz / Math.max(0.001, dist)) * sp;
      } else {
        e.vx *= Math.max(0, 1 - dt * 0.8);
        e.vz += (1.3 - e.vz) * Math.min(1, dt * 0.7);
      }

      e.x += e.vx * dt;
      e.z += e.vz * dt;

      if (dist < 1.05 + player.radius * 0.55) {
        if (onCollect) onCollect(e);
        this.remove(e);
        continue;
      }

      const bob = 0.9 + Math.sin(this.time * 3 + e.phase) * 0.16;
      e.mesh.position.set(e.x, bob, e.z);
      e.mesh.rotation.z = Math.sin(this.time * 1.6 + e.phase) * 0.25;
      if (e.halo) {
        e.halo.position.set(e.x, bob, e.z);
        e.halo.visibility = 0.4 + Math.sin(this.time * 4 + e.phase) * 0.16;
      }

      if (e.z > 14) {
        this.remove(e);
        continue;
      }
      if (e.dead) this.list.splice(i, 1);
    }
  }

  remove(e) {
    if (e.dead) return;
    e.dead = true;
    e.mesh.dispose(false, false);
    if (e.halo) e.halo.dispose(false, false);
  }

  dispose() {
    for (const e of this.list) {
      e.mesh.dispose(false, false);
      if (e.halo) e.halo.dispose(false, false);
    }
    this.list.length = 0;
  }
}