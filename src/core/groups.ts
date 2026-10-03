/**
 * 棋串与气（提案 §3.2）。
 * 棋串 = 同色石子在图上的最大连通分量；气一律使用集合，
 * 两条不同跨缝路径通向同一空点只算一口气。
 */
import { EMPTY, type Cell, type Color, colorOf } from './types';

/** 包含 start 的同色连通棋串（升序 vertexId）。start 处必须有子。 */
export function getGroup(board: Cell[], adjacency: number[][], start: number): number[] {
  const color = board[start];
  if (color === EMPTY) throw new Error(`getGroup on empty vertex ${start}`);
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const v = stack.pop()!;
    for (const u of adjacency[v]) {
      if (!seen.has(u) && board[u] === color) {
        seen.add(u);
        stack.push(u);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** 棋串的气：相邻空点集合（天然去重）。 */
export function getLiberties(board: Cell[], adjacency: number[][], group: number[]): Set<number> {
  const libs = new Set<number>();
  for (const v of group) {
    for (const u of adjacency[v]) {
      if (board[u] === EMPTY) libs.add(u);
    }
  }
  return libs;
}

export interface GroupInfo {
  color: Color;
  stones: number[];
  liberties: Set<number>;
}

/** 全盘所有棋串（每个棋串一次，stones 升序）。 */
export function getAllGroups(board: Cell[], adjacency: number[][]): GroupInfo[] {
  const visited = new Set<number>();
  const groups: GroupInfo[] = [];
  for (let v = 0; v < board.length; v++) {
    if (board[v] === EMPTY || visited.has(v)) continue;
    const stones = getGroup(board, adjacency, v);
    for (const s of stones) visited.add(s);
    groups.push({
      color: colorOf(board[v])!,
      stones,
      liberties: getLiberties(board, adjacency, stones),
    });
  }
  return groups;
}
