/** 拓扑构造验收（提案 §9.1）：N=5/9/13/19，五类棋盘全量不变量 + 具体锚点。 */
import { describe, expect, it } from 'vitest';
import { getTopologySpec } from '../src/core/topology';
import { buildFaces, validateEmbedding, type ValidationReport } from '../src/core/topologyFaces';
import { ALL_TOPOLOGIES, vid, type TopologyId } from '../src/core/types';

interface Expected {
  edges: number;
  faces: number;
  euler: number;
  orientable: boolean;
  boundary: number;
  degrees: Record<number, number>;
}

function expectedFor(kind: TopologyId, n: number): Expected {
  switch (kind) {
    case 'plane':
      return {
        edges: 2 * n * (n - 1),
        faces: (n - 1) * (n - 1),
        euler: 1,
        orientable: true,
        boundary: 1,
        degrees: { 2: 4, 3: 4 * (n - 2), 4: (n - 2) * (n - 2) },
      };
    case 'torus':
      return { edges: 2 * n * n, faces: n * n, euler: 0, orientable: true, boundary: 0, degrees: { 4: n * n } };
    case 'mobius':
      return {
        edges: 2 * n * n - n,
        faces: n * (n - 1),
        euler: 0,
        orientable: false,
        boundary: 1,
        degrees: { 3: 2 * n, 4: n * (n - 2) },
      };
    case 'klein':
      return { edges: 2 * n * n, faces: n * n, euler: 0, orientable: false, boundary: 0, degrees: { 4: n * n } };
    case 'projective':
      return {
        edges: 2 * n * n - 2,
        faces: n * n - 1,
        euler: 1,
        orientable: false,
        boundary: 0,
        degrees: { 3: 4, 4: n * n - 4 },
      };
  }
}

function reportFor(kind: TopologyId, n: number): ValidationReport {
  const spec = getTopologySpec(kind, n);
  if (spec.faces.length === 0) spec.faces = buildFaces(kind, n);
  return validateEmbedding(spec);
}

describe('拓扑嵌入校验：N=5/9/13/19 × 五类棋盘', () => {
  for (const n of [5, 9, 13, 19]) {
    for (const kind of ALL_TOPOLOGIES) {
      it(`${kind} N=${n}：全部不变量由实现真实计算并对上`, () => {
        const spec = getTopologySpec(kind, n);
        const { adjacency } = spec;

        // 邻接无向、无自环、去重
        for (let v = 0; v < adjacency.length; v++) {
          const nbs = adjacency[v];
          expect(new Set(nbs).size).toBe(nbs.length);
          expect(nbs).not.toContain(v);
          for (const u of nbs) expect(adjacency[u]).toContain(v);
        }

        const r = reportFor(kind, n);
        const exp = expectedFor(kind, n);
        expect(r.graphConnected).toBe(true);
        expect(r.faceEdgesExist).toBe(true);
        expect(r.edgeIncidenceOk).toBe(true);
        expect(r.vertexLinksOk).toBe(true);
        expect(r.vertices).toBe(n * n);
        expect(r.edges).toBe(exp.edges);
        expect(r.faces).toBe(exp.faces);
        expect(r.euler).toBe(exp.euler);
        expect(r.orientable).toBe(exp.orientable);
        expect(r.boundaryComponents).toBe(exp.boundary);
        expect(r.degreeHistogram).toEqual(exp.degrees);
      });
    }
  }
});

describe('具体锚点（N=19）', () => {
  const n = 19;
  it('torus: neighbors(0,7) 含 (18,7)', () => {
    const a = getTopologySpec('torus', n).adjacency;
    expect(a[vid(0, 7, n)]).toContain(vid(18, 7, n));
  });
  it('mobius: neighbors(0,7) 含 (18,11)，不含 (18,7)', () => {
    const a = getTopologySpec('mobius', n).adjacency;
    expect(a[vid(0, 7, n)]).toContain(vid(18, 11, n));
    expect(a[vid(0, 7, n)]).not.toContain(vid(18, 7, n));
  });
  it('mobius: neighbors(5,0) 不含 (5,18)（上下为真实边界）', () => {
    const a = getTopologySpec('mobius', n).adjacency;
    expect(a[vid(5, 0, n)]).not.toContain(vid(5, 18, n));
  });
  it('klein: neighbors(5,0) 含 (5,18)，左右仍翻转', () => {
    const a = getTopologySpec('klein', n).adjacency;
    expect(a[vid(5, 0, n)]).toContain(vid(5, 18, n));
    expect(a[vid(0, 7, n)]).toContain(vid(18, 11, n));
  });
  it('projective: neighbors(5,0) 含 (13,18)', () => {
    const a = getTopologySpec('projective', n).adjacency;
    expect(a[vid(5, 0, n)]).toContain(vid(13, 18, n));
  });
  it('projective: neighbors(0,0) 恰为 {(1,0),(0,1),(18,18)}，两条跨缝路径只算一个邻点', () => {
    const a = getTopologySpec('projective', n).adjacency;
    expect(a[vid(0, 0, n)]).toEqual([vid(0, 1, n), vid(1, 0, n), vid(18, 18, n)].sort((x, y) => x - y));
  });
  it('projective: 其余三角同样三邻点，四角之外全部四邻点', () => {
    const a = getTopologySpec('projective', n).adjacency;
    for (const c of [vid(0, n - 1, n), vid(n - 1, 0, n), vid(n - 1, n - 1, n)]) {
      expect(a[c].length).toBe(3);
    }
    expect(a.filter((nbs) => nbs.length === 3).length).toBe(4);
  });
});
