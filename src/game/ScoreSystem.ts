import type { RuntimeState } from "./GameState";
import type { Enemy } from "../entities/Enemy";

export class ScoreSystem {
  constructor(private readonly state: RuntimeState) {}

  enemyDestroyed(enemy: Enemy): void {
    this.state.kills += 1;
    this.state.score += enemy.scoreValue;
  }

  finalBonus(): void {
    this.state.score += Math.max(0, Math.floor(this.state.timeLeft) * 25);
  }

  get accuracy(): number {
    return this.state.shots > 0 ? Math.round((this.state.hits / this.state.shots) * 100) : 0;
  }
}
