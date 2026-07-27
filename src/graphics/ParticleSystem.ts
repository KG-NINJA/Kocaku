import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";

interface Burst {
  line: THREE.LineSegments;
  velocities: Float32Array;
  life: number;
  maxLife: number;
  gravity: number;
}

interface BossSequence {
  origin: THREE.Vector3;
  time: number;
  nextSmall: number;
  largeStarted: boolean;
}

interface PolygonFragment {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

export class ParticleSystem {
  private readonly bursts: Burst[] = [];
  private readonly polygonFragments: PolygonFragment[] = [];
  private bossSequence?: BossSequence;
  constructor(private readonly scene: THREE.Scene, private readonly lowPerformance: boolean) {}

  burst(position: THREE.Vector3, enemy = true, multiplier = 1, velocityScale = 1, life = 0.34, gravity = 0): void {
    const count = (this.lowPerformance ? 10 : 22) * multiplier;
    const positions = new Float32Array(count * 2 * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const direction = new THREE.Vector3().randomDirection().multiplyScalar((3 + Math.random() * 7) * velocityScale);
      velocities.set([direction.x, direction.y, direction.z], i * 3);
      positions.set([position.x, position.y, position.z, position.x, position.y, position.z], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: enemy ? COLORS.enemy : COLORS.projectile, transparent: true
    }));
    this.scene.add(line);
    this.bursts.push({ line, velocities, life, maxLife: life, gravity });
  }

  startBossExplosion(position: THREE.Vector3): void {
    this.bossSequence = { origin: position.clone(), time: 0, nextSmall: 0, largeStarted: false };
  }

  update(dt: number): void {
    if (this.bossSequence) {
      const sequence = this.bossSequence;
      sequence.time += dt;
      while (sequence.time >= sequence.nextSmall && sequence.nextSmall < 1.05) {
        const offset = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 5);
        this.burst(sequence.origin.clone().add(offset), true, this.lowPerformance ? 1 : 2);
        sequence.nextSmall += 0.1;
      }
      if (!sequence.largeStarted && sequence.time >= 0.95) {
        sequence.largeStarted = true;
        this.burst(sequence.origin, false, this.lowPerformance ? 5 : 10);
        // A boss shell breaks into many short-lived metal fragments after the
        // main blast, making the destruction feel physical rather than purely
        // light-based.
        this.burst(sequence.origin, true, this.lowPerformance ? 5 : 10, 0.34, 1.35, 2.4);
        this.spawnPolygonFragments(sequence.origin);
      }
      if (sequence.time >= 2.2) this.bossSequence = undefined;
    }
    for (let b = this.bursts.length - 1; b >= 0; b -= 1) {
      const burst = this.bursts[b];
      if (!burst) continue;
      burst.life -= dt;
      const attribute = burst.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < burst.velocities.length / 3; i += 1) {
        const x = attribute.getX(i * 2 + 1) + burst.velocities[i * 3]! * dt;
        const y = attribute.getY(i * 2 + 1) + burst.velocities[i * 3 + 1]! * dt - burst.gravity * dt * dt * 0.5;
        const z = attribute.getZ(i * 2 + 1) + burst.velocities[i * 3 + 2]! * dt;
        attribute.setXYZ(i * 2 + 1, x, y, z);
      }
      attribute.needsUpdate = true;
      (burst.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, burst.life / burst.maxLife);
      if (burst.life <= 0) {
        this.scene.remove(burst.line);
        burst.line.geometry.dispose();
        (burst.line.material as THREE.Material).dispose();
        this.bursts.splice(b, 1);
      }
    }
    for (let i = this.polygonFragments.length - 1; i >= 0; i -= 1) {
      const fragment = this.polygonFragments[i];
      if (!fragment) continue;
      fragment.life -= dt;
      fragment.velocity.y -= 3.2 * dt;
      fragment.mesh.position.addScaledVector(fragment.velocity, dt);
      fragment.mesh.rotation.x += fragment.spin.x * dt;
      fragment.mesh.rotation.y += fragment.spin.y * dt;
      fragment.mesh.rotation.z += fragment.spin.z * dt;
      (fragment.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fragment.life / 1.6);
      if (fragment.life <= 0) {
        this.scene.remove(fragment.mesh);
        fragment.mesh.geometry.dispose();
        (fragment.mesh.material as THREE.Material).dispose();
        this.polygonFragments.splice(i, 1);
      }
    }
  }

  private spawnPolygonFragments(origin: THREE.Vector3): void {
    // Deliberately dense debris cloud: the boss defeat should visibly stress
    // the polygon renderer as part of the spectacle.
    const count = this.lowPerformance ? 120 : 420;
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffcf45 : 0xff3157, transparent: true });
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.5 + Math.random() * 0.9, 0), material);
      mesh.position.copy(origin).add(new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 6));
      this.scene.add(mesh);
      this.polygonFragments.push({
        mesh,
        velocity: new THREE.Vector3().randomDirection().multiplyScalar(4.5 + Math.random() * 8),
        spin: new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 8),
        life: 1.6 + Math.random() * 0.6
      });
    }
  }
}
