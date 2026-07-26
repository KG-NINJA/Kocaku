import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { COLORS } from "../config/graphicsConfig";
import { ObjectPool } from "../utils/ObjectPool";
import type { Enemy } from "../entities/Enemy";
import type { Player } from "./Player";

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  damage: number;
  hostile: boolean;
  active: boolean;
  homingTarget?: Enemy;
  flightTime: number;
  curvePhase: number;
  trail?: THREE.Line;
  trailPoints: THREE.Vector3[];
}

interface FadingTrail {
  line: THREE.Line;
  life: number;
}

const MISSILE_TRAIL_POINTS = 36;

export interface HitResult {
  enemy?: Enemy;
  playerHit: boolean;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  obstacleHit?: boolean;
}

export class ProjectileManager {
  private readonly active: Projectile[] = [];
  private readonly pool: ObjectPool<Projectile>;
  private readonly fadingTrails: FadingTrail[] = [];
  private stageMode: "tunnel" | "surface" = "tunnel";
  private obstacleSurfaces: THREE.Object3D[] = [];
  private readonly obstacleRaycaster = new THREE.Raycaster();

  constructor(private readonly scene: THREE.Scene) {
    this.pool = new ObjectPool(() => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 5, 4),
        new THREE.MeshBasicMaterial({ color: COLORS.projectile })
      );
      mesh.visible = false;
      scene.add(mesh);
      return {
        mesh,
        velocity: new THREE.Vector3(),
        lifetime: 0,
        damage: 0,
        hostile: false,
        active: false,
        flightTime: 0,
        curvePhase: 0,
        trailPoints: []
      };
    }, 48);
  }

  spawn(origin: THREE.Vector3, direction: THREE.Vector3, hostile: boolean, damage: number, homingTarget?: Enemy): void {
    const shot = this.pool.acquire();
    shot.active = true;
    shot.hostile = hostile;
    shot.homingTarget = homingTarget;
    shot.flightTime = 0;
    shot.curvePhase = Math.random() * Math.PI * 2;
    shot.trailPoints.length = 0;
    shot.damage = damage;
    shot.lifetime = GAME.projectileLifetime;
    shot.mesh.position.copy(origin);
    shot.velocity.copy(direction).multiplyScalar(homingTarget ? GAME.missileSpeed : hostile ? GAME.enemyProjectileSpeed : GAME.projectileSpeed);
    if (homingTarget) {
      const launchCurve = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
      if (launchCurve.lengthSq() < 0.01) launchCurve.crossVectors(direction, new THREE.Vector3(1, 0, 0));
      const curveSide = Math.sin(shot.curvePhase) >= 0 ? 1 : -1;
      shot.velocity.addScaledVector(launchCurve.normalize(), GAME.missileSpeed * 0.55 * curveSide).normalize().multiplyScalar(GAME.missileSpeed);
    }
    (shot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
      hostile ? COLORS.enemyProjectile : homingTarget ? COLORS.target : COLORS.projectile
    );
    shot.mesh.visible = true;
    if (homingTarget) {
      this.ensureTrail(shot);
      shot.trailPoints.push(origin.clone());
      if (shot.trail) shot.trail.visible = true;
      this.updateTrailGeometry(shot);
    } else if (shot.trail) {
      shot.trail.visible = false;
    }
    this.active.push(shot);
  }

  setStageMode(mode: "tunnel" | "surface"): void {
    this.stageMode = mode;
  }

  setObstacleSurfaces(surfaces: THREE.Object3D[]): void {
    this.obstacleSurfaces = surfaces;
  }

  update(dt: number, player: Player, enemies: Enemy[], onHit: (result: HitResult) => void): void {
    this.updateFadingTrails(dt);
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const shot = this.active[i];
      if (!shot) continue;
      shot.flightTime += dt;
      if (shot.homingTarget?.alive) {
        const toTarget = shot.homingTarget.getPosition(new THREE.Vector3()).sub(shot.mesh.position);
        const distance = toTarget.length();
        const desired = toTarget.normalize();
        const lateral = new THREE.Vector3().crossVectors(desired, new THREE.Vector3(0, 1, 0));
        if (lateral.lengthSq() < 0.01) lateral.crossVectors(desired, new THREE.Vector3(1, 0, 0));
        lateral.normalize();
        const curve = Math.min(0.42, 0.12 + distance / 220);
        desired.addScaledVector(lateral, Math.sin(shot.flightTime * 7 + shot.curvePhase) * curve).normalize();
        shot.velocity.lerp(desired.multiplyScalar(GAME.missileSpeed), Math.min(1, dt * 2.4));
      }
      const previousPosition = shot.mesh.position.clone();
      const travel = shot.velocity.clone().multiplyScalar(dt);
      shot.mesh.position.add(travel);
      if (this.obstacleSurfaces.length > 0 && travel.lengthSq() > 0.000001) {
        this.obstacleRaycaster.set(previousPosition, travel.clone().normalize());
        this.obstacleRaycaster.near = 0;
        this.obstacleRaycaster.far = travel.length() + 0.25;
        const obstacle = this.obstacleRaycaster.intersectObjects(this.obstacleSurfaces, false)[0];
        if (obstacle) {
          shot.mesh.position.copy(obstacle.point);
          onHit({ obstacleHit: true, playerHit: false, position: obstacle.point.clone(), direction: shot.velocity.clone().normalize() });
          this.release(i, shot, false);
          continue;
        }
      }
      if (shot.homingTarget) {
        shot.trailPoints.push(shot.mesh.position.clone());
        if (shot.trailPoints.length > MISSILE_TRAIL_POINTS) shot.trailPoints.shift();
        this.updateTrailGeometry(shot);
      }
      shot.lifetime -= dt;
      let hit = false;
      if (this.stageMode === "tunnel") {
        const radius = Math.hypot(shot.mesh.position.x, shot.mesh.position.y);
        if (radius > GAME.tunnelRadius - 0.15 || shot.mesh.position.z < 0 || shot.mesh.position.z > GAME.tunnelLength) hit = true;
      } else if (Math.abs(shot.mesh.position.x) > 90 || Math.abs(shot.mesh.position.y) > 90 || shot.mesh.position.z < -20 || shot.mesh.position.z > 210) {
        hit = true;
      }
      if (shot.hostile && shot.mesh.position.distanceToSquared(player.group.position) < 1.6) {
        player.damage(shot.damage);
        onHit({ playerHit: true, position: shot.mesh.position.clone(), direction: shot.velocity.clone().normalize() });
        hit = true;
      } else if (!shot.hostile) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const threshold = enemy.kind === "boss" ? 30 : shot.homingTarget ? 5.5 : 4.2;
          if (shot.mesh.position.distanceToSquared(enemy.group.position) < threshold) {
            enemy.damage(shot.damage);
            onHit({ enemy, playerHit: false, position: shot.mesh.position.clone(), direction: shot.velocity.clone().normalize() });
            hit = true;
            break;
          }
        }
      }
      if (hit || shot.lifetime <= 0) this.release(i, shot, true);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const shot = this.active[i];
      if (shot) this.release(i, shot, false);
    }
    this.fadingTrails.forEach((trail) => {
      this.scene.remove(trail.line);
      trail.line.geometry.dispose();
      (trail.line.material as THREE.Material).dispose();
    });
    this.fadingTrails.length = 0;
  }

  private release(index: number, shot: Projectile, leaveTrail: boolean): void {
    if (leaveTrail && shot.homingTarget && shot.trailPoints.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints(shot.trailPoints);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: COLORS.target, transparent: true, opacity: 0.85
      }));
      this.scene.add(line);
      this.fadingTrails.push({ line, life: 0.55 });
    }
    shot.active = false;
    shot.mesh.visible = false;
    shot.homingTarget = undefined;
    shot.trailPoints.length = 0;
    if (shot.trail) shot.trail.visible = false;
    this.active.splice(index, 1);
    this.pool.release(shot);
  }

  private ensureTrail(shot: Projectile): void {
    if (shot.trail) return;
    const positions = new Float32Array(MISSILE_TRAIL_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);
    shot.trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: COLORS.target, transparent: true, opacity: 0.85
    }));
    shot.trail.frustumCulled = false;
    this.scene.add(shot.trail);
  }

  private updateTrailGeometry(shot: Projectile): void {
    if (!shot.trail) return;
    const attribute = shot.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    shot.trailPoints.forEach((point, index) => attribute.setXYZ(index, point.x, point.y, point.z));
    attribute.needsUpdate = true;
    shot.trail.geometry.setDrawRange(0, shot.trailPoints.length);
  }

  private updateFadingTrails(dt: number): void {
    for (let i = this.fadingTrails.length - 1; i >= 0; i -= 1) {
      const trail = this.fadingTrails[i];
      if (!trail) continue;
      trail.life -= dt;
      (trail.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, trail.life / 0.55) * 0.85;
      if (trail.life <= 0) {
        this.scene.remove(trail.line);
        trail.line.geometry.dispose();
        (trail.line.material as THREE.Material).dispose();
        this.fadingTrails.splice(i, 1);
      }
    }
  }
}
