<template>
  <div class="canvas-wrapper" tabindex="0">
    <div class="canvas-container">
      <v-stage ref="stageRef" :config="stageConfig">
        <v-layer ref="layerRef" v-if="imageStore.imagesLoaded">
          <template 
						v-for="(image) in imageStore.loadedCanvasImages" 
						:key="image.src + '-' + image.originalIndex"
					>
            <v-image
              :config="{
                ...image.config,
                listening: true
              }"
              @dragstart="handleDragStart"
              @dragend="e => handleDragEnd(image.originalIndex, e)"
              @transformend="e => handleTransformEnd(image.originalIndex, e)"
              @click="e => handleImageClick(image.originalIndex, e)"
              @tap="e => handleImageClick(image.originalIndex, e)"
            />
          </template>
          <v-transformer
            v-if="selectedStickerIndex !== null"
            ref="transformerRef"
            :config="transformerConfig"
          />
        </v-layer>
      </v-stage>
      <div class="tw-absolute tw-top-4 tw-right-20">
        <label for="paste" @click="pasteZoneSelect" class="tw-cursor-pointer tw-ml-2"> 
          <q-icon name="content_paste" 
            class="tw-text-red-400 tw-bg-white tw-p-3 tw-shadow-xl tw-text-3xl tw-rounded tw-border-gray-200 tw-border-b-2 tw-border-r-2 tw-transform tw-transition tw-duration-300 tw-ease-in-out tw-rotate-0 hover:tw-bg-slate-100 hover:tw-rotate-12 active:tw-bg-slate-200 active:tw-rotate-0"
          />
        </label>
      </div>
			<div class="tw-absolute tw-top-4 tw-right-36">
        <label for="paste" @click="exportCanvasImage" class="tw-cursor-pointer tw-ml-2"> 
          <q-icon name="downloading"
            class="tw-text-red-400 tw-bg-white tw-p-3 tw-shadow-xl tw-text-3xl tw-rounded tw-border-gray-200 tw-border-b-2 tw-border-r-2 tw-transform tw-transition tw-duration-300 tw-ease-in-out tw-rotate-0 hover:tw-bg-slate-100 hover:tw-rotate-12 active:tw-bg-slate-200 active:tw-rotate-0"
          />
        </label>
      </div>
      <div class="tw-absolute tw-top-4 tw-left-4" v-if="selectedStickerIndex !== null">
        <q-btn icon="delete" @click="deleteSticker" push color="negative" class="tw-text-lg tw-w-12 tw-h-12"/>
      </div>
      <div v-if="showOverlay" 
				@paste="handleOverlayPaste" 
				@click.self="showOverlay = false" 
				class="overlay"
			>
        <textarea
          ref="overlayInput"
          class="overlay-input"
          readonly
          @focus="removeReadonly"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { useImageStore } from '../stores/useImageStore';

const imageStore = useImageStore();

// 定義 ref 變數
const stageRef = ref(null);
const layerRef = ref(null);
const transformerRef = ref(null);
const selectedStickerIndex = ref(null);
const overlayInput = ref(null);
const showOverlay = ref(false);
const isDragging = ref(false);

// 初始寬高依據視窗大小
const stageConfig = reactive({
  width: window.innerWidth * 0.9,
  height: window.innerHeight * 0.8,
  draggable: false,
});

// Transformer配置
const transformerConfig = reactive({
  anchorSize: 20,
  borderDash: [3, 3],
  borderStroke: '#0096FF',
  borderStrokeWidth: 1,
  anchorStroke: '#0096FF',
  anchorFill: '#fff',
  anchorStrokeWidth: 1,
  keepRatio: true,
  boundBoxFunc: (oldBox, newBox) => {
    const minSize = 10;
    if (newBox.width < minSize || newBox.height < minSize) {
      return oldBox;
    }
    return newBox;
  },
});

const handleDragStart = () => {
  isDragging.value = true;
};

const handleDragEnd = (index, event) => {
  if (!isDragging.value) return;
  
  const node = event.target;
  imageStore.updateImageConfig(index, {
    x: node.x(),
    y: node.y()
  });
  isDragging.value = false;
};

const handleTransformEnd = (index, event) => {
  const node = event.target;
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const newWidth = node.width() * scaleX;
  const newHeight = node.height() * scaleY;

  imageStore.updateImageConfig(index, {
    width: newWidth,
    height: newHeight,
    rotation: node.rotation(),
    scaleX: 1,
    scaleY: 1,
    x: node.x(),
    y: node.y()
  });

  node.scaleX(1);
  node.scaleY(1);

  if (transformerRef.value) {
    transformerRef.value.getNode().forceUpdate();
  }
};

const setupStageListeners = () => {
  const stage = stageRef.value.getNode();
  
  stage.on('click tap', (e) => {
    // 如果點擊到舞台本身，取消選擇
    if (e.target === stage) {
      selectedStickerIndex.value = null;
      if (transformerRef.value) {
        transformerRef.value.getNode().nodes([]);
        layerRef.value.getNode().batchDraw();
      }
      return;
    }
    // 如果點擊到的是圖片
    if (e.target.getClassName() === 'Image') {
      const actualIndex = imageStore.loadedCanvasImages.findIndex(
        img => img.config.image === e.target.getImage()
      );
      
      if (actualIndex !== -1) {
        selectSticker(actualIndex);
      }
    }
  });
};

