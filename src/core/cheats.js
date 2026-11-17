/* ============================================================
   CHEATS — developer console overlay (Ctrl+Shift+D / ?dev=1)
   ============================================================ */

import { SHIPS, SKILLS, STORE_ITEMS, TRAILS, PAINTS } from "../config.js";

const HELP = [
  ["help", "Show this command list"],
  ["credits <n>", "Add credits (default 10000)"],
  ["points <n>", "Add skill points"],
  ["unlock <n>", "Unlock campaign up to sector n"],
  ["max", "Max every ship, store item and skill"],
  ["god", "Toggle damage immunity"],
  ["speed <n>", "Set player speed multiplier (1 = normal)"],
  ["heal", "Restore hull and shields"],
  ["win", "Instantly win the current mission"],
  ["kill", "Destroy every hostile on screen"],
  ["boss", "Spawn the final boss now"],
  ["nuke", "Clear the screen and award score"],
  ["level <n>", "Start campaign sector n"],
  ["mode <name>", "Start a mode: campaign, endless, weekly,"],
  ["", "bossrush, daily, training"],
  ["quality <h|l>", "Switch render quality"],
  ["paint <hex|off>", "Paint the current ship"],
  ["trail <id>", "Set engine trail cosmetic"],
  ["export", "Show a save backup code (copy it)"],
  ["import <code>", "Restore a save backup code"],
  ["reset", "Erase the save (asks first)"],
  ["close", "Close the console"]
];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class CheatConsole {
  constructor(app) {
    this.app = app;
    this.open = false;
    this.history = [];
    this.historyIndex = -1;
    this.layer = null;
    this.input = null;
    this.output = null;
    this.build();
    this.bindKeys();
  }

  build() {
    const layer = el("div", "cheat-layer hidden");
    layer.id = "cheat-layer";

    const card = el("div", "cheat-card glass");
    const head = el("div", "cheat-head");
    head.appendChild(el("span", "cheat-title", "DEV CONSOLE"));
    const hint = el("span", "cheat-hint", "Ctrl+Shift+D · ?dev=1");
    head.appendChild(hint);
    const close = el("button", "cheat-close", "✕");
    close.dataset.cheatClose = "1";
    close.setAttribute("aria-label", "Close console");
    head.appendChild(close);
    card.appendChild(head);

    const output = el("div", "cheat-output");
    card.appendChild(output);

    const form = el("form", "cheat-form");
    const prompt = el("span", "cheat-prompt", ">");
    const input = el("input", "cheat-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "type help…";
    form.appendChild(prompt);
    form.appendChild(input);
    card.appendChild(form);

    layer.appendChild(card);
    layer.addEventListener("click", (ev) => {
      if (ev.target === layer || ev.target.closest("[data-cheat-close]")) {
        ev.preventDefault();
        this.hide();
      }
    });
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const value = input.value;
      input.value = "";
      this.run(value);
    });
    document.body.appendChild(layer);

    this.layer = layer;
    this.input = input;
    this.output = output;
    this.print("STELLAR WARS developer console ready.", "dim");
    this.print("Type help for commands.", "dim");
  }

  bindKeys() {
    window.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey && ev.shiftKey && (ev.key === "D" || ev.key === "d" || ev.code === "KeyD")) {
        ev.preventDefault();
        this.toggle();
        return;
      }
      if (!this.open) return;
      if (ev.key === "Escape") {
        ev.stopPropagation();
        this.hide();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        this.navigate(-1);
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        this.navigate(1);
      }
    }, true);

    if (new URLSearchParams(window.location.search).get("dev") === "1") {
      setTimeout(() => this.show(), 400);
    }
  }

  navigate(dir) {
    if (!this.history.length) return;
    this.historyIndex = Math.max(-1, Math.min(this.history.length - 1, this.historyIndex - dir));
    if (this.historyIndex === -1) {
      this.input.value = "";
      return;
    }
    this.input.value = this.history[this.historyIndex] || "";
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
  }

  toggle() {
    this.open ? this.hide() : this.show();
  }

  show() {
    this.open = true;
    this.layer.classList.remove("hidden");
    this.app.audio?.play("click");
    setTimeout(() => this.input.focus(), 20);
  }

  hide() {
    this.open = false;
    this.layer.classList.add("hidden");
    this.input.blur();
    if (this.app.level) this.app.level.input.target = null;
  }

  print(text, cls = "") {
    const line = el("div", "cheat-line " + cls, text);
    this.output.appendChild(line);
    while (this.output.childNodes.length > 120) this.output.removeChild(this.output.firstChild);
    this.output.scrollTop = this.output.scrollHeight;
  }

  run(raw) {
    const text = String(raw || "").trim();
    if (!text) return;
    this.history.push(text);
    this.historyIndex = this.history.length;
    this.print("> " + text, "cmd");

    const parts = text.split(/\s+/);
    const cmd = parts.shift().toLowerCase();
    const arg = parts.join(" ");
    try {
      this.execute(cmd, arg);
    } catch (err) {
      this.print("ERROR: " + (err && err.message ? err.message : String(err)), "bad");
    }
  }

  execute(cmd, arg) {
    const app = this.app;
    const save = app.save;
    const num = Number(arg);
    const hasNum = arg !== "" && Number.isFinite(num);

    switch (cmd) {
      case "help":
        this.print("COMMANDS", "good");
        for (const [name, desc] of HELP) {
          this.print("  " + name.padEnd(16, " ") + desc);
        }
        break;

      case "credits":
      case "coins": {
        const amount = hasNum ? Math.max(1, Math.floor(num)) : 10000;
        save.addCoins(amount);
        app.refreshCoins();
        this.print(`Added ${amount.toLocaleString("en-US")} credits. Balance ${save.coins.toLocaleString("en-US")}.`, "good");
        break;
      }

      case "points":
      case "sp": {
        const amount = hasNum ? Math.max(1, Math.floor(num)) : 5;
        save.data.skillPoints = (save.data.skillPoints || 0) + amount;
        save.save();
        this.print(`Skill points: ${save.data.skillPoints}.`, "good");
        break;
      }

      case "unlock": {
        const n = hasNum ? Math.min(35, Math.max(1, Math.floor(num))) : 35;
        save.data.unlockedLevel = Math.max(save.data.unlockedLevel || 1, n);
        save.save();
        this.print(`Campaign unlocked through sector ${save.data.unlockedLevel}.`, "good");
        if (app.currentScreen === "levels") app.showLevels();
        break;
      }

      case "max": {
        for (const ship of SHIPS) {
          save.data.shipUpgrades[ship.id] = { hp: 10, shield: 10, speed: 10, damage: 10, fireRate: 10 };
        }
        for (const item of STORE_ITEMS) save.data.store[item.id] = item.max;
        save.data.skills = SKILLS.map((s) => s.id);
        save.data.skillPoints = 0;
        save.data.licenses = true;
        save.save();
        this.print("All ships, store items and skills maxed.", "good");
        app.refreshCoins();
        if (app.currentScreen === "garage") app.renderGarage();
        else if (app.currentScreen === "store") app.renderStore();
        else if (app.currentScreen === "skills") app.showSkills();
        break;
      }

      case "god": {
        app.dev.god = !app.dev.god;
        this.print(`God mode ${app.dev.god ? "ON" : "OFF"}.`, app.dev.god ? "good" : "warn");
        if (app.dev.god && app.level) app.level.damagePlayer(0);
        break;
      }

      case "speed": {
        const v = hasNum ? Math.max(0.25, Math.min(4, num)) : 1;
        app.dev.speed = v;
        this.print(`Player speed set to ×${v}.`, "good");
        break;
      }

      case "heal": {
        const level = app.level;
        if (!level || !level.player) {
          this.print("No active mission.", "warn");
          break;
        }
        level.player.hp = level.player.maxHp;
        level.player.shield = level.player.maxShield;
        level.player.invuln = 1.5;
        this.print("Hull and shields restored.", "good");
        break;
      }

      case "win": {
        if (!app.level) {
          this.print("No active mission.", "warn");
          break;
        }
        app.level.finish(true);
        this.print("Mission won.", "good");
        break;
      }

      case "kill":
      case "nuke": {
        const level = app.level;
        if (!level) {
          this.print("No active mission.", "warn");
          break;
        }
        let killed = 0;
        for (const e of [...level.enemies]) {
          if (!e.dead) {
            level.killEnemy(e, true, cmd === "nuke" ? {} : { noDrop: true });
            killed++;
          }
        }
        if (cmd === "nuke" && level.boss && !level.boss.dead) {
          level.boss.hp = 0;
          killed++;
        }
        level.projectiles.clearHostile();
        this.print(`Destroyed ${killed} hostile${killed === 1 ? "" : "s"}.`, "good");
        break;
      }

      case "boss": {
        const level = app.level;
        if (!level) {
          this.print("No active mission.", "warn");
          break;
        }
        if (level.boss) {
          this.print("A boss is already active.", "warn");
          break;
        }
        level.pendingAfterBoss = "victory";
        level.startFinalBoss();
        this.print("Final boss spawning.", "good");
        break;
      }

      case "level": {
        if (!hasNum) {
          this.print("Usage: level <1-35>", "warn");
          break;
        }
        const n = Math.max(1, Math.min(35, Math.floor(num)));
        save.data.unlockedLevel = Math.max(save.data.unlockedLevel || 1, n);
        save.save();
        app.startRun("campaign", n);
        this.hide();
        break;
      }

      case "mode": {
        const mode = (arg || "").toLowerCase();
        const allowed = ["campaign", "endless", "weekly", "bossrush", "daily", "training"];
        if (!allowed.includes(mode)) {
          this.print("Modes: " + allowed.join(", "), "warn");
          break;
        }
        save.data.unlockedLevel = Math.max(save.data.unlockedLevel || 1, 35);
        save.save();
        app.startRun(mode, 1);
        this.hide();
        break;
      }

      case "quality": {
        const q = arg.toLowerCase().startsWith("l") ? "low" : "high";
        app.applySetting("quality", q);
        this.print(`Render quality: ${q.toUpperCase()} (applies next mission).`, "good");
        break;
      }

      case "paint": {
        const hex = (arg || "").trim();
        if (hex === "off" || hex === "none" || hex === "") {
          save.setPaint(save.getShip().id, "");
          this.print("Factory paint restored.", "good");
        } else {
          const paint = PAINTS.find((p) => p.id === hex) || null;
          const color = paint ? paint.color : hex;
          if (!/^#?[0-9a-f]{6}$/i.test(color)) {
            this.print("Usage: paint <#rrggbb|off>", "warn");
            break;
          }
          save.setPaint(save.getShip().id, color.startsWith("#") ? color : "#" + color);
          this.print(`Painted ${save.getShip().name} ${color}.`, "good");
        }
        break;
      }

      case "trail": {
        const trail = TRAILS.find((t) => t.id === arg.toLowerCase());
        if (!trail) {
          this.print("Trails: " + TRAILS.map((t) => t.id).join(", "), "warn");
          break;
        }
        save.setTrail(trail.id);
        this.print(`Trail set to ${trail.name}.`, "good");
        break;
      }

      case "export": {
        const code = save.exportCode();
        this.print(code || "Export failed.", code ? "code" : "bad");
        if (code && navigator.clipboard) {
          navigator.clipboard.writeText(code).then(
            () => this.print("Copied to clipboard.", "good"),
            () => { /* clipboard blocked, code is printed */ }
          );
        }
        break;
      }

      case "import": {
        if (!arg) {
          this.print("Usage: import <SW1:...>", "warn");
          break;
        }
        save.importCode(arg);
        app.refreshCoins();
        app.showMenu();
        this.print("Save imported.", "good");
        break;
      }

      case "reset": {
        if (window.confirm("Erase all save data?")) {
          save.reset();
          app.showMenu();
          this.print("Save erased.", "bad");
        }
        break;
      }

      case "close":
        this.hide();
        break;

      default:
        this.print(`Unknown command: ${cmd}. Type help.`, "bad");
    }
  }
}
