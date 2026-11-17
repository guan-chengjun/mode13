/**
 * config.js —— 全局配置
 * 包含：部件讲解文案、天气状态参数、场景与动画常量。
 * 所有可调整的“业务参数”集中在此，便于维护与讲解文案二次编辑。
 */

/**
 * 部件信息字典：key 与模型 userData.partId 一一对应。
 * @typedef {Object} PartInfo
 * @property {string} name 部件名称
 * @property {string} role 结构作用
 * @property {string} desc 功能介绍
 */
export const PART_INFO = {
  centralShaft: {
    name: '中心主轴',
    role: '旋转木马的核心承力与传动构件，竖直贯穿设备中心，上端连接顶棚轴承、下端连接传动底座内的驱动齿轮。',
    desc: '运转时由底座电机经减速齿轮驱动，绕自身轴线匀速旋转。主轴通过中部旋转轮毂带动全部悬臂与木马座椅做水平公转，是整机旋转运动的动力来源与定位基准。'
  },
  canopy: {
    name: '顶棚',
    role: '固定在支撑立柱顶端的伞形顶盖，为乘骑区遮蔽日晒雨淋，同时是装饰灯带的主要安装载体。',
    desc: '采用伞盖式曲面造型，属于静止部件，不随主轴旋转。顶棚外缘与顶饰上布置装饰灯带，夜晚灯带开启后成为场景主光源，烘托游乐场氛围。'
  },
  column: {
    name: '支撑立柱',
    role: '沿圆周均匀分布的 8 根承重立柱，下端固定于传动底座、上端承托顶棚，构成整机的固定框架。',
    desc: '立柱保持静止，与旋转部件互不干涉，同时为顶棚载荷和灯带线缆提供传递路径。线框模式下可清楚看到立柱与旋转主轴、悬臂之间的空间关系。'
  },
  arm: {
    name: '悬臂',
    role: '从旋转轮毂水平伸出的放射状承重杆，内端固定在中心主轴的轮毂上，外端连接木马立杆。',
    desc: '悬臂随主轴一起公转，将扭矩与向心力传递给每一个木马座椅，保证所有座椅在同一圆周上同步转动、彼此间距恒定，是“主轴带动木马公转”的直接传力部件。'
  },
  horse: {
    name: '木马座椅',
    role: '供游客乘骑的座椅单元，通过立杆悬挂在悬臂外端，沿圆周均匀布置共 8 匹。',
    desc: '木马随悬臂做水平公转的同时，由立杆导向沿竖直方向做小幅上下起伏弹跳，模拟马匹奔腾姿态。弹跳高度与频率随动画速度联动，形成经典的旋转木马节奏。'
  },
  base: {
    name: '传动底座',
    role: '整机的地基与动力舱，内部容纳电机、减速齿轮组，外部承托平台、立柱与中心主轴。',
    desc: '底座内部的大齿圈与小齿轮构成减速传动机构：电机带动小齿轮，小齿轮驱动与主轴相连的大齿圈，输出大扭矩低转速。切换到线框透视模式可直接观察齿轮啮合与内部结构。'
  },
  lightBelt: {
    name: '装饰灯带',
    role: '沿顶棚伞沿和底座平台外缘环形布置的装饰照明带，由灯串与灯泡组成。',
    desc: '白天仅作装饰；进入夜晚模式后灯泡发光并自动点亮配套点光源，成为场景主要照明；雨雾天气中灯带光晕会被雾气柔化，营造湿润朦胧的夜间游乐场效果。'
  },
  unknown: {
    name: '自定义部件',
    role: '该部件来自外部导入的 GLB 模型，未携带内置部件标识（userData.partId）。',
    desc: '可通过「导出 GLB」按钮将当前场景模型保存后在三维软件中查看其命名与层级结构；内置模型的每个部件均挂有 partId，可重新加载内置模型恢复完整讲解。'
  }
};

/**
 * 天气预设。三个布尔开关（晴/夜/雨）可自由叠加，
 * 各属性按“开关组合”在 WeatherSystem 中合成。
 */
export const WEATHER_PRESETS = {
  sunny: {
    skyColor: 0x9ec9f5,        // 明亮蓝天
    hemiIntensity: 0.95,       // 环境天光强度
    hemiGround: 0x9a8f7d,      // 地面反弹光颜色
    sunIntensity: 2.6,         // 方向光（太阳）强度
    sunColor: 0xfff3d6,
    exposure: 1.05,            // 色调映射曝光
    fogDensity: 0.0,           // 无雾
    groundColor: 0x8f9aa6,     // 地面石材色
    groundRoughness: 0.85,
    groundMetalness: 0.0,
    shadows: true,
    shadowOpacity: 0.28
  },
  night: {
    skyColor: 0x070b18,        // 深色夜空
    hemiIntensity: 0.18,
    hemiGround: 0x101624,
    sunIntensity: 0.25,        // 月光（弱方向光）
    sunColor: 0x9db4ff,
    exposure: 0.9,
    fogDensity: 0.004,
    groundColor: 0x1b2230,
    groundRoughness: 0.6,
    groundMetalness: 0.1,
    shadows: true,
    shadowOpacity: 0.4,
    lightBeltEmissive: 2.2,    // 灯带自发光强度
    pointLightIntensity: 18    // 灯带配套点光源强度
  },
  rain: {
    skyColor: 0x6b7684,        // 阴天灰蒙
    hemiIntensity: 0.55,
    hemiGround: 0x5d6672,
    sunIntensity: 0.5,
    sunColor: 0xc4ccd6,
    exposure: 0.85,
    fogDensity: 0.022,         // 轻微雾
    groundColor: 0x3a424d,     // 湿润深灰地面
    groundRoughness: 0.18,     // 低粗糙度 -> 湿润反光
    groundMetalness: 0.35,
    shadows: false,
    shadowOpacity: 0.0
  }
};

/** 场景常量 */
export const SCENE_CONFIG = {
  cameraFov: 45,
  cameraPosition: [11, 8, 13],
  cameraTarget: [0, 3.2, 0],
  groundRadius: 30,
  horseCount: 8,          // 木马 / 悬臂 / 立柱数量
  orbitRadius: 3.4,       // 木马公转半径
  baseRotationSpeed: 0.45 // 速度滑块为 1.0× 时的角速度（弧度/秒）
};
