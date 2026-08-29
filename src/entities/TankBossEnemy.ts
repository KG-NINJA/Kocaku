import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";
import type { Player } from "../game/Player";
import { BossEnemy } from "./BossEnemy";
import type { EnemyShotCallback } from "./Enemy";

export class TankBossEnemy extends BossEnemy {
  override readonly scoreValue = 9000;
  override maxHealth = 420;
  override readonly contactRadius = 8.5;
  private cannonCooldown = 1.4;
  private grabCooldown = 1.8;
  private grabTime = 0;
  private grabConnected = false;
  private readonly arenaCenter = new THREE.Vector3();
  private readonly cannonMuzzle = new THREE.Object3D();
  private readonly legs: THREE.Group[] = [];
  private readonly manipulators: THREE.Group[] = [];

  constructor() {
    super();
    const armor = new THREE.MeshBasicMaterial({ color: COLORS.enemy, wireframe: true });
    const core = new THREE.MeshBasicMaterial({ color: COLORS.target, wireframe: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.5, 8, 3, 1, 3), armor);
    body.position.y = 2.6;
    this.group.add(body);
    const reactor = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 1), core);
    reactor.position.set(0, 4.1, 0.4);
    this.group.add(reactor);

    const legGeometry = new THREE.BoxGeometry(0.75, 0.75, 5.2, 1, 1, 2);
    const footGeometry = new THREE.BoxGeometry(1.8, 0.7, 2.2);
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row += 1) {
        const leg = new THREE.Group();
        leg.position.set(side * 4.2, 2.2, (row - 1) * 2.8);
        const limb = new THREE.Mesh(legGeometry, armor);
        limb.rotation.x = Math.PI / 2;
        limb.rotation.y = side * 0.72;
        limb.position.set(side * 1.45, -1.25, 0);
        const foot = new THREE.Mesh(footGeometry, armor);
        foot.position.set(side * 3.1, -2.35, 0);
        leg.add(limb, foot);
        this.legs.push(leg);
        this.group.add(leg);
      }
    }

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 1.4, 10), armor);
    turret.position.set(0, 4.5, 1.2);
    this.group.add(turret);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 10.5, 10), armor);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 5, 6.3);
    this.group.add(cannon);
    this.cannonMuzzle.position.set(0, 5, 11.6);
    this.group.add(this.cannonMuzzle);

    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 5, 3.2, 2.3);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 5.2), armor);
      upper.position.z = 2.4;
      const palm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.5), armor);
      palm.position.z = 5.1;
      for (const clawSide of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, 0.55), core);
        claw.position.set(clawSide * 1.1, 0, 0.7);
        claw.rotation.z = clawSide * 0.35;
        palm.add(claw);
      }
      arm.add(upper, palm);
      this.manipulators.push(arm);
      this.group.add(arm);
    }
  }

  override relocate(position: THREE.Vector3, normal = new THREE.Vector3(0, 1, 0)): void {
    super.relocate(position, normal);
    this.arenaCenter.copy(position);
    this.cannonCooldown = 1.4;
    this.grabCooldown = 1.8;
    this.grabTime = 0;
    this.grabConnected = false;
  }

  override update(dt: number, elapsed: number, player: Player, shoot: EnemyShotCallback): void {
    if (!this.alive) return;
    this.tickReveal(dt);
    if (!this.revealed) this.weakpoints.forEach((point) => { point.visible = false; });

    const playerPosition = player.getWorldPosition(new THREE.Vector3());
    const distance = this.group.position.distanceTo(playerPosition);
    const targetX = THREE.MathUtils.clamp(playerPosition.x, this.arenaCenter.x - 14, this.arenaCenter.x + 14);
    const targetZ = THREE.MathUtils.clamp(playerPosition.z - 11, this.arenaCenter.z - 10, this.arenaCenter.z + 12);
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, targetX, 0.75, dt);
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, targetZ, 0.55, dt);
    this.group.lookAt(playerPosition.x, this.group.position.y, playerPosition.z);

    const gait = elapsed * (distance > 15 ? 2.8 : 1.7);
    this.legs.forEach((leg, index) => {
      const phase = gait + (index % 2 === 0 ? 0 : Math.PI);
      leg.rotation.x = Math.sin(phase) * 0.17;
      leg.position.y = 2.2 + Math.max(0, Math.sin(phase)) * 0.3;
    });

    this.grabCooldown -= dt;
    this.cannonCooldown -= dt;
    if (this.grabTime > 0) {
      this.updateGrab(dt, player, playerPosition);
      return;
    }
    if (distance < 15 && this.grabCooldown <= 0) {
      this.grabTime = 1.05;
      this.grabConnected = false;
      return;
    }

    this.manipulators.forEach((arm) => {
      arm.rotation.x = THREE.MathUtils.damp(arm.rotation.x, 0, 9, dt);
      arm.scale.z = THREE.MathUtils.damp(arm.scale.z, 1, 9, dt);
    });

    if (distance >= 11 && distance < 95 && this.cannonCooldown <= 0) {
      const origin = this.cannonMuzzle.getWorldPosition(new THREE.Vector3());
      shoot(origin, playerPosition.clone().sub(origin).normalize(), 20);
      this.cannonCooldown = this.health < this.maxHealth * 0.5 ? 2.35 : 3.1;
    }
  }

  private updateGrab(dt: number, player: Player, playerPosition: THREE.Vector3): void {
    this.grabTime = Math.max(0, this.grabTime - dt);
    const progress = 1 - this.grabTime / 1.05;
    const reach = Math.sin(Math.min(1, progress) * Math.PI);
    this.manipulators.forEach((arm, index) => {
      arm.rotation.x = -reach * 0.22;
      arm.rotation.y = (index === 0 ? -1 : 1) * reach * 0.16;
      arm.scale.z = 1 + reach * 1.25;
    });

    if (!this.grabConnected && progress >= 0.46) {
      const bossPosition = this.getPosition(new THREE.Vector3());
      if (bossPosition.distanceTo(playerPosition) <= 17) {
        const pullDirection = bossPosition.sub(playerPosition).normalize();
        player.damage(22);
        player.pushFromContact(pullDirection, 3.2);
        player.registerHit(pullDirection.clone().negate());
        this.grabConnected = true;
      }
    }

    if (this.grabTime <= 0) {
      this.grabCooldown = 4.2;
      this.cannonCooldown = Math.max(this.cannonCooldown, 1.1);
    }
  }
}
