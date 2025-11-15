// Global type declarations for the 2048 project

// Movement direction
// Matches JSDoc typedef: {'left' | 'right' | 'up' | 'down'}
type Direction = 'left' | 'right' | 'up' | 'down';

// Single tile movement information used for animations and bookkeeping
interface TileMove {
  fromR: number; // Source row
  fromC: number; // Source column
  toR: number;   // Destination row
  toC: number;   // Destination column
  value: number; // Tile value
  merged: boolean; // Whether this tile was merged
  newValue?: number; // New value after merge (if merged)
}

// Destination cell info when a merge occurs
interface MergedDestination {
  r: number; // Row
  c: number; // Column
  newValue: number; // Value after merge
}

// Result of a move operation to the left (before un-rotating)
interface MoveResult {
  grid: number[][]; // New grid state
  moved: boolean; // Whether any tiles moved
  mergedScore: number; // Score gained from merges
  moves: TileMove[]; // Array of tile movements
  mergedDestinations: MergedDestination[]; // Cells that received merges
}

// Pixel position of a cell in the board
interface CellPosition {
  top: number; // Top position in pixels
  left: number; // Left position in pixels
}

type TurnType = 'move' | 'place';

interface GameState {
    grid: number[][];
    score: number;
    turn: TurnType;
}

interface GameConfig {
    SIZE: number;
    STORAGE_KEY: string;
    TILE_VALUES: number[];
    SECOND_PLAYER_ENABLED: boolean;
    INITIAL_PLACEMENTS: number;
}