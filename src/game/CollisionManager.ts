import * as THREE from "three";
import { GAME } from "../config/gameConfig";
import type { Player } from "./Player";

export class CollisionManager {
  resolvePlayer(player: Player): void {
    player.movement.z = THREE.MathUtils.clamp(player.movement.z, 2, GAME.tunnelLength - 4);
    player.movement.radialOffset = THREE.MathUtils.clamp(player.movement.radialOffset, 0, GAME.maxJumpHeight);
  }
}
