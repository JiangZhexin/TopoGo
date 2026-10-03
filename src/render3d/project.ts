/**
 * 3D 视图用的旋转与透视投影（纯函数，可单测）。
 * 约定：yaw 绕 y 轴、pitch 绕 x 轴；相机位于 +z 轴上望向原点，
 * 旋转后 z 越大越靠近相机（depth 越大越近）。
 */
import type { Vec3 } from './surfaces';

/** 相机到原点的距离（相机位于 z = +CAMERA_DIST）。 */
export const CAMERA_DIST = 4.5;

/** 先绕 y 轴转 yaw，再绕 x 轴转 pitch（角度制为弧度）。 */
export function rotate(v: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x: x1,
    y: v.y * cp - z1 * sp,
    z: v.y * sp + z1 * cp,
  };
}

export interface Projected {
  /** 画布像素坐标 */
  x: number;
  y: number;
  /** 旋转后 z；越大越靠近相机，用于画家算法排序 */
  depth: number;
  /** 相对缩放：点位于原点时为 1，越远越小 */
  scale: number;
}

/**
 * 透视投影：v 应为 rotate 之后的点。
 * fov 为像素焦距（例如 min(width,height)*0.9）。
 */
export function project(v: Vec3, width: number, height: number, fov: number): Projected {
  const z = Math.max(CAMERA_DIST - v.z, 0.05); // 点到相机的距离；v.z 越大越近
  const f = fov / z;
  return {
    x: width / 2 + v.x * f,
    y: height / 2 - v.y * f,
    depth: v.z,
    scale: CAMERA_DIST / z,
  };
}
