import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";

export class VectorEffects {
  private muzzleFlash?: THREE.Line;
  private life = 0;

  constructor(private readonly scene: THREE.Scene) {}

  shot(origin: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.muzzleFlash) {
      this.scene.remove(this.muzzleFlash);
      this.muzzleFlash.geometry.dispose();
    }
    this.muzzleFlash = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(direction, 3.5)]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true })
    );
    this.scene.add(this.muzzleFlash);
    this.life = 0.08;
  }

  update(dt: number): void {
    if (!this.muzzleFlash) return;
    this.life -= dt;
    (this.muzzleFlash.material as THREE.LineBasicMaterial).opacity = Math.max(0, this.life / 0.08);
    if (this.life <= 0) {
      this.scene.remove(this.muzzleFlash);
      this.muzzleFlash.geometry.dispose();
      (this.muzzleFlash.material as THREE.Material).dispose();
      this.muzzleFlash = undefined;
    }
  }
}
