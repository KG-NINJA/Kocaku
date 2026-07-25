import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import { COLORS } from "../config/graphicsConfig";

export class StageManager {
  readonly tunnelGroup = new THREE.Group();
  readonly buildingGroup = new THREE.Group();
  readonly buildingSurfaces: THREE.Mesh[] = [];
  readonly buildingStart = new THREE.Vector3(0, 3, 8);

  constructor(scene: THREE.Scene, lowPerformance: boolean) {
    this.createTunnel(lowPerformance);
    this.createBuildingComplex(lowPerformance);
    this.buildingGroup.visible = false;
    scene.add(this.tunnelGroup, this.buildingGroup);
  }

  activateTunnel(): void {
    this.tunnelGroup.visible = true;
    this.buildingGroup.visible = false;
  }

  activateBuilding(): THREE.Mesh[] {
    this.tunnelGroup.visible = false;
    this.buildingGroup.visible = true;
    this.buildingGroup.updateMatrixWorld(true);
    return this.buildingSurfaces;
  }

  private createTunnel(lowPerformance: boolean): void {
    const tunnelGeometry = new THREE.CylinderGeometry(
      GAME.tunnelRadius, GAME.tunnelRadius, GAME.tunnelLength, lowPerformance ? 24 : 48, 24, true
    );
    tunnelGeometry.rotateX(Math.PI / 2);
    const tunnel = new THREE.Mesh(tunnelGeometry, new THREE.MeshBasicMaterial({
      color: COLORS.terrainDim, wireframe: true, transparent: true, opacity: 0.42, side: THREE.BackSide
    }));
    tunnel.position.z = GAME.tunnelLength / 2;
    this.tunnelGroup.add(tunnel);

    const ringMaterial = new THREE.LineBasicMaterial({ color: COLORS.terrain, transparent: true, opacity: 0.45 });
    for (let z = 0; z <= GAME.tunnelLength; z += 10) {
      const points: THREE.Vector3[] = [];
      const segments = lowPerformance ? 24 : 48;
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * GAME.tunnelRadius, Math.sin(a) * GAME.tunnelRadius, z));
      }
      this.tunnelGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial));
    }

    const railMaterial = new THREE.LineBasicMaterial({ color: COLORS.terrainDim, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      this.tunnelGroup.add(new THREE.Line(
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
      this.tunnelGroup.add(obstacle);
    }
    this.tunnelGroup.add(this.createGate(3, COLORS.terrain), this.createGate(GAME.bossZ + 15, COLORS.target));
  }

  private createBuildingComplex(lowPerformance: boolean): void {
    const terrain = new THREE.MeshBasicMaterial({
      color: COLORS.terrainDim, wireframe: true, transparent: true, opacity: 0.62
    });
    const accent = new THREE.MeshBasicMaterial({
      color: COLORS.terrain, wireframe: true, transparent: true, opacity: 0.7
    });
    this.addSurfaceBox(new THREE.Vector3(36, 6, 176), new THREE.Vector3(0, 0, 82), terrain, lowPerformance);
    this.addSurfaceBox(new THREE.Vector3(14, 24, 34), new THREE.Vector3(-15, 12, 46), accent, lowPerformance);
    this.addSurfaceBox(new THREE.Vector3(16, 32, 38), new THREE.Vector3(14, 16, 91), terrain, lowPerformance);
    this.addSurfaceBox(new THREE.Vector3(26, 14, 28), new THREE.Vector3(-5, 7, 130), accent, lowPerformance);
    this.addSurfaceBox(new THREE.Vector3(34, 20, 24), new THREE.Vector3(0, 10, 161), terrain, lowPerformance);
    this.addSurfaceBox(new THREE.Vector3(10, 6, 42), new THREE.Vector3(0, 22, 91), accent, lowPerformance);

    const beaconMaterial = new THREE.LineBasicMaterial({ color: COLORS.target, transparent: true, opacity: 0.8 });
    for (let z = 12; z < 170; z += 16) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-18, 3.2, z), new THREE.Vector3(18, 3.2, z)
      ]);
      this.buildingGroup.add(new THREE.Line(geometry, beaconMaterial));
    }

    const goal = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(7, 1)),
      new THREE.LineBasicMaterial({ color: COLORS.target })
    );
    goal.position.set(0, 22, 164);
    this.buildingGroup.add(goal);
  }

  private addSurfaceBox(size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, lowPerformance: boolean): void {
    const segments = lowPerformance ? 1 : 3;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z, segments, segments, segments),
      material
    );
    mesh.position.copy(position);
    this.buildingSurfaces.push(mesh);
    this.buildingGroup.add(mesh);
  }

  private createGate(z: number, color: number): THREE.LineSegments {
    const geometry = new THREE.TorusGeometry(GAME.tunnelRadius - 1.2, 0.08, 4, 48);
    const gate = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color }));
    gate.position.z = z;
    return gate;
  }
}
