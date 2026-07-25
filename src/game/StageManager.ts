import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { COLORS } from "../config/graphicsConfig";

export class StageManager {
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, lowPerformance: boolean) {
    const tunnelGeometry = new THREE.CylinderGeometry(
      GAME.tunnelRadius, GAME.tunnelRadius, GAME.tunnelLength, lowPerformance ? 24 : 48, 24, true
    );
    tunnelGeometry.rotateX(Math.PI / 2);
    const tunnel = new THREE.Mesh(tunnelGeometry, new THREE.MeshBasicMaterial({
      color: COLORS.terrainDim, wireframe: true, transparent: true, opacity: 0.42, side: THREE.BackSide
    }));
    tunnel.position.z = GAME.tunnelLength / 2;
    this.group.add(tunnel);

    const ringMaterial = new THREE.LineBasicMaterial({ color: COLORS.terrain, transparent: true, opacity: 0.45 });
    for (let z = 0; z <= GAME.tunnelLength; z += 10) {
      const points: THREE.Vector3[] = [];
      const segments = lowPerformance ? 24 : 48;
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * GAME.tunnelRadius, Math.sin(a) * GAME.tunnelRadius, z));
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial));
    }

    const railMaterial = new THREE.LineBasicMaterial({ color: COLORS.terrainDim, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      this.group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(a) * GAME.tunnelRadius, Math.sin(a) * GAME.tunnelRadius, 0),
          new THREE.Vector3(Math.cos(a) * GAME.tunnelRadius, Math.sin(a) * GAME.tunnelRadius, GAME.tunnelLength)
        ]),
        railMaterial
      ));
    }

    const obstacleMaterial = new THREE.MeshBasicMaterial({ color: COLORS.target, wireframe: true });
    for (const [theta, z] of [[-1.2, 45], [-2.2, 82], [0.2, 124], [2.4, 166]] as const) {
      const obstacle = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 3, 4, 1, 2), obstacleMaterial);
      const radius = GAME.tunnelRadius - 0.7;
      obstacle.position.set(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
      const inward = new THREE.Vector3(-Math.cos(theta), -Math.sin(theta), 0);
      obstacle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward);
      this.group.add(obstacle);
    }

    const start = this.createGate(3, COLORS.terrain);
    const goal = this.createGate(GAME.bossZ + 15, COLORS.target);
    this.group.add(start, goal);
    scene.add(this.group);
  }

  private createGate(z: number, color: number): THREE.LineSegments {
    const geometry = new THREE.TorusGeometry(GAME.tunnelRadius - 1.2, 0.08, 4, 48);
    const edges = new THREE.EdgesGeometry(geometry);
    const gate = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
    gate.position.z = z;
    return gate;
  }
}
