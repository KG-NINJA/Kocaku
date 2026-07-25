import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import { GAME } from "../config/gameConfig";
import { orientToSurface } from "../utils/MathUtils";
import type { InputSnapshot } from "./InputManager";
import { PlayerMovement } from "./PlayerMovement";

export class Player {
  readonly group = new THREE.Group();
  readonly movement = new PlayerMovement();
  readonly muzzle = new THREE.Object3D();
  health: number = GAME.maxHealth;
  energy: number = GAME.maxEnergy;
  boosting = false;
  private readonly legs: THREE.Group[] = [];
  private walkTime = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = "player";
    const white = new THREE.MeshBasicMaterial({ color: COLORS.player, wireframe: true });
    const glow = new THREE.MeshBasicMaterial({ color: 0x99ffff });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.7, 2, 1, 2), white);
    body.position.y = 0.45;
    this.group.add(body);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glow);
    core.position.set(0, 0.62, 0.2);
    this.group.add(core);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 0.45, 8), white);
    turret.position.set(0, 0.95, 0.35);
    turret.rotation.z = Math.PI / 2;
    this.group.add(turret);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.6), glow);
    barrel.position.set(0, 0.95, 1.25);
    this.group.add(barrel);
    this.muzzle.position.set(0, 0.95, 2.1);
    this.group.add(this.muzzle);

    const legGeometry = new THREE.BoxGeometry(0.18, 0.18, 1.15);
    const footGeometry = new THREE.BoxGeometry(0.45, 0.16, 0.65);
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.85, 0.25, front * 0.75);
        const leg = new THREE.Mesh(legGeometry, white);
        leg.rotation.x = 0.55 * front;
        leg.position.set(side * 0.2, -0.18, front * 0.42);
        const foot = new THREE.Mesh(footGeometry, white);
        foot.position.set(side * 0.25, -0.4, front * 0.85);
        pivot.add(leg, foot);
        this.legs.push(pivot);
        this.group.add(pivot);
      }
    }
    scene.add(this.group);
    this.reset();
  }

  reset(): void {
    this.health = GAME.maxHealth;
    this.energy = GAME.maxEnergy;
    this.movement.reset();
    this.movement.getPosition(this.group.position);
    orientToSurface(this.group, this.movement.theta, 1);
  }

  update(input: InputSnapshot, dt: number): void {
    const result = this.movement.update(input, dt, this.energy);
    this.boosting = result.boosting;
    this.energy = THREE.MathUtils.clamp(this.energy + result.energyDelta, 0, GAME.maxEnergy);
    this.movement.getPosition(this.group.position);
    orientToSurface(this.group, this.movement.theta, 1 - Math.exp(-10 * dt));
    this.walkTime += dt * (2 + Math.abs(this.movement.forwardVelocity) * 0.45);
    const travel = Math.min(1, Math.abs(this.movement.forwardVelocity) / GAME.walkSpeed);
    this.legs.forEach((leg, index) => {
      const phase = this.walkTime + (index % 2 === 0 ? 0 : Math.PI);
      leg.rotation.x = this.boosting ? 0.85 : Math.sin(phase) * 0.32 * travel;
      leg.position.y = this.boosting ? 0.22 : 0;
    });
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  knockback(incomingDirection: THREE.Vector3): void {
    const tangent = this.movement.getTangent(new THREE.Vector3());
    this.movement.z = THREE.MathUtils.clamp(this.movement.z - incomingDirection.z * 2.8, 2, GAME.tunnelLength - 5);
    this.movement.theta -= tangent.dot(incomingDirection) * 0.12;
    this.movement.forwardVelocity -= incomingDirection.z * 8;
    this.movement.strafeVelocity -= tangent.dot(incomingDirection) * 8;
    this.movement.jumpVelocity = Math.max(this.movement.jumpVelocity, 3.5);
    this.movement.grounded = false;
  }

  getWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.group.getWorldPosition(target);
  }
}
