/**
 * 测试夹具：直接设定初始颜色以隔离规则（提案 §9.2）。
 * 夹具校验没有预存零气棋串；不宣称可由空盘合法达到。
 * 需要验证可达性的整局测试请使用真实行动序列。
 */
import { createGame } from '../../src/core/state';
import { getAllGroups } from '../../src/core/groups';
import { getTopologySpec } from '../../src/core/topology';
import { boardKey } from '../../src/core/history';
import { stoneOf, vid, type Color, type TopologyId } from '../../src/core/types';
import type { GameState } from '../../src/core/rules';

export interface Placement {
  vertex: number;
  color: Color;
}

export function at(x: number, y: number, n = 19): number {
  return vid(x, y, n);
}

export function fixtureState(
  topologyId: TopologyId,
  placements: Placement[],
  opts?: { n?: number; komi?: number; toPlay?: Color },
): GameState {
  const n = opts?.n ?? 19;
  const state = createGame({ topologyId, n, komi: opts?.komi ?? 7.5 });
  for (const { vertex, color } of placements) {
    state.board[vertex] = stoneOf(color);
  }
  const spec = getTopologySpec(topologyId, n);
  for (const g of getAllGroups(state.board, spec.adjacency)) {
    if (g.liberties.size === 0) {
      throw new Error(`fixture has zero-liberty ${g.color} group at ${g.stones[0]}`);
    }
  }
  // PSK 有效历史从夹具局面重新开始
  state.positionKeys = [boardKey(state.board, state.topologyVersion, n)];
  if (opts?.toPlay) state.toPlay = opts.toPlay;
  return state;
}
