/* ============================================================
   HUD — in-mission DOM overlay, pause, mobile controls
   ============================================================ */

import { ICONS } from "../core/assets.js";

const TEMPLATE = `
<div class="hud-flash" data-el="flash"></div>
<div class="enemy-bars" data-el="enemyBars"></div>

<div class="hud-top">
  <div class="hud-left">
    <div class="hud-bars">
      <div class="hud-bar-label"><span>HULL</span><b data-el="hpText">100 / 100</b></div>
      <div class="hud-bar" data-el="hpBar"><span></span></div>
      <div class="hud-bar-label" style="margin-top:2px"><span>SHIELD</span><b data-el="shText">0 / 0</b></div>
      <div class="hud-bar shield" data-el="shBar"><span></span></div>
    </div>
    <div class="hud-lives"><span data-el="lives"></span></div>
  </div>

  <div class="hud-center">
    <div class="hud-wave" data-el="wave">WAVE <b>1</b> / 5</div>
    <div class="boss-meter" data-el="bossMeter">
      <div class="boss-name"><span data-el="bossName">ALIEN CRUISER</span><span data-el="bossPhase">PHASE 1</span></div>
      <div class="boss-track"><span data-el="bossFill"></span></div>
    </div>
  </div>

  <div class="hud-right">
    <div class="hud-score-label">SCORE</div>
    <div class="hud-score" data-el="score">0</div>
    <div class="hud-coins"><img src="${ICONS.coin}" alt="" /><span data-el="coins">0</span></div>
    <div class="hud-combo" data-el="combo">COMBO ×2</div>
    <button class="icon-btn hud-pause" data-action="pause" title="Pause (Esc)">II</button>
  </div>
</div>

<div class="hud-bottom">
  <div class="hud-powers">
    <button class="power-slot empty" data-power="nuke" title="Nuclear Blast (R)">
      <span class="keycap">R</span><img src="${ICONS.nuke}" alt="" /><span class="count"></span>
    </button>
    <button class="power-slot empty" data-power="orbital" title="Orbital Strike (F)">
      <span class="keycap">F</span><img src="${ICONS.orbital}" alt="" /><span class="count"></span>
    </button>
    <button class="power-slot empty" data-power="timeSlow" title="Time Slow (G)">
      <span class="keycap">G</span><img src="${ICONS.timeSlow}" alt="" /><span class="count"></span>
    </button>
  </div>

  <div class="ability-cluster">
    <button class="missile-btn" data-action="missile" title="Missiles (Q)">
      <span class="cd" data-el="missileCd"></span>
      <span>✦</span>
    </button>
    <button class="ability-btn" data-el="ability" data-action="ability" title="Ship ultimate (E)">
      <span class="ab-fill"></span>
      <span class="ab-icon" data-el="abilityIcon">⚡</span>
      <span class="ab-label" data-el="abilityLabel">ULTIMATE</span>
    </button>
  </div>
</div>

<div class="banner" data-el="banner">
  <div class="b-kicker" data-el="bannerKicker"></div>
  <div class="b-title" data-el="bannerTitle"></div>
  <div class="b-sub" data-el="bannerSub"></div>
</div>

<div class="hud-toast" data-el="toast"></div>

<div class="mobile-controls">
  <div class="joystick" data-el="joystick">
    <div class="joystick-knob" data-el="knob"></div>
  </div>
  <div class="mobile-actions">
    <div class="mobile-power-col">
      <button class="power-slot empty" data-power="nuke" title="Nuclear Blast">
        <img src="${ICONS.nuke}" alt="" /><span class="count"></span>
      </button>
      <button class="power-slot empty" data-power="orbital" title="Orbital Strike">
        <img src="${ICONS.orbital}" alt="" /><span class="count"></span>
      </button>
      <button class="power-slot empty" data-power="timeSlow" title="Time Slow">
        <img src="${ICONS.timeSlow}" alt="" /><span class="count"></span>
      </button>
    </div>
    <button class="missile-btn" data-action="missile">
      <span class="cd" data-el="missileCd"></span><span>✦</span>
    </button>
    <button class="ability-btn" data-el="ability" data-action="ability">
      <span class="ab-fill"></span>
      <span class="ab-icon" data-el="abilityIcon">⚡</span>
      <span class="ab-label" data-el="abilityLabel">ULTIMATE</span>
    </button>
  </div>
</div>
`;

