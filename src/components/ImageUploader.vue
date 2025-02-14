<template>
  <div class="tw-absolute tw-top-4 tw-right-4 tw-z-10">
    <label for="uploader" class="tw-cursor-pointer"> 
      <q-icon name="cloud_upload" 
        class="tw-text-red-400 tw-bg-white tw-p-3 tw-shadow-xl tw-text-3xl tw-rounded tw-border-gray-200 tw-border-b-2 tw-border-r-2 tw-transform tw-transition tw-duration-300 tw-ease-in-out tw-rotate-0 hover:tw-bg-slate-100 hover:tw-rotate-12 active:tw-bg-slate-200 active:tw-rotate-0"
      />
    </label>
    <input id="uploader" 
      @change="handleFileUpload"
      type="file" 
      accept="image/*" 
      class="hidden"
    />
  </div>
</template>

<script setup>
import { useImageStore } from '../stores/useImageStore';

const imageStore = useImageStore();

const handleFileUpload = async (event) => {
  const files = event.target.files;
  if (files.length === 0) return;

  try {
    for (const file of files) {
      // 讀取文件為 base64
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 加載圖片以獲取尺寸
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height
          });
        };
        img.src = dataUrl;
      });

      // 計算縮放後的尺寸
      const defaultWidth = 200;
      const scale = defaultWidth / dimensions.width;
      const defaultHeight = dimensions.height * scale;

      // 創建圖片對象
      const imageObject = {
        src: dataUrl,
        name: file.name,
        config: {
          x: window.innerWidth * 0.9 / 2,
          y: window.innerHeight * 0.8 / 2,
          width: defaultWidth,
          height: defaultHeight,
          rotation: 0,
          draggable: true,
        }
      };

      // 直接添加到畫布
      await imageStore.addCanvasImage(imageObject);
    }
  } catch (error) {
    console.error('Failed to upload image:', error);
    alert('圖片上傳失敗，請重試');
  }

  event.target.value = '';
};
</script>

<style scoped>
.image-uploader {
  margin: 20px 0;
}
</style>