/**
 * CarouselBuilder.js —— 旋转木马程序化建模
 *
 * 模型由 7 类独立部件构成（每类由若干独立 Mesh 组成，部件标识挂在
 * userData.partId 上，供射线拾取与讲解面板使用）：
 *   centralShaft 中心主轴 | canopy 顶棚 | column 支撑立柱
 *   arm 悬臂 | horse 木马座椅 | base 传动底座 | lightBelt 装饰灯带
 *
 * 层级关系：
 *   carouselRoot（静止：底座 / 立柱 / 顶棚 / 灯带）
 *     └─ rotatingGroup（旋转：主轴 + 轮毂 + 齿轮 + 悬臂 + 木马）
 */
import * as THREE from 'three';
import { SCENE_CONFIG } from './config.js';
import { enableShadows } from './utils.js';

const HORSE_COUNT = SCENE_CONFIG.horseCount;
const ORBIT_RADIUS = SCENE_CONFIG.orbitRadius;

/* ----------------------------------------------------------------
 * 材质工厂：统一使用 MeshStandardMaterial（PBR 基础材质）
 * ---------------------------------------------------------------- */
function makeMaterials() {
  return {
    // 金色装饰（柱身、灯座、顶饰）
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.32 }),
    // 顶棚红色漆面
    canopyRed: new THREE.MeshStandardMaterial({ color: 0xb3302f, metalness: 0.25, roughness: 0.45 }),
    // 底座深绿漆面
    baseGreen: new THREE.MeshStandardMaterial({ color: 0x2f6b54, metalness: 0.3, roughness: 0.5 }),
    // 平台木纹
    wood: new THREE.MeshStandardMaterial({ color: 0xa9763f, metalness: 0.05, roughness: 0.75 }),
    // 主轴 / 机械钢件
    steel: new THREE.MeshStandardMaterial({ color: 0x8a94a0, metalness: 0.9, roughness: 0.28 }),
    // 齿轮
    gear: new THREE.MeshStandardMaterial({ color: 0x5c6672, metalness: 0.85, roughness: 0.35 }),
    // 马身（每匹马会 clone 一份并改色）
    horseBody: new THREE.MeshStandardMaterial({ color: 0xf2efe7, metalness: 0.05, roughness: 0.55 }),
    // 马鬃 / 马鞍
    saddle: new THREE.MeshStandardMaterial({ color: 0x7a2e2e, metalness: 0.1, roughness: 0.6 }),
    mane: new THREE.MeshStandardMaterial({ color: 0x3b2b22, metalness: 0.05, roughness: 0.8 }),
    // 灯泡：自发光材质，发光强度交由天气系统调节
    bulb: new THREE.MeshStandardMaterial({
      color: 0xffe6a3,
      emissive: 0xffc56b,
      emissiveIntensity: 0.6,
      metalness: 0.0,
      roughness: 0.3
    })
  };
}

/**
 * 给对象打上部件标识。标识只挂在“部件根”上，
 * 拾取时沿父级链向上查找（见 InteractionController.findPartId）。
 * @param {THREE.Object3D} obj
 * @param {string} partId
 */
function tagPart(obj, partId) {
  obj.userData.partId = partId;
}

/* ----------------------------------------------------------------
 * 齿轮几何体（自定义 BufferGeometry，用于透视模式下观察传动）
 * 思路：在半径 R 的圆周上按齿数交替外推齿顶圆、齿根圆顶点，
 *       沿 Y 方向挤出成带厚度的圆柱齿轮。
 * ---------------------------------------------------------------- */
