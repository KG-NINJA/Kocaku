export const GAME = {
  tunnelRadius: 18,
  tunnelLength: 260,
  playerClearance: 0.8,
  walkSpeed: 18,
  strafeSpeed: 14,
  boostSpeed: 32,
  acceleration: 8,
  jumpImpulse: 9,
  adhesionGravity: 22,
  maxJumpHeight: 5.5,
  projectileSpeed: 70,
  enemyProjectileSpeed: 24,
  projectileLifetime: 2.8,
  fireInterval: 0.12,
  lockRange: 65,
  lockAngle: 0.32,
  scanRange: 55,
  scanCooldown: 7,
  stageTime: 180,
  bossZ: 232,
  cameraDistance: 9,
  cameraHeight: 4.5,
  maxHealth: 100,
  maxEnergy: 100
} as const;

export type GameMode = "title" | "playing" | "paused" | "clear" | "gameover";
