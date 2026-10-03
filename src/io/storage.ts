/** localStorage 自动保存（提案 §8）：容量/访问失败被捕获，保留手动下载途径。 */
import { exportGame, importGame } from './gameJson';
import type { GameState } from '../core/rules';

const KEY = 'topogo:autosave:v1';

export type SaveStatus = 'ok' | 'unavailable' | 'quota';

export function saveGame(state: GameState): SaveStatus {
  try {
    localStorage.setItem(KEY, exportGame(state));
    return 'ok';
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'SecurityError')) {
      return e.name === 'QuotaExceededError' ? 'quota' : 'unavailable';
    }
    return 'unavailable';
  }
}

export function loadGame(): { ok: true; state: GameState } | { ok: false } {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return { ok: false };
    const r = importGame(text);
    return r.ok ? { ok: true, state: r.state } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
