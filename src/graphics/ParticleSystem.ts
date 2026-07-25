import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";

interface Burst {
  line: THREE.LineSegments;
  velocities: Float32Array;
  life: number;
}

export class ParticleSystem {
  private readonly bursts: Burst[] = [];
  constructor(private readonly scene: THREE.Scene, private readonly lowPerformance: boolean) {}

  burst(position: THREE.Vector3, enemy = true): void {
    const count = this.lowPerformance ? 10 : 22;
    const positions = new Float32Array(count * 2 * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const direction = new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 7);
      velocities.set([direction.x, direction.y, direction.z], i * 3);
      positions.set([position.x, position.y, position.z, position.x, position.y, position.z], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: enemy ? COLORS.enemy : COLORS.projectile, transparent: true
    }));
    this.scene.add(line);
    this.bursts.push({ line, velocities, life: 0.75 });
  }

  update(dt: number): void {
    for (let b = this.bursts.length - 1; b >= 0; b -= 1) {
      const burst = this.bursts[b];
      if (!burst) continue;
      burst.life -= dt;
      const attribute = burst.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < burst.velocities.length / 3; i += 1) {
        const x = attribute.getX(i * 2 + 1) + burst.velocities[i * 3]! * dt;
        const y = attribute.getY(i * 2 + 1) + burst.velocities[i * 3 + 1]! * dt;
        const z = attribute.getZ(i * 2 + 1) + burst.velocities[i * 3 + 2]! * dt;
        attribute.setXYZ(i * 2 + 1, x, y, z);
      }
      attribute.needsUpdate = true;
      (burst.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, burst.life / 0.75);
      if (burst.life <= 0) {
        this.scene.remove(burst.line);
        burst.line.geometry.dispose();
        (burst.line.material as THREE.Material).dispose();
        this.bursts.splice(b, 1);
      }
    }
  }
}
