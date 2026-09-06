import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import type { BossEnemy } from "../entities/BossEnemy";
import type { RuntimeState } from "../game/GameState";
import type { Player } from "../game/Player";
import type { ScanSystem } from "../game/ScanSystem";
import type { ScoreSystem } from "../game/ScoreSystem";

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`UI element not found: ${selector}`);
  return element;
};

export class UIManager {
  readonly stageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-stage-start]"));
  readonly retryButton = required<HTMLButtonElement>("#retry-button");
  readonly pauseButton = required<HTMLButtonElement>("#pause-button");
  readonly resumeButton = required<HTMLButtonElement>("#resume-button");
  readonly titleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-return-title]"));
  readonly lowMode = required<HTMLInputElement>("#low-mode");
  readonly volume = required<HTMLInputElement>("#volume");
  readonly muteButton = required<HTMLButtonElement>("#mute-button");
  private readonly title = required<HTMLElement>("#title-screen");
  private readonly hud = required<HTMLElement>("#hud");
  private readonly pause = required<HTMLElement>("#pause-screen");
  private readonly result = required<HTMLElement>("#result-screen");
  private readonly touchControls = required<HTMLElement>("#touch-controls");
  private readonly healthBar = required<HTMLElement>("#health-bar");
  private readonly energyBar = required<HTMLElement>("#energy-bar");
  private readonly healthText = required<HTMLElement>("#health-text");
  private readonly energyText = required<HTMLElement>("#energy-text");
  private readonly timer = required<HTMLElement>("#timer");
  private readonly score = required<HTMLElement>("#score");
  private readonly stageNumber = required<HTMLElement>("#stage-number");
  private readonly enemies = required<HTMLElement>("#enemies");
  private readonly scan = required<HTMLElement>("#scan-status");
  private readonly lock = required<HTMLElement>("#lock-label");
  private readonly crosshair = required<HTMLElement>("#crosshair");
  private readonly bossIndicator = required<HTMLElement>("#boss-indicator");
  private readonly bossName = required<HTMLElement>("#boss-name");
  private readonly bossHealthBar = required<HTMLElement>("#boss-health-bar");
  private readonly bossMarker = required<HTMLElement>("#boss-marker");
  private readonly bossDistance = required<HTMLElement>("#boss-distance");
  private readonly movementStatus = required<HTMLElement>("#movement-status");
  private readonly hitMarker = required<HTMLElement>("#hit-marker");
  private hitTime = 0;
  private readonly projected = new THREE.Vector3();
  private readonly warning = required<HTMLElement>("#warning");
  private readonly fps = required<HTMLElement>("#fps");
  private readonly scanFlash = required<HTMLElement>("#scan-flash");
  private readonly stageClearBanner = required<HTMLElement>("#stage-clear-banner");
  private frameCount = 0;
  private fpsTime = 0;
  private announcement = "";
  private announcementTime = 0;

  showGame(touch: boolean): void {
    this.hitTime = 0;
    this.hitMarker.classList.add("hidden");
    this.scanFlash.classList.remove("pulse", "boss-blast");
    this.title.classList.add("hidden");
    this.result.classList.add("hidden");
    this.pause.classList.add("hidden");
    this.stageClearBanner.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.touchControls.classList.toggle("hidden", !touch);
  }

  showPause(paused: boolean): void {
    this.pause.classList.toggle("hidden", !paused);
    this.touchControls.classList.toggle("hidden", paused || !matchMedia("(pointer: coarse)").matches);
  }

  showTitle(): void {
    this.title.classList.remove("hidden");
    [this.hud, this.pause, this.result, this.touchControls, this.stageClearBanner].forEach(element => element.classList.add("hidden"));
    this.scanFlash.classList.remove("pulse", "boss-blast");
    this.announcementTime = 0;
  }

  confirmHit(destroyed: boolean): void {
    this.hitTime = destroyed ? 0.3 : 0.12;
    this.hitMarker.classList.toggle("destroyed", destroyed);
  }

  update(
    state: RuntimeState,
    player: Player,
    scanSystem: ScanSystem,
    enemyCount: number,
    locked: boolean,
    dt: number,
    boss: BossEnemy,
    camera: THREE.Camera
  ): void {
    const healthPercent = player.health / GAME.maxHealth * 100;
    const energyPercent = player.energy / GAME.maxEnergy * 100;
    this.healthBar.style.width = `${healthPercent}%`;
    this.energyBar.style.width = `${energyPercent}%`;
    this.healthText.textContent = Math.ceil(player.health).toString();
    this.energyText.textContent = Math.ceil(player.energy).toString();
    const totalSeconds = Math.max(0, Math.ceil(state.timeLeft));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.timer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    this.score.textContent = state.score.toString().padStart(6, "0");
    this.stageNumber.textContent = state.stage.toString();
    this.enemies.textContent = enemyCount.toString();
    this.scan.textContent = scanSystem.cooldown <= 0 ? "F / 使用可能" : `${Math.ceil(scanSystem.cooldown)}s`;
    this.lock.textContent = locked ? "追尾攻撃中" : "";
    this.movementStatus.textContent = player.movement.wallAttached ? "壁面吸着 / Spaceで離脱" : !player.movement.grounded ? "空中 / 着地待ち" : "地面走行 / Shiftでスライド";
    this.movementStatus.classList.toggle("attached", player.movement.wallAttached);
    this.hud.classList.toggle("critical", healthPercent <= 25);
    this.timer.classList.toggle("urgent", state.timeLeft <= 30);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.hitMarker.classList.toggle("hidden", this.hitTime <= 0);
    this.lock.classList.toggle("active", locked);
    this.crosshair.classList.toggle("locked", locked);
    this.updateBossIndicator(state, boss, camera, player);
    this.announcementTime = Math.max(0, this.announcementTime - dt);
    this.warning.textContent = this.announcementTime > 0
      ? this.announcement
      : healthPercent <= 25 ? "装甲低下 — スライドで攻撃を回避" : state.timeLeft <= 30 ? "残り30秒 — ボスを撃破せよ" : "";
    this.frameCount += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps.textContent = `${Math.round(this.frameCount / this.fpsTime)} FPS`;
      this.frameCount = 0;
      this.fpsTime = 0;
    }
  }

  private updateBossIndicator(state: RuntimeState, boss: BossEnemy, camera: THREE.Camera, player: Player): void {
    const visible = state.mode === "playing" && boss.alive;
    this.bossIndicator.classList.toggle("hidden", !visible);
    this.bossMarker.classList.toggle("hidden", !visible);
    if (!visible) return;

    const labels: Record<number, string> = {
      1: "DEFENSE CORE",
      2: "SURFACE CORE",
      3: "COLOSSUS WALKER",
      4: "ATTACK HELICOPTER"
    };
    this.bossName.textContent = labels[state.stage] ?? "BOSS";
    this.bossHealthBar.style.width = `${THREE.MathUtils.clamp(boss.health / boss.maxHealth * 100, 0, 100)}%`;

    boss.getPosition(this.projected);
    this.bossDistance.textContent = `${Math.round(this.projected.distanceTo(player.group.position))}m`;
    this.projected.applyMatrix4(camera.matrixWorldInverse);
    const behind = this.projected.z >= 0;
    const side = this.projected.x >= 0 ? 1 : -1;
    this.projected.applyMatrix4(camera.projectionMatrix);
    const offscreen = behind || Math.abs(this.projected.x) > 0.88 || Math.abs(this.projected.y) > 0.78;
    const x = behind ? side * 0.88 : THREE.MathUtils.clamp(this.projected.x, -0.88, 0.88);
    const y = behind ? 0 : THREE.MathUtils.clamp(this.projected.y, -0.78, 0.55);
    this.bossMarker.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`;
    this.bossMarker.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
    this.bossMarker.classList.toggle("offscreen", offscreen);
    this.bossMarker.querySelector("span")!.textContent = offscreen ? behind || Math.abs(this.projected.x) > 0.88 ? x > 0 ? "▶" : "◀" : this.projected.y > 0 ? "▲" : "▼" : "◇";
    this.bossMarker.querySelector("small")!.textContent = behind ? "後方 / BOSS" : "BOSS";
  }

  triggerScan(): void {
    this.scanFlash.classList.remove("pulse");
    void this.scanFlash.offsetWidth;
    this.scanFlash.classList.add("pulse");
  }

  announceStage(stage: number): void {
    const labels: Record<number, string> = {
      1: "STAGE 1 // 防衛トンネル — 奥のボスを撃破",
      2: "STAGE 2 // SURFACE COMPLEX",
      3: "STAGE 3 // ARMORED CONFLUENCE",
      4: "STAGE 4 // AIR RAID ZONE",
    };
    this.announcement = labels[stage] ?? `STAGE ${stage}`;
    this.announcementTime = 4;
  }

  announceBossExplosion(stage: number): void {
    this.announcement = `STAGE ${stage} // ボス撃破`;
    this.announcementTime = 3.2;
    this.scanFlash.classList.remove("boss-blast");
  }

  triggerBossBlast(): void {
    void this.scanFlash.offsetWidth;
    this.scanFlash.classList.add("boss-blast");
  }

  showStageClear(stage: number): void {
    const title = this.stageClearBanner.querySelector("strong");
    if (title) title.textContent = `STAGE ${stage} CLEAR`;
    this.stageClearBanner.querySelector("i")!.textContent = stage === 4 ? "ALL SECTORS SECURED" : "次のステージへ / 装甲 +40・エネルギー回復";
    this.stageClearBanner.classList.add("hidden");
    void this.stageClearBanner.offsetWidth;
    this.stageClearBanner.classList.remove("hidden");
  }

  hideStageClear(): void {
    this.stageClearBanner.classList.add("hidden");
  }

  showResult(clear: boolean, state: RuntimeState, scores: ScoreSystem): void {
    this.hideStageClear();
    this.hud.classList.add("hidden");
    this.touchControls.classList.add("hidden");
    this.result.classList.remove("hidden");
    required<HTMLElement>("#result-kicker").textContent = clear ? "DEFENSE CORE ERASED" : "SIGNAL TERMINATED";
    required<HTMLElement>("#result-title").textContent = clear ? "ALL CLEAR" : "GAME OVER";
    required<HTMLElement>("#result-stats").innerHTML = `
      <span>SCORE <b>${state.score.toString().padStart(6, "0")}</b></span>
      <span>DESTROYED <b>${state.kills}</b></span>
      <span>ACCURACY <b>${scores.accuracy}%</b></span>
      <span>TIME <b>${state.elapsed.toFixed(1)}s</b></span>`;
  }

  showError(error: unknown): void {
    required<HTMLElement>("#error-screen").classList.remove("hidden");
    required<HTMLElement>("#error-message").textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  }
}
