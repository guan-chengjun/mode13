/**
 * WeatherSystem.js —— 天气系统
 *
 * 三个可叠加的布尔状态：sunny（晴，默认）/ night（夜）/ rain（雨）。
 * 切换时同步更新：背景色、环境光与方向光、阴影、雾、地面材质
 * （雨天低粗糙度模拟湿润反光）、雨线粒子、星空、灯带自发光与点光源。
 */
import * as THREE from 'three';
import { WEATHER_PRESETS, SCENE_CONFIG } from './config.js';

const RAIN_COUNT = 1400;   // 雨线数量
const RAIN_RANGE = 16;     // 雨区水平半宽
const RAIN_TOP = 14;       // 雨线重置高度
const RAIN_SPEED = 11;     // 雨线下落速度

export class WeatherSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {CarouselBuilder} carousel 用于访问灯带灯泡与点光源
   */
  constructor(scene, renderer, carousel) {
    this.scene = scene;
    this.renderer = renderer;
    this.carousel = carousel;

    /** 天气开关状态（晴天为基准态，始终视为开启） */
    this.state = { night: false, rain: false };

    this.setupLights();
    this.setupGround();
    this.setupRain();
    this.setupStars();

    // 初始应用晴天预设
    this.apply();
  }

  /* ---------------- 灯光：环境半球光 + 平行方向光 ---------------- */
  setupLights() {
    // 半球光模拟天空环境光 + 地面反弹光
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9a8f7d, 0.9);
    this.scene.add(this.hemi);

    // 方向光作为太阳 / 月亮，负责投影
    this.sun = new THREE.DirectionalLight(0xfff3d6, 2.6);
    this.sun.position.set(8, 14, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 45;
    this.sun.shadow.camera.left = -11;
    this.sun.shadow.camera.right = 11;
    this.sun.shadow.camera.top = 11;
    this.sun.shadow.camera.bottom = -11;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // 柔和的补光，避免背光面死黑
    this.fill = new THREE.DirectionalLight(0xbfd4ff, 0.35);
    this.fill.position.set(-7, 6, -8);
    this.scene.add(this.fill);
  }

  /* ---------------- 地面（PBR，雨天切换为湿润反光材质） ---------------- */
  setupGround() {
    this.groundMat = new THREE.MeshStandardMaterial({
      color: WEATHER_PRESETS.sunny.groundColor,
      roughness: WEATHER_PRESETS.sunny.groundRoughness,
      metalness: WEATHER_PRESETS.sunny.groundMetalness
    });
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(SCENE_CONFIG.groundRadius, 72), this.groundMat);
    this.ground.name = 'Ground';
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  /* ---------------- 雨线粒子（LineSegments，每段一条雨丝） ---------------- */
  setupRain() {
    const positions = new Float32Array(RAIN_COUNT * 2 * 3);
    this.rainDrops = [];

    for (let i = 0; i < RAIN_COUNT; i++) {
      const drop = {
        x: (Math.random() - 0.5) * RAIN_RANGE * 2,
        y: Math.random() * RAIN_TOP,
        z: (Math.random() - 0.5) * RAIN_RANGE * 2,
        len: 0.5 + Math.random() * 0.5 // 雨丝长度
      };
      this.rainDrops.push(drop);
      // 此时 geometry 尚未创建，直接写本地缓冲（与 writeRainVertex 同一布局）
      const k = i * 6;
      positions[k] = drop.x;
      positions[k + 1] = drop.y;
      positions[k + 2] = drop.z;
      positions[k + 3] = drop.x + 0.08;       // 轻微倾斜，模拟风雨
      positions[k + 4] = drop.y - drop.len;
      positions[k + 5] = drop.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xb8c6d6, transparent: true, opacity: 0.55
    });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.name = 'RainParticles';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  /** 将第 i 条雨丝的两个端点写入位置缓冲 */
  writeRainVertex(i, d) {
    const arr = this.rain.geometry.attributes.position.array;
    const k = i * 6;
    arr[k] = d.x;
    arr[k + 1] = d.y;
    arr[k + 2] = d.z;
    arr[k + 3] = d.x + 0.08;       // 轻微倾斜，模拟风雨
    arr[k + 4] = d.y - d.len;
    arr[k + 5] = d.z;
  }

  /* ---------------- 星空（仅夜晚可见，不受雾影响） ---------------- */
  setupStars() {
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // 在半径 46 的球壳上随机分布
      const r = 46;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.92); // 略偏上半球
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.9, fog: false
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.name = 'Stars';
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  /* ---------------- 天气切换入口（UI 按钮调用） ---------------- */
  toggle(key) {
    if (key === 'night') this.state.night = !this.state.night;
    if (key === 'rain') this.state.rain = !this.state.rain;
    this.apply();
  }

  /**
   * 按当前状态合成各预设参数并应用到场景。
   * 规则：以晴天为基准，夜/雨开关开启时覆盖对应字段；
   * 灯带与点光源仅在夜晚发光；雨雾密度在夜雨叠加时增强。
   */
  apply() {
    const s = WEATHER_PRESETS.sunny;
    const n = WEATHER_PRESETS.night;
    const r = WEATHER_PRESETS.rain;
    const { night, rain } = this.state;

    // 背景色：雨 > 夜 的覆盖优先级（夜雨叠加取雨夜灰蓝）
    let bg = s.skyColor;
    if (night) bg = n.skyColor;
    if (rain) bg = night ? 0x141b28 : r.skyColor;
    this.scene.background = new THREE.Color(bg);

    // 雾：雨天轻微雾，夜晚薄雾，叠加时加深
    let fogDensity = s.fogDensity;
    if (night) fogDensity = Math.max(fogDensity, n.fogDensity);
    if (rain) fogDensity = Math.max(fogDensity, night ? 0.03 : r.fogDensity);
    this.scene.fog = fogDensity > 0 ? new THREE.FogExp2(bg, fogDensity) : null;

    // 环境光 / 方向光
    this.hemi.intensity = night ? n.hemiIntensity : s.hemiIntensity;
    if (rain) this.hemi.intensity *= 0.8;
    this.hemi.color.setHex(night ? 0x33405e : 0xffffff);
    this.hemi.groundColor.setHex(night ? n.hemiGround : s.hemiGround);

    this.sun.intensity = night ? n.sunIntensity : s.sunIntensity;
    this.sun.color.setHex(night ? n.sunColor : s.sunColor);
    if (rain) this.sun.intensity = r.sunIntensity;

    this.fill.intensity = night ? 0.12 : 0.35;

    // 阴影：雨天关闭（阴天散射光无清晰投影）
    const shadowsEnabled = rain ? r.shadows : (night ? n.shadows : s.shadows);
    this.sun.castShadow = shadowsEnabled;
    this.renderer.shadowMap.enabled = shadowsEnabled;

    // 曝光
    let exposure = s.exposure;
    if (night) exposure = n.exposure;
    if (rain) exposure = r.exposure;
    this.renderer.toneMappingExposure = exposure;

    // 地面材质：雨天湿润（低粗糙 + 金属度提升 -> 反射灯带）
    const gm = this.groundMat;
    if (rain) {
      gm.color.setHex(night ? 0x141a22 : r.groundColor);
      gm.roughness = r.groundRoughness;
      gm.metalness = r.groundMetalness;
    } else if (night) {
      gm.color.setHex(n.groundColor);
      gm.roughness = n.groundRoughness;
      gm.metalness = n.groundMetalness;
    } else {
      gm.color.setHex(s.groundColor);
      gm.roughness = s.groundRoughness;
      gm.metalness = s.groundMetalness;
    }
    gm.needsUpdate = true;

    // 雨粒子 / 星空显隐
    this.rain.visible = rain;
    this.stars.visible = night && !rain; // 雨夜看不到星星

    // 灯带：夜晚发光并点亮点光源，白天仅保留微弱自发光装饰
    const bulbEmissive = night ? n.lightBeltEmissive : 0.6;
    this.carousel.bulbMeshes.forEach((m) => {
      m.material.emissiveIntensity = bulbEmissive;
    });
    this.carousel.bulbLights.forEach((l) => {
      l.intensity = night ? n.pointLightIntensity : 0;
    });
  }

  /**
   * 每帧更新：雨丝下落 + 夜晚灯带轻微呼吸闪烁。
   * @param {number} delta 帧间隔（秒）
   * @param {number} elapsed 累计时间（秒）
   */
  update(delta, elapsed) {
    // 雨线下落，落出地面后回收到顶部
    if (this.rain.visible) {
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < this.rainDrops.length; i++) {
        const d = this.rainDrops[i];
        d.y -= RAIN_SPEED * delta;
        d.x += 0.6 * delta; // 风向偏移
        if (d.y < 0) {
          d.y = RAIN_TOP;
          d.x = (Math.random() - 0.5) * RAIN_RANGE * 2;
          d.z = (Math.random() - 0.5) * RAIN_RANGE * 2;
        }
        this.writeRainVertex(i, d);
      }
      pos.needsUpdate = true;
    }

    // 夜晚灯带呼吸（正弦微调自发光）
    if (this.state.night) {
      const pulse = 2.0 + Math.sin(elapsed * 2.4) * 0.35;
      this.carousel.bulbMeshes.forEach((m) => {
        m.material.emissiveIntensity = pulse;
      });
    }
  }
}
