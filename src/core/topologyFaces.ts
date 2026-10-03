/**
 * 显式面数据与嵌入校验（提案 §2.4）。
 *
 * 游戏规则只需要图 G=(V,E)；面列表 F 用于验证所声明的曲面真正正确：
 * 每条边的面关联数、顶点 link 单圈/单路径、可定向性、边界分支、
 * 度数直方图与 Euler 数全部由实现真实计算，不硬编码。
 */
import { vid, type TopologyId } from './types';
import { seamKinds, type TopologySpec } from './topology';

/** 按提案 §2.4 的 8 条规则生成四边形面。顶点顺序为局部边界顺序。 */
export function buildFaces(kind: TopologyId, n: number): number[][] {
  const F: number[][] = [];
  const v = (x: number, y: number) => vid(x, y, n);
  const { xSeam, ySeam } = seamKinds(kind);

  // 1. 内部面
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      F.push([v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)]);
    }
  }
  // 2/3. 左右接缝面
  if (xSeam === 'periodic') {
    for (let y = 0; y < n - 1; y++) {
      F.push([v(n - 1, y), v(0, y), v(0, y + 1), v(n - 1, y + 1)]);
    }
  } else if (xSeam === 'flip') {
    for (let y = 0; y < n - 1; y++) {
      F.push([v(n - 1, y), v(0, n - 1 - y), v(0, n - 2 - y), v(n - 1, y + 1)]);
    }
  }
  // 4/5. 上下接缝面
  if (ySeam === 'periodic') {
    for (let x = 0; x < n - 1; x++) {
      F.push([v(x, n - 1), v(x, 0), v(x + 1, 0), v(x + 1, n - 1)]);
    }
  } else if (ySeam === 'flip') {
    for (let x = 0; x < n - 1; x++) {
      F.push([v(x, n - 1), v(n - 1 - x, 0), v(n - 2 - x, 0), v(x + 1, n - 1)]);
    }
  }
  // 6/7/8. 额外角面：仅环面与克莱因瓶；RP² 不加
  if (kind === 'torus') {
    F.push([v(n - 1, n - 1), v(0, n - 1), v(0, 0), v(n - 1, 0)]);
  } else if (kind === 'klein') {
    F.push([v(n - 1, n - 1), v(0, 0), v(0, n - 1), v(n - 1, 0)]);
  }
  return F;
}

