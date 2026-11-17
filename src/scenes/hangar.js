/* ============================================================
   HANGAR SCENE — animated menu / garage backdrop
   ============================================================ */

import { makeStarTexture, makeNebulaTexture, FxSystem } from "../core/fx.js";
import { loadShip, SHIP_TEXTURES, tintShip } from "../core/assets.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class HangarScene {
  constructor(engine, quality = "high") {
    this.engine = engine;
    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = new BABYLON.Color4(0.015, 0.025, 0.06, 1);
    this.scene.autoClear = true;
    this.scene.skipFrustumClipping = true;

    this.camera = new BABYLON.FreeCamera("hangarCam", new BABYLON.Vector3(0, 3.2, -15), this.scene);
    this.camera.fov = 0.62;
    this.camera.minZ = 0.1;
    this.camera.setTarget(new BABYLON.Vector3(0, 0.4, 0));
    this.camera.inputs.clear();

    const hemi = new BABYLON.HemisphericLight("hangarHemi", new BABYLON.Vector3(0.2, 1, -0.2), this.scene);
    hemi.intensity = 1.05;
    hemi.diffuse = new BABYLON.Color3(0.75, 0.86, 1);
    hemi.groundColor = new BABYLON.Color3(0.1, 0.12, 0.25);

    const key = new BABYLON.DirectionalLight("hangarKey", new BABYLON.Vector3(-0.4, -1, 0.55), this.scene);
    key.intensity = 0.9;
    key.diffuse = new BABYLON.Color3(0.65, 0.85, 1);

    const rim = new BABYLON.PointLight("hangarRim", new BABYLON.Vector3(8, 2, 6), this.scene);
    rim.intensity = 1.2;
    rim.diffuse = new BABYLON.Color3(0.7, 0.3, 1);
    rim.range = 40;

    this.glow = new BABYLON.GlowLayer("hangarGlow", this.scene, {
      mainTextureFixedSize: quality === "high" ? 1024 : 512,
      blurKernelSize: 32
    });
    this.glow.intensity = 0.4;

    this.fx = new FxSystem(this.scene, this.glow);
    this.time = 0;
    this.mode = "none";
    this.ship = null;
    this.shipKey = null;
    this.textureKey = null;
    this.paint = "";
    this.trailTimer = 0;
    this.loadToken = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.dragging = false;
    this.dragX = 0;

    this._buildBackdrop();
    this.updateCameraForLayout();
    this._bindDrag();
  }

  _buildBackdrop() {
    const scene = this.scene;
    const starTex = makeStarTexture(scene, 512, 300);
    this.starTexes = [];

    const layers = [
      { z: 42, size: 120, scale: 2.2, alpha: 0.75, speed: 0.006 },
      { z: 64, size: 190, scale: 1.6, alpha: 0.5, speed: 0.012 },
      { z: 90, size: 300, scale: 1.15, alpha: 0.32, speed: 0.02 }
    ];

    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const tex = i === 0 ? starTex : starTex.clone("starTex" + i);
      tex.uScale = l.scale;
      tex.vScale = l.scale;
      tex.uOffset = Math.random();
      tex.vOffset = Math.random();
      this.starTexes.push({ tex, speed: l.speed });

      const plane = BABYLON.MeshBuilder.CreatePlane("starLayer" + i, { width: l.size, height: l.size * 0.72 }, scene);
      plane.position = new BABYLON.Vector3(0, 2, l.z);
      plane.isPickable = false;
      plane.renderingGroupId = 0;
      const mat = new BABYLON.StandardMaterial("starMat" + i, scene);
      mat.disableLighting = true;
      mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      mat.diffuseTexture = tex;
      mat.opacityTexture = tex;
      mat.backFaceCulling = false;
      mat.disableDepthWrite = true;
      mat.alpha = l.alpha;
      mat.freeze();
      plane.material = mat;
    }

    // nebula wash
    const nebTex = makeNebulaTexture(scene, 512);
    const neb = BABYLON.MeshBuilder.CreatePlane("nebula", { width: 160, height: 100 }, scene);
    neb.position = new BABYLON.Vector3(0, 5, 72);
    neb.isPickable = false;
    neb.renderingGroupId = 0;
    const nebMat = new BABYLON.StandardMaterial("nebulaMat", scene);
    nebMat.disableLighting = true;
    nebMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    nebMat.opacityTexture = nebTex;
    nebMat.diffuseTexture = nebTex;
    nebMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    nebMat.backFaceCulling = false;
    nebMat.disableDepthWrite = true;
    nebMat.alpha = 0.75;
    nebMat.freeze();
    neb.material = nebMat;
    this.nebula = neb;

    // distant planet
    const planet = BABYLON.MeshBuilder.CreateSphere("planet", { diameter: 26, segments: 32 }, scene);
    planet.position = new BABYLON.Vector3(-18, 7, 44);
    planet.isPickable = false;
    planet.renderingGroupId = 0;
    const pm = new BABYLON.StandardMaterial("planetMat", scene);
    pm.diffuseColor = new BABYLON.Color3(0.04, 0.08, 0.16);
    pm.emissiveColor = new BABYLON.Color3(0.03, 0.07, 0.16);
    pm.specularColor = new BABYLON.Color3(0.05, 0.1, 0.18);
    pm.freeze();
    planet.material = pm;

    const ring = BABYLON.MeshBuilder.CreateTorus("planetRing", { diameter: 38, thickness: 1.1, tessellation: 64 }, scene);
    ring.position = planet.position.add(new BABYLON.Vector3(0, 0, 0));
    ring.rotation.x = Math.PI / 2.3;
    ring.rotation.z = 0.4;
    ring.isPickable = false;
    ring.renderingGroupId = 0;
    const rm = new BABYLON.StandardMaterial("ringMat", scene);
    rm.disableLighting = true;
    rm.emissiveColor = new BABYLON.Color3(0.24, 0.3, 0.55);
    rm.alpha = 0.25;
    rm.freeze();
    ring.material = rm;

    // soft floor glow beneath the hero ship
    const floorTex = makeStarTexture(scene, 256, 0);
    const floor = BABYLON.MeshBuilder.CreateDisc("floorGlow", { radius: 16, tessellation: 64 }, scene);
    floor.rotation.x = Math.PI / 2;
    floor.position = new BABYLON.Vector3(0, -3.4, 0);
    floor.isPickable = false;
    const fm = new BABYLON.StandardMaterial("floorMat", scene);
    fm.disableLighting = true;
    fm.emissiveColor = new BABYLON.Color3(0.22, 0.5, 0.9);
    fm.alpha = 0.12;
    fm.alphaMode = BABYLON.Engine.ALPHA_ADD;
    fm.backFaceCulling = false;
    fm.freeze();
    floor.material = fm;
    this.floor = floor;
  }

  async setShip(shipKey, textureKey) {
    if (!shipKey) {
      this.loadToken++;
      this.clearShip();
      return;
    }
    this.textureKey = textureKey || shipKey;
    if (this.shipKey === shipKey && this.ship) {
      this.ship.setEnabled(true);
      return;
    }
    // Invalidate any in-flight load before disposing, otherwise a slow earlier
    // request can resolve after a newer one and leave two hulls in the bay.
    const token = ++this.loadToken;
    this.clearShip();
    this.shipKey = shipKey;
    const ship = await loadShip(
      this.scene,
      shipKey,
      SHIP_TEXTURES[this.textureKey],
      8,
      false
    );
    if (token !== this.loadToken) {
      ship.dispose(false, true);
      return;
    }
    ship.position = new BABYLON.Vector3(0, 0, 0);
    this.ship = ship;
    if (this.paint) tintShip(ship, this.paint, 0.6);
    this.baseYaw = ship.rotation.y;
    ship.rotation.y = this.baseYaw - 0.25;
    this.spin = 0;
    this.spinVel = 0;
    this.applyLayout();
    this.emitWarp();
  }

  setPaint(color) {
    const next = color || "";
    if (next === this.paint) return;
    this.paint = next;
    if (!this.ship || !this.shipKey) return;
    const key = this.shipKey;
    this.shipKey = null;
    this.setShip(key, this.textureKey);
  }

  clearShip() {
    if (this.ship) {
      this.ship.dispose(false, true);
      this.ship = null;
      this.shipKey = null;
    }
  }

  emitWarp() {
    if (!this.ship) return;
    this.fx.warp(this.ship.position.x, this.ship.position.z, "#7bd8ff", 1.2);
  }

  setMode(mode) {
    this.mode = mode;
    this.updateCameraForLayout();
    this.applyLayout();
    if (this.floor) this.floor.setEnabled(mode !== "none");
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) canvas.style.cursor = mode === "garage" ? "grab" : "";
  }

  /**
   * Drag-to-spin showroom control. Works for mouse and touch via pointer
   * events; a short momentum tail makes flicks feel natural.
   */
  _bindDrag() {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    const down = (ev) => {
      if (this.mode !== "garage" || !this.ship) return;
      this.dragging = true;
      this.dragX = ev.clientX;
      this.spinVel = 0;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      canvas.style.cursor = "grabbing";
      ev.preventDefault();
    };
    const move = (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.dragX;
      this.dragX = ev.clientX;
      this.spin += dx * 0.011;
      this.spinVel = dx * 0.45;
      ev.preventDefault();
    };
    const up = (ev) => {
      if (!this.dragging) return;
      this.dragging = false;
      try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      if (this.mode === "garage") canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  }

  /** Viewport height in CSS pixels (not device pixels). */
  cssHeight() {
    const canvas = this.engine.getRenderingCanvas();
    const h = canvas && canvas.clientHeight;
    return h || this.engine.getRenderHeight();
  }

  updateCameraForLayout() {
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const mobile = aspect < 1.05;

    if (this.mode === "garage") {
      if (mobile) {
        // Portrait: sit the hull in the open band between the name plate and
        // the ship rail instead of tucking it under the header text.
        this.camera.position = new BABYLON.Vector3(0, 4.2, -18);
        this.camera.setTarget(new BABYLON.Vector3(0, -0.3, 0));
      } else {
        this.camera.position = new BABYLON.Vector3(0, 3.6, -17);
        this.camera.setTarget(new BABYLON.Vector3(0, 0.5, 0));
      }
    } else if (this.mode === "menu") {
      this.camera.position = new BABYLON.Vector3(0, 3.0, -18);
      this.camera.setTarget(new BABYLON.Vector3(0, 0.2, 0));
    } else {
      this.camera.position = new BABYLON.Vector3(0, 3.2, -15);
      this.camera.setTarget(new BABYLON.Vector3(0, 0.4, 0));
    }
  }

  applyLayout() {
    if (!this.ship) return;
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const portrait = aspect < 1.05;
    // Only treat wide layouts as phones when the viewport is actually short.
    // Measure CSS pixels: on a high-DPR phone the backing render height is
    // double the CSS height and would otherwise never look "short".
    const landscapePhone = aspect > 1.6 && this.cssHeight() < 560;
    const base = this.ship.metadata.baseScale || 1;
    // Keep the hull inside the narrower ortho width on phones.
    const fit = clamp(0.79 * aspect, 0.26, 0.64);

    if (this.mode === "garage") {
      if (portrait) {
        this.ship.position.x = 0;
        this.ship.scaling.setAll(base * fit * 0.82);
        this.shipBaseY = 0.5;
      } else if (landscapePhone) {
        this.ship.position.x = -3.2;
        this.ship.scaling.setAll(base * 0.68);
        this.shipBaseY = 0.6;
      } else {
        this.ship.position.x = -3.5;
        this.ship.scaling.setAll(base * 0.8);
        this.shipBaseY = 0;
      }
    } else if (portrait) {
      this.ship.position.x = 0;
      this.shipBaseY = 1.15;
      this.ship.scaling.setAll(base * fit);
    } else if (landscapePhone) {
      this.ship.position.x = -6.2;
      this.shipBaseY = 0.2;
      this.ship.scaling.setAll(base * 0.5);
    } else {
      this.ship.position.x = 0;
      this.shipBaseY = 1.5;
      this.ship.scaling.setAll(base * 0.64);
    }
    this.ship.position.y = this.shipBaseY;
  }

  resize() {
    this.updateCameraForLayout();
    this.applyLayout();
  }

  render(dt) {
    this.time += dt;
    const t = this.time;

    for (const s of this.starTexes) {
      s.tex.vOffset += s.speed * dt;
    }
    this.nebula.material.alphaTexture = null;

    if (this.ship) {
      const base = this.baseYaw ?? this.ship.rotation.y;
      const sway = this.mode === "garage" ? 0.35 : 0.55;
      const speed = this.mode === "garage" ? 0.22 : 0.32;
      if (!this.dragging && Math.abs(this.spinVel) > 0.002) {
        this.spin += this.spinVel * dt;
        this.spinVel *= Math.exp(-3.5 * dt);
      }
      const swayAmount = this.dragging ? sway * 0.15 : sway;
      this.ship.rotation.y = base - 0.25 + this.spin + Math.sin(t * speed) * swayAmount;
      this.ship.rotation.x = Math.sin(t * 0.7) * 0.03;
      this.ship.rotation.z = Math.sin(t * 0.5) * 0.035;
      this.ship.position.y = (this.shipBaseY != null ? this.shipBaseY : 0) + Math.sin(t * 1.1) * 0.09;

      // engine glow trail — one stream per nozzle on the current hull
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.038;
        const yaw = this.ship.rotation.y;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const baseScale = this.ship.metadata?.baseScale || 1;
        const worldSize = (this.ship.metadata?.size || 8) * (this.ship.scaling.x / baseScale);
        const mounts = this.ship.metadata?.engines
          || [{ x: -0.18, z: 0.47 }, { x: 0.18, z: 0.47 }];
        for (let i = 0; i < mounts.length; i++) {
          const m = mounts[i];
          const ox = (m.x * cos + m.z * sin) * worldSize;
          const oz = (m.z * cos - m.x * sin) * worldSize;
          this.fx.spawn({
            x: this.ship.position.x + ox,
            y: this.ship.position.y + 0.12,
            z: this.ship.position.z + oz,
            color: i % 2 ? "#b388ff" : "#6fe8ff",
            size: 0.5 + Math.random() * 0.16,
            endSize: 0.05,
            life: 0.26,
            alpha: 0.85,
            vx: (Math.random() - 0.5) * 0.6,
            vz: 1.4,
            drag: 1.5
          });
        }
      }
    }

    this.fx.update(dt);
    this.scene.render();
  }

  dispose() {
    this.loadToken++;
    this.clearShip();
    this.fx.dispose();
    this.scene.dispose();
  }
}
