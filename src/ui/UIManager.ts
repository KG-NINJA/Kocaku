import { GAME } from "../config/gameConfig";
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
  readonly startButton = required<HTMLButtonElement>("#start-button");
  readonly retryButton = required<HTMLButtonElement>("#retry-button");
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
  private readonly warning = required<HTMLElement>("#warning");
  private readonly fps = required<HTMLElement>("#fps");
  private readonly scanFlash = required<HTMLElement>("#scan-flash");
  private frameCount = 0;
  private fpsTime = 0;
  private announcement = "";
  private announcementTime = 0;

  showGame(touch: boolean): void {
    this.title.classList.add("hidden");
    this.result.classList.add("hidden");
    this.pause.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.touchControls.classList.toggle("hidden", !touch);
  }

  showPause(paused: boolean): void {
    this.pause.classList.toggle("hidden", !paused);
  }

  update(state: RuntimeState, player: Player, scanSystem: ScanSystem, enemyCount: number, locked: boolean, dt: number): void {
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
    this.scan.textContent = scanSystem.cooldown <= 0 ? "READY" : `${scanSystem.cooldown.toFixed(1)}s`;
    this.lock.textContent = locked ? "TARGET LOCKED" : "NO LOCK";
    this.lock.classList.toggle("active", locked);
    this.crosshair.classList.toggle("locked", locked);
    this.announcementTime = Math.max(0, this.announcementTime - dt);
    this.warning.textContent = this.announcementTime > 0
      ? this.announcement
      : healthPercent <= 25 ? "WARNING // STRUCTURAL FAILURE" : "";
    this.frameCount += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps.textContent = `${Math.round(this.frameCount / this.fpsTime)} FPS`;
      this.frameCount = 0;
      this.fpsTime = 0;
    }
  }

  triggerScan(): void {
    this.scanFlash.classList.remove("pulse");
    void this.scanFlash.offsetWidth;
    this.scanFlash.classList.add("pulse");
  }

  announceStage(stage: number): void {
    this.announcement = stage === 2 ? "STAGE 2 // SURFACE COMPLEX" : `STAGE ${stage}`;
    this.announcementTime = 4;
  }

  showResult(clear: boolean, state: RuntimeState, scores: ScoreSystem): void {
    this.hud.classList.add("hidden");
    this.touchControls.classList.add("hidden");
    this.result.classList.remove("hidden");
    required<HTMLElement>("#result-kicker").textContent = clear ? "DEFENSE CORE ERASED" : "SIGNAL TERMINATED";
    required<HTMLElement>("#result-title").textContent = clear ? "STAGE CLEAR" : "GAME OVER";
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
