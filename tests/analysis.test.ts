/** 评估测试（提案 §9.5）。 */
import { describe, expect, it } from 'vitest';
import { computeInfluence, heuristicMargin } from '../src/analysis/influence';
import { findCaptureMoves, findAtariGroups } from '../src/analysis/tactical';
import { getTopologySpec } from '../src/core/topology';
import { createGame } from '../src/core/state';
import { tryPlay } from '../src/core/rules';
import { BLACK, EMPTY, WHITE, vid, type Cell } from '../src/core/types';
import { at, fixtureState } from './fixtures/builder';

function boardFrom(placements: [number, Cell][], n: number): Cell[] {
  const b = new Array<Cell>(n * n).fill(EMPTY);
  for (const [v, c] of placements) b[v] = c;
  return b;
}

describe('势力算法', () => {
  it('空盘全零、结果确定、数值有界', () => {
    const n = 9;
    const adj = getTopologySpec('plane', n).adjacency;
    const r = computeInfluence(new Array<Cell>(n * n).fill(EMPTY), adj);
    expect(r.values.every((v) => v === 0)).toBe(true);
    expect(r.converged).toBe(true);
    const r2 = computeInfluence(new Array<Cell>(n * n).fill(EMPTY), adj);
    expect(r2.values).toEqual(r.values);
  });

  it('黑白互换时变号', () => {
    const n = 9;
    const adj = getTopologySpec('plane', n).adjacency;
    const b1 = boardFrom([[vid(2, 2, n), BLACK], [vid(6, 6, n), WHITE]], n);
    const b2 = boardFrom([[vid(2, 2, n), WHITE], [vid(6, 6, n), BLACK]], n);
    const h1 = computeInfluence(b1, adj);
    const h2 = computeInfluence(b2, adj);
    for (let v = 0; v < n * n; v++) {
      expect(h2.values[v]).toBeCloseTo(-h1.values[v], 12);
      expect(Math.abs(h1.values[v])).toBeLessThanOrEqual(1);
    }
    expect(h1.converged).toBe(true);
  });

  it('环面平移（真实图自同构）下势力等变', () => {
    const n = 9;
    const adj = getTopologySpec('torus', n).adjacency;
    const stones: [number, number, Cell][] = [
      [1, 1, BLACK],
      [2, 1, BLACK],
      [5, 6, WHITE],
    ];
    const shift = (x: number, y: number) => vid((x + 3) % n, (y + 4) % n, n);
    const b1 = boardFrom(stones.map(([x, y, c]) => [vid(x, y, n), c] as [number, Cell]), n);
    const b2 = boardFrom(stones.map(([x, y, c]) => [shift(x, y), c] as [number, Cell]), n);
    const h1 = computeInfluence(b1, adj);
    const h2 = computeInfluence(b2, adj);
    // 迭代法在容差处停机，等变性在收敛容差内成立
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        expect(h2.values[shift(x, y)]).toBeCloseTo(h1.values[vid(x, y, n)], 4);
      }
    }
  });

  it('仅一色落子：解退化并标注 singleColor，不给参考估值', () => {
    const n = 9;
    const adj = getTopologySpec('klein', n).adjacency;
    const b = boardFrom([[vid(0, 0, n), BLACK], [vid(8, 8, n), BLACK]], n);
    const r = computeInfluence(b, adj);
    expect(r.singleColor).toBe(true);
    expect(r.values.every((v) => v === 1)).toBe(true);
  });

  it('势力折算差公式：B-W+Σh-komi', () => {
    const n = 9;
    const adj = getTopologySpec('plane', n).adjacency;
    const b = boardFrom([[vid(0, 0, n), BLACK], [vid(8, 8, n), WHITE]], n);
    const h = computeInfluence(b, adj);
    const m = heuristicMargin(b, h, 6.5);
    const emptySum = h.values.reduce((s, v, i) => (b[i] === EMPTY ? s + v : s), 0);
    expect(m).toBeCloseTo(1 - 1 + emptySum - 6.5, 10);
  });
});

describe('战术信息', () => {
  it('叫吃与二气棋串识别（跨缝同样生效）', () => {
    const s = fixtureState(
      'projective',
      [
        { vertex: at(0, 0), color: 'white' },
        { vertex: at(1, 0), color: 'black' },
        { vertex: at(0, 1), color: 'black' },
      ],
      { toPlay: 'black' },
    );
    const adj = getTopologySpec('projective', 19).adjacency;
    const { atari } = findAtariGroups(s.board, adj);
    expect(atari.length).toBe(1);
    expect(atari[0].color).toBe('white');
    expect(atari[0].liberties).toEqual([at(18, 18)]);
  });

  it('一手提子点与规则层一致：单劫中被 PSK 禁止的回提不出现在列表里', () => {
    let s = createGame({ topologyId: 'plane' });
    const play = (v: number) => {
      const r = tryPlay(s, v);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
    };
    play(at(1, 0));
    play(at(2, 0));
    play(at(0, 1));
    play(at(1, 1));
    play(at(1, 2));
    play(at(2, 2));
    play(at(10, 10));
    play(at(3, 1));
    play(at(2, 1)); // B 提 (1,1)
    const adj = getTopologySpec('plane', 19).adjacency;
    const moves = findCaptureMoves(s, adj);
    // 白在 (1,1) 可提黑 (2,1)，但被 superko 禁止 -> 不得列为合法提子点
    expect(moves.find((m) => m.vertex === at(1, 1))).toBeUndefined();
  });
});
