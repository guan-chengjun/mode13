# 交互式 3D 旋转木马演示项目

基于 **Three.js（r160）** 原生 ES Module 开发的交互式 3D 旋转木马演示，无需打包工具、无需安装依赖，浏览器通过 CDN 直接加载运行。支持轨道环绕查看、线框透视、启停与调速动画、部件点击讲解、三种可叠加天气切换，以及一键导出 / 导入 GLB 模型。

---

## 一、技术栈与目录结构

| 技术 | 用途 | 引入方式 |
| --- | --- | --- |
| three 0.160.0 | 3D 渲染引擎（PBR / 阴影 / 雾 / 粒子） | CDN import map |
| OrbitControls | 鼠标轨道控制器 | CDN addon |
| GLTFExporter | 导出 GLB 二进制模型 | CDN addon |
| GLTFLoader | 导入 GLB 模型 | CDN addon |

> CDN 默认使用 **unpkg**（`https://unpkg.com/three@0.160.0/`，已实测可访问）。若你的网络环境打不开，可把 `index.html` import map 中的域名整体替换为以下任一备选（目录结构相同）：
> - `https://fastly.jsdelivr.net/npm/three@0.160.0/`
> - `https://registry.npmmirror.com/three/0.160.0/files/`（注意路径前缀为 `files/`）
> - 或下载 npm 包 `three@0.160.0` 到本地 `assets/vendor/three/` 后改为相对路径，实现完全离线运行。

```
carousel-3d/
├── index.html              # 入口页面（import map 引入 CDN、UI 结构）
├── README.md               # 本运行说明文档
├── css/
│   └── style.css           # 界面样式（玻璃拟态工具栏 / 讲解面板 / Toast）
├── js/
│   ├── main.js             # 主入口：渲染器、相机、UI 事件、动画循环
│   ├── config.js           # 全局配置：部件讲解文案、天气预设、场景常量
│   ├── CarouselBuilder.js  # 程序化建模：7 类独立部件的旋转木马
│   ├── weather.js          # 天气系统：光照/阴影/雾/雨粒子/灯带/湿地
│   ├── interaction.js      # 射线拾取、讲解面板、选中高亮、线框切换
│   ├── glbManager.js       # GLB 导出（GLTFExporter）/ 导入（GLTFLoader）
│   └── utils.js            # Toast、文件下载、阴影工具函数
├── docs/
│   └── PARTS.md            # 部件说明文档（7 大构件功能介绍）
└── assets/
    └── README.md           # 资源目录说明（本项目模型全部程序化生成，无需外部资源）
```

---

## 二、本地启动方法

> ⚠️ 不能直接双击 `index.html` 用 `file://` 协议打开。本项目使用 ES Module + import map，浏览器安全策略会拦截 `file://` 下的模块加载，**必须通过 HTTP 服务访问**。

任选一种方式（均无需联网安装项目依赖，仅需本机有对应运行时；Three.js 本身从 CDN 拉取，因此运行时需要联网）：

### 方式 1：Python 3（Windows 11 自带 python 命令）

```bash
cd carousel-3d
python -m http.server 8080
```

### 方式 2：Node.js（npx，无需全局安装）

```bash
cd carousel-3d
npx serve -l 8080 .
```

### 方式 3：VS Code

安装 **Live Server** 扩展 → 右键 `index.html` → `Open with Live Server`。

启动后浏览器访问：

```
http://localhost:8080/
```

---

## 三、部署方式

本项目是纯静态站点，部署到任意静态托管即可：

1. 将整个 `carousel-3d/` 目录上传到服务器站点根目录（Nginx / Apache / IIS 均可）；
2. Nginx 示例配置片段：

   ```nginx
   server {
       listen 80;
       server_name your-domain.example;
       root /var/www/carousel-3d;
       index index.html;
   }
   ```

3. 也可直接托管到 GitHub Pages、Vercel、Netlify、对象存储静态网站（OSS/COS/S3）等平台，上传目录后保持相对路径不变即可；
4. 注意：页面通过 CDN（默认 `unpkg.com`）加载 Three.js，部署环境需要能访问该 CDN；如需离线部署，把 `three.module.js` 与 `examples/jsm/` 下载到本地并修改 `index.html` 中 import map 的路径即可。

---

## 四、浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
| --- | --- | --- |
| Chrome / Edge | 90+ | 推荐，完整支持 |
| Firefox | 90+ | 完整支持 |
| Safari | 15+ | 完整支持（import map 16.4+，旧版本可加 es-module-shims） |
| 移动端浏览器 | iOS Safari 15+ / Android Chrome 90+ | 可触屏环绕查看，工具栏自动换行适配 |

