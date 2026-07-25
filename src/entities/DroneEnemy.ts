import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import type { Player } from "../game/Player";
import { Enemy, type EnemyShotCallback } from "./Enemy";

export class DroneEnemy extends Enemy {
  readonly kind = "drone" as const;
  readonly scoreValue = 500;
  maxHealth = 25;
  private cooldown = 0.8;
  private readonly basePosition: THREE.Vector3;
  private readonly phase: number;

  constructor(position: THREE.Vector3) {
    super();
    this.health = this.maxHealth;
    this.basePosition = position.clone();
    this.phase = Math.random() * Math.PI * 2;
    const material = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 1), material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 5, 16), material);
    ring.rotation.x = Math.PI / 2;
    this.group.add(body, ring);
    this.group.position.copy(position);
  }

  update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    if (!this.alive) return;
    this.tickReveal(dt);
    this.group.position.x = this.basePosition.x + Math.sin(elapsed * 1.3 + this.phase) * 3;
    this.group.position.y = this.basePosition.y + Math.cos(elapsed * 1.1 + this.phase) * 2;
    this.group.rotation.z += dt * 0.8;
    const target = player.getWorldPosition(new THREE.Vector3());
    const distance = this.group.position.distanceTo(target);
    this.cooldown -= dt;
    if (distance < 55 && this.cooldown <= 0) {
      shoot(this.group.position.clone(), target.sub(this.group.position).normalize(), 7);
      this.cooldown = 1.7 + Math.random() * 0.65;
    }
  }
}
