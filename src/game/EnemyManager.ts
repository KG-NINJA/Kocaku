import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { TurretEnemy } from "../entities/TurretEnemy";
import { DroneEnemy } from "../entities/DroneEnemy";
import { BossEnemy } from "../entities/BossEnemy";
import type { Enemy, EnemyShotCallback } from "../entities/Enemy";
import type { Player } from "./Player";

export class EnemyManager {
  readonly enemies: Enemy[] = [];
  readonly boss: BossEnemy;

  constructor(private readonly scene: THREE.Scene, lowPerformance: boolean) {
    const scale = lowPerformance ? 0.65 : 1;
    const turrets: Array<[number, number]> = [
      [-1.6, 34], [0.1, 58], [2.5, 91], [-2.8, 118], [1.1, 148], [-0.4, 181], [2.2, 207]
    ];
    turrets.slice(0, Math.ceil(turrets.length * scale)).forEach(([theta, z]) => this.add(new TurretEnemy(theta, z)));
    const drones = [
      new THREE.Vector3(2, 1, 48), new THREE.Vector3(-4, 5, 76), new THREE.Vector3(3, -2, 108),
      new THREE.Vector3(-2, -5, 138), new THREE.Vector3(4, 3, 172), new THREE.Vector3(0, -3, 205)
    ];
    drones.slice(0, Math.ceil(drones.length * scale)).forEach((position) => this.add(new DroneEnemy(position)));
    this.boss = new BossEnemy();
    this.add(this.boss);
  }

  reset(): void {
    this.enemies.forEach((enemy) => {
      enemy.alive = true;
      enemy.health = enemy.maxHealth;
      enemy.group.visible = true;
    });
  }

  update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    this.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      const dz = Math.abs(enemy.group.position.z - player.movement.z);
      if (enemy.kind === "boss" || dz < 80 || index % 3 === Math.floor(elapsed * 10) % 3) {
        enemy.update(dt, elapsed, player, shoot);
      }
    });
  }

  get aliveCount(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  findLockTarget(camera: THREE.Camera, player: Player): Enemy | undefined {
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    let best: { enemy: Enemy; value: number } | undefined;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const toEnemy = enemy.getPosition(new THREE.Vector3()).sub(cameraPosition);
      const distance = toEnemy.length();
      if (distance > GAME.lockRange) continue;
      const angle = cameraDirection.angleTo(toEnemy.normalize());
      if (angle > GAME.lockAngle) continue;
      const value = angle + distance / GAME.lockRange * 0.15;
      if (!best || value < best.value) best = { enemy, value };
    }
    void player;
    return best?.enemy;
  }

  private add(enemy: Enemy): void {
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
  }
}
