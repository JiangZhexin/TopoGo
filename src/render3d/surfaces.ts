/**
 * 五种棋盘拓扑的参数曲面（纯函数，可单测）。
 * 棋盘格点 (x,y)∈[0,n-1]^2 先归一化为 u=x/(n-1), v=y/(n-1)∈[0,1]^2，
 * 再映射到三维点。仅用于 3D 同步视图；规则只认 src/core 的抽象邻接图。
 *
 * 说明：klein 的 8 字浸入与 rp2 的 cross-cap 浸入在三维中必然自交，
 * 自交线是投影/浸入的假象，不代表棋盘上真实相邻。
 */
import type { TopologyId } from '../core/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 环面半径参数 */
const TORUS_R = 1.6;
const TORUS_r = 0.9;
/** 克莱因瓶 8 字浸入主半径 */
const KLEIN_A = 1.5;

function planePoint(u: number, v: number): Vec3 {
  return { x: (u - 0.5) * 2.4, y: 0, z: (v - 0.5) * 2.4 };
}

function torusPoint(u: number, v: number): Vec3 {
  const theta = 2 * Math.PI * u;
  const phi = 2 * Math.PI * v;
  const w = TORUS_R + TORUS_r * Math.cos(phi);
  return { x: w * Math.cos(theta), y: TORUS_r * Math.sin(phi), z: w * Math.sin(theta) };
}

function mobiusPoint(u: number, v: number): Vec3 {
  const t = 2 * Math.PI * u;
  // 带宽取安全上限（w=1+(s/2)cos(t/2) 恒正不捏拢），让棋格长宽比尽量接近方形
  const s = (v - 0.5) * 2.0;
  const w = 1 + (s / 2) * Math.cos(t / 2);
  return { x: w * Math.cos(t), y: (s / 2) * Math.sin(t / 2), z: w * Math.sin(t) };
}

function kleinPoint(u: number, v: number): Vec3 {
  const theta = 2 * Math.PI * u;
  const phi = 2 * Math.PI * v;
  const w = KLEIN_A + Math.cos(theta / 2) * Math.sin(phi) - Math.sin(theta / 2) * Math.sin(2 * phi);
  return {
    x: w * Math.cos(theta),
    y: w * Math.sin(theta),
    z: Math.sin(theta / 2) * Math.sin(phi) + Math.cos(theta / 2) * Math.sin(2 * phi),
  };
}

function rp2Point(u: number, v: number): Vec3 {
  // 维基 Cross-cap 标准参数式；beta∈[0,pi/2]，beta=0 退化为极点 (0,0,1)
  const alpha = 2 * Math.PI * u;
  const beta = (Math.PI / 2) * v;
  return {
    x: Math.cos(alpha) * Math.sin(2 * beta),
    y: Math.sin(alpha) * Math.sin(2 * beta),
    z: Math.cos(beta) ** 2 - Math.cos(alpha) ** 2 * Math.sin(beta) ** 2,
  };
}

/** 统一入口：拓扑 + 归一化坐标 -> 三维点。 */
export function surfacePoint(topology: TopologyId, u: number, v: number): Vec3 {
  switch (topology) {
    case 'plane':
      return planePoint(u, v);
    case 'torus':
      return torusPoint(u, v);
    case 'mobius':
      return mobiusPoint(u, v);
    case 'klein':
      return kleinPoint(u, v);
    case 'projective':
      return rp2Point(u, v);
  }
}

export interface SurfaceInfo {
  /** 中文曲面名 */
  name: string;
  /** 一句说明（UI 展示用） */
  desc: string;
}

export const SURFACE_INFO: Record<TopologyId, SurfaceInfo> = {
  plane: {
    name: '平面',
    desc: '普通平面棋盘，四条边均为真实边界。',
  },
  torus: {
    name: '环面 T²',
    desc: '左右、上下边分别同向粘合，棋盘没有边界。',
  },
  mobius: {
    name: '莫比乌斯带',
    desc: '左右边反向粘合（扭转 180°），上下边为真实边界。',
  },
  klein: {
    name: '克莱因瓶',
    desc: '左右边反向粘合、上下边同向粘合；8 字自交是三维浸入的投影假象。',
  },
  projective: {
    name: '实射影平面 RP²',
    desc: '对径点粘合；Cross-cap 浸入的自交线为三维投影假象，不代表真实相邻。',
  },
};
