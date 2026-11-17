/**
 * main.js —— 应用主入口
 *
 * 串联：渲染器 / 场景 / 相机 / OrbitControls / 程序化模型 /
 *       天气系统 / 交互拾取 / GLB 导入导出 / UI 事件 / 动画循环。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_CONFIG } from './config.js';
import { CarouselBuilder } from './CarouselBuilder.js';
import { WeatherSystem } from './weather.js';
import { InteractionController } from './interaction.js';
import { GLBManager } from './glbManager.js';
import { showToast } from './utils.js';

/* ================================================================
 * 1. 渲染器 / 场景 / 相机
 * ================================================================ */
const container = document.getElementById('scene-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  SCENE_CONFIG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.fromArray(SCENE_CONFIG.cameraPosition);

// 轨道控制器：左键环绕 / 滚轮缩放 / 右键平移
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(SCENE_CONFIG.cameraTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.495; // 禁止视角穿入地面以下
controls.update();

/* ================================================================
 * 2. 构建旋转木马模型
 * ================================================================ */
const builder = new CarouselBuilder();
let carousel = builder.build();
scene.add(carousel);
/** 是否为内置程序化模型（导入外部 GLB 后置 false，停用内置旋转/弹跳动画） */
let isBuiltinModel = true;

/* ================================================================
 * 3. 天气系统（内部创建灯光、地面、雨、星空）
 * ================================================================ */
const weather = new WeatherSystem(scene, renderer, builder);

/* ================================================================
 * 4. 交互拾取 + 讲解面板
 * ================================================================ */
const panel = document.getElementById('info-panel');
const panelTitle = document.getElementById('panel-title');
const panelRole = document.getElementById('panel-role');
const panelDesc = document.getElementById('panel-desc');
const panelMeta = document.getElementById('panel-meta');

const interaction = new InteractionController(renderer, camera, carousel, (info) => {
  if (!info) {
    panel.hidden = true;
    return;
  }
  panelTitle.textContent = info.name;
  panelRole.textContent = info.role;
  panelDesc.textContent = info.desc;
  panelMeta.textContent = '提示：可切换「线框透视」观察该部件与内部传动结构的空间关系。';
  panel.hidden = false;
});

document.getElementById('panel-close').addEventListener('click', () => {
  panel.hidden = true;
  interaction.clearSelection();
});

/* ================================================================
 * 5. UI：线框透视 / 运转开关 / 速度 / 天气 / GLB
 * ================================================================ */
// —— 线框透视 ——
const btnWire = document.getElementById('btn-wireframe');
btnWire.addEventListener('click', () => {
  const on = interaction.toggleWireframe();
  btnWire.textContent = `线框透视：${on ? '开' : '关'}`;
  btnWire.setAttribute('aria-pressed', String(on));
  showToast(on ? '已进入线框透视模式，可观察内部齿轮传动' : '已恢复实体渲染模式');
});

// —— 运转开关 ——
const btnRun = document.getElementById('btn-run');
let running = true;
btnRun.addEventListener('click', () => {
  running = !running;
  btnRun.textContent = `运转：${running ? '开' : '关'}`;
  btnRun.setAttribute('aria-pressed', String(running));
});

// —— 动画速度 ——
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
let speedFactor = 1;
speedRange.addEventListener('input', () => {
  speedFactor = parseFloat(speedRange.value);
  speedValue.textContent = `${speedFactor.toFixed(1)}×`;
});

// —— 天气切换（三态可叠加） ——
const weatherButtons = {
  night: document.getElementById('btn-weather-night'),
  rain: document.getElementById('btn-weather-rain')
};
Object.entries(weatherButtons).forEach(([key, btn]) => {
  btn.addEventListener('click', () => {
    weather.toggle(key);
    const active = weather.state[key];
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
});
// 晴天按钮：一键复位为基准晴天
document.getElementById('btn-weather-sunny').addEventListener('click', () => {
  weather.state.night = false;
  weather.state.rain = false;
  weather.apply();
  Object.values(weatherButtons).forEach((b) => {
    b.classList.remove('is-active');
    b.setAttribute('aria-pressed', 'false');
  });
  const btnSunny = document.getElementById('btn-weather-sunny');
  btnSunny.classList.add('is-active');
  btnSunny.setAttribute('aria-pressed', 'true');
  showToast('已切换为晴天');
});
// 点击夜/雨按钮后取消晴天按钮的激活态
Object.values(weatherButtons).forEach((btn) => {
  btn.addEventListener('click', () => {
    const anyActive = Object.values(weather.state).some(Boolean);
    const btnSunny = document.getElementById('btn-weather-sunny');
    btnSunny.classList.toggle('is-active', !anyActive);
    btnSunny.setAttribute('aria-pressed', String(!anyActive));
  });
});

// —— GLB 导出 ——
const glb = new GLBManager();
document.getElementById('btn-export').addEventListener('click', () => {
  glb.exportGLB(carousel, 'carousel.glb');
});

// —— GLB 导入（替换当前模型） ——
const fileInput = document.getElementById('file-input');
document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = await glb.importGLB(file);
    scene.remove(carousel);
    carousel = imported;
    scene.add(carousel);
    interaction.setPickRoot(carousel);
    isBuiltinModel = false;
    panel.hidden = true;
    showToast(`已导入：${file.name}（无内置标识的外部模型将显示“自定义部件”讲解）`);
  } catch (err) {
    console.error('[GLTFLoader]', err);
    showToast('导入失败：请选择有效的 .glb 文件');
  } finally {
    fileInput.value = '';
  }
});

/* ================================================================
 * 6. 窗口自适应
 * ================================================================ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ================================================================
 * 7. 动画循环
 *    - 旋转组绕 Y 轴匀速公转（速度滑块调节）
 *    - 木马沿立杆小幅上下弹跳，相位交替错开
 *    - 天气系统更新雨丝与灯带呼吸
 * ================================================================ */
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05); // 钳制大间隔，防止切页后跳变
  elapsed += delta;

  if (running && isBuiltinModel) {
    const angularSpeed = SCENE_CONFIG.baseRotationSpeed * speedFactor;
    // 主轴带动旋转组水平公转
    builder.rotatingGroup.rotation.y += angularSpeed * delta;
    // 小齿轮随主轴自转（透视模式下可观察）
    if (builder.pinion) builder.pinion.rotation.y += angularSpeed * 2.2 * delta;

    // 木马上下起伏弹跳：相邻木马相位错开 180°，弹跳幅度 0.18
    const bobFrequency = 2.2 * speedFactor;
    builder.horseBobs.forEach((bob, i) => {
      const phase = (i % 2) * Math.PI;
      bob.position.y = 4.25 + Math.sin(elapsed * bobFrequency + phase) * 0.18;
    });
  }

  weather.update(delta, elapsed);
  controls.update();
  renderer.render(scene, camera);
}
animate();
