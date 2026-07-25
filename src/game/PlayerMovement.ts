import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import type { InputSnapshot } from "./InputManager";
import { damp } from "../utils/MathUtils";

export class PlayerMovement {
  theta = -Math.PI / 2;
  z = 5;
  radialOffset = 0;
  jumpVelocity = 0;
  forwardVelocity = 0;
  strafeVelocity = 0;
  grounded = true;

  reset(): void {
    this.theta = -Math.PI / 2;
    this.z = 5;
    this.radialOffset = 0;
    this.jumpVelocity = 0;
    this.forwardVelocity = 0;
    this.strafeVelocity = 0;
    this.grounded = true;
  }

  update(input: InputSnapshot, dt: number, energy: number): { boosting: boolean; energyDelta: number } {
    const canBoost = input.boost && input.forward > 0 && energy > 1;
    const targetForward = input.forward * (canBoost ? GAME.boostSpeed : GAME.walkSpeed);
    const targetStrafe = (input.strafe + input.roll * 0.75) * GAME.strafeSpeed;
    this.forwardVelocity = damp(this.forwardVelocity, targetForward, GAME.acceleration, dt);
    this.strafeVelocity = damp(this.strafeVelocity, targetStrafe, GAME.acceleration, dt);
    this.z = THREE.MathUtils.clamp(this.z + this.forwardVelocity * dt, 2, GAME.tunnelLength - 5);
    this.theta += (this.strafeVelocity / (GAME.tunnelRadius - GAME.playerClearance)) * dt;

    if (input.jumpPressed && this.grounded) {
      this.jumpVelocity = GAME.jumpImpulse;
      this.grounded = false;
    }
    if (!this.grounded) {
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
    return { boosting: canBoost, energyDelta: canBoost ? -28 * dt : 18 * dt };
  }

  getPosition(target = new THREE.Vector3()): THREE.Vector3 {
    const radius = GAME.tunnelRadius - GAME.playerClearance - this.radialOffset;
    return target.set(Math.cos(this.theta) * radius, Math.sin(this.theta) * radius, this.z);
  }

  getInward(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(-Math.cos(this.theta), -Math.sin(this.theta), 0);
  }

  getTangent(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(-Math.sin(this.theta), Math.cos(this.theta), 0);
  }
}
