import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { Renderer } from "../graphics/Renderer";
import { PostProcessing } from "../graphics/PostProcessing";
import { ParticleSystem } from "../graphics/ParticleSystem";
import { VectorEffects } from "../graphics/VectorEffects";
import { AudioManager } from "../audio/AudioManager";
import { UIManager } from "../ui/UIManager";
import { InputManager } from "./InputManager";
import { Player } from "./Player";
import { CameraController } from "./CameraController";
import { StageManager } from "./StageManager";
import { EnemyManager } from "./EnemyManager";
import { ProjectileManager } from "./ProjectileManager";
import { PlayerWeapon } from "./PlayerWeapon";
import { ScanSystem } from "./ScanSystem";
import { CollisionManager } from "./CollisionManager";
import { createInitialState } from "./GameState";
import { ScoreSystem } from "./ScoreSystem";

export class Game {
  private bossExplosionTime = 0;
  private bossExplosionLargeTriggered = false;
  private bossExplosionClearShown = false;
  private bossExplosionStage: 1 | 2 | 3 | 4 = 1;
  private readonly bossExplosionOrigin = new THREE.Vector3();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 340);
  private readonly renderer: Renderer;
  private readonly post: PostProcessing;
  private readonly input: InputManager;
  private readonly player: Player;
  private readonly cameraController: CameraController;
  private readonly stage: StageManager;
  private readonly enemies: EnemyManager;
  private readonly projectiles: ProjectileManager;
  private readonly weapon = new PlayerWeapon();
  private readonly scan: ScanSystem;
  private readonly particles: ParticleSystem;
  private readonly effects: VectorEffects;
  private readonly collision = new CollisionManager();
  private readonly state = createInitialState();
  private readonly scores = new ScoreSystem(this.state);
  private previousTime = performance.now();
  private animationFrame = 0;
  private running = true;
  private wasBoosting = false;
  private stageStartedAt = 0;
  private hitStop = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly ui: UIManager,
    private readonly audio: AudioManager,
    private readonly lowPerformance: boolean
  ) {
    this.scene.fog = new THREE.FogExp2(0x020a0d, lowPerformance ? 0.012 : 0.008);
    this.renderer = new Renderer(canvas, lowPerformance);
    this.post = new PostProcessing(this.renderer.instance, this.scene, this.camera, lowPerformance);
    this.input = new InputManager(canvas);
    this.input.bindTouchZones();
    this.stage = new StageManager(this.scene, lowPerformance);
    this.player = new Player(this.scene);
    this.cameraController = new CameraController(this.camera);
    this.cameraController.reset(this.player);
    this.enemies = new EnemyManager(this.scene, lowPerformance);
    this.projectiles = new ProjectileManager(this.scene);
    this.scan = new ScanSystem(this.scene);
    this.particles = new ParticleSystem(this.scene, lowPerformance);
    this.effects = new VectorEffects(this.scene);
    addEventListener("resize", this.onResize, { passive: true });
    addEventListener("keydown", this.onEscape);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  async start(stage: 1 | 2 | 3 | 4 = 1): Promise<void> {
    await this.audio.resume();
    this.input.reset();
    this.scan.reset();
    this.weapon.reset();
    this.particles.clear();
    this.effects.update(1);
    this.wasBoosting = false;
    Object.assign(this.state, createInitialState(), { mode: "playing", timeLeft: GAME.stageTime });
    this.player.reset();
    this.stage.activateTunnel();
    this.cameraController.setSurfaces([]);
    this.enemies.reset();
    this.projectiles.clear();
    this.projectiles.setStageMode("tunnel");
    this.projectiles.setObstacleSurfaces([]);
    this.weapon.lockTarget = undefined;
    this.cameraController.reset(this.player);
    this.stageStartedAt = 0;
    this.previousTime = performance.now();
    this.hitStop = 0;
    if (stage > 1) {
      this.state.stage = (stage - 1) as 1 | 2 | 3;
      this.advanceToNextStage(false);
    }
    this.ui.showGame(this.input.isTouch);
    this.ui.announceStage(stage);
    this.audio.play("start");
  }

  get currentStage(): 1 | 2 | 3 | 4 { return this.state.stage; }

  setPaused(paused: boolean): void {
    if (this.state.mode !== "playing" && this.state.mode !== "paused") return;
    this.state.mode = paused ? "paused" : "playing";
    this.input.reset();
    if (paused && document.pointerLockElement) void document.exitPointerLock();
    this.ui.showPause(paused);
    this.previousTime = performance.now();
  }

  returnToTitle(): void {
    this.state.mode = "title";
    this.input.reset();
    this.projectiles.clear();
    if (document.pointerLockElement) void document.exitPointerLock();
    this.ui.showTitle();
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onEscape);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.input.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (time - this.previousTime) / 1000));
    this.previousTime = time;
    if (this.hitStop > 0 && (this.state.mode === "playing" || this.state.mode === "boss-explosion")) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.post.render(dt * 0.2, this.state.elapsed);
      this.input.endFrame();
      this.animationFrame = requestAnimationFrame(this.loop);
      return;
    }
    if (this.state.mode === "playing" || this.state.mode === "boss-explosion") this.update(dt);
    this.post.render(dt, this.state.elapsed);
    this.input.endFrame();
    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.state.mode === "boss-explosion") {
      // Let the entire boss breakup play as a readable slow-motion set piece.
      // Gameplay is paused in this mode, so only the cinematic clock is scaled.
      this.updateBossExplosion(dt * 0.55);
      return;
    }

    const input = this.input.update();
    this.player.update(input, dt);
    this.collision.resolvePlayer(this.player);

    const previousLock = this.weapon.lockTarget;
    if (input.lock) this.weapon.lockTarget = this.enemies.findLockTarget(this.camera, this.player);
    else this.weapon.lockTarget = undefined;
    if (!previousLock && this.weapon.lockTarget) this.audio.play("lock");

    this.weapon.update(dt, input.fire, input.lock, this.player, this.cameraController,
      this.projectiles, this.effects, () => {
        this.state.shots += 1;
        this.audio.play("shot");
      });

    if (input.scanPressed && this.scan.tryActivate(this.player, this.enemies.enemies)) {
      this.audio.play("scan");
      this.post.triggerScan();
      this.ui.triggerScan();
    }
    this.scan.update(dt, this.player);

    const enemyGracePeriod = 5;
    if (this.state.elapsed - this.stageStartedAt > enemyGracePeriod) {
      this.enemies.update(dt, this.state.elapsed, this.player, (origin, direction, damage) => {
        this.projectiles.spawn(origin, direction, true, damage);
      });
    }
    this.projectiles.update(dt, this.player, this.enemies.enemies, (hit) => {
      if (hit.obstacleHit) {
        this.effects.impact(hit.position, 0x9aa6ad, 0.7);
        this.audio.play("bulletCrack");
        return;
      }
      this.particles.burst(hit.position, !hit.playerHit);
      if (hit.playerHit) {
        this.effects.impact(hit.position, 0xff3157, 1.25);
        this.audio.play("hit");
        this.audio.play("impact");
        this.player.knockback(hit.direction);
        this.player.registerHit(hit.direction);
        this.cameraController.impact(hit.direction, 0.42);
        this.triggerHitStop(0.075);
        this.post.triggerDamage();
      } else if (hit.enemy) {
        this.effects.impact(hit.position, 0xffcf45, hit.enemy.kind === "boss" ? 1.35 : 1);
        const impactForce = hit.enemy.kind === "boss" ? 1.8 : hit.enemy.kind === "turret" ? 3.2 : 2.5;
        hit.enemy.registerHit(hit.direction, impactForce);
        this.audio.play("armorHit");
        this.triggerHitStop(hit.enemy.alive ? 0.025 : 0.065);
        this.ui.confirmHit(!hit.enemy.alive);
        this.state.hits += 1;
        if (!hit.enemy.alive) {
          this.scores.enemyDestroyed(hit.enemy);
          this.audio.play("destroy");
          this.particles.burst(hit.position, true);
          if (hit.enemy.kind === "boss") this.beginBossExplosion();
        }
      }
    });

    if (this.player.boosting && !this.wasBoosting) this.audio.play("boost");
    this.wasBoosting = this.player.boosting;
    this.particles.update(dt);
    this.effects.update(dt);
    this.cameraController.update(this.player, dt, input.aimX, input.aimY, this.weapon.lockTarget?.group);
    this.state.elapsed += dt;
    this.state.timeLeft = Math.max(0, this.state.timeLeft - dt);
    this.ui.update(this.state, this.player, this.scan, this.enemies.aliveCount, Boolean(this.weapon.lockTarget), dt, this.enemies.boss, this.camera);

    if (!this.enemies.boss.alive) {
      this.beginBossExplosion();
    }
    else if (this.player.health <= 0 || this.state.timeLeft <= 0) this.finish(false);
  }

  private triggerHitStop(duration: number): void {
    this.hitStop = Math.max(this.hitStop, duration);
  }

  private advanceToNextStage(playCue = true): void {
    this.ui.hideStageClear();
    // The stage-one clear sequence runs in boss-explosion mode. Explicitly
    // return to the normal gameplay state before handing control to stage 2.
    this.state.mode = "playing";
    this.state.stage = (this.state.stage + 1) as 2 | 3 | 4;
    this.stageStartedAt = this.state.elapsed;
    this.state.timeLeft = Math.max(this.state.timeLeft, this.state.stage === 2 ? 240 : this.state.stage === 3 ? 270 : 300);
    this.player.health = Math.min(GAME.maxHealth, this.player.health + 40);
    this.player.energy = GAME.maxEnergy;
    const surfaces = this.stage.activateBuilding();
    this.cameraController.setSurfaces(surfaces);
    this.projectiles.setObstacleSurfaces(surfaces);
    this.player.movement.enterSurfaceMode(
      surfaces,
      this.stage.getBuildingStart(this.state.stage),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    );
    this.player.movement.getPosition(this.player.group.position);
    this.player.group.quaternion.copy(this.player.movement.getOrientation());
    this.enemies.prepareSurfaceStage(this.state.stage);
    this.projectiles.clear();
    this.projectiles.setStageMode("surface");
    this.weapon.lockTarget = undefined;
    this.cameraController.reset(this.player);
    this.enemies.boss.group.scale.setScalar(1);
    this.ui.announceStage(this.state.stage);
    this.post.triggerScan();
    if (playCue) this.audio.play("start");
  }

  private beginBossExplosion(): void {
    if (this.state.mode !== "playing") return;
    this.state.mode = "boss-explosion";
    this.bossExplosionTime = 0;
    this.bossExplosionLargeTriggered = false;
    this.bossExplosionClearShown = false;
    this.bossExplosionStage = this.state.stage;
    this.enemies.boss.getPosition(this.bossExplosionOrigin);
    this.enemies.boss.group.visible = true;
    this.enemies.boss.group.scale.setScalar(1);
    this.particles.startBossExplosion(this.bossExplosionOrigin);
    this.audio.play("destroy");
    this.ui.announceBossExplosion(this.bossExplosionStage);
    this.weapon.lockTarget = undefined;
    this.projectiles.clear();
  }

  private updateBossExplosion(dt: number): void {
    this.bossExplosionTime += dt;
    this.particles.update(dt);
    this.effects.update(dt);
    this.cameraController.update(this.player, dt, 0, 0);
    this.ui.update(this.state, this.player, this.scan, this.enemies.aliveCount, false, dt, this.enemies.boss, this.camera);

    if (!this.bossExplosionLargeTriggered) {
      const pulse = 1 + Math.sin(this.bossExplosionTime * 38) * 0.045;
      this.enemies.boss.group.scale.setScalar(pulse);
      this.enemies.boss.group.rotation.z += dt * (2.2 + this.bossExplosionTime * 3);
    }

    if (!this.bossExplosionLargeTriggered && this.bossExplosionTime >= 0.95) {
      this.bossExplosionLargeTriggered = true;
      this.enemies.boss.group.visible = false;
      this.post.triggerExplosion();
      this.audio.play("bigExplosion");
      this.effects.impact(this.bossExplosionOrigin, 0xffffff, 3);
      // Exaggerated kabuki-like impact: a brief, theatrical camera jolt makes
      // the destruction read as a deliberate finishing tableau.
      const impactDirection = this.bossExplosionOrigin.clone().sub(this.player.getWorldPosition(new THREE.Vector3())).normalize();
      this.cameraController.impact(impactDirection, 1.15);
      this.ui.triggerBossBlast();
    }
    if (!this.bossExplosionClearShown && this.bossExplosionTime >= 1.35) {
      this.bossExplosionClearShown = true;
      this.ui.showStageClear(this.bossExplosionStage);
      this.audio.play("clear");
    }
    if (this.bossExplosionTime >= 3.2) {
      if (this.bossExplosionStage < 4) this.advanceToNextStage();
      else this.finish(true);
    }
  }

  private finish(clear: boolean): void {
    if (this.state.mode !== "playing" && this.state.mode !== "boss-explosion") return;
    this.state.mode = clear ? "clear" : "gameover";
    if (clear) {
      this.scores.finalBonus();
      this.audio.play("clear");
    } else {
      this.audio.play("warning");
    }
    if (document.pointerLockElement) void document.exitPointerLock();
    this.ui.showResult(clear, this.state, this.scores);
  }

  private onResize = (): void => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.resize();
    this.post.resize();
  };

  private onEscape = (event: KeyboardEvent): void => {
    if (import.meta.env.DEV && event.code === "Digit2" && this.state.mode === "playing" && this.state.stage === 1) {
      this.advanceToNextStage();
      return;
    }
    if (import.meta.env.DEV && event.code === "Digit3" && this.state.mode === "playing" && this.state.stage === 2) {
      this.advanceToNextStage();
      return;
    }
    if (import.meta.env.DEV && event.code === "Digit4" && this.state.mode === "playing" && this.state.stage === 3) {
      this.advanceToNextStage();
      return;
    }
    if (import.meta.env.DEV && event.code === "Digit9" && this.state.mode === "playing" && this.enemies.boss.alive) {
      this.enemies.boss.alive = false;
      this.enemies.boss.group.visible = false;
      this.beginBossExplosion();
      return;
    }
    if (event.code !== "Escape" || !["playing", "paused"].includes(this.state.mode)) return;
    this.setPaused(this.state.mode === "playing");
  };

  private onVisibility = (): void => {
    if (document.hidden && this.state.mode === "playing") {
      this.setPaused(true);
    }
    this.previousTime = performance.now();
  };
}
