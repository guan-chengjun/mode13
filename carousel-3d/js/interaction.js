/**
 * InteractionController.js —— 交互控制器
 *
 * 职责：
 *  1. 射线拾取：单击任意部件 -> 沿父级链查找 partId -> 弹出讲解面板；
 *  2. 选中高亮：被选中部件的材质叠加暖色发光；
 *  3. 悬停反馈：鼠标移到可讲解部件上时显示手型光标；
 *  4. 线框透视：一键切换全部模型材质的 wireframe，便于观察内部传动。
 */
import * as THREE from 'three';
import { PART_INFO } from './config.js';

export class InteractionController {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} pickRoot 可被拾取的模型根节点
   * @param {(info: object, partId: string) => void} onPick 拾取回调（弹出面板）
   */
  constructor(renderer, camera, pickRoot, onPick) {
    this.renderer = renderer;
    this.camera = camera;
    this.pickRoot = pickRoot;
    this.onPick = onPick;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dom = renderer.domElement;

    /** 当前选中的部件根对象 */
    this.selected = null;
    /** 线框模式开关 */
    this.wireframe = false;
    /** 高亮材质缓存：Mesh -> 原始 emissive 参数 */
    this.highlightCache = new Map();

    // 区分“点击”与“拖拽轨道”：记录按下位置，松开时位移很小才算点击
    this.pointerDown = { x: 0, y: 0 };
    this.bindEvents();
  }

  /* ---------------- 事件绑定 ---------------- */
  bindEvents() {
    this.dom.addEventListener('pointerdown', (e) => {
      this.pointerDown.x = e.clientX;
      this.pointerDown.y = e.clientY;
    });

    this.dom.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      if (moved < 6) this.handleClick(e); // 6px 阈值，避免 OrbitControls 拖拽误触发
    });

    this.dom.addEventListener('pointermove', (e) => this.handleHover(e));
  }

  /** 将屏幕坐标换算为 NDC 坐标并执行射线检测 */
  pickAt(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.pickRoot, true);
    return hits.length ? hits[0] : null;
  }

  /**
   * 沿父级链向上查找部件标识 partId。
   * 模型中标识挂在部件根 Group 上，Mesh 本身不带标识。
   */
  findPartId(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.partId) return cur.userData.partId;
      cur = cur.parent;
    }
    return null;
  }

  /** 找到距离命中 Mesh 最近的、带 partId 的部件根对象 */
  findPartRoot(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.partId) return cur;
      cur = cur.parent;
    }
    return null;
  }

  /* ---------------- 单击拾取 ---------------- */
  handleClick(e) {
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit) {
      this.clearSelection();
      this.onPick(null);
      return;
    }
    const partId = this.findPartId(hit.object) || 'unknown';
    const partRoot = this.findPartRoot(hit.object);
    this.setSelection(partRoot);
    this.onPick(PART_INFO[partId] || PART_INFO.unknown, partId);
  }

  /* ---------------- 悬停手型 ---------------- */
  handleHover(e) {
    const hit = this.pickAt(e.clientX, e.clientY);
    this.dom.style.cursor = hit ? 'pointer' : 'default';
  }

  /* ---------------- 选中高亮（缓存原材质参数，取消时还原） ---------------- */
  setSelection(partRoot) {
    this.clearSelection();
    if (!partRoot) return;
    this.selected = partRoot;

    partRoot.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m.emissive) return;
        this.highlightCache.set(m, {
          emissive: m.emissive.getHex(),
          intensity: m.emissiveIntensity
        });
        m.emissive.setHex(0x4c9aff);
        m.emissiveIntensity = 0.55;
      });
    });
  }

  clearSelection() {
    if (!this.selected) return;
    // 以缓存为准还原材质，避免共享材质（如灯泡）在跨部件选中时泄漏
    this.highlightCache.forEach((saved, m) => {
      if (m.emissive) {
        m.emissive.setHex(saved.emissive);
        m.emissiveIntensity = saved.intensity;
      }
    });
    this.highlightCache.clear();
    this.selected = null;
  }

  /* ---------------- 线框透视切换 ---------------- */
  toggleWireframe() {
    this.wireframe = !this.wireframe;
    this.pickRoot.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => { m.wireframe = this.wireframe; });
    });
    return this.wireframe;
  }

  /** 替换拾取根（导入外部 GLB 后调用） */
  setPickRoot(root) {
    this.clearSelection();
    this.pickRoot = root;
  }
}
