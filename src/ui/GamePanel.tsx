/** 对局面板：状态、操作按钮、开关、新建游戏与导入导出。 */
import { useRef, useState } from 'react';
import type { GameState } from '../core/rules';
import { displayCoord, ALL_TOPOLOGIES, type TopologyId } from '../core/types';
import { importGame, exportGame } from '../io/gameJson';
import { downloadJson } from '../io/storage';

export const TOPOLOGY_NAMES: Record<TopologyId, string> = {
  plane: '普通平面',
  torus: '环面 T²',
  mobius: '莫比乌斯带',
  klein: '克莱因瓶',
  projective: '实射影平面 RP²',
};

export interface GamePanelProps {
  state: GameState;
  saveStatus: string;
  showSeams: boolean;
  showGhosts: boolean;
  showLiberties: boolean;
  showInfluence: boolean;
  onToggleSeams: () => void;
  onToggleGhosts: () => void;
  onToggleLiberties: () => void;
  onToggleInfluence: () => void;
  onNewGame: (topology: TopologyId, n: number, komi: number) => void;
  onPass: () => void;
  onResign: () => void;
  onUndo: () => void;
  onImport: (state: GameState) => void;
  onExportName: () => string;
}

export function GamePanel(props: GamePanelProps) {
  const { state } = props;
  const [newTopo, setNewTopo] = useState<TopologyId>('torus');
  const [newN, setNewN] = useState(19);
  const [newKomi, setNewKomi] = useState(7.5);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const playing = state.phase === 'playing';
  const reviewing = state.historyCursor < state.moves.length;
  const lastText =
    state.lastMove === null
      ? '—'
      : state.lastMove.vertex === null
        ? `${state.lastMove.color === 'black' ? '黑' : '白'} 停着`
        : `${state.lastMove.color === 'black' ? '黑' : '白'} ${displayCoord(state.lastMove.vertex, state.n)}`;

  const handleNew = () => {
    const hasProgress = state.moves.length > 0 && state.phase !== 'finished';
    if (hasProgress && !window.confirm('当前对局尚未结束，新建游戏将放弃它（可先导出保存）。继续吗？')) return;
    props.onNewGame(newTopo, newN, newKomi);
  };

  const handleResign = () => {
    const who = state.toPlay === 'black' ? '黑方' : '白方';
    if (window.confirm(`确认${who}认输？认输后立即结束对局。`)) props.onResign();
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    const r = importGame(text);
    if (r.ok) {
      setImportError(null);
      props.onImport(r.state);
    } else {
      setImportError(r.error);
    }
  };

  return (
    <div className="card">
      <h2>对局</h2>
      <div className="status-line">
        当前执棋：
        <span className={`stone-icon ${state.toPlay}`} />
        {state.toPlay === 'black' ? '黑方' : '白方'}
        {reviewing && <span className="warn">（复盘中）</span>}
      </div>
      <div className="status-line">拓扑：{TOPOLOGY_NAMES[state.topologyId]}（{state.n}×{state.n}）</div>
      <div className="status-line">贴目：{state.komi} ｜ 手数：{state.historyCursor}/{state.moves.length}</div>
      <div className="status-line">
        提子：黑提 {state.captures.black} 子 ｜ 白提 {state.captures.white} 子
      </div>
      <div className="status-line">上一手：{lastText}</div>
      <div className="status-line note">自动保存：{props.saveStatus}</div>

      <div className="row">
        <button className="primary" disabled={!playing || reviewing} onClick={props.onPass}>
          停一手
        </button>
        <button className="danger" disabled={!playing && state.phase !== 'scoring'} onClick={handleResign}>
          认输
        </button>
        <button disabled={!playing || state.historyCursor === 0} onClick={props.onUndo}>
          悔棋
        </button>
      </div>

      <div className="row">
        <label><input type="checkbox" checked={props.showSeams} onChange={props.onToggleSeams} /> 显示接缝</label>
        <label><input type="checkbox" checked={props.showGhosts} onChange={props.onToggleGhosts} /> 幽灵副本</label>
      </div>
      <div className="row">
        <label><input type="checkbox" checked={props.showLiberties} onChange={props.onToggleLiberties} /> 显示气</label>
        <label><input type="checkbox" checked={props.showInfluence} onChange={props.onToggleInfluence} /> 势力图（启发式）</label>
      </div>

      <h2 style={{ marginTop: 12 }}>新建游戏</h2>
      <div className="row">
        <select value={newTopo} onChange={(e) => setNewTopo(e.target.value as TopologyId)}>
          {ALL_TOPOLOGIES.map((t) => (
            <option key={t} value={t}>{TOPOLOGY_NAMES[t]}</option>
          ))}
        </select>
        <select value={newN} onChange={(e) => setNewN(Number(e.target.value))}>
          {[9, 13, 19].map((v) => (
            <option key={v} value={v}>{v}×{v}</option>
          ))}
        </select>
        <label>
          贴目
          <input
            type="number"
            step={0.5}
            value={newKomi}
            style={{ width: 64, marginLeft: 4 }}
            onChange={(e) => setNewKomi(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="row">
        <button onClick={handleNew}>开始新对局</button>
      </div>

      <h2 style={{ marginTop: 12 }}>棋谱</h2>
      <div className="row">
        <button onClick={() => downloadJson(props.onExportName(), exportGame(state))}>
          导出 JSON
        </button>
        <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {importError && <div className="error-text">导入失败：{importError}</div>}
    </div>
  );
}
