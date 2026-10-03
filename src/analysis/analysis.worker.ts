/// <reference lib="webworker" />
/**
 * 分析 Worker：请求携带 stateRevision，回复同样携带；
 * 主线程负责丢弃过期回复（见 AnalysisPanel/App）。
 */
import { runAnalysis } from './analyze';
import type { AnalysisRequest } from './types';

self.onmessage = (ev: MessageEvent<AnalysisRequest>) => {
  const req = ev.data;
  if (req.type !== 'analyze') return;
  const result = runAnalysis(req);
  self.postMessage(result);
};