依赖的现代特性：ES Module、import map、WebGL 2.0、Pointer Events。如遇白屏，请确认浏览器版本并检查控制台是否有 CDN 网络错误。

---

## 五、功能操作手册

### 1. 视角控制（OrbitControls）

| 操作 | 鼠标 | 触控板 / 触屏 |
| --- | --- | --- |
| 360° 环绕查看 | 按住左键拖拽 | 单指拖动 |
| 缩放 | 滚轮滚动 | 双指捏合 |
| 平移 | 按住右键拖拽 | 双指拖动 |

视角被限制在地面以上，不会穿入地面；阻尼缓动已开启，松手后有平滑惯性。

### 2. 线框透视模式

点击顶部 **「线框透视：关 / 开」** 按钮切换：

- **关（默认）**：正常 PBR 实体渲染；
- **开**：全部材质切换为 wireframe 线框，可穿透顶棚与外壳直接观察底座内的齿圈 / 小齿轮啮合、中心主轴与悬臂的连接关系。

### 3. 运转动画

- **「运转：开 / 关」**：控制旋转木马启停；
- **动画速度滑块（0.2× ～ 2.0×）**：同时调节主轴公转角速度与木马弹跳频率；
- 动画内容：中心主轴带动旋转轮毂、8 组悬臂与木马座椅绕 Y 轴匀速公转；每匹木马沿立杆做 ±0.18 单位的小幅上下起伏弹跳，相邻木马相位错开 180°，模拟奔腾节奏。

### 4. 部件讲解（点击交互）

- 鼠标单击场景中**任意部件**（中心主轴、顶棚、支撑立柱、悬臂、木马座椅、传动底座、装饰灯带），右侧弹出讲解面板，显示 **部件名称 / 结构作用 / 功能介绍**；
- 被选中的部件会叠加蓝色高亮发光，再次点击其他部件自动切换；点击空白处或面板右上角 × 关闭；
- 鼠标悬停在可讲解部件上时光标变为手型；
- 完整文案同时整理在 [`docs/PARTS.md`](./docs/PARTS.md)。

### 5. 天气切换（三态可叠加）

| 按钮 | 效果 |
| --- | --- |
| ☀ **晴天**（默认） | 明亮蓝天、强方向光 + 环境光、清晰柔和阴影、无雾 |
| 🌙 **夜晚** | 深色夜空 + 星空、弱月光、装饰灯带发光并点亮点光源成为主照明、薄雾 |
| 🌧 **雨天** | 阴天灰蒙背景、雨线粒子（约 1400 条雨丝）、地面低粗糙度湿润反光、轻微雾、关闭清晰阴影 |

- 夜晚与雨天**可自由叠加**（夜雨：深色灰蓝背景 + 雨丝 + 湿地灯带反射 + 浓雾，星空自动隐藏）；
- 点击「晴天」一键复位为基准状态；
- 每次切换同步更新背景、光照、阴影、雾、地面材质、灯带自发光、点光源与粒子显隐。

### 6. GLB 模型导出 / 导入

- **导出 GLB**：点击顶部「导出 GLB」，浏览器自动下载 `carousel.glb`。文件为二进制 glTF，保留全部独立 Mesh、英文命名以及部件标识（`userData.partId`），可直接在 Blender、Windows 3D 查看器、glTF Viewer 等软件中打开；
- **导入 GLB**：点击「导入 GLB」选择本地 `.glb` 文件，当前模型会被替换。导入的外部模型没有内置部件标识，点击时讲解面板显示「自定义部件」通用说明；内置旋转/弹跳动画仅对程序化内置模型生效。

---

## 六、常见问题

**Q：双击 index.html 白屏？**
A：`file://` 协议无法加载 ES Module，请按第二节用本地 HTTP 服务启动。

**Q：模型加载不出来 / 控制台报 CDN 错误？**
A：本项目默认从 `unpkg.com` 拉取 Three.js，检查网络或参照第一节表格切换其他 CDN 镜像（fastly.jsdelivr / npmmirror），离线环境请下载到本地并改 import map。

**Q：雨天地面为什么会反光？**
A：雨天将地面 PBR 材质的 roughness 降到 0.18、metalness 提升到 0.35，配合夜晚灯带点光源即可呈现湿润地面的反射效果。

**Q：导出的 GLB 里有多少个独立 Mesh？**
A：约 130 个独立 Mesh（含 8 匹马各 13 个零件、齿轮、灯串、立柱等），未做合并，便于在三维软件中逐件检查。
