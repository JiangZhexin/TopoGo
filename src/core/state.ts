/** 对局创建与规格装配。 */
import { buildFaces, validateEmbedding } from './topologyFaces';
import { getTopologySpec } from './topology';
import { boardKey } from './history';
import { EMPTY, RULESET_ID, TOPOLOGY_VERSION, type Cell, type TopologyId } from './types';
import type { GameState } from './rules';

export interface NewGameOptions {
  topologyId: TopologyId;
  n?: number;
  komi?: number;
}

export function createGame(options: NewGameOptions): GameState {
  const n = options.n ?? 19;
  const komi = options.komi ?? 7.5;
  const spec = getTopologySpec(options.topologyId, n);
  if (spec.faces.length === 0) {
    // 缓存规格只生成一次面数据；生成后立即做完整嵌入校验
    spec.faces = buildFaces(options.topologyId, n);
    const report = validateEmbedding(spec);
    if (!report.edgeIncidenceOk || !report.vertexLinksOk || !report.faceEdgesExist || !report.graphConnected) {
      throw new Error(`Topology validation failed for ${options.topologyId} N=${n}`);
    }
  }
  const board: Cell[] = new Array(n * n).fill(EMPTY);
  return {
    topologyId: options.topologyId,
    topologyVersion: TOPOLOGY_VERSION,
    n,
    ruleset: RULESET_ID,
    komi,
    board,
    toPlay: 'black',
    phase: 'playing',
    moves: [],
    historyCursor: 0,
    positionKeys: [boardKey(board, TOPOLOGY_VERSION, n)],
    captures: { black: 0, white: 0 },
    consecutivePasses: 0,
    lastMove: null,
    scoring: null,
    result: null,
    stateRevision: 1,
  };
}
