import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { COLORS } from "../config/graphicsConfig";
import { ObjectPool } from "../utils/ObjectPool";
import type { Enemy } from "../entities/Enemy";
import type { Player } from "./Player";

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  damage: number;
  hostile: boolean;
  active: boolean;
}

export interface HitResult {
  enemy?: Enemy;
  playerHit: boolean;
  position: THREE.Vector3;
}

export class ProjectileManager {
  private readonly active: Projectile[] = [];
  private readonly pool: ObjectPool<Projectile>;

  constructor(private readonly scene: THREE.Scene) {
    this.pool = new ObjectPool(() => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 5, 4),
        new THREE.MeshBasicMaterial({ color: COLORS.projectile })
      );
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), lifetime: 0, damage: 0, hostile: false, active: false };
    }, 48);
  }

  spawn(origin: THREE.Vector3, direction: THREE.Vector3, hostile: boolean, damage: number): void {
    const shot = this.pool.acquire();
    shot.active = true;
    shot.hostile = hostile;
    shot.damage = damage;
    shot.lifetime = GAME.projectileLifetime;
    shot.mesh.position.copy(origin);
    shot.velocity.copy(direction).multiplyScalar(hostile ? GAME.enemyProjectileSpeed : GAME.projectileSpeed);
    (shot.mesh.material as THREE.MeshBasicMaterial).color.setHex(hostile ? COLORS.enemyProjectile : COLORS.projectile);
    shot.mesh.visible = true;
    this.active.push(shot);
  }

  update(dt: number, player: Player, enemies: Enemy[], onHit: (result: HitResult) => void): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const shot = this.active[i];
      if (!shot) continue;
      shot.mesh.position.addScaledVector(shot.velocity, dt);
      shot.lifetime -= dt;
      let hit = false;
      const radius = Math.hypot(shot.mesh.position.x, shot.mesh.position.y);
      if (radius > GAME.tunnelRadius - 0.15 || shot.mesh.position.z < 0 || shot.mesh.position.z > GAME.tunnelLength) hit = true;
      if (shot.hostile && shot.mesh.position.distanceToSquared(player.group.position) < 1.6) {
        player.damage(shot.damage);
        onHit({ playerHit: true, position: shot.mesh.position.clone() });
        hit = true;
      } else if (!shot.hostile) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const threshold = enemy.kind === "boss" ? 30 : 2.4;
          if (shot.mesh.position.distanceToSquared(enemy.group.position) < threshold) {
            enemy.damage(shot.damage);
            onHit({ enemy, playerHit: false, position: shot.mesh.position.clone() });
            hit = true;
            break;
          }
        }
      }
      if (hit || shot.lifetime <= 0) this.release(i, shot);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const shot = this.active[i];
      if (shot) this.release(i, shot);
    }
  }

  private release(index: number, shot: Projectile): void {
    shot.active = false;
    shot.mesh.visible = false;
    this.active.splice(index, 1);
    this.pool.release(shot);
  }
}
