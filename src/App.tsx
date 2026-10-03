/** TopoGo 主界面：同机双人轮流执黑白。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  confirmScore,
  goTo,
  pass,
  resign,
  resumePlay,
  toggleDeadGroup,
  tryPlay,
  undo,
  type ActionResult,
  type GameState,
} from './core/rules';
import { createGame } from './core/state';
import type { TopologyId } from './core/types';
import { loadGame, saveGame } from './io/storage';
import { Board2D } from './ui/Board2D';
import { GamePanel } from './ui/GamePanel';
import { ScoringPanel } from './ui/ScoringPanel';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { ReviewControls } from './ui/ReviewControls';
import { isAnalysisResult, type AnalysisRequest, type AnalysisResult } from './analysis/types';
import { runAnalysis } from './analysis/analyze';

function initialState(): GameState {
  const loaded = loadGame();
  if (loaded.ok) return loaded.state;
  return createGame({ topologyId: 'torus', n: 19, komi: 7.5 });
}

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [showSeams, setShowSeams] = useState(true);
  const [showGhosts, setShowGhosts] = useState(true);
  const [showLiberties, setShowLiberties] = useState(false);
  const [showInfluence, setShowInfluence] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('—');
  const [actionError, setActionError] = useState<string | null>(null);

  // ---- 自动保存 ----
  useEffect(() => {
    const status = saveGame(state);
    setSaveStatus(
      status === 'ok' ? `已保存（${new Date().toLocaleTimeString()}）`
      : status === 'quota' ? 'localStorage 容量不足，请使用导出'
      : '自动保存不可用，请使用导出',
    );
  }, [state]);

  // ---- 分析（Worker 优先，失败同步回退；过期回复按 revision 丢弃）----
  const workerRef = useRef<Worker | null>(null);
  const workerFailed = useRef(false);
  const latestReqRev = useRef(0);
  useEffect(() => {
    if (workerFailed.current) return;
    try {
      const w = new Worker(new URL('./analysis/analysis.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<unknown>) => {
        if (!isAnalysisResult(ev.data)) return;
        if (ev.data.revision !== latestReqRev.current) return; // 丢弃过期回复
        setAnalysis(ev.data);
        setAnalyzing(false);
      };
      w.onerror = (ev) => {
        console.warn('[TopoGo] 分析 Worker 加载失败，退化为同步计算：', ev.message ?? ev);
        workerFailed.current = true;
        w.terminate();
        workerRef.current = null;
      };
      workerRef.current = w;
      return () => w.terminate();
    } catch {
      workerFailed.current = true;
    }
  }, []);

  useEffect(() => {
    if (state.phase === 'finished') {
      setAnalysis(null);
      return;
    }
    const rev = state.stateRevision;
    latestReqRev.current = rev;
    const req: AnalysisRequest = {
      type: 'analyze',
      revision: rev,
      topologyId: state.topologyId,
      n: state.n,
      komi: state.komi,
      board: state.board as number[],
      toPlay: state.toPlay,
      positionKeys: state.positionKeys.slice(0, state.historyCursor + 1),
    };
    setAnalyzing(true);
    const w = workerRef.current;
    let posted = false;
    if (w) {
      try {
        w.postMessage(req);
        posted = true;
      } catch (e) {
        console.warn('[TopoGo] Worker 通信失败，退化为同步计算：', e);
        workerRef.current = null;
      }
    }
    if (posted) return;
    // 同步回退（无 Worker 环境）；分析失败不应影响对弈
    try {
      const r = runAnalysis(req);
      if (latestReqRev.current === rev) {
        setAnalysis(r);
      }
    } catch (e) {
      console.warn('[TopoGo] 局势分析失败：', e);
    } finally {
      setAnalyzing(false);
    }
  }, [state]);

  // ---- 操作 ----
  const apply = useCallback((r: ActionResult) => {
    if (r.ok) {
      setActionError(null);
      setState(r.state);
    } else {
      setActionError(r.error.message);
    }
  }, []);

  const onIntersection = useCallback(
    (v: number) => {
      const s = state;
      if (s.phase === 'playing') {
        if (s.historyCursor < s.moves.length) {
          if (!window.confirm(`将从第 ${s.historyCursor + 1} 手“从此处继续”，丢弃之后 ${s.moves.length - s.historyCursor} 手。继续吗？`)) {
            return;
          }
        }
        const r = tryPlay(s, v);
        if (!r.ok) {
          setActionError(r.error.message);
          return;
        }
        setActionError(null);
        setState(r.state);
        return;
      }
      if (s.phase === 'scoring') {
        const r = toggleDeadGroup(s, v);
        if (r.ok) setState(r.state);
      }
    },
    [state],
  );

  const onNewGame = useCallback((topologyId: TopologyId, n: number, komi: number) => {
    setAnalysis(null);
    setActionError(null);
    setState(createGame({ topologyId, n, komi }));
  }, []);

  const exportName = useCallback(
    () =>
      `topogo-${state.topologyId}-${state.n}x${state.n}-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.json`,
    [state.topologyId, state.n],
  );

  const influence = useMemo(
    () => (showInfluence && analysis ? analysis.influence : null),
    [showInfluence, analysis],
  );

  return (
    <div className="app">
      <div className="board-wrap">
        <Board2D
          state={state}
          showSeams={showSeams}
          showGhosts={showGhosts}
          showLiberties={showLiberties}
          influence={influence}
          showInfluence={showInfluence}
          onIntersection={onIntersection}
        />
        <ReviewControls state={state} onGoTo={(c) => apply(goTo(state, c))} />
        {actionError && <div className="error-text" style={{ textAlign: 'center', marginTop: 6 }}>{actionError}</div>}
      </div>
      <div className="sidebar">
        <GamePanel
          state={state}
          saveStatus={saveStatus}
          showSeams={showSeams}
          showGhosts={showGhosts}
          showLiberties={showLiberties}
          showInfluence={showInfluence}
          onToggleSeams={() => setShowSeams((v) => !v)}
          onToggleGhosts={() => setShowGhosts((v) => !v)}
          onToggleLiberties={() => setShowLiberties((v) => !v)}
          onToggleInfluence={() => setShowInfluence((v) => !v)}
          onNewGame={onNewGame}
          onPass={() => apply(pass(state))}
          onResign={() => apply(resign(state, state.toPlay))}
          onUndo={() => apply(undo(state))}
          onImport={(s) => {
            setAnalysis(null);
            setState(s);
          }}
          onExportName={exportName}
        />
        <ScoringPanel
          state={state}
          onConfirm={(c) => apply(confirmScore(state, c))}
          onResume={() => apply(resumePlay(state))}
        />
        <AnalysisPanel analysis={analysis} loading={analyzing} showInfluence={showInfluence} n={state.n} />
      </div>
    </div>
  );
}
