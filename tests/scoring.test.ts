/** 计分测试（提案 §9.3）。 */
import { describe, expect, it } from 'vitest';
import { scorePosition } from '../src/core/scoring';
import { getTopologySpec } from '../src/core/topology';
import { BLACK, EMPTY, WHITE, vid, type Cell } from '../src/core/types';
import { at } from './fixtures/builder';

const N = 19;

function emptyBoard(n = N): Cell[] {
  return new Array(n * n).fill(EMPTY);
}

describe('面积分解恒等式与基本分类', () => {
  it('空盘全部中立；komi 为整数时允许和棋', () => {
    const adj = getTopologySpec('plane', N).adjacency;
    const r0 = scorePosition(emptyBoard(), adj, new Set(), 0);
    expect(r0.neutral).toBe(N * N);
    expect(r0.margin).toBe(0);
    expect(r0.total).toBe(N * N);
    const r75 = scorePosition(emptyBoard(), adj, new Set(), 7.5);
    expect(r75.margin).toBe(-7.5);
  });

  it('单色边界空域计入该色；提子不额外加分', () => {
    const adj = getTopologySpec('plane', N).adjacency;
    const board = emptyBoard();
    // 黑占满第 0 行：下方 18 行空域只邻黑
    for (let x = 0; x < N; x++) board[vid(x, 0, N)] = BLACK;
    const r = scorePosition(board, adj, new Set(), 0);
    expect(r.blackStones).toBe(19);
    expect(r.blackTerritory).toBe(18 * 19);
    expect(r.whiteTerritory).toBe(0);
    expect(r.neutral).toBe(0);
    expect(r.margin).toBe(19 + 18 * 19);
  });

  it('混合边界空域中立；双活公共气不自动删除', () => {
    const adj = getTopologySpec('plane', N).adjacency;
    const board = emptyBoard();
    board[at(0, 0)] = BLACK;
    board[at(0, 2)] = WHITE;
    // (0,1) 同时邻接黑白 -> 中立；其余空域也邻接黑白 -> 中立
    const r = scorePosition(board, adj, new Set(), 0);
    expect(r.blackStones).toBe(1);
    expect(r.whiteStones).toBe(1);
    expect(r.blackTerritory).toBe(0);
    expect(r.whiteTerritory).toBe(0);
    expect(r.neutral).toBe(N * N - 2);
  });

  it('标死移除参与计分：死子不计入保留石子，其位置变为空域', () => {
    const adj = getTopologySpec('plane', N).adjacency;
    const board = emptyBoard();
    for (let x = 0; x < N; x++) board[vid(x, 0, N)] = BLACK;
    board[at(5, 5)] = WHITE; // 黑空域中的白死子
    const dead = new Set([at(5, 5)]);
    const r = scorePosition(board, adj, dead, 0);
    expect(r.whiteStones).toBe(0);
    expect(r.blackTerritory).toBe(18 * 19); // 死子位置回归黑方空域
    expect(r.total).toBe(N * N);
  });
});

describe('拓扑计分', () => {
  it('环面竖圈示例：黑 x=0 圈、白 x=9 圈，两个跨缝空域均为混合边界中立（152+171）', () => {
    const adj = getTopologySpec('torus', N).adjacency;
    const board = emptyBoard();
    for (let y = 0; y < N; y++) {
      board[vid(0, y, N)] = BLACK;
      board[vid(9, y, N)] = WHITE;
    }
    const r = scorePosition(board, adj, new Set(), 0);
    expect(r.blackStones).toBe(19);
    expect(r.whiteStones).toBe(19);
    // 跨缝连通的空域不能被平面直觉拆成“被围地”
    expect(r.blackTerritory).toBe(0);
    expect(r.whiteTerritory).toBe(0);
    expect(r.neutral).toBe(152 + 171);
    expect(r.margin).toBe(0);
    expect(r.total).toBe(N * N);
  });

  it('莫比乌斯带：左右跨缝翻转连通的空域是一个分量', () => {
    const n = 9;
    const adj = getTopologySpec('mobius', n).adjacency;
    const board = new Array(n * n).fill(EMPTY) as Cell[];
    // 黑占满 y=0 与 y=8 两条水平带 -> 中间 7 行空域只邻黑
    for (let x = 0; x < n; x++) {
      board[vid(x, 0, n)] = BLACK;
      board[vid(x, n - 1, n)] = BLACK;
    }
    const r = scorePosition(board, adj, new Set(), 0);
    expect(r.blackStones).toBe(2 * n);
    expect(r.blackTerritory).toBe(7 * n);
    expect(r.neutral).toBe(0);
    expect(r.total).toBe(n * n);
  });
});