export class Hud {
  constructor(game, app) {
    this.game = game;
    this.app = app;
    this.el = document.getElementById("hud");
    this.el.classList.remove("hidden");
    this.el.innerHTML = TEMPLATE;
    this.enemyBarsEl = this.el.querySelector('[data-el="enemyBars"]');
    this.cache = {};
    this.bannerTime = 0;
    this.toastTime = 0;
    this.pauseLayer = null;
    this.boundPointerUp = null;
    this.bind();
    this.updateAbilityIcon();
    document.body.classList.toggle(
      "touch",
      window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window
    );
  }

  $(sel) { return this.el.querySelector(sel); }

  bind() {
    this.el.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-action],[data-power]");
      if (!btn) return;
      if (btn.dataset.power) {
        this.game.usePower(btn.dataset.power);
        return;
      }
      switch (btn.dataset.action) {
        case "pause": this.game.togglePause(); break;
        case "missile": this.game.useMissile(); break;
        case "ability": this.game.useAbility(); break;
      }
    });

    // joystick
    const joy = this.$('[data-el="joystick"]');
    const knob = this.$('[data-el="knob"]');
    if (joy && knob) {
      let active = false;
      let pointerId = null;

      const move = (ev) => {
        if (!active || ev.pointerId !== pointerId) return;
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = ev.clientX - cx;
        let dy = ev.clientY - cy;
        const max = rect.width * 0.34;
        const len = Math.hypot(dx, dy);
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.game.input.joyX = dx / max;
        this.game.input.joyY = dy / max;
      };

      const end = (ev) => {
        if (ev && pointerId !== null && ev.pointerId !== pointerId && ev.type !== "pointercancel") return;
        active = false;
        pointerId = null;
        knob.style.transform = "";
        this.game.input.joyX = 0;
        this.game.input.joyY = 0;
      };

      joy.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        active = true;
        pointerId = ev.pointerId;
        joy.setPointerCapture?.(pointerId);
        move(ev);
      });
      joy.addEventListener("pointermove", move);
      joy.addEventListener("pointerup", end);
      joy.addEventListener("pointercancel", end);
      this._joyHandlers = { joy, knob, end };
    }
  }

  updateAbilityIcon() {
    const ability = this.game.loadout?.ability;
    if (!ability) return;
    this.el.querySelectorAll('[data-el="abilityIcon"]').forEach((el) => (el.textContent = ability.icon));
    this.el.querySelectorAll('[data-el="abilityLabel"]').forEach((el) => (el.textContent = ability.name.toUpperCase()));
    this.el.querySelectorAll('[data-el="ability"]').forEach((el) => (el.title = `${ability.name} (E) - ${ability.desc}`));
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (apply) apply(value);
  }

  update(dt) {
    const g = this.game;
    if (!g.player) return;
    const p = g.player;

    const hpPct = Math.max(0, p.hp / p.maxHp);
    const shPct = p.maxShield > 0 ? Math.max(0, p.shield / p.maxShield) : 0;

    const hpBar = this.$('[data-el="hpBar"]');
    const shBar = this.$('[data-el="shBar"]');
    this.set("hp", Math.round(hpPct * 1000), () => {
      hpBar.querySelector("span").style.width = `${hpPct * 100}%`;
      hpBar.classList.toggle("low", hpPct < 0.3);
      this.$('[data-el="hpText"]').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
    });
    this.set("sh", Math.round(shPct * 1000), () => {
      shBar.querySelector("span").style.width = `${shPct * 100}%`;
      this.$('[data-el="shText"]').textContent = `${Math.max(0, Math.ceil(p.shield))} / ${p.maxShield}`;
    });

    this.set("lives", p.revives, (v) => {
      this.$('[data-el="lives"]').innerHTML = v > 0
        ? Array.from({ length: v }, () => "<i></i>").join("") + " EMERGENCY CORES"
        : "";
    });

    this.set("score", Math.floor(g.score), (v) => {
      this.$('[data-el="score"]').textContent = v.toLocaleString("en-US");
    });
    this.set("coins", g.runCoins, (v) => {
      this.$('[data-el="coins"]').textContent = v.toLocaleString("en-US");
    });

    const waveLabel = g.waveLabel || "";
    this.set("wave", waveLabel, (v) => {
      this.$('[data-el="wave"]').innerHTML = v;
    });

    this.set("combo", g.combo, (v) => {
      const el = this.$('[data-el="combo"]');
      el.textContent = v > 1 ? `COMBO ×${(1 + (v - 1) * 0.1).toFixed(1)}` : "";
      el.classList.toggle("show", v > 1);
    });

    const charge = Math.round(p.abilityCharge * 100);
    this.el.querySelectorAll('[data-el="ability"]').forEach((el) => {
      el.style.setProperty("--p", `${charge}%`);
      el.classList.toggle("ready", p.abilityCharge >= 1);
    });

    const mCd = Math.max(0, p.missileCd / Math.max(0.01, g.loadout.missileCooldown));
    this.el.querySelectorAll('[data-el="missileCd"]').forEach((el) => {
      el.style.setProperty("--p", `${mCd * 100}%`);
    });
    this.el.querySelectorAll('[data-action="missile"]').forEach((b) => b.classList.toggle("cooling", mCd > 0.02));

    // power counts
    for (const id of ["nuke", "orbital", "timeSlow"]) {
      const count = p.powers[id] || 0;
      this.set("power_" + id, count, () => {
        this.el.querySelectorAll(`[data-power="${id}"]`).forEach((el) => {
          el.classList.toggle("empty", count <= 0);
          const c = el.querySelector(".count");
          if (c) c.textContent = count > 1 ? count : "";
        });
      });
    }

    // boss meter
    const boss = g.boss;
    this.set("boss", boss ? boss.id + ":" + Math.round((boss.hp / boss.maxHp) * 500) : "none", () => {
      const meter = this.$('[data-el="bossMeter"]');
      if (boss) {
        meter.classList.add("show");
        this.$('[data-el="bossName"]').textContent = boss.name.toUpperCase();
        this.$('[data-el="bossPhase"]').textContent = boss.isMini ? "ELITE" : `PHASE ${boss.phase + 1}`;
        this.$('[data-el="bossFill"]').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      } else {
        meter.classList.remove("show");
      }
    });

    // banner timer
    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      if (this.bannerTime <= 0) this.$('[data-el="banner"]').classList.remove("show");
    }
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) this.$('[data-el="toast"]').classList.remove("show");
    }
  }

  banner(kicker, title, sub = "", cls = "", duration = 2.2) {
    const b = this.$('[data-el="banner"]');
    this.$('[data-el="bannerKicker"]').textContent = kicker;
    this.$('[data-el="bannerTitle"]').textContent = title;
    this.$('[data-el="bannerSub"]').textContent = sub;
    b.className = "banner show " + cls;
    this.bannerTime = duration;
  }

  toast(text) {
    const el = this.$('[data-el="toast"]');
    el.textContent = text;
    el.classList.add("show");
    this.toastTime = 1.4;
  }

  flashDamage() {
    const f = this.$('[data-el="flash"]');
    f.classList.add("hit");
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => f.classList.remove("hit"), 150);
  }

  showPause() {
    if (this.pauseLayer) return;
    const g = this.game;
    const layer = document.createElement("div");
    layer.className = "pause-layer";
    layer.innerHTML = `
      <div class="pause-card glass">
        <div class="kicker">MISSION PAUSED</div>
        <h3>STANDBY</h3>
        <div class="run-stats">
          <div>SCORE<b>${g.score.toLocaleString("en-US")}</b></div>
          <div>CREDITS<b>${g.runCoins}</b></div>
          <div>KILLS<b>${g.kills}</b></div>
        </div>
        <button class="btn primary wide" data-p="resume">RESUME</button>
        <button class="btn wide" data-p="settings">SETTINGS</button>
        <button class="btn wide" data-p="restart">RESTART MISSION</button>
        <button class="btn danger wide" data-p="quit">ABANDON MISSION</button>
      </div>`;
    this.el.appendChild(layer);
    this.pauseLayer = layer;
    layer.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-p]");
      if (!btn) return;
      const action = btn.dataset.p;
      if (action === "resume") g.resume();
      else if (action === "restart") this.app.restartRun();
      else if (action === "quit") this.app.quitRun();
      else if (action === "settings") this.app.openSettingsOverlay();
    });
  }

  hidePause() {
    if (this.pauseLayer) {
      this.pauseLayer.remove();
      this.pauseLayer = null;
    }
  }

  dispose() {
    clearTimeout(this._flashTimer);
    this.hidePause();
    this.el.innerHTML = "";
    this.el.classList.add("hidden");
    document.body.classList.remove("touch");
  }
}
