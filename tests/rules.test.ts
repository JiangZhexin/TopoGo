/** 规则单元测试（提案 §9.2）。 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { pass, tryPlay, undo } from '../src/core/rules';
import { getGroup, getLiberties } from '../src/core/groups';
import { getTopologySpec } from '../src/core/topology';
import { EMPTY } from '../src/core/types';
import { at, fixtureState } from './fixtures/builder';

function mustPlay(state: Parameters<typeof tryPlay>[0], v: number) {
  const r = tryPlay(state, v);
  if (!r.ok) throw new Error(`expected legal play at ${v}, got ${r.error.code}: ${r.error.message}`);
  return r.state;
}

describe('棋串与气', () => {
  it('普通棋串：竖直二子棋串有 6 气', () => {
    const s = fixtureState('plane', [
      { vertex: at(5, 5), color: 'black' },
      { vertex: at(5, 6), color: 'black' },
    ]);
    const adj = getTopologySpec('plane', 19).adjacency;
    const g = getGroup(s.board, adj, at(5, 5));
    expect(g.length).toBe(2);
    expect(getLiberties(s.board, adj, g).size).toBe(6);
  });

  it('跨缝棋串：torus 上 (0,7) 与 (18,7) 属于同一棋串', () => {
    const s = fixtureState('torus', [
      { vertex: at(0, 7), color: 'black' },
      { vertex: at(18, 7), color: 'black' },
    ]);
    const adj = getTopologySpec('torus', 19).adjacency;
    expect(getGroup(s.board, adj, at(0, 7)).length).toBe(2);
  });

  it('共享气去重：RP² 角点 (0,0) 的白子只有 3 气，跨缝重复路径不重复计', () => {
    const s = fixtureState('projective', [{ vertex: at(0, 0), color: 'white' }]);
    const adj = getTopologySpec('projective', 19).adjacency;
    const libs = getLiberties(s.board, adj, [at(0, 0)]);
    expect(libs.size).toBe(3);
    expect(libs).toContain(at(1, 0));
    expect(libs).toContain(at(0, 1));
    expect(libs).toContain(at(18, 18));
  });
});

describe('提子', () => {
  it('RP² 特别夹具：白 (0,0) 仅剩一气 (18,18)，黑在此落子提白，不误报仍有气', () => {
    const s = fixtureState(
      'projective',
      [
        { vertex: at(0, 0), color: 'white' },
        { vertex: at(1, 0), color: 'black' },
        { vertex: at(0, 1), color: 'black' },
      ],
      { toPlay: 'black' },
    );
    const r = tryPlay(s, at(18, 18));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[at(0, 0)]).toBe(EMPTY);
    expect(r.state.board[at(18, 18)]).not.toBe(EMPTY);
    expect(r.state.captures.black).toBe(1);
  });

  it('多串同时提子：黑 (1,0) 同时提掉左右两个白子', () => {
    const s = fixtureState(
      'plane',
      [
        { vertex: at(0, 0), color: 'white' },
        { vertex: at(2, 0), color: 'white' },
        { vertex: at(0, 1), color: 'black' },
        { vertex: at(2, 1), color: 'black' },
        { vertex: at(3, 0), color: 'black' },
      ],
      { toPlay: 'black' },
    );
    const r = tryPlay(s, at(1, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[at(0, 0)]).toBe(EMPTY);
    expect(r.state.board[at(2, 0)]).toBe(EMPTY);
    expect(r.state.captures.black).toBe(2);
  });

  it('先提子后查自杀：被围点落子因提子而合法（不能误判自杀）', () => {
    // 黑 (1,0) 的三个在盘邻点 (0,0)/(2,0)/(1,1) 全为白；提掉后黑子有气
    const s = fixtureState(
      'plane',
      [
        { vertex: at(0, 0), color: 'white' },
        { vertex: at(2, 0), color: 'white' },
        { vertex: at(1, 1), color: 'white' },
        { vertex: at(0, 1), color: 'black' },
        { vertex: at(3, 0), color: 'black' },
        { vertex: at(2, 1), color: 'black' },
        { vertex: at(1, 2), color: 'black' },
      ],
      { toPlay: 'black' },
    );
    const r = tryPlay(s, at(1, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.captures.black).toBe(3);
    expect(r.state.board[at(1, 0)]).not.toBe(EMPTY);
  });

  it('自杀非法：填入完全被对方包围的点被拒绝', () => {
    const s = fixtureState(
      'plane',
      [
        { vertex: at(1, 0), color: 'white' },
        { vertex: at(0, 1), color: 'white' },
      ],
      { toPlay: 'black' },
    );
    const r = tryPlay(s, at(0, 0));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('suicide');
  });
});

describe('非法操作不改变状态', () => {
  it('占点非法、越界非法，且不改变轮次与连续停着数', () => {
    let s = createGame({ topologyId: 'torus' });
    s = mustPlay(s, at(3, 3)); // 黑
    const p = pass(s); // 白停着，consecutivePasses=1
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    s = p.state;
    const before = s;
    const r1 = tryPlay(s, at(3, 3)); // 占点
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.code).toBe('occupied');
    const r2 = tryPlay(s, -1);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('out-of-range');
    expect(s).toBe(before); // 非法操作返回错误，原状态对象未被改动
    expect(s.toPlay).toBe('black');
    expect(s.consecutivePasses).toBe(1);
  });
});

describe('positional superko', () => {
  // 经典单劫（plane）：
  //   . B W .       (1,0)B (2,0)W
  //   B W . W       (0,1)B (1,1)W (2,1). (3,1)W
  //   . B W .       (1,2)B (2,2)W
  // 黑在 (2,1) 提 (1,1) 后，白立即回提会恢复两手前局面。
  function playKo() {
    let s = createGame({ topologyId: 'plane' });
    s = mustPlay(s, at(1, 0)); // B
    s = mustPlay(s, at(2, 0)); // W
    s = mustPlay(s, at(0, 1)); // B
    s = mustPlay(s, at(1, 1)); // W
    s = mustPlay(s, at(1, 2)); // B
    s = mustPlay(s, at(2, 2)); // W
    s = mustPlay(s, at(10, 10)); // B（劫材外的一手，让白补 (3,1)）
    s = mustPlay(s, at(3, 1)); // W
    s = mustPlay(s, at(2, 1)); // B 提白 (1,1)
    return s;
  }

  it('单劫：立即回提违反 PSK，被拒绝', () => {
    const s = playKo();
    expect(s.captures.black).toBe(1);
    expect(s.board[at(1, 1)]).toBe(EMPTY);
    // 白立即回提 (1,1)：可提黑 (2,1) 不属自杀，但恢复两手前局面 -> superko
    const r = tryPlay(s, at(1, 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('superko');
  });

  it('停着豁免 PSK：同一局面可因停着重复出现', () => {
    let s = createGame({ topologyId: 'klein' });
    s = mustPlay(s, at(5, 5));
    const p1 = pass(s);
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    const p2 = pass(p1.state);
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;
    expect(p2.state.phase).toBe('scoring');
  });

  it('悔棋后废弃的未来局面不再阻止落子', () => {
    let s = playKo();
    // 悔棋两手：撤掉 B(2,1) 与 W(3,1)
    const u1 = undo(s);
    expect(u1.ok).toBe(true);
    if (!u1.ok) return;
    const u2 = undo(u1.state);
    expect(u2.ok).toBe(true);
    if (!u2.ok) return;
    s = u2.state;
    expect(s.board[at(1, 1)]).not.toBe(EMPTY); // 白子回来了
    expect(s.toPlay).toBe('white');
    // 白改下他处，黑再下 (2,1) 提子：该局面键曾被废弃，不应再阻止
    s = mustPlay(s, at(12, 12)); // W
    const r = tryPlay(s, at(2, 1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.captures.black).toBe(1);
  });
});
