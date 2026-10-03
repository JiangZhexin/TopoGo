/**
 * 终局面积计分：确定性裁判（提案 §4）。
 *
 * 拓扑原则：计分判断空点的图连通分量，不凭 2D 图上是否画出闭合圈。
 * 提子计数只用于过程展示，不再额外加分；双活不自动删除。
 */
import { BLACK, EMPTY, WHITE, type Cell } from './types';

export interface ScoreBreakdown {
  /** 保留在棋盘上的黑/白石子数（确认死子已移除） */
  blackStones: number;
  whiteStones: number;
  /** 单色边界空域 */
  blackTerritory: number;
  whiteTerritory: number;
  /** 混合边界或无边界的中立空点 */
  neutral: number;
  komi: number;
  blackScore: number;
  whiteScore: number;
  /** SB - SW；正黑胜，负白胜，零和棋 */
  margin: number;
  /** B+W+TB+TW+U，恒等于 N*N（断言用） */
  total: number;
}

/**
 * @param board 真实棋盘（含死子）
 * @param adjacency 图邻接
 * @param dead 双方确认的死子 vertexId 集合
 * @param komi 贴目（白方加分）
 */
export function scorePosition(
  board: Cell[],
  adjacency: number[][],
  dead: ReadonlySet<number>,
  komi: number,
): ScoreBreakdown {
  const n2 = board.length;
  const eff: Cell[] = board.slice();
  for (const v of dead) eff[v] = EMPTY;

  let blackStones = 0;
  let whiteStones = 0;
  for (const c of eff) {
    if (c === BLACK) blackStones++;
    else if (c === WHITE) whiteStones++;
  }

  // 空点连通分量 flood fill（按真实图邻接，跨缝自然连通）
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;
  const visited = new Set<number>();
  for (let s = 0; s < n2; s++) {
    if (eff[s] !== EMPTY || visited.has(s)) continue;
    const region: number[] = [];
    const colors = new Set<Cell>();
    const stack = [s];
    visited.add(s);
    while (stack.length) {
      const v = stack.pop()!;
      region.push(v);
      for (const u of adjacency[v]) {
        if (eff[u] === EMPTY) {
          if (!visited.has(u)) {
            visited.add(u);
            stack.push(u);
          }
        } else {
          colors.add(eff[u]);
        }
      }
    }
    if (colors.size === 1 && colors.has(BLACK)) blackTerritory += region.length;
    else if (colors.size === 1 && colors.has(WHITE)) whiteTerritory += region.length;
    else neutral += region.length; // {B,W} 或空集
  }

  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + komi;
  const total = blackStones + whiteStones + blackTerritory + whiteTerritory + neutral;
  if (total !== n2) {
    throw new Error(`score identity violated: ${total} != ${n2}`);
  }
  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    neutral,
    komi,
    blackScore,
    whiteScore,
    margin: blackScore - whiteScore,
    total,
  };
}

export interface GameResultWin {
  type: 'score' | 'resign';
  winner: Color | null; // score 且 margin=0 时为 null（和棋）
  margin: number; // resign 时为 0
  breakdown: ScoreBreakdown | null;
}

import type { Color } from './types';

export function formatResult(r: GameResultWin): string {
  if (r.type === 'resign') {
    return r.winner === 'black' ? '白方认输，黑中盘胜' : '黑方认输，白中盘胜';
  }
  if (r.winner === null) return '和棋';
  const m = Math.abs(r.margin);
  return r.winner === 'black' ? `黑胜 ${m} 分` : `白胜 ${m} 分`;
}
