import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { COLORS } from "../config/graphicsConfig";
import type { Enemy } from "../entities/Enemy";
import type { Player } from "./Player";

export class ScanSystem {
  cooldown = 0;
  private readonly ring: THREE.Mesh;
  private active = false;
  private progress = 0;

  constructor(scene: THREE.Scene) {
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 64),
      new THREE.MeshBasicMaterial({ color: COLORS.target, side: THREE.DoubleSide, transparent: true, opacity: 0 })
    );
    this.ring.visible = false;
    scene.add(this.ring);
  }

  tryActivate(player: Player, enemies: Enemy[]): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = GAME.scanCooldown;
    this.active = true;
    this.progress = 0;
    this.ring.visible = true;
    this.ring.position.copy(player.group.position);
    enemies.forEach((enemy) => {
      if (enemy.alive && enemy.group.position.distanceTo(player.group.position) <= GAME.scanRange) enemy.scan();
    });
    return true;
  }

  update(dt: number, player: Player): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) return;
    this.progress += dt / 0.8;
    this.ring.position.copy(player.group.position);
    this.ring.scale.setScalar(1 + this.progress * GAME.scanRange);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - this.progress);
    this.ring.lookAt(this.ring.position.clone().add(new THREE.Vector3(0, 0, 1)));
    if (this.progress >= 1) {
      this.active = false;
      this.ring.visible = false;
    }
  }
}
