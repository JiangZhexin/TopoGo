/**
 * 局部战术信息（提案 §5.1）：叫吃、二气警示、当前方一手提子点。
 * 全部由规则事实确定计算，不做棋力解释。
 */
import { getAllGroups } from '../core/groups';
import { tryPlay, type GameState } from '../core/rules';
import { EMPTY, type Color } from '../core/types';
import type { AtariInfo, CaptureMoveInfo } from './types';

export function findAtariGroups(
  board: GameState['board'],
  adjacency: number[][],
): { atari: AtariInfo[]; twoLiberty: AtariInfo[] } {
  const atari: AtariInfo[] = [];
  const twoLiberty: AtariInfo[] = [];
  for (const g of getAllGroups(board, adjacency)) {
    const info: AtariInfo = {
      color: g.color as Color,
      stones: g.stones,
      liberties: [...g.liberties].sort((a, b) => a - b),
    };
    if (g.liberties.size === 1) atari.push(info);
    else if (g.liberties.size === 2) twoLiberty.push(info);
  }
  return { atari, twoLiberty };
}

/** 当前行棋方所有能立即提子的合法落点（模拟规则内核，含跨缝与 PSK）。 */
export function findCaptureMoves(state: GameState, adjacency: number[][]): CaptureMoveInfo[] {
  void adjacency;
  const out: CaptureMoveInfo[] = [];
  if (state.phase !== 'playing') return out;
  for (let v = 0; v < state.board.length; v++) {
    if (state.board[v] !== EMPTY) continue;
    const r = tryPlay(state, v);
    if (r.ok) {
      // 取数组末尾而非 historyCursor-1：探测状态的 historyCursor 可能被人为抬高
      const m = r.state.moves[r.state.moves.length - 1];
      if (m && m.type === 'play' && m.captured.length > 0) {
        out.push({ vertex: v, captures: m.captured.length });
      }
    }
  }
  return out;
}
