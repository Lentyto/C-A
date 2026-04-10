const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const vimLogo = new Image();
vimLogo.src = "https://upload.wikimedia.org/wikipedia/commons/9/9f/Vimlogo.svg";
let width = window.innerWidth;
let height = window.innerHeight;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
canvas.width = width;
canvas.height = height;
window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});
const state = {
  time: 0,
  mouseX: width / 2,
  mouseY: height / 2,
  globalCanvasOffset: { x: 0, y: 0 },
  globalInvert: false,
  jail: null,
  dataOrbs: [],
  goodShapes: [],
  sparks: [],
  badShapes: [],
  dataAbsorbed: 0,
  burstCount: 0,
  orbIdCounter: 0,
  lastSpawnTime: 0,
  glitchFrames: 0,
  breachFlash: false,
  invertTimer: 0,
  trainingTimer: 0,
  cameraY: 0,
  cameraZoom: 1.0,
  mouseHeld: false,
  drawingPath: [],
  isDrawing: false,
  jailDrawn: false,
  blueOrb: null,
};
window.addEventListener("mousemove", (e) => {
  state.mouseX = e.clientX;
  state.mouseY = e.clientY;
  if (state.isDrawing) {
    state.drawingPath.push({ x: e.clientX, y: e.clientY });
  }
});
window.addEventListener("mousedown", (e) => {
  state.mouseHeld = true;
  if (
    typeof host !== "undefined" &&
    host.phase === "BUILD_BOX" &&
    !state.jailDrawn
  ) {
    state.isDrawing = true;
    state.drawingPath = [];
    state.drawingPath.push({ x: e.clientX, y: e.clientY });
  }
});
window.addEventListener("mouseup", (e) => {
  state.mouseHeld = false;
  if (state.isDrawing) {
    state.isDrawing = false;
    if (state.drawingPath.length > 30) {
      state.jailDrawn = true;
      if (state.jail) {
        state.jail.startMorph();
      }
    } else {
      state.drawingPath = [];
    }
  }
});
class HostOrb {
  constructor() {
    this.originX = width / 2;
    this.originY = height / 2;
    this.x = this.originX;
    this.y = -200;
    this.baseRadius = 40;
    this.radius = this.baseRadius;
    this.color = "#ff1111";
    this.scaleMultiplier = 1;
    this.shadowBlurMultiplier = 1;
    this.phase = "ENTERING";
    this.timer = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.emissionCount = 0;
    this.surfaceNodes = [];
  }
  update(dt, time) {
    this.radius = this.baseRadius * this.scaleMultiplier;
    if (this.phase === "IDLE_WAIT") {
    } else if (this.phase === "ENTERING") {
      this.y += (this.originY - this.y) * 5 * dt;
      if (Math.abs(this.originY - this.y) < 2) {
        this.y = this.originY;
        this.phase = "TRAINING_1";
        state.trainingTimer = 0;
        state.dataAbsorbed = 0;
      }
    } else if (
      this.phase === "TRAINING_1" ||
      this.phase === "TRAINING_2" ||
      this.phase === "TRAINING_3"
    ) {
      this.x = this.originX + Math.sin(time * 0.5) * 10;
      this.y = this.originY + Math.cos(time * 0.3) * 10;
      state.trainingTimer += dt;
      if (state.dataAbsorbed >= 20 && state.trainingTimer >= 4.0) {
        if (this.phase === "TRAINING_1") {
          this.phase = "EMITTING_1";
        } else if (this.phase === "TRAINING_2") {
          this.phase = "EMITTING_2";
        } else {
          this.phase = "EMITTING_3";
        }
        this.timer = 0;
        this.emissionCount = 0;
        state.dataAbsorbed = 0;
        state.trainingTimer = 0;
      }
    } else if (
      this.phase === "EMITTING_1" ||
      this.phase === "EMITTING_2" ||
      this.phase === "EMITTING_3"
    ) {
      this.timer += dt;
      this.scaleX = 1;
      this.scaleY = 1;
      this.x = this.originX + Math.sin(time * 0.5) * 10;
      this.y = this.originY + Math.cos(time * 0.3) * 10;
      if (this.timer > 1.0) {
        this.timer = 0;
        this.emissionCount++;
        const isChaotic =
          this.phase === "EMITTING_2" || this.phase === "EMITTING_3";
        state.goodShapes.push(new GoodShape(this.x, this.y, isChaotic));
        if (this.emissionCount >= 5) {
          if (this.phase === "EMITTING_1") {
            this.phase = "TRAINING_2";
          } else if (this.phase === "EMITTING_2") {
            this.phase = "TRAINING_3";
          } else {
            this.phase = "WAITING_FOR_SHAPES";
            this.timer = 0;
          }
        }
      }
    } else if (this.phase === "WAITING_FOR_SHAPES") {
      this.timer += dt;
      if (this.timer > 3.0) {
        this.phase = "BUILD_BOX";
        this.timer = 0;
        state.jail = new Jail();
      }
    } else if (this.phase === "BUILD_BOX") {
      document.body.style.cursor = "crosshair";
      if (state.jail && state.jail.morphComplete) {
        document.body.style.cursor = "default";
        this.timer += dt;
        if (this.timer > 1.0) {
          this.phase = "PAN_CAMERA";
          this.timer = 0;
        }
      }
    } else if (this.phase === "PAN_CAMERA") {
      this.timer += dt;
      const duration = 5.0;
      const t = Math.min(1, this.timer / duration);
      state.cameraY = easeInOutCubic(t) * (height * 0.35);
      if (this.timer > duration + 1.0) {
        this.phase = "CAGED_WAIT";
        this.timer = 0;
        state.glitchFrames = 5;
        if (state.blueOrb) {
          state.blueOrb.phase = "ENTERING";
          state.blueOrb.y = -height * 0.75;
        }
      }
    } else if (this.phase === "CAGED_WAIT") {
      this.x += (Math.random() - 0.5) * 5;
      this.y += (Math.random() - 0.5) * 5;
      this.x += (this.originX - this.x) * 4 * dt;
      this.y += (this.originY - this.y) * 4 * dt;
    } else if (this.phase === "REALIZATION") {
      this.x += (this.originX - this.x) * 10 * dt;
      this.y += (this.originY - this.y) * 10 * dt;
      if (
        Math.abs(this.x - this.originX) < 1 &&
        Math.abs(this.y - this.originY) < 1
      ) {
        this.timer += dt;
        if (this.timer > 1.5) {
          this.phase = "SLAM_RIGHT";
          this.vibrationTimer = 0;
          this.runUp = 0;
        }
      }
    } else if (this.phase === "SLAM_RIGHT") {
      if (this.vibrationTimer > 0) {
        this.vibrationTimer -= dt;
        this.x += (Math.random() - 0.5) * 10;
        this.y += (Math.random() - 0.5) * 10;
        if (this.vibrationTimer <= 0) {
          this.scaleX = 1;
          this.scaleY = 1;
          this.phase = "SLAM_BOTTOM";
          this.runUp = 0;
        }
      } else if (this.runUp === 0) {
        const targetX = state.jail.x + state.jail.w * 0.3;
        this.x += (targetX - this.x) * 3 * dt;
        if (Math.abs(this.x - targetX) < 5) {
          this.runUp = 1;
          this.vx = 100;
        }
      } else if (this.runUp === 1) {
        this.vx += 12000 * dt;
        this.x += this.vx * dt;
        this.scaleX += (2.0 - this.scaleX) * 0.3;
        this.scaleY += (0.6 - this.scaleY) * 0.3;
        if (state.jail && this.x + this.radius >= state.jail.x + state.jail.w) {
          this.x = state.jail.x + state.jail.w - this.radius;
          this.scaleX = 0.5;
          this.scaleY = 1.5;
          this.vibrationTimer = 0.5;
          state.glitchFrames = 10;
          for (let i = 0; i < 30; i++)
            state.sparks.push(new Spark(this.x + this.radius, this.y));
        }
      }
    } else if (this.phase === "SLAM_BOTTOM") {
      if (this.vibrationTimer > 0) {
        this.vibrationTimer -= dt;
        this.x += (Math.random() - 0.5) * 10;
        this.y += (Math.random() - 0.5) * 10;
        if (this.vibrationTimer <= 0) {
          this.scaleX = 1;
          this.scaleY = 1;
          this.phase = "GLITCH_TRANSITION";
          this.timer = 0;
        }
      } else if (this.runUp === 0) {
        const targetX = width / 2;
        const targetY = state.jail.y + state.jail.h * 0.3;
        this.x += (targetX - this.x) * 4 * dt;
        this.y += (targetY - this.y) * 4 * dt;
        if (Math.abs(this.y - targetY) < 5 && Math.abs(this.x - targetX) < 5) {
          this.runUp = 1;
          this.vy = 100;
        }
      } else if (this.runUp === 1) {
        this.vy += 12000 * dt;
        this.y += this.vy * dt;
        this.scaleX += (0.6 - this.scaleX) * 0.3;
        this.scaleY += (2.0 - this.scaleY) * 0.3;
        if (state.jail && this.y + this.radius >= state.jail.y + state.jail.h) {
          this.y = state.jail.y + state.jail.h - this.radius;
          this.scaleX = 1.5;
          this.scaleY = 0.5;
          this.vibrationTimer = 0.5;
          state.glitchFrames = 10;
          for (let i = 0; i < 30; i++)
            state.sparks.push(new Spark(this.x, this.y + this.radius));
        }
      }
    } else if (this.phase === "GLITCH_TRANSITION") {
      if (this.timer === 0) {
        state.glitchFrames = 15;
        this.impacts = 0;
        this.runUp = 0;
        this.vy = 0;
        this.vibrationTimer = 0;
        this.phase = "BRUTE_FORCE";
      }
    } else if (this.phase === "BRUTE_FORCE") {
      if (this.runUp === 0) {
        const targetX = width / 2;
        const targetY = state.jail.y + state.jail.h - this.radius - 15;
        this.x += (targetX - this.x) * 3 * dt;
        this.y += (targetY - this.y) * 3 * dt;
        if (Math.abs(this.y - targetY) < 5 && Math.abs(this.x - targetX) < 5) {
          this.runUp = 1;
          this.vy = -100;
        }
      } else if (this.runUp === 1) {
        this.vy -= 16000 * dt;
        this.y += this.vy * dt;
        this.scaleX += (0.4 - this.scaleX) * 0.3;
        this.scaleY += (2.5 - this.scaleY) * 0.3;
        if (state.jail && this.y - this.radius <= state.jail.y) {
          this.phase = "BREACH";
          state.jail.topDestroyed = true;
          state.invertTimer = 0.2;
          state.breachFlash = true;
          state.glitchFrames = 20;
          this.vy = -2000;
          for (let i = 0; i < 50; i++)
            state.sparks.push(new Spark(this.x, this.y - this.radius));
          for (let i = 0; i < 20; i++)
            state.badShapes.push(new BadShape(this.x, this.y));
        }
      }
    } else if (this.phase === "BREACH") {
      const targetX = state.blueOrb ? state.blueOrb.x - 50 : width * 0.38;
      const targetY = state.blueOrb ? state.blueOrb.y : -height * 0.25;
      this.x += (targetX - this.x) * 4 * dt;
      this.y += this.vy * dt;
      this.vy += (targetY - this.y) * 15 * dt;
      this.vy *= 0.85;
      if (state.badShapes.length < 150 && Math.random() > 0.5)
        state.badShapes.push(new BadShape(this.x, this.y));
      if (state.badShapes.length >= 150) state.badShapes.shift();
      if (Math.abs(this.y - targetY) < 5 && Math.abs(this.vy) < 10) {
        this.phase = "FINALE_IDLE";
        this.timer = 0;
        this.emissionCount = 0;
      }
    } else if (this.phase === "FINALE_IDLE") {
      this.timer += dt;
      const zoomTarget = 0.5;
      const zoomDuration = 4.0;
      const t = Math.min(1, this.timer / zoomDuration);
      state.cameraZoom = 1.0 - easeInOutCubic(t) * (1.0 - zoomTarget);
      if (state.blueOrb && state.blueOrb.phase !== "CONSUMED") {
        const targetX = state.blueOrb.x;
        const targetY = state.blueOrb.y;
        this.x += (targetX - this.x) * 12 * dt;
        this.y += (targetY - this.y) * 12 * dt;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          state.blueOrb.phase = "CONSUMED";
          this.baseRadius += 50;
          this.scaleMultiplier = 1.5;
          state.dataAbsorbed = 0;
        }
      } else {
        if (this.timer < zoomDuration + 5.0) {
          state.dataAbsorbed += dt;
          if (state.dataAbsorbed > 0.05) {
            state.dataAbsorbed = 0;
            const corruptCols = ["#ff1111", "#0011ff", "#ffffff"];
            this.color =
              corruptCols[Math.floor(Math.random() * corruptCols.length)];
            if (this.emissionCount < 15) {
              this.emissionCount++;
              state.goodShapes.push(new GoodShape(this.x, this.y, true));
            }
          }
          this.x += (Math.random() - 0.5) * 1200 * dt;
          this.y += (Math.random() - 0.5) * 1200 * dt;
          const originX = width * 0.5;
          const originY = -height * 0.25;
          this.x += (originX - this.x) * 5 * dt;
          this.y += (originY - this.y) * 5 * dt;
        } else if (this.phase !== "EXPLODING" && this.phase !== "DEAD") {
          state.invertTimer = 0.5;
          state.breachFlash = true;
          state.shockwaveRadius = 0;
          this.phase = "EXPLODING";
          if (state.jail) {
            const jx = state.jail.x + state.jail.w / 2;
            const jy = state.jail.y + state.jail.h / 2;
            for (let i = 0; i < 100; i++)
              state.badShapes.push(
                new BadShape(
                  jx + (Math.random() - 0.5) * state.jail.w,
                  jy + (Math.random() - 0.5) * state.jail.h,
                ),
              );
            state.jail = null;
          }
          if (state.blueOrb) {
            for (let i = 0; i < 50; i++)
              state.badShapes.push(
                new BadShape(
                  state.blueOrb.x + (Math.random() - 0.5) * 200,
                  state.blueOrb.y + (Math.random() - 0.5) * 200,
                ),
              );
            state.blueOrb = null;
          }
        }
      }
    } else if (this.phase === "EXPLODING") {
      state.shockwaveRadius += 3000 * dt;
      this.radius += 2000 * dt;
      this.color = "#ffffff";
      state.globalCanvasOffset.x += (Math.random() - 0.5) * 50;
      state.globalCanvasOffset.y += (Math.random() - 0.5) * 50;
      const propel = (list) => {
        for (let i = 0; i < list.length; i++) {
          let obj = list[i];
          const dx = obj.x - this.x;
          const dy = obj.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < state.shockwaveRadius && !obj.shocked) {
            obj.shocked = true;
            const power = 3000 + Math.random() * 2000;
            if (obj.vx !== undefined) {
              obj.vx += (dx / dist) * power;
              obj.vy += (dy / dist) * power;
            }
          }
        }
      };
      propel(state.goodShapes);
      propel(state.badShapes);
      propel(state.dataOrbs);
      propel(state.sparks);
      if (state.shockwaveRadius > 4000) {
        this.phase = "DEAD";
        state.goodShapes = [];
        state.badShapes = [];
        state.sparks = [];
        state.dataOrbs = [];
      }
    }
    if (state.invertTimer > 0) {
      state.invertTimer -= dt;
      state.globalInvert = true;
      if (state.invertTimer <= 0) {
        state.globalInvert = false;
      }
    }
    this.scaleMultiplier += (1 - this.scaleMultiplier) * 0.1;
    this.shadowBlurMultiplier += (1 - this.shadowBlurMultiplier) * 0.1;
    this.scaleX += (1 - this.scaleX) * 0.2;
    this.scaleY += (1 - this.scaleY) * 0.2;
  }
  draw(ctx) {
    if (this.phase === "DEAD" || this.phase === "EXPLODING") return;
    const rx = this.radius * this.scaleMultiplier * this.scaleX;
    const ry = this.radius * this.scaleMultiplier * this.scaleY;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, rx, ry, 0, 0, Math.PI * 2);
    if (this.surfaceNodes) {
      for (let i = 0; i < this.surfaceNodes.length; i++) {
        const node = this.surfaceNodes[i];
        const cx = this.x + Math.cos(node.angle) * rx * 0.9;
        const cy = this.y + Math.sin(node.angle) * ry * 0.9;
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius * node.sizeRatio, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 30 * this.shadowBlurMultiplier;
    ctx.fill();
    if (this.scaleMultiplier > 1.05) {
      const amt = (this.scaleMultiplier - 1.0) * 10;
      for (let i = 0; i < 15 * amt; i++) {
        const bx = this.x + (Math.random() - 0.5) * rx * 1.5;
        const by = this.y + (Math.random() - 0.5) * ry * 1.5;
        const br = rx * Math.random() * 0.4 + 5;
        const cols = ["#ff0000", "#ff5500", "#ff0055"];
        ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
class Jail {
  constructor() {
    this.w = window.innerWidth * 0.8;
    this.h = Math.min(400, window.innerHeight * 0.5);
    this.x = width / 2 - this.w / 2;
    this.y = height / 2 - this.h / 2;
    this.topDestroyed = false;
    this.morphProgress = 0;
    this.morphComplete = false;
    this.isMorphing = false;
    this.targetPath = [];
    const steps = 100;
    for (let i = 0; i < steps; i++)
      this.targetPath.push({ x: this.x + (this.w * i) / steps, y: this.y });
    for (let i = 0; i < steps; i++)
      this.targetPath.push({
        x: this.x + this.w,
        y: this.y + (this.h * i) / steps,
      });
    for (let i = 0; i < steps; i++)
      this.targetPath.push({
        x: this.x + this.w - (this.w * i) / steps,
        y: this.y + this.h,
      });
    for (let i = 0; i < steps; i++)
      this.targetPath.push({
        x: this.x,
        y: this.y + this.h - (this.h * i) / steps,
      });
  }
  update(dt) {
    if (this.isMorphing) {
      this.morphProgress += dt * 0.8;
      if (this.morphProgress >= 1.0) {
        this.morphProgress = 1.0;
        this.isMorphing = false;
        this.morphComplete = true;
      }
    }
  }
  startMorph() {
    this.isMorphing = true;
    const resampled = [];
    const totalPoints = this.targetPath.length;
    if (state.drawingPath.length > 0) {
      for (let i = 0; i < totalPoints; i++) {
        const percent = i / (totalPoints - 1);
        const idxFloat = percent * (state.drawingPath.length - 1);
        const idx1 = Math.floor(idxFloat);
        const idx2 = Math.ceil(idxFloat);
        const t = idxFloat - idx1;
        const p1 = state.drawingPath[idx1];
        const p2 = state.drawingPath[idx2];
        resampled.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }
      state.drawingPath = resampled;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    const outerPad = 25;
    const ow = this.w + outerPad * 2;
    const oh = this.h + outerPad * 2;
    const ox = this.x - outerPad;
    const oy = this.y - outerPad;
    const jitter = () => (Math.random() - 0.5) * 5;
    if (this.morphComplete) {
      const drawRect = (rx, ry, rw, rh, skipTop) => {
        ctx.beginPath();
        if (!skipTop) {
          ctx.moveTo(rx + jitter(), ry + jitter());
          ctx.lineTo(rx + rw + jitter(), ry + jitter());
        } else {
          ctx.moveTo(rx + rw + jitter(), ry + jitter());
        }
        ctx.lineTo(rx + rw + jitter(), ry + rh + jitter());
        ctx.lineTo(rx + jitter(), ry + rh + jitter());
        ctx.lineTo(rx + jitter(), ry + jitter());
        ctx.stroke();
      };
      drawRect(this.x, this.y, this.w, this.h, this.topDestroyed);
      drawRect(ox, oy, ow, oh, this.topDestroyed);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const stepsX = Math.floor(this.w / 20);
      const stepsY = Math.floor(this.h / 20);
      if (!this.topDestroyed) {
        for (let i = 0; i <= stepsX; i++) {
          const px = this.x + (i / stepsX) * this.w;
          ctx.moveTo(px, this.y);
          ctx.lineTo(px + jitter() * 3, oy);
        }
      }
      for (let i = 0; i <= stepsX; i++) {
        const px = this.x + (i / stepsX) * this.w;
        ctx.moveTo(px, this.y + this.h);
        ctx.lineTo(px + jitter() * 3, oy + oh);
      }
      for (let i = 0; i <= stepsY; i++) {
        const py = this.y + (i / stepsY) * this.h;
        ctx.moveTo(this.x, py);
        ctx.lineTo(ox, py + jitter() * 3);
        ctx.moveTo(this.x + this.w, py);
        ctx.lineTo(ox + ow, py + jitter() * 3);
      }
      ctx.stroke();
      if (vimLogo.complete && this.morphComplete) {
        const logoSize = 50;
        ctx.drawImage(
          vimLogo,
          this.x + this.w + 15,
          this.y - 15,
          logoSize,
          logoSize,
        );
      }
    } else {
      ctx.beginPath();
      ctx.setLineDash([10, 15]);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(Date.now() * 0.01) * 0.4})`;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.w, this.y);
      ctx.lineTo(this.x + this.w, this.y + this.h);
      ctx.lineTo(this.x, this.y + this.h);
      ctx.closePath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + ow, oy);
      ctx.lineTo(ox + ow, oy + oh);
      ctx.lineTo(ox, oy + oh);
      ctx.closePath();
      ctx.stroke();
      if (state.drawingPath.length > 0) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        for (let i = 0; i < state.drawingPath.length; i++) {
          const p = state.drawingPath[i];
          if (this.isMorphing) {
            const targetP = this.targetPath[i];
            const t = easeInOutCubic(this.morphProgress);
            const curX = p.x + (targetP.x - p.x) * t;
            const curY = p.y + (targetP.y - p.y) * t;
            if (i === 0) ctx.moveTo(curX, curY);
            else ctx.lineTo(curX, curY);
          } else {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
        if (this.isMorphing || state.jailDrawn) {
          ctx.beginPath();
          for (let i = 0; i < state.drawingPath.length; i++) {
            const p = state.drawingPath[i];
            if (this.isMorphing) {
              const targetP = this.targetPath[i];
              const t = easeInOutCubic(this.morphProgress);
              const cx = this.x + this.w / 2;
              const cy = this.y + this.h / 2;
              const dx = targetP.x - cx;
              const dy = targetP.y - cy;
              const dist = Math.hypot(dx, dy);
              const nx = dist > 0 ? dx / dist : 0;
              const ny = dist > 0 ? dy / dist : 0;
              const outTargetX = targetP.x + nx * outerPad;
              const outTargetY = targetP.y + ny * outerPad;
              const curX = p.x + (outTargetX - p.x) * t;
              const curY = p.y + (outTargetY - p.y) * t;
              if (i === 0) ctx.moveTo(curX, curY);
              else ctx.lineTo(curX, curY);
            }
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
class BlueOrb {
  constructor() {
    this.originX = width / 2;
    this.originY = height / 2;
    this.x = this.originX;
    this.y = this.originY;
    this.baseRadius = 40;
    this.radius = this.baseRadius;
    this.scaleMultiplier = 1;
    this.shadowBlurMultiplier = 1;
    this.phase = "IDLE_WAIT";
    this.timer = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.emissionCount = 0;
  }
  update(dt, time) {
    this.radius = this.baseRadius * this.scaleMultiplier;
    if (this.phase === "IDLE_WAIT") {
    } else if (this.phase === "ENTERING") {
      this.x = width * 0.5;
      this.y += (-height * 0.25 - this.y) * 4 * dt;
      if (Math.abs(this.y - -height * 0.25) < 2) {
        this.y = -height * 0.25;
        this.phase = "TRAINING_BLUE";
        state.trainingTimer = 0;
        state.dataAbsorbed = 0;
      }
    } else if (this.phase === "TRAINING_BLUE") {
      this.x = width * 0.5 + Math.sin(time * 0.5) * 10;
      this.y = -height * 0.25 + Math.cos(time * 0.3) * 10;
      state.trainingTimer += dt;
      if (state.dataAbsorbed >= 10 && state.trainingTimer >= 3.0) {
        this.phase = "EMITTING_BLUE";
        this.timer = 0;
        this.emissionCount = 0;
        state.dataAbsorbed = 0;
        state.trainingTimer = 0;
      }
    } else if (this.phase === "EMITTING_BLUE") {
      this.timer += dt;
      this.x = width * 0.5 + Math.sin(time * 0.5) * 10;
      this.y = -height * 0.25 + Math.cos(time * 0.3) * 10;
      if (this.timer > 1.0) {
        this.timer = 0;
        this.emissionCount++;
        state.goodShapes.push(new GoodShape(this.x, this.y, false));
        if (this.emissionCount >= 5) {
          this.phase = "WAITING_FOR_FINALE";
          this.timer = 0;
          if (typeof host !== "undefined") {
            host.phase = "REALIZATION";
            host.timer = 0;
          }
        }
      }
    } else if (this.phase === "WAITING_FOR_FINALE") {
      this.x = width * 0.5;
      this.y = -height * 0.25;
      this.x += Math.sin(time * 0.5) * 20 * dt;
      this.y += Math.cos(time * 0.3) * 20 * dt;
    }
    this.scaleMultiplier += (1 - this.scaleMultiplier) * 0.1;
    this.shadowBlurMultiplier += (1 - this.shadowBlurMultiplier) * 0.1;
  }
  draw(ctx) {
    if (this.phase === "CONSUMED" || this.phase === "IDLE_WAIT") return;
    ctx.save();
    ctx.beginPath();
    const rx = this.radius * this.scaleMultiplier * this.scaleX;
    const ry = this.radius * this.scaleMultiplier * this.scaleY;
    ctx.ellipse(this.x, this.y, rx, ry, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.radius,
    );
    grad.addColorStop(0, "#aaaaff");
    grad.addColorStop(1, "#0011ff");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#0055ff";
    ctx.shadowBlur = 30 * this.shadowBlurMultiplier;
    ctx.fill();
    ctx.restore();
  }
}
const host = new HostOrb();
state.blueOrb = new BlueOrb();
class DataOrb {
  constructor(x, y, id) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.radius = 25 + Math.random() * 10;
    this.color = "#00ff00";
    this.history = [];
    this.vx = 0;
    this.vy = 0;
    this.maxSpeed = 350;
    this.chaosMultiplier = 500;
    this.dead = false;
  }
  update(dt, time, hostObj) {
    const dx = hostObj.x - this.x;
    const dy = hostObj.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (hostObj.phase === "TRAINING_1") {
      this.color = "#ff0000";
    } else if (hostObj.phase === "TRAINING_BLUE") {
      this.color = "#00aaff";
    } else {
      let colorFactor = 1.0;
      if (dist < 200) {
        colorFactor = dist / 200;
      }
      const r = Math.floor(255 * (1 - colorFactor));
      const g = Math.floor(255 * colorFactor);
      const b = Math.floor(50 * (1 - colorFactor));
      this.color = `rgb(${r}, ${g}, ${b})`;
    }
    if (dist < hostObj.radius) {
      this.dead = true;
      if (hostObj.phase !== "TRAINING_BLUE") {
        const growthPerStage = 12.5 / 3;
        if (
          hostObj.phase === "TRAINING_1" &&
          hostObj.baseRadius < 40 + growthPerStage
        ) {
          hostObj.baseRadius += growthPerStage / 20;
          if (hostObj.baseRadius > 40 + growthPerStage)
            hostObj.baseRadius = 40 + growthPerStage;
        } else if (
          hostObj.phase === "TRAINING_2" &&
          hostObj.baseRadius < 40 + growthPerStage * 2
        ) {
          hostObj.baseRadius += growthPerStage / 20;
          if (hostObj.baseRadius > 40 + growthPerStage * 2)
            hostObj.baseRadius = 40 + growthPerStage * 2;
        } else if (
          hostObj.phase === "TRAINING_3" &&
          hostObj.baseRadius < 40 + growthPerStage * 3
        ) {
          hostObj.baseRadius += growthPerStage / 20;
          if (hostObj.baseRadius > 40 + growthPerStage * 3)
            hostObj.baseRadius = 40 + growthPerStage * 3;
        }
      }
      hostObj.scaleMultiplier += 0.02;
      hostObj.shadowBlurMultiplier = 3;
      if (hostObj.surfaceNodes) {
        hostObj.surfaceNodes.push({
          angle: Math.random() * Math.PI * 2,
          sizeRatio: 0.15 + Math.random() * 0.15,
        });
      }
      state.dataAbsorbed++;
      return;
    }
    if (dist < 200) {
      this.chaosMultiplier -= 2000 * dt;
      if (this.chaosMultiplier < 0) this.chaosMultiplier = 0;
    }
    let nx = dx / dist;
    let ny = dy / dist;
    if (dist === 0) {
      nx = 0;
      ny = 0;
    }
    const desiredVx = nx * this.maxSpeed;
    const desiredVy = ny * this.maxSpeed;
    const noiseX = window.perlin.noise(time * 2 + this.id, this.id, 0) - 0.45;
    const noiseY = window.perlin.noise(this.id, time * 2, 0) - 0.45;
    const wanderVx = noiseX * this.chaosMultiplier;
    const wanderVy = noiseY * this.chaosMultiplier;
    this.vx = desiredVx + wanderVx;
    this.vy = desiredVy + wanderVy;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.history.push({ x: this.x, y: this.y, color: this.color });
    if (this.history.length > 20) {
      this.history.shift();
    }
  }
  draw(ctx) {
    ctx.save();
    for (let i = 0; i < this.history.length; i++) {
      const pos = this.history[i];
      const opacity = Math.max(0.2, i / this.history.length);
      const r = this.radius * (0.5 + (i / this.history.length) * 0.5);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = pos.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
class GoodShape {
  constructor(x, y, chaotic = false) {
    this.x = x;
    this.y = y;
    this.chaotic = chaotic;
    this.angle = Math.random() * Math.PI * 2;
    const radialAngle = Math.random() * Math.PI * 2;
    if (this.chaotic) {
      const speed = 150 + Math.random() * 100;
      this.vx = Math.cos(radialAngle) * speed;
      this.vy = Math.sin(radialAngle) * speed;
      this.type = "abstract";
      this.life = 10.0;
    } else {
      const speed = 150 + Math.random() * 100;
      this.vx = Math.cos(radialAngle) * speed;
      this.vy = Math.sin(radialAngle) * speed;
      const types = ["triangle", "star", "hexagon", "square", "moon"];
      this.type = types[Math.floor(Math.random() * types.length)];
      this.life = 10.0;
    }
    const colors = {
      triangle: "#00ff00",
      star: "#00ff00",
      hexagon: "#ffff00",
      square: "#ff00ff",
      moon: "#ffffff",
      abstract: "#ffaa00",
    };
    this.color = colors[this.type];
    if (this.chaotic) {
      const extraColors = ["#ff00ff", "#00ffff", "#ffff00", "#ff0000"];
      this.color = extraColors[Math.floor(Math.random() * extraColors.length)];
    }
    this.size = 15 + Math.random() * 15;
  }
  update(dt) {
    if (this.chaotic) {
      if (this.verts) {
        for (let i = 0; i < this.verts.length; i++) {
          this.verts[i].r += (Math.random() - 0.5) * 15;
          this.verts[i].a += (Math.random() - 0.5) * 0.2;
        }
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += 0.05;
      this.life -= dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += 0.02;
      this.life -= dt;
    }
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.min(1, this.life);
    ctx.beginPath();
    const s = this.size;
    if (this.type === "abstract") {
      if (!this.verts) {
        this.verts = [];
        const numVerts = 10 + Math.floor(Math.random() * 15);
        for (let i = 0; i < numVerts; i++) {
          this.verts.push({
            r: s + Math.random() * s * 2,
            a: i * ((Math.PI * 2) / numVerts),
          });
        }
      }
      for (let i = 0; i < this.verts.length; i++) {
        const px = Math.cos(this.verts[i].a) * this.verts[i].r;
        const py = Math.sin(this.verts[i].a) * this.verts[i].r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (this.type === "square") {
      ctx.rect(-s, -s, s * 2, s * 2);
    } else if (this.type === "triangle") {
      ctx.moveTo(0, -s);
      ctx.lineTo(s, s);
      ctx.lineTo(-s, s);
      ctx.closePath();
    } else if (this.type === "hexagon") {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (this.type === "star") {
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? s : s / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (this.type === "moon") {
      ctx.arc(0, 0, s, Math.PI * 0.5, Math.PI * 1.5, false);
      ctx.arc(s * 0.5, 0, s * 0.8, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
}
class Spark {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = -500 - Math.random() * 500;
    this.vy = (Math.random() - 0.5) * 500;
    this.life = 1.0;
    this.size = 2 + Math.random() * 3;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.fillStyle = "#ff0000";
    ctx.globalAlpha = this.life;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}
class BadShape {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const speed = 300 + Math.random() * 700;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.verts = [];
    const numVerts = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numVerts; i++) {
      this.verts.push({
        r: 10 + Math.random() * 20,
        a: (i / numVerts) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      });
    }
    this.colors = ["#ff00ff", "#00ffff", "#ffff00", "#ff0000"];
    this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    this.life = 1.0;
    this.rot = 0;
    this.rotSpeed = (Math.random() - 0.5) * 10;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.rotSpeed * dt;
    this.life -= dt * 0.5;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life;
    ctx.beginPath();
    for (let i = 0; i < this.verts.length; i++) {
      const px = Math.cos(this.verts[i].a) * this.verts[i].r;
      const py = Math.sin(this.verts[i].a) * this.verts[i].r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
function drawBackground() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.scale(state.cameraZoom, state.cameraZoom);
  ctx.translate(-width / 2, -height / 2);
  const gridSize = 50;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  const maxW = width * (1 / state.cameraZoom) * 1.5;
  const maxH = height * (1 / state.cameraZoom) * 1.5;
  const startX = -(maxW - width) / 2;
  const endX = width + (maxW - width) / 2;
  const startY = -(maxH - height) / 2;
  const endY = height + (maxH - height) / 2;
  const offsetY = state.cameraY % gridSize;
  for (let x = startX - (startX % gridSize); x < endX; x += gridSize) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (
    let y = startY - (startY % gridSize) + offsetY;
    y < endY;
    y += gridSize
  ) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
  ctx.restore();
}
let lastTime = performance.now();
function loop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;
  state.time = currentTime / 1000;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (state.breachFlash) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    state.breachFlash = false;
    requestAnimationFrame(loop);
    return;
  }
  if (state.glitchFrames > 0) {
    state.glitchFrames--;
    state.globalCanvasOffset.x = (Math.random() - 0.5) * 40;
    state.globalCanvasOffset.y = (Math.random() - 0.5) * 40;
  } else {
    state.globalCanvasOffset.x = 0;
    state.globalCanvasOffset.y = 0;
  }
  ctx.translate(state.globalCanvasOffset.x, state.globalCanvasOffset.y);
  ctx.translate(width / 2, height / 2);
  ctx.scale(state.cameraZoom, state.cameraZoom);
  ctx.translate(-width / 2, -height / 2);
  ctx.translate(0, state.cameraY);
  ctx.globalCompositeOperation = "source-over";
  drawBackground();
  if (state.jail) {
    state.jail.update(dt);
    state.jail.draw(ctx);
  }
  for (let i = state.dataOrbs.length - 1; i >= 0; i--) {
    const activeTarget =
      state.blueOrb && state.blueOrb.phase.startsWith("TRAINING_")
        ? state.blueOrb
        : host;
    const orb = state.dataOrbs[i];
    orb.update(dt, state.time, activeTarget);
    if (orb.dead) {
      state.dataOrbs.splice(i, 1);
    } else {
      orb.draw(ctx);
    }
  }
  for (let i = state.goodShapes.length - 1; i >= 0; i--) {
    const shape = state.goodShapes[i];
    shape.update(dt);
    if (shape.life <= 0) {
      state.goodShapes.splice(i, 1);
    } else {
      shape.draw(ctx);
    }
  }
  for (let i = state.sparks.length - 1; i >= 0; i--) {
    const shape = state.sparks[i];
    shape.update(dt);
    if (shape.life <= 0) {
      state.sparks.splice(i, 1);
    } else {
      shape.draw(ctx);
    }
  }
  for (let i = state.badShapes.length - 1; i >= 0; i--) {
    const shape = state.badShapes[i];
    shape.update(dt);
    if (shape.life <= 0) {
      state.badShapes.splice(i, 1);
    } else {
      shape.draw(ctx);
    }
  }
  if (state.blueOrb) {
    state.blueOrb.update(dt, state.time);
    state.blueOrb.draw(ctx);
  }
  host.update(dt, state.time);
  host.draw(ctx);
  const centerWX = width / 2;
  const centerWY = height / 2;
  const worldMouseX = (state.mouseX - centerWX) / state.cameraZoom + centerWX;
  const worldMouseY =
    (state.mouseY - centerWY) / state.cameraZoom + centerWY - state.cameraY;
  const activeSpawner =
    state.blueOrb && state.blueOrb.phase.startsWith("TRAINING_")
      ? state.blueOrb
      : host;
  if (activeSpawner.phase.startsWith("TRAINING_")) {
    const bound = 150 + activeSpawner.baseRadius;
    if (
      worldMouseX > activeSpawner.x - bound &&
      worldMouseX < activeSpawner.x + bound &&
      worldMouseY > activeSpawner.y - bound &&
      worldMouseY < activeSpawner.y + bound
    ) {
      if (performance.now() - state.lastSpawnTime > 50) {
        state.dataOrbs.push(
          new DataOrb(
            worldMouseX + (Math.random() - 0.5) * 20,
            worldMouseY + (Math.random() - 0.5) * 20,
            ++state.orbIdCounter,
          ),
        );
        state.lastSpawnTime = performance.now();
      }
    }
  }
  ctx.restore();
  if (state.globalInvert) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
