/** 汇总分析：Worker 与同步回退共用同一实现。 */
import { getTopologySpec } from '../core/topology';
import { createGame } from '../core/state';
import { computeInfluence, heuristicMargin } from './influence';
import { findAtariGroups, findCaptureMoves } from './tactical';
import { EMPTY, BLACK, WHITE, type Cell } from '../core/types';
import type { AnalysisRequest, AnalysisResult } from './types';

export function runAnalysis(req: AnalysisRequest): AnalysisResult {
  const t0 = Date.now();
  const spec = getTopologySpec(req.topologyId, req.n);
  const board = req.board.map((c) => (c === BLACK ? BLACK : c === WHITE ? WHITE : EMPTY)) as Cell[];

  const influence = computeInfluence(
    board,
    spec.adjacency,
    req.maxIterations,
    req.residualTolerance,
  );
  const { atari, twoLiberty } = findAtariGroups(board, spec.adjacency);

  // 用最小状态驱动规则内核求一手提子点（棋盘由请求方保证来自有效局面）
  const probe = createGame({ topologyId: req.topologyId, n: req.n, komi: req.komi });
  probe.board = board.slice();
  probe.toPlay = req.toPlay;
  probe.positionKeys = req.positionKeys.slice();
  probe.historyCursor = req.positionKeys.length - 1;
  const captureMoves = findCaptureMoves(probe, spec.adjacency);

  let emptyCount = 0;
  for (const c of board) if (c === EMPTY) emptyCount++;

  const warnings: string[] = [];
  if (influence.singleColor) {
    warnings.push('仅一色落子：势力图解退化，仅反映影响；开局不能据此判断领地或胜负。');
  }
  if (!influence.converged) {
    warnings.push(`势力迭代未完全收敛（residual=${influence.residual.toExponential(2)}），结果为近似值。`);
  }
  warnings.push('势力图与参考估值为启发式，不处理死活、劫争与最佳对抗，不能用于裁定终局。');

  const margin = influence.singleColor ? null : heuristicMargin(board, influence, req.komi);
  if (margin === null) {
    warnings.push('尚不适合判断领先。');
  }

  return {
    type: 'result',
    method: 'harmonic-influence+tactical',
    revision: req.revision,
    influence,
    atariGroups: atari,
    twoLibertyGroups: twoLiberty,
    captureMoves,
    heuristicMargin: margin,
    warnings,
    diagnostics: { emptyCount, durationMs: Date.now() - t0 },
  };
}