const handleImageClick = (index, event) => {
  event.cancelBubble = true; 
  selectSticker(index);
};

// 選中 sticker 更新 Transformer 的節點
const selectSticker = async (index) => {
  selectedStickerIndex.value = index;
  imageStore.moveToTop(index);
  
  await nextTick();
  
  const stage = stageRef.value.getNode();
  const selectedImage = stage.find('Image')[imageStore.loadedCanvasImages.findIndex(img => img.originalIndex === index)];
  
  if (selectedImage && transformerRef.value) {
    const transformer = transformerRef.value.getNode();
    transformer.nodes([selectedImage]);
    layerRef.value.getNode().batchDraw();
  }
};

// 處理圖片貼上
const textToImage = (text) => {
  return new Promise((resolve) => {
    // 獲取設備像素比
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 基礎設置
    const fontSize = 48; // 更大的基礎字體大小
    const padding = 40;
    const backgroundColor = 'rgba(0, 0, 0, 0)';
    const textColor = 'black';
    
    // 配置字體
    const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    // 計算文字尺寸
    const textMetrics = ctx.measureText(text);
    const textHeight = fontSize;
    
    // 設置 canvas 尺寸
    canvas.width = (textMetrics.width + padding * 2) * dpr;
    canvas.height = (textHeight + padding * 2) * dpr;
    
    // 清除並設置背景
    ctx.scale(dpr, dpr);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 配置文字渲染
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    // 繪製文字
    const centerX = (textMetrics.width + padding * 2) / 2;
    const centerY = (textHeight + padding * 2) / 2;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.strokeText(text, centerX, centerY);
    
    ctx.fillText(text, centerX, centerY);
    
    // 轉換為高品質 PNG
    resolve(canvas.toDataURL('image/png', 1.0));
  });
};

const handleImagePaste = async (file) => {
  if (file.size > 5 * 1024 * 1024) {
    alert('請使用小於 5MB 的圖片');
    return;
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const imageObject = {
      src: base64,
      config: {
        x: window.innerWidth * 0.9 / 2,
        y: window.innerHeight * 0.8 / 2,
        width: 200,
        draggable: true,
      }
    };

    await imageStore.addCanvasImage(imageObject);
    showOverlay.value = false;
  } catch (error) {
    console.error('圖片處理失敗:', error);
    alert('圖片處理失敗，請重試');
  }
};

// 處理文字貼上的輔助函數
const handleTextPaste = async (text) => {
  if (!text.trim()) return;
  
  try {
    const imageUrl = await textToImage(text.trim());
    
    const imageObject = {
      src: imageUrl,
      config: {
        x: window.innerWidth * 0.9 / 2,
        y: window.innerHeight * 0.8 / 2,
        width: 200,
        draggable: true,
      }
    };

    await imageStore.addCanvasImage(imageObject);
    showOverlay.value = false;
  } catch (error) {
    console.error('文字處理失敗:', error);
    alert('文字處理失敗，請重試');
  }
};


// 貼上處理函數
const handleOverlayPaste = async (e) => {
  e.preventDefault();
  
  if (!e.clipboardData || !e.clipboardData.items) {
    console.warn('No clipboard data available');
    return;
  }

  const items = Array.from(e.clipboardData.items);

  try {
    for (const item of items) {
      // 處理圖片
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          await handleImagePaste(file);
          return;
        }
      }
      
      // 處理文字
      else if (item.type === 'text/plain') {
        const text = await new Promise(resolve => item.getAsString(resolve));
        await handleTextPaste(text);
        return;
      }
    }
  } catch (error) {
    console.error('貼上處理失敗:', error);
    alert('貼上處理失敗，請重試');
  }
};

// 刪除 sticker
const deleteSticker = () => {
  if (selectedStickerIndex.value !== null) {
    imageStore.removeFromCanvas(selectedStickerIndex.value);
    selectedStickerIndex.value = null;
    if (transformerRef.value) {
      transformerRef.value.getNode().nodes([]);
      transformerRef.value.getNode().getLayer().batchDraw();
    }
  }
};

const pasteZoneSelect = () => {
  showOverlay.value = true;
  nextTick(() => {
    overlayInput.value.focus();
  });
};

const removeReadonly = () => {
  overlayInput.value.removeAttribute('readonly');
};

const exportCanvasImage = () => {
  const dataURL = stageRef.value.getNode().toDataURL({
    mimeType: 'image/png',
    quality: 1.0,
    pixelRatio: 2,
  });
  
  const link = document.createElement('a');
  link.download = 'canvas.png';
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 設定 Stage 的點擊與 resize 監聽
onMounted(async () => {
  await imageStore.initializeImages();
  setupStageListeners();

  // 防抖處理 resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      stageConfig.width = window.innerWidth * 0.9;
      stageConfig.height = window.innerHeight * 0.7;
      layerRef.value?.getNode().batchDraw();
    }, 100);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  justify-content: center;
}

.canvas-container {
  width: 100%;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-input {
  width: 90%;
  height: 10%;
  opacity: 0.5;
	text-align: center;
	background: transparent;
	font-size: 30px;
  border: none;
  outline: none;
  resize: none;
}

.overlay-tip {
  position: absolute;
  top: 10%;
  color: #fff;
  font-size: 16px;
  pointer-events: none;
}
</style>
