/** 局势辅助的类型：明确区分 heuristic / simulation / agreed-final，不混用同一 score 字段。 */
import type { Color, TopologyId } from '../core/types';

export interface InfluenceResult {
  kind: 'heuristic';
  /** 每个顶点的势力值 [-1,1]；棋子点为其颜色极值 */
  values: number[];
  iterations: number;
  converged: boolean;
  residual: number;
  /** 仅一色落子时解退化，UI 必须提示“仅反映影响” */
  singleColor: boolean;
}

export interface AtariInfo {
  color: Color;
  stones: number[];
  liberties: number[];
}

export interface CaptureMoveInfo {
  vertex: number;
  captures: number;
}

export interface AnalysisRequest {
  type: 'analyze';
  revision: number;
  topologyId: TopologyId;
  n: number;
  komi: number;
  board: number[];
  toPlay: Color;
  /** 有效 PSK 历史键（含初始局面），保证一手提子提示与规则层一致 */
  positionKeys: string[];
  maxIterations?: number;
  residualTolerance?: number;
}

export interface AnalysisResult {
  type: 'result';
  method: 'harmonic-influence+tactical';
  revision: number;
  influence: InfluenceResult;
  /** 叫吃（一气）棋串 */
  atariGroups: AtariInfo[];
  /** 二气警示棋串（不等于必死） */
  twoLibertyGroups: AtariInfo[];
  /** 当前行棋方的一手提子点（提子数不含义最佳着法） */
  captureMoves: CaptureMoveInfo[];
  /** 势力折算差：B-W+Σh-komi，不是预言终局分差 */
  heuristicMargin: number | null;
  warnings: string[];
  diagnostics: { emptyCount: number; durationMs: number };
}

export function isAnalysisResult(x: unknown): x is AnalysisResult {
  return typeof x === 'object' && x !== null && (x as { type?: string }).type === 'result';
}