export interface ValidationReport {
  kind: TopologyId;
  n: number;
  vertices: number;
  edges: number;
  faces: number;
  euler: number;
  orientable: boolean;
  boundaryComponents: number;
  /** 度数 -> 顶点数 */
  degreeHistogram: Record<number, number>;
  /** 每条边的面关联数是否都属于 {1,2}，且每条图边都被面覆盖 */
  edgeIncidenceOk: boolean;
  /** 每个顶点 link 是单圈（内部）或单路径（边界） */
  vertexLinksOk: boolean;
  /** 面边全部真实存在于图中 */
  faceEdgesExist: boolean;
  graphConnected: boolean;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/** 从实际结构推导全部不变量；不做任何“预期值”假设。 */
export function validateEmbedding(spec: TopologySpec): ValidationReport {
  const { n, adjacency } = spec;
  const F = spec.faces.length > 0 ? spec.faces : buildFaces(spec.id, n);

  // 图边集合
  const E = new Set<string>();
  let edgeCount = 0;
  for (let v = 0; v < adjacency.length; v++) {
    for (const u of adjacency[v]) {
      if (v < u) {
        E.add(edgeKey(v, u));
        edgeCount++;
      }
    }
  }

  // 面边存在性与边-面关联
  const facesByEdge = new Map<string, { face: number; sign: number }[]>();
  const links = new Map<number, [number, number][]>();
  let faceEdgesExist = true;
  F.forEach((f, i) => {
    for (let j = 0; j < f.length; j++) {
      const a = f[j];
      const b = f[(j + 1) % f.length];
      const ek = edgeKey(a, b);
      if (!E.has(ek)) faceEdgesExist = false;
      const inc = facesByEdge.get(ek) ?? [];
      inc.push({ face: i, sign: a < b ? 1 : -1 });
      facesByEdge.set(ek, inc);
      const prev = f[(j - 1 + f.length) % f.length];
      const l = links.get(a) ?? [];
      l.push([Math.min(prev, b), Math.max(prev, b)]);
      links.set(a, l);
    }
  });

  let edgeIncidenceOk = facesByEdge.size === E.size;
  for (const inc of facesByEdge.values()) {
    if (inc.length !== 1 && inc.length !== 2) edgeIncidenceOk = false;
  }

  // 顶点 link：连通且度分布为 单圈（全 2）或单路径（两个 1 其余 2）
  let vertexLinksOk = true;
  for (const [, link] of links) {
    const ladj = new Map<number, Set<number>>();
    for (const [b, c] of link) {
      (ladj.get(b) ?? ladj.set(b, new Set()).get(b)!).add(c);
      (ladj.get(c) ?? ladj.set(c, new Set()).get(c)!).add(b);
    }
    // 连通性
    const start = ladj.keys().next().value as number;
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length) {
      const a = stack.pop()!;
      for (const nb of ladj.get(a)!) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (seen.size !== ladj.size) {
      vertexLinksOk = false;
      continue;
    }
    let ones = 0;
    for (const s of ladj.values()) {
      if (s.size === 1) ones++;
      else if (s.size !== 2) vertexLinksOk = false;
    }
    if (ones !== 0 && ones !== 2) vertexLinksOk = false;
  }

  // 可定向性：面定向传播
  const faceAdj = new Map<number, { other: number; sign: number }[]>();
  for (const inc of facesByEdge.values()) {
    if (inc.length === 2) {
      const [p, q] = inc;
      const s = -p.sign * q.sign;
      (faceAdj.get(p.face) ?? faceAdj.set(p.face, []).get(p.face)!).push({ other: q.face, sign: s });
      (faceAdj.get(q.face) ?? faceAdj.set(q.face, []).get(q.face)!).push({ other: p.face, sign: s });
    }
  }
  const assigned = new Map<number, number>();
  let orientable = true;
  for (let start = 0; start < F.length; start++) {
    if (assigned.has(start)) continue;
    assigned.set(start, 1);
    const stack = [start];
    while (stack.length) {
      const a = stack.pop()!;
      for (const { other, sign } of faceAdj.get(a) ?? []) {
        const want = assigned.get(a)! * sign;
        if (assigned.has(other)) {
          if (assigned.get(other) !== want) orientable = false;
        } else {
          assigned.set(other, want);
          stack.push(other);
        }
      }
    }
  }

  // 边界分支
  const badj = new Map<number, Set<number>>();
  for (const [ek, inc] of facesByEdge) {
    if (inc.length === 1) {
      const [a, b] = ek.split(',').map(Number);
      (badj.get(a) ?? badj.set(a, new Set()).get(a)!).add(b);
      (badj.get(b) ?? badj.set(b, new Set()).get(b)!).add(a);
    }
  }
  let boundaryComponents = 0;
  {
    const seen = new Set<number>();
    for (const start of badj.keys()) {
      if (seen.has(start)) continue;
      boundaryComponents++;
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const a = stack.pop()!;
        for (const nb of badj.get(a)!) {
          if (!seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
        }
      }
    }
  }

  // 度数直方图与图连通
  const degreeHistogram: Record<number, number> = {};
  for (const nbs of adjacency) {
    degreeHistogram[nbs.length] = (degreeHistogram[nbs.length] ?? 0) + 1;
  }
  let graphConnected = false;
  {
    const seen = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const a = stack.pop()!;
      for (const nb of adjacency[a]) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    graphConnected = seen.size === adjacency.length;
  }

  const faces = F.length;
  return {
    kind: spec.id,
    n,
    vertices: adjacency.length,
    edges: edgeCount,
    faces,
    euler: adjacency.length - edgeCount + faces,
    orientable,
    boundaryComponents,
    degreeHistogram,
    edgeIncidenceOk,
    vertexLinksOk,
    faceEdgesExist,
    graphConnected,
  };
}
