import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import { GAME } from "../config/gameConfig";
import { orientToSurface } from "../utils/MathUtils";
import type { Player } from "../game/Player";
import { Enemy, type EnemyShotCallback } from "./Enemy";

export class TurretEnemy extends Enemy {
  readonly kind = "turret" as const;
  readonly scoreValue = 300;
  maxHealth = 35;
  private cooldown = 1;
  private readonly barrel = new THREE.Mesh();

  constructor(theta: number, z: number) {
    super();
    this.health = this.maxHealth;
    const material = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.15, 0.8, 8), material);
    base.position.y = 0.2;
    this.barrel.geometry = new THREE.BoxGeometry(0.25, 0.25, 2.2);
    this.barrel.material = material;
    this.barrel.position.set(0, 0.9, 0.9);
    this.group.add(base, this.barrel);
    const radius = GAME.tunnelRadius - 0.6;
    this.group.position.set(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
    orientToSurface(this.group, theta, 1);
  }

  update(dt: number, _elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    if (!this.alive) return;
    this.tickReveal(dt);
    const origin = this.barrel.getWorldPosition(new THREE.Vector3());
    const target = player.getWorldPosition(new THREE.Vector3());
    const distance = origin.distanceTo(target);
    this.cooldown -= dt;
    if (distance < 50 && this.cooldown <= 0) {
      shoot(origin, target.sub(origin).normalize(), 9);
      this.cooldown = 1.45 + Math.random() * 0.55;
    }
  }
}
