import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import { GAME } from "../config/gameConfig";
import type { Player } from "../game/Player";
import { Enemy, type EnemyShotCallback } from "./Enemy";

export class BossEnemy extends Enemy {
  readonly kind = "boss" as const;
  readonly scoreValue = 5000;
  maxHealth = 240;
  readonly weakpoints: THREE.Mesh[] = [];
  private cooldown = 1;

  constructor() {
    super();
    this.health = this.maxHealth;
    const material = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4.8, 1), material);
    this.group.add(core);
    for (let i = 0; i < 4; i += 1) {
      const weakpoint = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.75),
        new THREE.MeshBasicMaterial({ color: 0x301018, wireframe: true })
      );
      const angle = (i / 4) * Math.PI * 2;
      weakpoint.position.set(Math.cos(angle) * 5.8, Math.sin(angle) * 5.8, 0);
      weakpoint.visible = false;
      this.weakpoints.push(weakpoint);
      this.group.add(weakpoint);
    }
    this.group.position.set(0, 0, GAME.bossZ);
  }

  override scan(duration = 5): void {
    super.scan(duration);
    this.weakpoints.forEach((point) => {
      point.visible = true;
      (point.material as THREE.MeshBasicMaterial).color.setHex(COLORS.target);
    });
  }

  update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    if (!this.alive) return;
    this.tickReveal(dt);
    if (!this.revealed) this.weakpoints.forEach((point) => { point.visible = false; });
    this.group.rotation.z += dt * (this.health < this.maxHealth * 0.5 ? 0.55 : 0.25);
    const playerPosition = player.getWorldPosition(new THREE.Vector3());
    const distance = this.group.position.distanceTo(playerPosition);
    this.cooldown -= dt;
    if (distance < 75 && this.cooldown <= 0) {
      const count = this.health < this.maxHealth * 0.5 ? 5 : 3;
      for (let i = 0; i < count; i += 1) {
        const direction = playerPosition.clone().sub(this.group.position).normalize();
        direction.x += Math.sin(elapsed * 3 + i) * 0.12;
        direction.y += Math.cos(elapsed * 2 + i) * 0.12;
        shoot(this.group.position.clone(), direction.normalize(), 10);
      }
      this.cooldown = this.health < this.maxHealth * 0.5 ? 1.25 : 2;
    }
  }
}
