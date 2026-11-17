/**
 * utils.js —— 通用小工具
 */

/**
 * 轻量 Toast 消息提示（2.4 秒后自动消失）。
 * @param {string} text 提示文字
 */
export function showToast(text) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s ease';
    setTimeout(() => el.remove(), 320);
  }, 2400);
}

/**
 * 触发浏览器端文件下载（用于 GLB 导出）。
 * @param {Blob} blob 文件二进制
 * @param {string} filename 下载文件名
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延迟回收，确保下载已开始
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 开启递归阴影：组内所有 Mesh 默认投射并接收阴影。
 * 个别物体（灯泡、雨粒子等）可在外部单独覆盖。
 * @param {THREE.Object3D} root
 */
export function enableShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}
