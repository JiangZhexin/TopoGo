/**
 * 局面历史与 PSK 键（提案 §3.4）。
 * 键 = 固定 vertexId 顺序的 361 位颜色序列，命名空间含 topologyVersion 与 N。
 * 不做旋转/平移/镜像/图自同构归一化；不把 toPlay 加入键（否则变 SSK）。
 *
 * 停着会产生重复键；悔棋后从有效历史前缀重建——实现上以
 * positionKeys 数组 + 游标截断表达，countMap 供需要增减计数的场景使用。
 */
import type { Cell } from './types';

export function boardKey(board: Cell[], topologyVersion: string, n: number): string {
  return `${topologyVersion}|${n}|${board.join('')}`;
}

/** 带计数的键集合：正确处理停着重复键与悔棋重建（Map<key,count>）。 */
export class KeyCounter {
  private counts = new Map<string, number>();

  add(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  remove(key: string): void {
    const c = this.counts.get(key);
    if (c === undefined) throw new Error(`KeyCounter.remove: unknown key`);
    if (c === 1) this.counts.delete(key);
    else this.counts.set(key, c - 1);
  }

  has(key: string): boolean {
    return this.counts.has(key);
  }

  get size(): number {
    return this.counts.size;
  }

  /** 从有效历史前缀重建（悔棋后废弃尾部不得继续阻止落子）。 */
  static fromKeys(keys: Iterable<string>): KeyCounter {
    const kc = new KeyCounter();
    for (const k of keys) kc.add(k);
    return kc;
  }
}
