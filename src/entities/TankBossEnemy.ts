import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import type { Player } from "../game/Player";
import { BossEnemy } from "./BossEnemy";
import type { EnemyShotCallback } from "./Enemy";

export class TankBossEnemy extends BossEnemy {
  override readonly scoreValue = 9000;
  override maxHealth = 420;
  private artilleryCooldown = 1.2;

  constructor() {
    super();
    const armor = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.8, 6.5, 2, 1, 2), armor);
    body.position.y = -0.7;
    this.group.add(body);
    for (const side of [-1, 1]) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 6.8), armor);
      tread.position.set(side * 4.4, -0.8, 0);
      this.group.add(tread);
    }
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 8.5, 8), armor);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 1.1, 4.8);
    this.group.add(cannon);
  }

  override update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    super.update(dt, elapsed, player, shoot);
    this.artilleryCooldown -= dt;
    if (this.artilleryCooldown > 0) return;
    const target = player.getWorldPosition(new THREE.Vector3());
    const origin = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 4.8).applyQuaternion(this.group.quaternion));
    const direction = target.sub(origin).normalize();
    for (const spread of [-0.12, 0, 0.12]) {
      const shotDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      shoot(origin.clone(), shotDirection, 15);
    }
    this.artilleryCooldown = 2.1;
  }
}
