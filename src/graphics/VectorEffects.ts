import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";

interface ImpactEffect {
  line: THREE.LineSegments;
  life: number;
  maxLife: number;
}

export class VectorEffects {
  private muzzleFlash?: THREE.Line;
  private life = 0;
  private readonly impacts: ImpactEffect[] = [];

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

  impact(position: THREE.Vector3, color: number, size = 1): void {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i += 1) {
      const direction = new THREE.Vector3().randomDirection();
      points.push(position.clone(), position.clone().addScaledVector(direction, (1.8 + Math.random() * 2.4) * size));
    }
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    this.scene.add(line);
    this.impacts.push({ line, life: 0.24, maxLife: 0.24 });
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
    for (let i = this.impacts.length - 1; i >= 0; i -= 1) {
      const impact = this.impacts[i];
      if (!impact) continue;
      impact.life -= dt;
      impact.line.scale.multiplyScalar(1 + dt * 3.5);
      (impact.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, impact.life / impact.maxLife);
      if (impact.life <= 0) {
        this.scene.remove(impact.line);
        impact.line.geometry.dispose();
        (impact.line.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      }
    }
  }
}