function createGearGeometry(teeth, rootRadius, toothHeight, thickness) {
  const segments = teeth * 2;
  const outerRadius = rootRadius + toothHeight;
  const vertices = [];
  const indices = [];

  // 上下两个环的顶点（每齿两个角度点）
  for (let layer = 0; layer < 2; layer++) {
    const y = layer === 0 ? -thickness / 2 : thickness / 2;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const r = i % 2 === 0 ? outerRadius : rootRadius;
      vertices.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }

  // 侧面（每个齿段两个三角形）
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = i, b = next, c = i + segments, d = next + segments;
    indices.push(a, c, b, b, c, d);
  }
  // 顶面 / 底面扇形（用中心点）
  const topCenter = vertices.length / 3;
  vertices.push(0, thickness / 2, 0);
  const bottomCenter = vertices.length / 3;
  vertices.push(0, -thickness / 2, 0);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(topCenter, i + segments, next + segments);
    indices.push(bottomCenter, next, i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ----------------------------------------------------------------
 * 木马座椅：由多个独立小 Mesh 拼出的低多边形风格马
 * 返回 horseGroup（局部原点在马背悬挂点，向下建模）
 * ---------------------------------------------------------------- */
function buildHorse(mat, index) {
  const horse = new THREE.Group();
  horse.name = `Horse_${index + 1}`;

  // 每匹马独立 clone 材质并轮换马身配色，保证部件独立可调
  const bodyMat = mat.horseBody.clone();
  const palette = [0xf2efe7, 0xd9c8a9, 0x8f5e46, 0x4a4f5a, 0xc96f5b, 0x6f8f6b, 0xb98fb0, 0xd9b24a];
  bodyMat.color.setHex(palette[index % palette.length]);

  const addMesh = (geometry, material, name, pos, rot) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${horse.name}_${name}`;
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    horse.add(mesh);
    return mesh;
  };

  // 躯干（椭球）
  addMesh(new THREE.SphereGeometry(0.42, 20, 14), bodyMat, 'Body', [0, -0.55, 0]);
  // 脖颈（倾斜圆柱）
  addMesh(new THREE.CylinderGeometry(0.13, 0.18, 0.62, 12), bodyMat, 'Neck', [0, -0.18, 0.34], [0.55, 0, 0]);
  // 头部（椭球，朝向 +Z，即旋转半径外侧）
  addMesh(new THREE.SphereGeometry(0.2, 14, 10), bodyMat, 'Head', [0, 0.08, 0.62], [0.25, 0, 0]);
  // 耳朵
  addMesh(new THREE.ConeGeometry(0.05, 0.14, 8), bodyMat, 'EarL', [-0.08, 0.24, 0.58]);
  addMesh(new THREE.ConeGeometry(0.05, 0.14, 8), bodyMat, 'EarR', [0.08, 0.24, 0.58]);
  // 马鬃
  addMesh(new THREE.BoxGeometry(0.07, 0.42, 0.12), mat.mane, 'Mane', [0, -0.12, 0.28], [0.5, 0, 0]);
  // 马鞍
  addMesh(new THREE.BoxGeometry(0.36, 0.1, 0.4), mat.saddle, 'Saddle', [0, -0.22, -0.02]);
  // 四条腿（圆柱 + 蹄）
  const legPositions = [
    [-0.2, -1.05, 0.22], [0.2, -1.05, 0.22],
    [-0.2, -1.05, -0.24], [0.2, -1.05, -0.24]
  ];
  legPositions.forEach((p, i) => {
    addMesh(new THREE.CylinderGeometry(0.055, 0.045, 0.55, 8), bodyMat, `Leg${i + 1}`, p);
    addMesh(new THREE.BoxGeometry(0.11, 0.07, 0.13), mat.gear, `Hoof${i + 1}`, [p[0], p[1] - 0.3, p[2]]);
  });
  // 尾巴
  addMesh(new THREE.CylinderGeometry(0.04, 0.09, 0.45, 8), mat.mane, 'Tail', [0, -0.62, -0.42], [-0.5, 0, 0]);

  return horse;
}

/* ================================================================
 * CarouselBuilder 主类
 * ================================================================ */
export class CarouselBuilder {
  constructor() {
    this.mat = makeMaterials();
    /** @type {THREE.Group|null} 整机根节点（导出 GLB 的导出对象） */
    this.root = null;
    /** @type {THREE.Group|null} 旋转组：主轴/轮毂/悬臂/木马 */
    this.rotatingGroup = null;
    /** @type {THREE.Group[]} 每匹马的上下浮动节点 */
    this.horseBobs = [];
    /** @type {THREE.Mesh|null} 小齿轮（动画反向自转） */
    this.pinion = null;
    /** @type {THREE.PointLight[]} 灯带配套点光源（夜晚开启） */
    this.bulbLights = [];
    /** @type {THREE.Mesh[]} 全部灯泡（自发光随天气调节） */
    this.bulbMeshes = [];
  }

  /**
   * 构建完整旋转木马。
   * @returns {THREE.Group}
   */
  build() {
    const root = new THREE.Group();
    root.name = 'CarouselRoot';
    this.root = root;

    root.add(this.buildBase());
    root.add(this.buildColumns());
    root.add(this.buildCanopy());
    root.add(this.buildLightBelt());

    const rotating = this.buildRotatingGroup();
    this.rotatingGroup = rotating;
    root.add(rotating);

    enableShadows(root);
    // 灯泡不投阴影，避免大量小阴影贴图开销
    this.bulbMeshes.forEach((m) => { m.castShadow = false; });
    return root;
  }

  /* ---------------- 1. 传动底座 ---------------- */
  buildBase() {
    const g = new THREE.Group();
    g.name = 'BaseGroup';
    tagPart(g, 'base');

    // 底筒（主壳体）
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.6, 0.9, 48), this.mat.baseGreen);
    drum.name = 'Base_Drum';
    drum.position.y = 0.45;
    g.add(drum);

    // 上下金色箍边
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.09, 12, 64), this.mat.gold);
    ringTop.name = 'Base_RingTop';
    ringTop.rotation.x = Math.PI / 2;
    ringTop.position.y = 0.9;
    g.add(ringTop);

    const ringBottom = ringTop.clone();
    ringBottom.name = 'Base_RingBottom';
    ringBottom.position.y = 0.08;
    g.add(ringBottom);

    // 乘骑平台（木质圆盘）
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.25, 0.16, 48), this.mat.wood);
    deck.name = 'Base_Platform';
    deck.position.y = 1.0;
    g.add(deck);

    // 内齿圈（固定在底座上，透视模式可见，静止不转）
    const ringGear = new THREE.Mesh(createGearGeometry(28, 0.95, 0.14, 0.22), this.mat.gear);
    ringGear.name = 'Base_RingGear';
    ringGear.position.y = 0.55;
    g.add(ringGear);

    return g;
  }

  /* ---------------- 2. 支撑立柱（8 根，静止） ---------------- */
  buildColumns() {
    const g = new THREE.Group();
    g.name = 'ColumnsGroup';

    for (let i = 0; i < HORSE_COUNT; i++) {
      const angle = (i / HORSE_COUNT) * Math.PI * 2;
      const col = new THREE.Group();
      col.name = `Column_${i + 1}`;
      tagPart(col, 'column');
      col.position.set(Math.cos(angle) * 4.05, 0, Math.sin(angle) * 4.05);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 5.15, 14), this.mat.gold);
      shaft.name = `${col.name}_Shaft`;
      shaft.position.y = 3.6;
      col.add(shaft);

      // 柱头 / 柱脚装饰球
      const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), this.mat.gold);
      capTop.name = `${col.name}_CapTop`;
      capTop.position.y = 6.2;
      col.add(capTop);

      const capBottom = capTop.clone();
      capBottom.name = `${col.name}_CapBottom`;
      capBottom.position.y = 1.05;
      col.add(capBottom);

      g.add(col);
    }
    return g;
  }

  /* ---------------- 3. 顶棚（伞盖 + 顶饰，静止） ---------------- */
  buildCanopy() {
    const g = new THREE.Group();
    g.name = 'CanopyGroup';
    tagPart(g, 'canopy');

    // 伞盖：LatheGeometry 旋转剖面生成帐篷曲面
    const profile = [
      new THREE.Vector2(0.35, 0.55),
      new THREE.Vector2(1.6, 0.42),
      new THREE.Vector2(3.2, 0.1),
      new THREE.Vector2(4.35, -0.28),
      new THREE.Vector2(4.5, -0.42)
    ];
    const roof = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), this.mat.canopyRed);
    roof.name = 'Canopy_Roof';
    roof.position.y = 6.35;
    g.add(roof);

    // 伞沿金色压边
    const eave = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.09, 12, 72), this.mat.gold);
    eave.name = 'Canopy_Eave';
    eave.rotation.x = Math.PI / 2;
    eave.position.y = 5.93;
    g.add(eave);

    // 顶饰：宝珠 + 尖杆
    const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), this.mat.gold);
    finialBall.name = 'Canopy_FinialBall';
    finialBall.position.y = 7.05;
    g.add(finialBall);

    const finialSpike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 14), this.mat.gold);
    finialSpike.name = 'Canopy_FinialSpike';
    finialSpike.position.y = 7.45;
    g.add(finialSpike);

    return g;
  }

  /* ---------------- 4. 装饰灯带（伞沿 + 底座平台各一圈） ---------------- */
  buildLightBelt() {
    const g = new THREE.Group();
    g.name = 'LightBeltGroup';
    tagPart(g, 'lightBelt');

    const bulbCount = 24;
    const bulbGeo = new THREE.SphereGeometry(0.09, 12, 8);

    for (let i = 0; i < bulbCount; i++) {
      const angle = (i / bulbCount) * Math.PI * 2;
      const x = Math.cos(angle) * 4.42;
      const z = Math.sin(angle) * 4.42;

      // 伞沿灯泡
      const topBulb = new THREE.Mesh(bulbGeo, this.mat.bulb);
      topBulb.name = `Light_TopBulb_${i + 1}`;
      topBulb.position.set(x, 5.78, z);
      g.add(topBulb);
      this.bulbMeshes.push(topBulb);

      // 平台灯泡
      const bottomBulb = new THREE.Mesh(bulbGeo, this.mat.bulb);
      bottomBulb.name = `Light_BottomBulb_${i + 1}`;
      bottomBulb.position.set(Math.cos(angle) * 4.18, 1.18, Math.sin(angle) * 4.18);
      g.add(bottomBulb);
      this.bulbMeshes.push(bottomBulb);

      // 每 6 个灯泡配一个真实点光源（共 4 盏），夜晚作为主照明
      if (i % 6 === 0) {
        const light = new THREE.PointLight(0xffc56b, 0, 9, 2);
        light.name = `Light_Point_${i + 1}`;
        light.position.set(x, 5.6, z);
        g.add(light);
        this.bulbLights.push(light);
      }
    }
    return g;
  }

  /* ---------------- 5. 旋转组（主轴 + 轮毂 + 齿轮 + 悬臂 + 木马） ---------------- */
  buildRotatingGroup() {
    const g = new THREE.Group();
    g.name = 'RotatingGroup';

    // —— 中心主轴 ——
    const shaftGroup = new THREE.Group();
    shaftGroup.name = 'CentralShaft';
    tagPart(shaftGroup, 'centralShaft');

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.6, 20), this.mat.steel);
    shaft.name = 'CentralShaft_Cylinder';
    shaft.position.y = 3.65;
    shaftGroup.add(shaft);

    // 顶部轴承座（与顶棚衔接，随轴旋转的内圈）
    const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 20), this.mat.gear);
    bearing.name = 'CentralShaft_TopBearing';
    bearing.position.y = 6.25;
    shaftGroup.add(bearing);

    // 中部旋转轮毂（悬臂安装盘）
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 24), this.mat.gear);
    hub.name = 'CentralShaft_Hub';
    hub.position.y = 4.35;
    shaftGroup.add(hub);
    g.add(shaftGroup);

    // —— 底座内小齿轮：与主轴同转（透视模式下观察啮合） ——
    const pinion = new THREE.Mesh(createGearGeometry(14, 0.42, 0.1, 0.2), this.mat.gear);
    pinion.name = 'CentralShaft_DrivePinion';
    pinion.position.set(0.62, 0.55, 0);
    g.add(pinion);
    this.pinion = pinion;

    // —— 8 组悬臂 + 木马 ——
    for (let i = 0; i < HORSE_COUNT; i++) {
      const angle = (i / HORSE_COUNT) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.name = `HorsePivot_${i + 1}`;
      pivot.rotation.y = angle;
      g.add(pivot);

      // 悬臂（水平钢梁）—— 独立部件 arm
      const armPart = new THREE.Group();
      armPart.name = `Arm_${i + 1}`;
      tagPart(armPart, 'arm');

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, ORBIT_RADIUS, 10), this.mat.steel);
      beam.name = `${armPart.name}_Beam`;
      beam.rotation.z = Math.PI / 2;
      beam.position.set(ORBIT_RADIUS / 2, 4.35, 0);
      armPart.add(beam);

      // 木马立杆（上下导向杆，归入悬臂部件）
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 2.6, 10), this.mat.gold);
      pole.name = `${armPart.name}_Pole`;
      pole.position.set(ORBIT_RADIUS, 3.15, 0);
      armPart.add(pole);
      pivot.add(armPart);

      // 木马座椅 —— 独立部件 horse，bob 节点负责上下弹跳
      const bob = new THREE.Group();
      bob.name = `HorseBob_${i + 1}`;
      bob.position.set(ORBIT_RADIUS, 4.25, 0);

      const horse = buildHorse(this.mat, i);
      tagPart(horse, 'horse');
      bob.add(horse);
      pivot.add(bob);
      this.horseBobs.push(bob);
    }

    return g;
  }
}
