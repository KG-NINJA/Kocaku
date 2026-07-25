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

  async start(): Promise<void> {
    await this.audio.resume();
    Object.assign(this.state, createInitialState(), { mode: "playing", timeLeft: GAME.stageTime });
    this.player.reset();
    this.stage.activateTunnel();
    this.enemies.reset();
    this.projectiles.clear();
    this.projectiles.setStageMode("tunnel");
    this.weapon.lockTarget = undefined;
    this.cameraController.reset(this.player);
    this.stageStartedAt = 0;
    this.previousTime = performance.now();
    this.ui.showGame(this.input.isTouch);
    this.audio.play("start");
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
    if (this.state.mode === "playing" || this.state.mode === "boss-explosion") this.update(dt);
    this.post.render(dt, this.state.elapsed);
    this.input.endFrame();
    this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.state.mode === "boss-explosion") {
      this.updateBossExplosion(dt);
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

    const enemyGracePeriod = import.meta.env.DEV && this.state.stage === 2 ? 120 : this.state.stage === 2 ? 20 : 8;
    if (this.state.elapsed - this.stageStartedAt > enemyGracePeriod) {
      this.enemies.update(dt, this.state.elapsed, this.player, (origin, direction, damage) => {
        this.projectiles.spawn(origin, direction, true, damage);
      });
    }
    this.projectiles.update(dt, this.player, this.enemies.enemies, (hit) => {
      this.particles.burst(hit.position, !hit.playerHit);
      if (hit.playerHit) {
        this.effects.impact(hit.position, 0xff3157, 1.25);
        this.audio.play("hit");
        this.audio.play("impact");
        this.player.knockback(hit.direction);
        this.post.triggerDamage();
      } else if (hit.enemy) {
        this.effects.impact(hit.position, 0xffcf45, hit.enemy.kind === "boss" ? 1.35 : 1);
        this.state.hits += 1;
        if (!hit.enemy.alive) {
          this.scores.enemyDestroyed(hit.enemy);
          this.audio.play("destroy");
          this.particles.burst(hit.position, true);
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
    this.ui.update(this.state, this.player, this.scan, this.enemies.aliveCount, Boolean(this.weapon.lockTarget), dt);

    if (!this.enemies.boss.alive) {
      if (this.state.stage === 1) this.advanceToStage2();
      else this.beginBossExplosion();
    }
    else if (this.player.health <= 0 || this.state.timeLeft <= 0) this.finish(false);
  }

  private advanceToStage2(): void {
    this.state.stage = 2;
    this.stageStartedAt = this.state.elapsed;
    this.state.timeLeft = Math.max(this.state.timeLeft, 210);
    this.player.health = Math.min(GAME.maxHealth, this.player.health + 40);
    this.player.energy = GAME.maxEnergy;
    const surfaces = this.stage.activateBuilding();
    this.player.movement.enterSurfaceMode(
      surfaces,
      this.stage.buildingStart,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    );
    this.player.movement.getPosition(this.player.group.position);
    this.player.group.quaternion.copy(this.player.movement.getOrientation());
    this.enemies.prepareStage2();
    this.projectiles.clear();
    this.projectiles.setStageMode("surface");
    this.weapon.lockTarget = undefined;
    this.cameraController.reset(this.player);
    this.ui.announceStage(2);
    this.post.triggerScan();
    this.audio.play("start");
  }

  private beginBossExplosion(): void {
    if (this.state.mode !== "playing") return;
    this.state.mode = "boss-explosion";
    this.bossExplosionTime = 0;
    this.bossExplosionLargeTriggered = false;
    this.enemies.boss.getPosition(this.bossExplosionOrigin);
    this.particles.startBossExplosion(this.bossExplosionOrigin);
    this.audio.play("destroy");
    this.ui.announceBossExplosion();
    this.weapon.lockTarget = undefined;
    this.projectiles.clear();
  }

  private updateBossExplosion(dt: number): void {
    this.bossExplosionTime += dt;
    this.particles.update(dt);
    this.effects.update(dt);
    this.cameraController.update(this.player, dt, 0, 0);

    if (!this.bossExplosionLargeTriggered && this.bossExplosionTime >= 0.95) {
      this.bossExplosionLargeTriggered = true;
      this.post.triggerExplosion();
      this.audio.play("bigExplosion");
      this.effects.impact(this.bossExplosionOrigin, 0xffffff, 3);
    }
    if (this.bossExplosionTime >= 2.35) this.finish(true);
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
      this.advanceToStage2();
      return;
    }
    if (import.meta.env.DEV && event.code === "Digit9" && this.state.mode === "playing" && this.state.stage === 2) {
      this.enemies.boss.alive = false;
      this.enemies.boss.group.visible = false;
      this.beginBossExplosion();
      return;
    }
    if (event.code !== "Escape" || !["playing", "paused"].includes(this.state.mode)) return;
    this.state.mode = this.state.mode === "playing" ? "paused" : "playing";
    this.ui.showPause(this.state.mode === "paused");
    this.previousTime = performance.now();
  };

  private onVisibility = (): void => {
    if (document.hidden && this.state.mode === "playing") {
      this.state.mode = "paused";
      this.ui.showPause(true);
    }
    this.previousTime = performance.now();
  };
}
