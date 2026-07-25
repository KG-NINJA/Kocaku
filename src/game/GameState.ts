import type { GameMode } from "../config/gameConfig";

export interface RuntimeState {
  mode: GameMode;
  score: number;
  kills: number;
  shots: number;
  hits: number;
  timeLeft: number;
  elapsed: number;
}

export const createInitialState = (): RuntimeState => ({
  mode: "title",
  score: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  timeLeft: 180,
  elapsed: 0
});
