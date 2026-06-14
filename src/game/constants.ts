import type { Difficulty } from "./types.js";

export const DISCUSSION_DURATION_MS: Record<Difficulty, number> = {
  easy: 3 * 60 * 1000,
  normal: 2 * 60 * 1000,
  hard: 1 * 60 * 1000,
};

export const VOTING_DURATION_MS = 15_000;

export const OVERPOPULATION_PCT: Record<Difficulty, number> = {
  easy: 70,
  normal: 70,
  hard: 70,
};

export const BLOODBATH_PCT: Record<Difficulty, number> = {
  easy: 40,
  normal: 30,
  hard: 20,
};

export const BLIND_MARTYR_PCT: Record<Difficulty, number> = {
  easy: 40,
  normal: 30,
  hard: 20,
};

export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 100;

export const MIN_PLAYERS_SMALL = 5;
export const MAX_PLAYERS_SMALL = 7;

import type { GameMode } from "./types.js";

export function getMinPlayers(gameMode: GameMode): number {
  return gameMode === "compact" || gameMode === "local-compact" ? MIN_PLAYERS_SMALL : MIN_PLAYERS;
}

export function getMaxPlayers(gameMode: GameMode): number {
  return gameMode === "compact" || gameMode === "local-compact" ? MAX_PLAYERS_SMALL : MAX_PLAYERS;
}

export const CONDITION_CHECK_DURATION_MS = 7_000;
export const RESOLUTION_DURATION_MS = 13_000;
