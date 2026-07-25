import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import type { Enemy } from "../entities/Enemy";
import type { CameraController } from "./CameraController";
import type { Player } from "./Player";
import type { ProjectileManager } from "./ProjectileManager";
import type { VectorEffects } from "../graphics/VectorEffects";

export class PlayerWeapon {
  lockTarget?: Enemy;
  private cooldown = 0;
  private missileCooldown = 0;
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();

  update(dt: number, firing: boolean, locking: boolean, player: Player, camera: CameraController,
    projectiles: ProjectileManager, effects: VectorEffects, onShot: () => void): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    if (!locking || !this.lockTarget?.alive) this.lockTarget = undefined;
    if (locking && this.lockTarget?.alive && this.missileCooldown <= 0) {
      player.muzzle.getWorldPosition(this.origin);
      this.direction.copy(this.lockTarget.getPosition(new THREE.Vector3()).sub(this.origin).normalize());
      projectiles.spawn(this.origin, this.direction, false, 28, this.lockTarget);
      effects.shot(this.origin.clone(), this.direction.clone());
      this.missileCooldown = GAME.missileInterval;
      onShot();
    }
    if (!firing || this.cooldown > 0) return;
    player.muzzle.getWorldPosition(this.origin);
    camera.camera.getWorldDirection(this.direction);
    if (this.lockTarget?.alive) {
      this.direction.copy(this.lockTarget.getPosition(new THREE.Vector3()).sub(this.origin).normalize());
    }
    projectiles.spawn(this.origin, this.direction, false, 12);
    effects.shot(this.origin.clone(), this.direction.clone());
    this.cooldown = GAME.fireInterval;
    onShot();
  }
}
