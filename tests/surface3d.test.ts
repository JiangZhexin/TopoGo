/** 3D 曲面参数式与投影的纯数学测试（不渲染）。 */
import { describe, expect, it } from 'vitest';
import { surfacePoint, SURFACE_INFO, type Vec3 } from '../src/render3d/surfaces';
import { CAMERA_DIST, project, rotate } from '../src/render3d/project';
import { ALL_TOPOLOGIES, type TopologyId } from '../src/core/types';

function expectClose(a: Vec3, b: Vec3, eps = 1e-9) {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
  expect(Math.abs(a.z - b.z)).toBeLessThan(eps);
}

describe('surfacePoint 数值健康', () => {
  it.each(ALL_TOPOLOGIES)('%s：100 个采样点均为有限数', (t: TopologyId) => {
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        const p = surfacePoint(t, i / 9, j / 9);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Number.isFinite(p.z)).toBe(true);
      }
    }
  });

  it('每种曲面都有中文名与一句说明；RP² 说明包含自交线假象提示', () => {
    for (const t of ALL_TOPOLOGIES) {
      expect(SURFACE_INFO[t].name.length).toBeGreaterThan(0);
      expect(SURFACE_INFO[t].desc.length).toBeGreaterThan(0);
    }
    expect(SURFACE_INFO.projective.desc).toContain('自交线为三维投影假象');
  });
});

describe('边界粘合在参数曲面上成立', () => {
  it('torus：u 方向与 v 方向都闭合', () => {
    for (const k of [0, 0.13, 0.5, 0.77, 1]) {
      expectClose(surfacePoint('torus', 0, k), surfacePoint('torus', 1, k));
      expectClose(surfacePoint('torus', k, 0), surfacePoint('torus', k, 1));
    }
  });

  it('mobius：u+1 对应 t+2π 时 v 翻转粘合（扭转）', () => {
    for (const u of [0, 0.2, 0.6]) {
      for (const v of [0, 0.3, 0.9, 1]) {
        expectClose(surfacePoint('mobius', u, v), surfacePoint('mobius', u + 1, 1 - v));
      }
    }
  });

  it('klein：theta 方向闭合但伴随 v 翻转（与规则层 flipX 一致）', () => {
    // 8 字浸入满足 P(u=1, v) = P(u=0, 1-v)，而非同 v 相等
    for (const v of [0, 0.25, 0.5, 0.83, 1]) {
      expectClose(surfacePoint('klein', 0, v), surfacePoint('klein', 1, 1 - v));
    }
    // v 方向（phi 周期）同向闭合
    for (const u of [0, 0.3, 0.7]) {
      expectClose(surfacePoint('klein', u, 0), surfacePoint('klein', u, 1));
    }
  });

  it('rp2：cross-cap 在 beta=0 处所有 alpha 收敛到同一极点', () => {
    const pole = surfacePoint('projective', 0, 0);
    expectClose(pole, { x: 0, y: 0, z: 1 });
    for (const u of [0.1, 0.25, 0.5, 0.73, 0.99]) {
      expectClose(surfacePoint('projective', u, 0), pole);
    }
  });
});

describe('rotate/project 透视投影', () => {
  it('rotate：yaw=pi/2 把 +x 轴转到 -z（远离相机）', () => {
    const r = rotate({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    expectClose(r, { x: 0, y: 0, z: -1 }, 1e-12);
  });

  it('rotate：pitch=pi/2 把 +z 轴转到 -y', () => {
    const r = rotate({ x: 0, y: 0, z: 1 }, 0, Math.PI / 2);
    expectClose(r, { x: 0, y: -1, z: 0 }, 1e-12);
  });

  it('rotate 后深度符号决定远近：+z 更近、-z 更远', () => {
    const near = rotate({ x: 0, y: 0, z: 1 }, 0.3, 0.2);
    const far = rotate({ x: 0, y: 0, z: -1 }, 0.3, 0.2);
    const pn = project(near, 800, 600, 500);
    const pf = project(far, 800, 600, 500);
    expect(pn.depth).toBeGreaterThan(pf.depth);
    expect(pn.scale).toBeGreaterThan(pf.scale);
  });

  it('project：原点投影到画布中心且 scale=1', () => {
    const p = project({ x: 0, y: 0, z: 0 }, 800, 600, 500);
    expect(p.x).toBeCloseTo(400, 9);
    expect(p.y).toBeCloseTo(300, 9);
    expect(p.depth).toBe(0);
    expect(p.scale).toBeCloseTo(1, 9);
  });

  it('project：已知点解析验证（含 y 轴翻转）', () => {
    // v=(0.9, -0.45, 0)，z = CAMERA_DIST，f = fov / z
    const p = project({ x: 0.9, y: -0.45, z: 0 }, 800, 600, 500);
    const f = 500 / CAMERA_DIST;
    expect(p.x).toBeCloseTo(400 + 0.9 * f, 9);
    expect(p.y).toBeCloseTo(300 - -0.45 * f, 9); // 屏幕上 y 向下
    expect(p.scale).toBeCloseTo(1, 9);
  });
});
