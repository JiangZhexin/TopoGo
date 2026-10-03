/** 共享基础类型。规则核心与 React/DOM 无关。 */

export type TopologyId = 'plane' | 'torus' | 'mobius' | 'klein' | 'projective';

export const ALL_TOPOLOGIES: TopologyId[] = ['plane', 'torus', 'mobius', 'klein', 'projective'];

/** 邻接约定版本：变更跨边规则时必须升级，棋谱键命名空间依赖它。 */
export const TOPOLOGY_VERSION = 'topo-v1';

export const RULESET_ID = 'TopoGo Area v1';

export type Color = 'black' | 'white';

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE;

export function colorOf(cell: Cell): Color | null {
  return cell === BLACK ? 'black' : cell === WHITE ? 'white' : null;
}

export function stoneOf(color: Color): Cell {
  return color === 'black' ? BLACK : WHITE;
}

export function opponent(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}

export function vid(x: number, y: number, n: number): number {
  return y * n + x;
}

export function xy(v: number, n: number): { x: number; y: number } {
  return { x: v % n, y: Math.floor(v / n) };
}

/** 显示坐标：列 A–T（跳过 I），行 19–1（y=0 显示为 19）。 */
export function displayCoord(v: number, n: number): string {
  const { x, y } = xy(v, n);
  const letters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
  return `${letters[x]}${n - y}`;
}
