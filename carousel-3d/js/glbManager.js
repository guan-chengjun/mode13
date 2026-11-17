/**
 * GLBManager.js —— GLB 模型导出 / 导入
 *
 * 导出：使用官方 GLTFExporter 将当前场景中的旋转木马模型序列化为
 *       二进制 glTF（.glb），保留各独立 Mesh、命名与 userData 标识；
 * 导入：使用 GLTFLoader 读取本地 .glb 文件并替换当前模型，
 *       便于验证导出文件的完整性。
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { downloadBlob, showToast, enableShadows } from './utils.js';

export class GLBManager {
  constructor() {
    this.exporter = new GLTFExporter();
    this.loader = new GLTFLoader();
  }

  /**
   * 导出模型为 GLB 并触发浏览器下载。
   * @param {THREE.Object3D} object 待导出的模型根节点
   * @param {string} [filename]
   */
  exportGLB(object, filename = 'carousel.glb') {
    this.exporter.parse(
      object,
      (result) => {
        // binary 模式下 result 为 ArrayBuffer
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        downloadBlob(blob, filename);
        showToast(`已导出模型：${filename}`);
      },
      (error) => {
        console.error('[GLBExporter]', error);
        showToast('导出失败，请查看控制台日志');
      },
      {
        binary: true,          // 输出单文件 .glb
        onlyVisible: true,
        trs: false,
        maxTextureSize: 2048
      }
    );
  }

  /**
   * 从本地文件导入 GLB。
   * @param {File} file
   * @returns {Promise<THREE.Group>} 解析后的模型根节点
   */
  importGLB(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.loader.parse(
          reader.result,
          '',
          (gltf) => {
            const model = gltf.scene || gltf.scenes[0];
            model.name = 'ImportedCarousel';
            enableShadows(model);
            resolve(model);
          },
          (err) => reject(err)
        );
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
}
