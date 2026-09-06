import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnemyManager } from '../src/game/EnemyManager.ts';
import { ScanSystem } from '../src/game/ScanSystem.ts';
import { PlayerWeapon } from '../src/game/PlayerWeapon.ts';

test('stage selection activates exactly the selected boss in both quality modes', () => {
  for (const low of [false, true]) {
    const manager = new EnemyManager(new THREE.Scene(), low);
    for (const stage of [2, 3, 4, 2, 4, 3]) {
      manager.prepareSurfaceStage(stage);
      assert.deepEqual(manager.enemies.filter(enemy => enemy.kind === 'boss' && enemy.alive), [manager.boss]);
      assert.equal(manager.boss.group.visible, true);
      assert.equal(manager.boss.health, manager.boss.maxHealth);
    }
    manager.reset();
    assert.deepEqual(manager.enemies.filter(enemy => enemy.kind === 'boss' && enemy.alive), [manager.boss]);
  }
});

test('returning to tunnel restores placements and drone patrol origin', () => {
  const manager = new EnemyManager(new THREE.Scene(), false);
  manager.reset();
  const placements = manager.enemies.map(enemy => enemy.group.position.clone());
  manager.prepareSurfaceStage(3);
  manager.reset();
  manager.enemies.forEach((enemy, index) => assert.ok(enemy.group.position.equals(placements[index])));
  const drone = manager.enemies.find(enemy => enemy.kind === 'drone');
  const origin = drone.group.position.clone();
  drone.update(0.1, 2, { getWorldPosition: target => target.set(999, 999, 999) }, () => {});
  assert.ok(drone.group.position.distanceTo(origin) < 4);
});

test('distant enemies cannot alter contact coordinates for the next enemy', () => {
  const position = new THREE.Vector3(100, 0, 0);
  let pushes = 0;
  const player = {
    getWorldPosition: (target = new THREE.Vector3()) => target.copy(position),
    movement: { getInward: () => new THREE.Vector3(0, 1, 0), getTangent: () => new THREE.Vector3(1, 0, 0) },
    pushFromContact: () => { pushes++; }
  };
  const enemy = x => ({ alive: true, kind: 'turret', contactRadius: 2.2,
    getPosition: target => target.set(x, 0, 0), resolveContact: () => {} });
  EnemyManager.prototype.resolvePlayerContacts.call({ enemies: [enemy(50), enemy(50)] }, player);
  assert.equal(pushes, 0);
  EnemyManager.prototype.resolvePlayerContacts.call({ enemies: [enemy(50), enemy(99)] }, player);
  assert.equal(pushes, 1);
});

test('scan reset permits immediate use and removes the previous ring', () => {
  const scene = new THREE.Scene();
  const scan = new ScanSystem(scene);
  const player = { group: new THREE.Group() };
  assert.equal(scan.tryActivate(player, []), true);
  assert.equal(scan.tryActivate(player, []), false);
  scan.reset();
  assert.equal(scan.cooldown, 0);
  assert.equal(scene.children[0].visible, false);
  assert.equal(scan.tryActivate(player, []), true);
});

test('weapon reset removes lock and firing delays', () => {
  const weapon = new PlayerWeapon();
  weapon.cooldown = 2;
  weapon.missileCooldown = 3;
  weapon.lockTarget = {};
  weapon.reset();
  assert.equal(weapon.lockTarget, undefined);
  assert.equal(weapon.cooldown, 0);
  assert.equal(weapon.missileCooldown, 0);
});
