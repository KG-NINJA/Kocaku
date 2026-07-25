import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import type { InputSnapshot } from "./InputManager";
import { damp } from "../utils/MathUtils";

export type MovementMode = "tunnel" | "surface";

export class PlayerMovement {
  mode: MovementMode = "tunnel";
  theta = -Math.PI / 2;
  z = 5;
  radialOffset = 0;
  jumpVelocity = 0;
  forwardVelocity = 0;
  strafeVelocity = 0;
  grounded = true;
  private readonly surfacePosition = new THREE.Vector3();
  private readonly surfaceNormal = new THREE.Vector3(0, 1, 0);
  private readonly surfaceForward = new THREE.Vector3(0, 0, 1);
  private readonly surfaceRight = new THREE.Vector3(1, 0, 0);
  private readonly raycaster = new THREE.Raycaster();
  private surfaces: THREE.Object3D[] = [];

  reset(): void {
    this.mode = "tunnel";
    this.theta = -Math.PI / 2;
    this.z = 5;
    this.radialOffset = 0;
    this.jumpVelocity = 0;
    this.forwardVelocity = 0;
    this.strafeVelocity = 0;
    this.grounded = true;
  }

  enterSurfaceMode(surfaces: THREE.Object3D[], start: THREE.Vector3, normal: THREE.Vector3, forward: THREE.Vector3): void {
    this.mode = "surface";
    this.surfaces = surfaces;
    this.surfaceNormal.copy(normal).normalize();
    this.surfaceForward.copy(forward).projectOnPlane(this.surfaceNormal).normalize();
    this.surfaceRight.crossVectors(this.surfaceNormal, this.surfaceForward).normalize();
    this.surfacePosition.copy(start).addScaledVector(this.surfaceNormal, GAME.playerClearance);
    this.z = this.surfacePosition.z;
    this.radialOffset = 0;
    this.jumpVelocity = 0;
    this.forwardVelocity = 0;
    this.strafeVelocity = 0;
    this.grounded = true;
  }

  update(input: InputSnapshot, dt: number, energy: number): { boosting: boolean; energyDelta: number } {
    return this.mode === "tunnel"
      ? this.updateTunnel(input, dt, energy)
      : this.updateSurface(input, dt, energy);
  }

  getPosition(target = new THREE.Vector3()): THREE.Vector3 {
    if (this.mode === "surface") return target.copy(this.surfacePosition);
    const radius = GAME.tunnelRadius - GAME.playerClearance - this.radialOffset;
    return target.set(Math.cos(this.theta) * radius, Math.sin(this.theta) * radius, this.z);
  }

  getInward(target = new THREE.Vector3()): THREE.Vector3 {
    return this.mode === "surface"
      ? target.copy(this.surfaceNormal)
      : target.set(-Math.cos(this.theta), -Math.sin(this.theta), 0);
  }

  getTangent(target = new THREE.Vector3()): THREE.Vector3 {
    return this.mode === "surface"
      ? target.copy(this.surfaceRight)
      : target.set(-Math.sin(this.theta), Math.cos(this.theta), 0);
  }

  getForward(target = new THREE.Vector3()): THREE.Vector3 {
    return this.mode === "surface" ? target.copy(this.surfaceForward) : target.set(0, 0, 1);
  }

  getOrientation(target = new THREE.Quaternion()): THREE.Quaternion {
    const matrix = new THREE.Matrix4().makeBasis(this.getTangent(), this.getInward(), this.getForward());
    return target.setFromRotationMatrix(matrix);
  }

  knockback(incomingDirection: THREE.Vector3): void {
    if (this.mode === "surface") {
      this.surfacePosition.addScaledVector(incomingDirection, -2.2);
      this.forwardVelocity -= incomingDirection.dot(this.surfaceForward) * 8;
      this.strafeVelocity -= incomingDirection.dot(this.surfaceRight) * 8;
      this.jumpVelocity = Math.max(this.jumpVelocity, 3.5);
      this.grounded = false;
      return;
    }
    const tangent = this.getTangent();
    this.z = THREE.MathUtils.clamp(this.z - incomingDirection.z * 2.8, 2, GAME.tunnelLength - 5);
    this.theta -= tangent.dot(incomingDirection) * 0.12;
    this.forwardVelocity -= incomingDirection.z * 8;
    this.strafeVelocity -= tangent.dot(incomingDirection) * 8;
    this.jumpVelocity = Math.max(this.jumpVelocity, 3.5);
    this.grounded = false;
  }

