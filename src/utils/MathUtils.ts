import * as THREE from "three";

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

export function dampVector(current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number): THREE.Vector3 {
  return current.lerp(target, 1 - Math.exp(-lambda * dt));
}

export function orientToSurface(object: THREE.Object3D, theta: number, smoothing = 1): void {
  const tangent = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0);
  const inward = new THREE.Vector3(-Math.cos(theta), -Math.sin(theta), 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const matrix = new THREE.Matrix4().makeBasis(tangent, inward, forward);
  const target = new THREE.Quaternion().setFromRotationMatrix(matrix);
  object.quaternion.slerp(target, smoothing);
}
