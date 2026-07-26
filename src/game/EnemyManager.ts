import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { TurretEnemy } from "../entities/TurretEnemy";
import { DroneEnemy } from "../entities/DroneEnemy";
import { BossEnemy } from "../entities/BossEnemy";
import { TankBossEnemy } from "../entities/TankBossEnemy";
import { AttackHeliBossEnemy } from "../entities/AttackHeliBossEnemy";
import type { Enemy, EnemyShotCallback } from "../entities/Enemy";
import type { Player } from "./Player";

export class EnemyManager {
  readonly enemies: Enemy[] = [];
  boss: BossEnemy;
  private readonly stageBosses: BossEnemy[];

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
    this.stageBosses = [new BossEnemy(), new BossEnemy(), new TankBossEnemy(), new AttackHeliBossEnemy()];
    this.stageBosses.forEach((boss) => this.add(boss));
    this.boss = this.stageBosses[0]!;
  }

  reset(): void {
    this.boss = this.stageBosses[0]!;
    this.enemies.forEach((enemy) => {
      enemy.resetHitReaction();
      enemy.alive = true;
      enemy.health = enemy.maxHealth;
      enemy.revealed = false;
      enemy.revealTimer = 0;
      enemy.group.visible = true;
      enemy.group.scale.setScalar(1);
    });
    this.stageBosses.forEach((boss) => {
      if (boss !== this.boss) {
        boss.alive = false;
        boss.group.visible = false;
      }
    });
  }

  prepareStage2(): void {
    this.prepareSurfaceStage(2);
  }

  prepareSurfaceStage(stage: 2 | 3 | 4): void {
    this.boss = this.stageBosses[stage - 1]!;
    this.reset();
    this.boss = this.stageBosses[stage - 1]!;
    this.boss.alive = true;
    this.boss.health = this.boss.maxHealth;
    this.boss.group.visible = true;
    const turrets = this.enemies.filter((enemy) => enemy.kind === "turret");
    const drones = this.enemies.filter((enemy) => enemy.kind === "drone");
    const turretPlacements = [
      [new THREE.Vector3(-10, 3.8, 35), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(-21.8, 12, 46), new THREE.Vector3(-1, 0, 0)],
      [new THREE.Vector3(14, 32.8, 86), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(22.8, 16, 98), new THREE.Vector3(1, 0, 0)],
      [new THREE.Vector3(-8, 14.8, 128), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(0, 20.8, 157), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(-16.8, 10, 164), new THREE.Vector3(-1, 0, 0)]
    ] as const;
    turrets.forEach((enemy, index) => {
      const placement = turretPlacements[index % turretPlacements.length];
      if (placement) enemy.relocate(placement[0], placement[1]);
    });
    const dronePlacements = [
      new THREE.Vector3(4, 10, 30), new THREE.Vector3(-5, 20, 62), new THREE.Vector3(5, 25, 92),
      new THREE.Vector3(-12, 18, 118), new THREE.Vector3(10, 26, 142), new THREE.Vector3(0, 28, 158)
    ];
    drones.forEach((enemy, index) => enemy.relocate(dronePlacements[index % dronePlacements.length] ?? new THREE.Vector3()));
    const bossPosition = stage === 2
      ? new THREE.Vector3(0, 23, 164)
      : stage === 3
        ? new THREE.Vector3(-4, 17, 132)
        : new THREE.Vector3(4, 25, 158);
    this.boss.relocate(bossPosition);
  }

  update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    this.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      enemy.beginHitReactionFrame();
      const distance = enemy.group.position.distanceTo(player.group.position);
      if (!enemy.hitStopped && (enemy.kind === "boss" || distance < 90 || index % 3 === Math.floor(elapsed * 10) % 3)) {
        enemy.update(dt, elapsed, player, shoot);
      }
      enemy.updateHitReaction(dt);
    });
    this.resolvePlayerContacts(player);
  }

  private resolvePlayerContacts(player: Player): void {
    const playerPosition = player.getWorldPosition(new THREE.Vector3());
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const enemyPosition = enemy.getPosition(new THREE.Vector3());
      const separation = playerPosition.sub(enemyPosition);
      const distance = separation.length();
      const contactRadius = enemy.kind === "boss" ? 5.8 : enemy.kind === "turret" ? 2.2 : 2.6;
      if (distance >= contactRadius) continue;
      const direction = distance > 0.001 ? separation.normalize() : player.movement.getTangent();
      const tangentDirection = direction.clone().projectOnPlane(player.movement.getInward());
      if (tangentDirection.lengthSq() < 0.001) tangentDirection.copy(player.movement.getTangent());
      tangentDirection.normalize();
      const penetration = contactRadius - distance;
      player.pushFromContact(tangentDirection, penetration * 0.72);
      enemy.resolveContact(tangentDirection.clone().negate(), penetration * 0.28);
      playerPosition.copy(player.getWorldPosition());
    }
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