  private updateTunnel(input: InputSnapshot, dt: number, energy: number): { boosting: boolean; energyDelta: number } {
    const result = this.updateVelocity(input, dt, energy);
    this.z = THREE.MathUtils.clamp(this.z + this.forwardVelocity * dt, 2, GAME.tunnelLength - 5);
    this.theta += (this.strafeVelocity / (GAME.tunnelRadius - GAME.playerClearance)) * dt;
    this.updateJump(input, dt);
    return result;
  }

  private updateSurface(input: InputSnapshot, dt: number, energy: number): { boosting: boolean; energyDelta: number } {
    const result = this.updateVelocity(input, dt, energy);
    if (input.jumpPressed && this.grounded) {
      this.jumpVelocity = GAME.jumpImpulse * 0.72;
      this.grounded = false;
    }

    if (!this.grounded) {
      this.surfacePosition.addScaledVector(this.surfaceNormal, this.jumpVelocity * dt);
      this.jumpVelocity -= GAME.adhesionGravity * dt;
      if (this.jumpVelocity <= 0) {
        const hit = this.castSurface(this.surfacePosition, this.surfaceNormal.clone().negate(), 10);
        if (hit) this.attachToHit(hit);
      }
      this.z = this.surfacePosition.z;
      return result;
    }

    const movement = this.surfaceForward.clone().multiplyScalar(this.forwardVelocity * dt)
      .addScaledVector(this.surfaceRight, this.strafeVelocity * dt);
    const candidate = this.surfacePosition.clone().add(movement);
    const moveDirection = movement.lengthSq() > 0.0001 ? movement.clone().normalize() : this.surfaceForward.clone();
    let hit = this.castSurface(candidate.clone().addScaledVector(this.surfaceNormal, 2.5), this.surfaceNormal.clone().negate(), 7);

    // When crossing a box edge, probe back toward the edge to acquire the adjacent face.
    if (!hit && movement.lengthSq() > 0.0001) {
      const edgeOrigin = candidate.clone().addScaledVector(this.surfaceNormal, 1.2).addScaledVector(moveDirection, 2);
      hit = this.castSurface(edgeOrigin, moveDirection.clone().negate(), 5);
    }
    if (hit) this.attachToHit(hit);
    else this.surfacePosition.copy(candidate);
    this.z = this.surfacePosition.z;
    return result;
  }

  private updateVelocity(input: InputSnapshot, dt: number, energy: number): { boosting: boolean; energyDelta: number } {
    const canBoost = input.boost && input.forward > 0 && energy > 1;
    const targetForward = input.forward * (canBoost ? GAME.boostSpeed : GAME.walkSpeed);
    const targetStrafe = (input.strafe + input.roll * 0.75) * GAME.strafeSpeed;
    this.forwardVelocity = damp(this.forwardVelocity, targetForward, GAME.acceleration, dt);
    this.strafeVelocity = damp(this.strafeVelocity, targetStrafe, GAME.acceleration, dt);
    return { boosting: canBoost, energyDelta: canBoost ? -28 * dt : 18 * dt };
  }

  private updateJump(input: InputSnapshot, dt: number): void {
    if (input.jumpPressed && this.grounded) {
      this.jumpVelocity = GAME.jumpImpulse;
      this.grounded = false;
    }
    if (this.grounded) return;
    this.jumpVelocity -= GAME.adhesionGravity * dt;
    this.radialOffset += this.jumpVelocity * dt;
    if (this.radialOffset >= GAME.maxJumpHeight) {
      this.radialOffset = GAME.maxJumpHeight;
      this.jumpVelocity = Math.min(0, this.jumpVelocity);
    }
    if (this.radialOffset <= 0) {
      this.radialOffset = 0;
      this.jumpVelocity = 0;
      this.grounded = true;
    }
  }

  private castSurface(origin: THREE.Vector3, direction: THREE.Vector3, far: number): THREE.Intersection | undefined {
    this.raycaster.set(origin, direction.normalize());
    this.raycaster.near = 0;
    this.raycaster.far = far;
    return this.raycaster.intersectObjects(this.surfaces, false)[0];
  }

  private attachToHit(hit: THREE.Intersection): void {
    if (!hit.face) return;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    const nextNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
    const nextForward = this.surfaceForward.clone().projectOnPlane(nextNormal);
    if (nextForward.lengthSq() < 0.001) nextForward.copy(this.surfaceRight).projectOnPlane(nextNormal);
    nextForward.normalize();
    this.surfaceNormal.lerp(nextNormal, 0.5).normalize();
    this.surfaceForward.copy(nextForward).projectOnPlane(this.surfaceNormal).normalize();
    this.surfaceRight.crossVectors(this.surfaceNormal, this.surfaceForward).normalize();
    this.surfacePosition.copy(hit.point).addScaledVector(this.surfaceNormal, GAME.playerClearance);
    this.jumpVelocity = 0;
    this.grounded = true;
  }
}
