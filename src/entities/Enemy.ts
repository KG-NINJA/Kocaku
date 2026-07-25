import * as THREE from "three";
import type { Player } from "../game/Player";

export type EnemyKind = "turret" | "drone" | "boss";
export type EnemyShotCallback = (origin: THREE.Vector3, direction: THREE.Vector3, damage: number) => void;

export abstract class Enemy {
  readonly group = new THREE.Group();
  alive = true;
  revealed = false;
  revealTimer = 0;
  abstract readonly kind: EnemyKind;
  abstract readonly scoreValue: number;
  abstract maxHealth: number;
  health = 1;

  abstract update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void;

  damage(amount: number): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  scan(duration = 4): void {
    this.revealed = true;
    this.revealTimer = duration;
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.color.setHex(0xffcf45);
      }
    });
  }

  tickReveal(dt: number): void {
    if (!this.revealed) return;
    this.revealTimer -= dt;
    if (this.revealTimer <= 0) {
      this.revealed = false;
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.setHex(0xff3157);
        }
      });
    }
  }

  getPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.group.getWorldPosition(target);
  }
}
