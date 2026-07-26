import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
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
  private readonly impactVelocity = new THREE.Vector3();
  private readonly impactOffset = new THREE.Vector3();
  private readonly appliedImpactOffset = new THREE.Vector3();
  private impactSpin = 0;
  private impactPulse = 0;
  private hitFlashTime = 0;
  private hitStopTime = 0;

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

  get hitStopped(): boolean { return this.hitStopTime > 0; }

  registerHit(direction: THREE.Vector3, force: number): void {
    const impulse = direction.clone().normalize().multiplyScalar(force * (this.kind === "boss" ? 0.28 : 1));
    this.impactVelocity.add(impulse);
    this.impactSpin += (Math.random() - 0.5) * force * 0.9;
    this.impactPulse = Math.min(1.2, this.impactPulse + 0.85);
    this.hitFlashTime = 0.09;
    this.hitStopTime = Math.max(this.hitStopTime, this.kind === "boss" ? 0.08 : 0.055);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.color.setHex(0xffffff);
      }
    });
  }

  beginHitReactionFrame(): void {
    this.group.position.sub(this.appliedImpactOffset);
    this.appliedImpactOffset.set(0, 0, 0);
  }

  updateHitReaction(dt: number): void {
    this.hitStopTime = Math.max(0, this.hitStopTime - dt);
    this.impactOffset.addScaledVector(this.impactVelocity, dt);
    this.impactVelocity.multiplyScalar(Math.exp(-11 * dt));
    this.impactOffset.multiplyScalar(Math.exp(-8 * dt));
    if (this.impactOffset.lengthSq() > 3.24) this.impactOffset.setLength(1.8);
    this.group.position.add(this.impactOffset);
    this.appliedImpactOffset.copy(this.impactOffset);
    this.impactPulse = Math.max(0, this.impactPulse - dt * 8.5);
    this.group.scale.setScalar(1 + this.impactPulse * 0.12);
    this.group.rotation.z += this.impactSpin * dt;
    this.impactSpin *= Math.exp(-13 * dt);
    this.hitFlashTime -= dt;
    if (this.hitFlashTime <= 0) {
      const color = this.revealed ? COLORS.target : COLORS.enemy;
      this.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.setHex(color);
        }
      });
    }
  }

  resolveContact(direction: THREE.Vector3, distance: number): void {
    const correction = direction.clone().normalize().multiplyScalar(distance);
    this.impactOffset.add(correction);
    if (this.impactOffset.lengthSq() > 3.24) this.impactOffset.setLength(1.8);
    this.group.position.add(correction);
    this.appliedImpactOffset.add(correction);
  }

  resetHitReaction(): void {
    this.group.position.sub(this.appliedImpactOffset);
    this.appliedImpactOffset.set(0, 0, 0);
    this.impactVelocity.set(0, 0, 0);
    this.impactOffset.set(0, 0, 0);
    this.impactSpin = 0;
    this.impactPulse = 0;
    this.hitFlashTime = 0;
    this.hitStopTime = 0;
    this.group.scale.setScalar(1);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.color.setHex(COLORS.enemy);
      }
    });
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

  relocate(position: THREE.Vector3, normal = new THREE.Vector3(0, 1, 0)): void {
    this.resetHitReaction();
    this.group.position.copy(position);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
  }
}
