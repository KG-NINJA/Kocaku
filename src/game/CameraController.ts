import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { dampVector } from "../utils/MathUtils";
import type { Player } from "./Player";

export class CameraController {
  private readonly desired = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly lookMatrix = new THREE.Matrix4();
  private readonly targetQuaternion = new THREE.Quaternion();
  private aimYaw = 0;
  private aimPitch = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  reset(player: Player): void {
    const position = player.getWorldPosition();
    const inward = player.movement.getInward();
    const forward = player.movement.getForward();
    this.camera.position.copy(position).addScaledVector(inward, GAME.cameraHeight).addScaledVector(forward, -GAME.cameraDistance);
    this.up.copy(inward);
    this.lookTarget.copy(position).addScaledVector(forward, 8);
    this.camera.lookAt(this.lookTarget);
  }

  update(player: Player, dt: number, aimX: number, aimY: number, lockTarget?: THREE.Object3D): void {
    this.aimYaw = THREE.MathUtils.clamp(this.aimYaw + aimX, -0.8, 0.8);
    this.aimPitch = THREE.MathUtils.clamp(this.aimPitch + aimY, -0.45, 0.45);
    this.aimYaw *= Math.exp(-1.2 * dt);
    this.aimPitch *= Math.exp(-1.2 * dt);

    const playerPosition = player.getWorldPosition();
    const inward = player.movement.getInward();
    const tangent = player.movement.getTangent();
    const forward = player.movement.getForward();
    const speedRatio = Math.min(1, Math.abs(player.movement.forwardVelocity) / GAME.boostSpeed);
    const distance = GAME.cameraDistance + speedRatio * 3;
    this.desired.copy(playerPosition)
      .addScaledVector(inward, GAME.cameraHeight)
      .addScaledVector(tangent, this.aimYaw * 3)
      .addScaledVector(forward, -distance);
    if (player.movement.mode === "tunnel") {
      const radial = Math.hypot(this.desired.x, this.desired.y);
      const maxRadius = GAME.tunnelRadius - 1.3;
      if (radial > maxRadius) {
        this.desired.x *= maxRadius / radial;
        this.desired.y *= maxRadius / radial;
      }
    }
    dampVector(this.camera.position, this.desired, 7, dt);
    dampVector(this.up, inward, 3.5, dt).normalize();

    this.lookTarget.copy(playerPosition).addScaledVector(forward, 10);
    this.lookTarget.addScaledVector(tangent, this.aimYaw * 9);
    this.lookTarget.addScaledVector(inward, -this.aimPitch * 7);
    if (lockTarget) {
      const lockPosition = lockTarget.getWorldPosition(new THREE.Vector3());
      this.lookTarget.lerp(lockPosition, 0.38);
    }
    this.lookMatrix.lookAt(this.camera.position, this.lookTarget, this.up);
    this.targetQuaternion.setFromRotationMatrix(this.lookMatrix);
    this.camera.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-8 * dt));
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 64 + speedRatio * 8, 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  getAimRay(origin: THREE.Vector3, direction: THREE.Vector3): void {
    origin.copy(this.camera.position);
    this.camera.getWorldDirection(direction);
  }
}
