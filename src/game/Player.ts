import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import { GAME } from "../config/gameConfig";
import type { InputSnapshot } from "./InputManager";
import { PlayerMovement } from "./PlayerMovement";

export class Player {
  readonly group = new THREE.Group();
  readonly movement = new PlayerMovement();
  readonly muzzle = new THREE.Object3D();
  private readonly wallIndicator: THREE.Mesh;
  health: number = GAME.maxHealth;
  energy: number = GAME.maxEnergy;
  boosting = false;
  private impactPulse = 0;
  private impactRoll = 0;
  private impactPitch = 0;
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
    this.wallIndicator = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.06, 5, 16),
      new THREE.MeshBasicMaterial({ color: 0xffcf45, wireframe: true })
    );
    this.wallIndicator.rotation.x = Math.PI / 2;
    this.wallIndicator.position.y = 0.15;
    this.wallIndicator.visible = false;
    this.group.add(this.wallIndicator);

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
    this.group.quaternion.copy(this.movement.getOrientation());
    this.walkTime = 0;
    this.impactPulse = 0;
    this.impactRoll = 0;
    this.impactPitch = 0;
    this.group.scale.setScalar(1);
    this.legs.forEach((leg) => {
      leg.rotation.set(0, 0, 0);
      leg.position.y = 0.25;
    });
  }

  update(input: InputSnapshot, dt: number): void {
    const result = this.movement.update(input, dt, this.energy);
    this.boosting = result.boosting;
    this.energy = THREE.MathUtils.clamp(this.energy + result.energyDelta, 0, GAME.maxEnergy);
    this.movement.getPosition(this.group.position);
    this.impactPulse = Math.max(0, this.impactPulse - dt * 8.5);
    this.impactRoll *= Math.exp(-9 * dt);
    this.impactPitch *= Math.exp(-9 * dt);
    const impactOrientation = this.movement.getOrientation().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(
        this.impactPitch * this.impactPulse,
        0,
        this.impactRoll * this.impactPulse
      ))
    );
    this.group.quaternion.slerp(impactOrientation, 1 - Math.exp(-10 * dt));
    const squash = this.impactPulse * 0.1;
    this.group.scale.set(1 + squash, 1 - squash * 0.75, 1 + squash);
    this.wallIndicator.visible = this.movement.wallAttached;
    if (this.wallIndicator.visible) this.wallIndicator.rotation.z += dt * 3;
    const forwardSpeed = this.movement.forwardVelocity;
    const strafeSpeed = this.movement.strafeVelocity;
    const planarSpeed = Math.hypot(forwardSpeed, strafeSpeed);
    const walking = this.movement.grounded && planarSpeed > 0.15 && !this.boosting;
    if (walking) this.walkTime += planarSpeed * dt * 0.78;
    const travel = walking ? Math.min(1, planarSpeed / GAME.walkSpeed) : 0;
    const strafeDirection = planarSpeed > 0.01 ? strafeSpeed / planarSpeed : 0;
    const poseBlend = 1 - Math.exp(-14 * dt);
    this.legs.forEach((leg, index) => {
      // Four-legged machines use diagonal pairs: front-left with rear-right.
      const diagonalPhase = index === 0 || index === 3 ? 0 : Math.PI;
      const wave = Math.sin(this.walkTime + diagonalPhase);
      const lift = Math.max(0, Math.sin(this.walkTime + diagonalPhase + Math.PI * 0.45));
      const targetX = this.boosting ? 0.85 : wave * 0.38 * travel;
      const targetZ = this.boosting ? 0 : -wave * 0.24 * travel * strafeDirection;
      const targetY = this.boosting ? 0.22 : 0.25 + lift * 0.13 * travel;
      leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, targetX, poseBlend);
      leg.rotation.z = THREE.MathUtils.lerp(leg.rotation.z, targetZ, poseBlend);
      leg.position.y = THREE.MathUtils.lerp(leg.position.y, targetY, poseBlend);
    });
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  knockback(incomingDirection: THREE.Vector3): void {
    this.movement.knockback(incomingDirection);
  }

  registerHit(direction: THREE.Vector3): void {
    const tangent = this.movement.getTangent();
    const forward = this.movement.getForward();
    this.impactPulse = Math.min(1.2, this.impactPulse + 1);
    this.impactRoll = THREE.MathUtils.clamp(this.impactRoll + tangent.dot(direction) * 0.28, -0.5, 0.5);
    this.impactPitch = THREE.MathUtils.clamp(this.impactPitch + forward.dot(direction) * 0.22, -0.4, 0.4);
  }

  pushFromContact(direction: THREE.Vector3, distance: number): void {
    this.movement.pushFromContact(direction, distance);
    this.movement.getPosition(this.group.position);
  }

  getWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.group.getWorldPosition(target);
  }
}
