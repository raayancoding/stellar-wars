/* ============================================================
   FX — procedural textures, pooled sprites, explosions, trails
   ============================================================ */

export function makeStarTexture(scene, size = 512, count = 260) {
  const tex = new BABYLON.DynamicTexture("starTex", { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.5 + 0.35;
    const a = Math.random() * 0.7 + 0.2;
    const tint = Math.random();
    const col = tint > 0.86 ? `rgba(150,200,255,${a})` : tint > 0.7 ? `rgba(255,240,210,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint nebula wisps
  for (let i = 0; i < 7; i++) {
    const g = ctx.createRadialGradient(
      Math.random() * size, Math.random() * size, 0,
      Math.random() * size, Math.random() * size, size * 0.32
    );
    g.addColorStop(0, i % 2 ? "rgba(70,60,160,0.055)" : "rgba(40,120,180,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  tex.update(false);
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.hasAlpha = true;
  return tex;
}

export function makeNebulaTexture(scene, size = 512) {
  const tex = new BABYLON.DynamicTexture("nebulaTex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  const blobs = [
    ["rgba(110,60,220,0.5)", 0.68, 0.3, 0.34],
    ["rgba(30,130,220,0.4)", 0.28, 0.42, 0.3],
    ["rgba(220,60,150,0.22)", 0.55, 0.72, 0.24],
    ["rgba(40,230,200,0.12)", 0.15, 0.72, 0.22],
    ["rgba(160,100,255,0.3)", 0.86, 0.62, 0.28]
  ];
  for (const [color, x, y, r] of blobs) {
    const px = x * size;
    const py = y * size;
    const rad = r * size;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color.replace(/[\d.]+\)$/, "0.12)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

export function makeGalaxyTexture(scene, size = 512) {
  const tex = new BABYLON.DynamicTexture("galaxyTex", { width: size, height: size }, scene, true);
  const ctx = tex.getContext();
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.62);

  const halo = ctx.createRadialGradient(0, 0, size * 0.015, 0, 0, size * 0.46);
  halo.addColorStop(0, "rgba(255,230,190,0.95)");
  halo.addColorStop(0.06, "rgba(255,180,120,0.7)");
  halo.addColorStop(0.22, "rgba(184,115,255,0.3)");
  halo.addColorStop(0.58, "rgba(67,123,255,0.11)");
  halo.addColorStop(1, "rgba(40,70,180,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(-size / 2, -size / 2, size, size);

  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const progress = i / 260;
      const angle = progress * Math.PI * 4 + arm * (Math.PI * 2 / 3);
      const radius = size * (0.025 + progress * 0.4);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = arm === 1 ? "rgba(100,205,255,0.3)" : "rgba(193,133,255,0.32)";
    ctx.lineWidth = size * 0.03;
    ctx.lineCap = "round";
    ctx.shadowColor = arm === 1 ? "#4daaff" : "#b56aff";
    ctx.shadowBlur = size * 0.045;
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 420; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = size * Math.sqrt(Math.random()) * 0.44;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.62;
    const dot = Math.random() > 0.92 ? 2 : 0.8;
    ctx.fillStyle = `rgba(220,235,255,${0.25 + Math.random() * 0.65})`;
    ctx.fillRect(x, y, dot, dot);
  }

  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

function makeRadialTexture(scene) {
  const size = 128;
  const tex = new BABYLON.DynamicTexture("fxRadial", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.92)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

function makeRingTexture(scene) {
  const size = 128;
  const tex = new BABYLON.DynamicTexture("fxRing", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.24, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.72, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

function makeGlowTexture(scene) {
  const size = 64;
  const tex = new BABYLON.DynamicTexture("fxGlow", { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.update(false);
  tex.hasAlpha = true;
  return tex;
}

/* shared material helpers so we don't create hundreds of materials */
const matCache = new WeakMap();

function spriteMaterial(scene, color, tex, additive) {
  let cache = matCache.get(scene);
  if (!cache) {
    cache = new Map();
    matCache.set(scene, cache);
  }
  const key = color + (additive ? "|a" : "|n");
  if (cache.has(key)) return cache.get(key);
  const m = new BABYLON.StandardMaterial("fxMat_" + key, scene);
  m.disableLighting = true;
  m.emissiveColor = BABYLON.Color3.FromHexString(color);
  m.diffuseColor = new BABYLON.Color3(0, 0, 0);
  m.specularColor = new BABYLON.Color3(0, 0, 0);
  m.opacityTexture = tex;
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.alphaMode = additive ? BABYLON.Engine.ALPHA_ADD : BABYLON.Engine.ALPHA_COMBINE;
  cache.set(key, m);
  return m;
}

export class FxSystem {
  constructor(scene, glowLayer = null) {
    this.scene = scene;
    this.glowLayer = glowLayer;
    this.radial = makeRadialTexture(scene);
    this.ring = makeRingTexture(scene);
    this.glow = makeGlowTexture(scene);
    this.pool = [];
    this.active = [];
    this.trails = [];
    this.count = 0;
  }

  _getMesh() {
    let mesh = this.pool.pop();
    if (!mesh) {
      mesh = BABYLON.MeshBuilder.CreatePlane("fxSprite", { size: 1 }, this.scene);
      mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.doNotSyncBoundingInfo = true;
      if (this.glowLayer) this.glowLayer.addExcludedMesh(mesh);
    }
    mesh.setEnabled(true);
    mesh.isVisible = true;
    return mesh;
  }

  _release(entry) {
    entry.mesh.setEnabled(false);
    this.pool.push(entry.mesh);
  }

  spawn({
    x, y = 0.15, z,
    color = "#ffffff",
    size = 1,
    endSize = null,
    life = 0.4,
    vx = 0, vy = 0, vz = 0,
    drag = 2.2,
    alpha = 1,
    additive = true,
    ring = false,
    rotation = 0
  }) {
    if (this.active.length > 260) return null;
    const mesh = this._getMesh();
    const mat = spriteMaterial(this.scene, color, ring ? this.ring : this.radial, additive);
    mesh.material = mat;
    mesh.position.set(x, y, z);
    mesh.scaling.set(size, size, size);
    mesh.rotation.z = rotation;
    mesh.visibility = alpha;
    mesh.isVisible = true;
    const entry = {
      mesh, life, maxLife: life, size, endSize: endSize ?? size,
      vx, vy, vz, drag, alpha0: alpha, ring
    };
    this.active.push(entry);
    return entry;
  }

  spark(x, z, color = "#ffffff", amount = 3, speed = 8, size = 0.35) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.spawn({
        x, z,
        y: 0.2 + Math.random() * 0.3,
        color,
        size: size * (0.6 + Math.random() * 0.8),
        endSize: 0.05,
        life: 0.2 + Math.random() * 0.25,
        vx: Math.cos(a) * s,
        vz: Math.sin(a) * s,
        drag: 5
      });
    }
  }

  muzzle(x, z, color = "#7bf0ff", size = 0.9) {
    this.spawn({
      x, z, y: 0.3, color, size, endSize: 0.2, life: 0.09, alpha: 0.95
    });
  }

  explosion(x, z, color = "#ff9f43", scale = 1, big = false) {
    const n = big ? 8 : 5;
    // flash
    this.spawn({
      x, z, y: 0.3, color: "#ffffff", size: 1.6 * scale, endSize: 4.8 * scale,
      life: 0.22, alpha: 1
    });
    this.spawn({
      x, z, y: 0.25, color, size: 2.2 * scale, endSize: 7.5 * scale,
      life: big ? 0.6 : 0.42, alpha: 0.75
    });
    this.spawn({
      x, z, y: 0.2, color: "#ffffff", size: 0.9 * scale, endSize: (big ? 17 : 9) * scale,
      life: big ? 0.5 : 0.34, ring: true, alpha: big ? 0.6 : 0.38
    });
    for (let i = 0; i < n * 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 18 : 11) * (0.25 + Math.random());
      this.spawn({
        x, z,
        y: 0.2 + Math.random() * 0.8,
        color: Math.random() > 0.55 ? color : "#fff2c0",
        size: (big ? 0.9 : 0.55) * (0.5 + Math.random()),
        endSize: 0.05,
        life: 0.28 + Math.random() * (big ? 0.6 : 0.35),
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: Math.random() * 6,
        drag: big ? 1.6 : 2.8
      });
    }
    if (big) {
      this.debris(x, z, color, scale);
    }
  }

  /** Metallic hull fragments and smoke, used by big explosions and deaths. */
  debris(x, z, color = "#ff9f43", scale = 1) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 9 + Math.random() * 18;
      this.spawn({
        x: x + (Math.random() - 0.5) * scale,
        z: z + (Math.random() - 0.5) * scale,
        y: 0.2 + Math.random() * 1.2,
        color: Math.random() > 0.5 ? "#5b6b8f" : Math.random() > 0.5 ? color : "#9fb4d8",
        size: (0.45 + Math.random() * 0.75) * scale,
        endSize: 0.12,
        life: 0.75 + Math.random() * 0.8,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: 4 + Math.random() * 11,
        drag: 0.55,
        additive: false
      });
    }
    for (let i = 0; i < 5; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.5 * scale,
        z: z + (Math.random() - 0.5) * 1.5 * scale,
        y: 0.15,
        color,
        size: 0.4,
        endSize: 2.2 * scale,
        life: 0.4 + Math.random() * 0.3,
        alpha: 0.5,
        vx: (Math.random() - 0.5) * 7,
        vz: (Math.random() - 0.5) * 7,
        drag: 1.1
      });
    }
  }

  /** Blue-white impact flash when a shield absorbs a hit. */
  shieldHit(x, z, color = "#7fa8ff") {
    this.spawn({ x, z, y: 0.55, color: "#ffffff", size: 0.7, endSize: 2.6, life: 0.16, alpha: 0.9 });
    this.spawn({ x, z, y: 0.5, color, size: 1.1, endSize: 3.6, life: 0.3, ring: true, alpha: 0.7 });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x, z, y: 0.45 + Math.random() * 0.3, color,
        size: 0.32, endSize: 0.05, life: 0.22,
        vx: Math.cos(a) * (4 + Math.random() * 5),
        vz: Math.sin(a) * (4 + Math.random() * 5),
        drag: 4
      });
    }
  }

  /** Expanding shockwave ring, used by ultimates and phase shifts. */
  shockwave(x, z, color = "#ffffff", scale = 1) {
    this.spawn({ x, z, y: 0.22, color, size: 1.2 * scale, endSize: 10 * scale, life: 0.55, ring: true, alpha: 0.65 });
    this.spawn({ x, z, y: 0.25, color: "#ffffff", size: 0.8 * scale, endSize: 4 * scale, life: 0.3, alpha: 0.5 });
  }

  trail(x, z, color = "#6fe8ff", size = 0.55) {
    this.spawn({
      x, z, y: 0.2, color, size, endSize: 0.05,
      life: 0.3, alpha: 0.75, vx: (Math.random() - 0.5) * 1.6, vz: 3 + Math.random() * 2
    });
  }

  pickup(x, z, color = "#ffd166") {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
      this.spawn({
        x, z, y: 0.3, color, size: 0.5, endSize: 0.05,
        life: 0.4, vx: Math.cos(a) * 5, vz: Math.sin(a) * 5, drag: 3
      });
    }
    this.spawn({ x, z, y: 0.3, color, size: 1, endSize: 3.5, life: 0.35, ring: true, alpha: 0.7 });
  }

  warp(x, z, color = "#a26bff", scale = 1) {
    for (let i = 0; i < 4; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 3, z: z + (Math.random() - 0.5) * 2,
        y: 0.2, color, size: 1.5 * scale, endSize: 0.2, life: 0.35,
        vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, drag: 2
      });
    }
    this.spawn({ x, z, y: 0.2, color, size: 2 * scale, endSize: 8 * scale, life: 0.4, ring: true, alpha: 0.6 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.life -= dt;
      if (e.life <= 0) {
        this._release(e);
        this.active.splice(i, 1);
        continue;
      }
      const t = e.life / e.maxLife;
      const drag = Math.max(0, 1 - e.drag * dt);
      e.vx *= drag;
      e.vz *= drag;
      e.vy *= drag;
      e.mesh.position.x += e.vx * dt;
      e.mesh.position.z += e.vz * dt;
      e.mesh.position.y += e.vy * dt;
      const sz = e.endSize + (e.size - e.endSize) * t;
      e.mesh.scaling.set(sz, sz, sz);
      e.mesh.visibility = e.alpha0 * Math.min(1, t * 1.6);
    }
  }

  dispose() {
    this.active.forEach((e) => this._release(e));
    this.active.length = 0;
  }
}
