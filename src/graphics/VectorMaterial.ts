import * as THREE from "three";

export function createVectorMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: opacity < 1,
    opacity
  });
}
