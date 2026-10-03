/**
 * 即时势力图（提案 §5.2）：在全部空点上解离散调和方程
 *   h(v) = Σ h(u) / degree(v)，黑子固定 +1，白子固定 -1。
 * 全空盘 h=0；仅一色时解退化（singleColor=true，UI 必须提示局限）。
 * 固定初值 0、Gauss–Seidel、有最大迭代与容差；未收敛如实标注。
 */
import { BLACK, EMPTY, WHITE, type Cell } from '../core/types';
import type { InfluenceResult } from './types';

export const DEFAULT_MAX_ITERATIONS = 5000;
export const DEFAULT_RESIDUAL_TOLERANCE = 1e-5;

export function computeInfluence(
  board: Cell[],
  adjacency: number[][],
  maxIterations = DEFAULT_MAX_ITERATIONS,
  residualTolerance = DEFAULT_RESIDUAL_TOLERANCE,
): InfluenceResult {
  const n2 = board.length;
  const values = new Array<number>(n2).fill(0);
  let hasBlack = false;
  let hasWhite = false;
  for (let v = 0; v < n2; v++) {
    if (board[v] === BLACK) {
      values[v] = 1;
      hasBlack = true;
    } else if (board[v] === WHITE) {
      values[v] = -1;
      hasWhite = true;
    }
  }

  const singleColor = hasBlack !== hasWhite;
  if ((!hasBlack && !hasWhite) || singleColor) {
    // 全空：h=0。仅一色：调和解退化为该色常数场（Dirichlet 边界仅一种值）。
    if (singleColor) {
      const c = hasBlack ? 1 : -1;
      for (let v = 0; v < n2; v++) values[v] = c;
    }
    return { kind: 'heuristic', values, iterations: 0, converged: true, residual: 0, singleColor };
  }

  let iterations = 0;
  let residual = Infinity;
  for (let it = 0; it < maxIterations; it++) {
    iterations = it + 1;
    let maxDelta = 0;
    for (let v = 0; v < n2; v++) {
      if (board[v] !== EMPTY) continue;
      const nbs = adjacency[v];
      let sum = 0;
      for (const u of nbs) sum += values[u];
      const next = sum / nbs.length;
      const delta = Math.abs(next - values[v]);
      if (delta > maxDelta) maxDelta = delta;
      values[v] = next;
    }
    residual = maxDelta;
    if (residual <= residualTolerance) break;
  }

  // 数值保险：截断到 [-1,1]
  for (let v = 0; v < n2; v++) {
    if (values[v] > 1) values[v] = 1;
    else if (values[v] < -1) values[v] = -1;
  }

  return {
    kind: 'heuristic',
    values,
    iterations,
    converged: residual <= residualTolerance,
    residual,
    singleColor: false,
  };
}

/** 弱基线参考估值（提案 §5.3）：势力折算差，不是预言终局分差。 */
export function heuristicMargin(board: Cell[], influence: InfluenceResult, komi: number): number {
  let b = 0;
  let w = 0;
  let sum = 0;
  for (let v = 0; v < board.length; v++) {
    if (board[v] === BLACK) b++;
    else if (board[v] === WHITE) w++;
    else sum += influence.values[v];
  }
  return b - w + sum - komi;
}
