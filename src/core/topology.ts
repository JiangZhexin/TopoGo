/**
 * 拓扑构造：五种棋盘的图 G=(V,E) 与跨边接缝记录。
 * 邻接约定见提案 §2.2（TOPOLOGY.md 同步收录）。
 *
 * 不变量（由 tests/topology.test.ts 强制）：
 * - neighbors(v) 去重、无自环、无向对称；
 * - 图连通；
 * - 361 个独立落点，不做任何顶点合并。
 */
import { TOPOLOGY_VERSION, vid, type TopologyId } from './types';

export type SeamDirection = 'left' | 'right' | 'up' | 'down';

/** 有向跨缝记录：仅用于 UI 画接缝/幽灵映射；规则层使用去重后的 adjacency。 */
export interface SeamEdge {
  from: number;
  to: number;
  direction: SeamDirection;
}

export interface TopologySpec {
  id: TopologyId;
  version: string;
  n: number;
  vertexCount: number;
  /** adjacency[v] = 去重排序后的邻点 vertexId 列表 */
  adjacency: number[][];
  /** 有向跨缝出边（UI 用） */
  seams: SeamEdge[];
  /** 显式四边形面列表（topologyFaces.ts 生成并校验） */
  faces: number[][];
}

function flags(kind: TopologyId) {
  return {
    wrapX: kind !== 'plane',
    flipX: kind === 'mobius' || kind === 'klein' || kind === 'projective',
    wrapY: kind === 'torus' || kind === 'klein' || kind === 'projective',
    flipY: kind === 'projective',
  };
}

/**
 * 单步邻点：内部按矩形网格；越界时按 §2.2 表做接缝映射。
 * 返回 null 表示该方向无邻点（真实边界）。
 */
function stepNeighbor(
  x: number,
  y: number,
  dx: number,
  dy: number,
  kind: TopologyId,
  n: number,
): { x: number; y: number } | null {
  const nx = x + dx;
  const ny = y + dy;
  if (nx >= 0 && nx < n && ny >= 0 && ny < n) return { x: nx, y: ny };
  const f = flags(kind);
  if (nx < 0) {
    if (!f.wrapX) return null;
    return { x: n - 1, y: f.flipX ? n - 1 - y : y };
  }
  if (nx >= n) {
    if (!f.wrapX) return null;
    return { x: 0, y: f.flipX ? n - 1 - y : y };
  }
  if (ny < 0) {
    if (!f.wrapY) return null;
    return { x: f.flipY ? n - 1 - x : x, y: n - 1 };
  }
  // ny >= n
  if (!f.wrapY) return null;
  return { x: f.flipY ? n - 1 - x : x, y: 0 };
}

const DIRECTIONS: { dx: number; dy: number; dir: SeamDirection }[] = [
  { dx: -1, dy: 0, dir: 'left' },
  { dx: 1, dy: 0, dir: 'right' },
  { dx: 0, dy: -1, dir: 'up' },
  { dx: 0, dy: 1, dir: 'down' },
];

/** 生成面列表的接缝类型判断（与 flags 一致，供 topologyFaces 使用）。 */
export function seamKinds(kind: TopologyId) {
  const f = flags(kind);
  return {
    xSeam: f.wrapX ? (f.flipX ? ('flip' as const) : ('periodic' as const)) : null,
    ySeam: f.wrapY ? (f.flipY ? ('flip' as const) : ('periodic' as const)) : null,
  };
}

export function buildTopology(kind: TopologyId, n: number): TopologySpec {
  if (n < 3) throw new Error('Use N >= 3; small degenerate grids are not specified.');
  const vertexCount = n * n;
  const adjSets: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());
  const seams: SeamEdge[] = [];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = vid(x, y, n);
      for (const { dx, dy, dir } of DIRECTIONS) {
        const crossed = x + dx < 0 || x + dx >= n || y + dy < 0 || y + dy >= n;
        const nb = stepNeighbor(x, y, dx, dy, kind, n);
        if (!nb) continue;
        const u = vid(nb.x, nb.y, n);
        if (u === v) continue; // 不允许自环（N>=3 时本不会发生，防御性保留）
        adjSets[v].add(u);
        if (crossed) seams.push({ from: v, to: u, direction: dir });
      }
    }
  }

  // 无向性校验（构造层面保证，这里断言防御回归）
  for (let v = 0; v < vertexCount; v++) {
    for (const u of adjSets[v]) {
      if (!adjSets[u].has(v)) {
        throw new Error(`Adjacency not symmetric between ${v} and ${u} (${kind})`);
      }
    }
  }

  return {
    id: kind,
    version: TOPOLOGY_VERSION,
    n,
    vertexCount,
    adjacency: adjSets.map((s) => [...s].sort((a, b) => a - b)),
    seams,
    faces: [], // 由 topologyFaces.buildFaces 填充
  };
}

const cache = new Map<string, TopologySpec>();

/** 取规格（缓存）。返回的对象为共享只读，调用方不得修改。 */
export function getTopologySpec(kind: TopologyId, n: number): TopologySpec {
  const key = `${kind}:${n}`;
  let spec = cache.get(key);
  if (!spec) {
    spec = buildTopology(kind, n);
    cache.set(key, spec);
  }
  return spec;
}
