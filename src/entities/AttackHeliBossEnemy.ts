import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import type { Player } from "../game/Player";
import { BossEnemy } from "./BossEnemy";
import type { EnemyShotCallback } from "./Enemy";

export class AttackHeliBossEnemy extends BossEnemy {
  override readonly scoreValue = 12000;
  override maxHealth = 560;
  private rocketCooldown = 0.8;

  constructor() {
    super();
    const armor = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 7, 6, 12), armor);
    fuselage.rotation.x = Math.PI / 2;
    this.group.add(fuselage);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(2.1, 8, 5), new THREE.MeshBasicMaterial({ color: COLORS.target, wireframe: true }));
    cockpit.position.z = 3.1;
    this.group.add(cockpit);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.16, 0.55), armor);
    rotor.position.y = 2.8;
    this.group.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 7), armor);
    tail.position.z = -5.2;
    this.group.add(tail);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), armor);
    tailRotor.position.set(0, 0.8, -8.2);
    this.group.add(tailRotor);
  }

  override update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    super.update(dt, elapsed, player, shoot);
    this.group.rotation.y += dt * 0.5;
    this.group.rotation.z += Math.sin(elapsed * 2.4) * dt * 0.16;
    this.rocketCooldown -= dt;
    if (this.rocketCooldown > 0) return;
    const target = player.getWorldPosition(new THREE.Vector3());
    const origin = this.group.position.clone().add(new THREE.Vector3(0, 0.5, 3.8).applyQuaternion(this.group.quaternion));
    const direction = target.sub(origin).normalize();
    for (const spread of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const shotDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      shoot(origin.clone(), shotDirection, 12);
    }
    this.rocketCooldown = 1.65;
  }
}
