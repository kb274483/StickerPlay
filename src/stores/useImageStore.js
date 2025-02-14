import { defineStore } from 'pinia';
import localforage from 'localforage';

// 配置 localforage
localforage.config({
  driver: [
    localforage.INDEXEDDB,
    localforage.WEBSQL,
    localforage.LOCALSTORAGE
  ],
  name: 'image-store',
  version: 1.0
});

const imageChunkStore = localforage.createInstance({
  name: "image-chunks"
});

export const useImageStore = defineStore('image', {
  state: () => ({
    imageList: [],
    canvasImages: [],
    imagesLoaded: false,
    zIndexMap: {},
    chunkSize: 500 * 1024,
    totalStorageLimit: 100 * 1024 * 1024, 
    singleFileLimit: 10 * 1024 * 1024,
  }),

  actions: {
    async convertImageToBase64(imageData) {
      if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        return imageData;
      }

      if (imageData instanceof Blob || imageData instanceof File) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(imageData);
        });
      }

      throw new Error('Unsupported image data format');
    },

    async saveImageChunks(imageData) {
      try {
        let currentPosition = 0;
        const timestamp = Date.now();
        const chunkIds = [];

        while (currentPosition < imageData.length) {
          const chunk = imageData.slice(currentPosition, currentPosition + this.chunkSize);
          const chunkId = `chunk_${timestamp}_${chunkIds.length}`;
          await imageChunkStore.setItem(chunkId, chunk);
          chunkIds.push(chunkId);
          currentPosition += this.chunkSize;
        }

        return chunkIds;
      } catch (error) {
        console.error('Failed to save image chunks:', error);
        throw error;
      }
    },

    async reconstructImage(chunkIds) {
      try {
        let reconstructedData = '';
        for (const id of chunkIds) {
          const chunk = await imageChunkStore.getItem(id);
          if (chunk) {
            reconstructedData += chunk;
          }
        }
        return reconstructedData;
      } catch (error) {
        console.error('Failed to reconstruct image:', error);
        throw error;
      }
    },

    async addImage(image) {
      try {
        if (!this.validateImageSize(image.src)) {
          throw new Error(`圖片大小超過限制 ${this.singleFileLimit / (1024 * 1024)}MB`);
        }

        // 檢查總空間
        const currentTotal = await this.calculateTotalStorage();
        const newImageSize = this.calculateFileSize(image.src);

        // 清理舊檔案
        if (currentTotal + newImageSize > this.totalStorageLimit) {
          const requiredSpace = (currentTotal + newImageSize) - this.totalStorageLimit;
          await this.cleanupOldFiles(requiredSpace);
        }

        const imageId = `img_${Date.now()}`;
        let imageData = image.src;
        
        // 建立安全的設定物件
        const safeConfig = {
          width: Number(image.config?.width) || 200,
          height: Number(image.config?.height) || 200,
          x: Number(image.config?.x) || 0,
          y: Number(image.config?.y) || 0,
          rotation: Number(image.config?.rotation) || 0,
          scaleX: Number(image.config?.scaleX) || 1,
          scaleY: Number(image.config?.scaleY) || 1,
          draggable: true
        };

        // metadata
        const metadata = {
          id: imageId,
          src: imageData,
          timestamp: Date.now(),
          config: safeConfig,
          name: image.name || 'Untitled'
        };

        this.imageList.push(metadata);
        await localforage.setItem('images_metadata', JSON.stringify(this.imageList));

        return imageId;
      } catch (error) {
        console.error('Failed to add image:', error);
        throw error;
      }
    },

    async removeFromCanvas(index) {
      try {
        if (index >= 0 && index < this.canvasImages.length) {
          this.canvasImages.splice(index, 1);
          delete this.zIndexMap[index];
          this.reorderZIndices();
          await this.persistCanvasState();
        }
      } catch (error) {
        console.error('Failed to remove from canvas:', error);
        throw error;
      }
    },

    async removeFromImageList(imageId) {
      try {
        const index = this.imageList.findIndex(img => img.id === imageId);
        if (index !== -1) {
          this.imageList.splice(index, 1);
          await localforage.setItem('images_metadata', JSON.stringify(this.imageList));
        }
      } catch (error) {
        console.error('Failed to remove from image list:', error);
        throw error;
      }
    },

    async removeImageCompletely(imageId) {
      try {
        await this.removeFromImageList(imageId);
        
        const canvasIndices = this.canvasImages
          .map((img, index) => img.id === imageId ? index : -1)
          .filter(index => index !== -1)
          .reverse();
        
        for (const index of canvasIndices) {
          await this.removeFromCanvas(index);
        }
      } catch (error) {
        console.error('Failed to remove image completely:', error);
        throw error;
      }
    },

    calculateFileSize(src) {
      if (typeof src === 'string' && src.includes(',')) {
        const base64Length = src.length - (src.indexOf(',') + 1);
        return (base64Length * 3) / 4;
      }
      if (src instanceof Blob || src instanceof File) {
        return src.size;
      }
      return 0;
    },

    // 計算總存儲空間
    async calculateTotalStorage() {
      let totalSize = 0;
      for (const image of this.imageList) {
        if (image.src) {
          totalSize += this.calculateFileSize(image.src);
        }
      }
      return totalSize;
    },

    // 清理舊檔案
    async cleanupOldFiles(requiredSpace) {
      try {
        const sortedImages = [...this.imageList].sort((a, b) => a.timestamp - b.timestamp);
        let freedSpace = 0;

        while (freedSpace < requiredSpace && sortedImages.length > 0) {
          const oldestImage = sortedImages.shift();
          if (oldestImage) {
            const fileSize = this.calculateFileSize(oldestImage.src);
            await this.removeImageCompletely(oldestImage.id);
            freedSpace += fileSize;
          }
        }

        return freedSpace;
      } catch (error) {
        console.error('Failed to cleanup old files:', error);
        throw error;
      }
    },

    validateImageSize(src) {
      const size = this.calculateFileSize(src);
      return size <= this.singleFileLimit;
    },

    async loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(img);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Image load failed'));
        };
        
        img.src = src;
      });
    },

    async addCanvasImage(imageData) {
      try {
        if (!this.validateImageSize(imageData.src)) {
          throw new Error('Image size exceeds limit');
        }

        const existingImage = this.imageList.find(img => img.src === imageData.src);
        let imageId;

        if (existingImage) {
          imageId = existingImage.id;
        } else {
          imageId = await this.addImage({
            src: imageData.src,
            config: imageData.config
          });
        }

        const img = await this.loadImage(imageData.src);
        
        const newImage = {
          id: imageId,
          config: {
            ...imageData.config,
            image: img,
            width: imageData.config?.width || 200,
            height: imageData.config?.height || (img.height * (200 / img.width)),
            x: imageData.config?.x || window.innerWidth * 0.9 / 2,
            y: imageData.config?.y || window.innerHeight * 0.8 / 2,
            rotation: imageData.config?.rotation || 0,
            scaleX: imageData.config?.scaleX || 1,
            scaleY: imageData.config?.scaleY || 1,
            draggable: true
          }
        };

        const newIndex = this.canvasImages.length;
        this.zIndexMap[newIndex] = Object.keys(this.zIndexMap).length;
        this.canvasImages.push(newImage);

        await this.persistCanvasState();

        return newImage;
      } catch (error) {
        console.error('Failed to add canvas image:', error);
        throw error;
      }
    },

    async persistCanvasState() {
      try {
        const canvasState = {
          canvasImages: this.canvasImages.map(img => ({
            id: img.id,
            config: {
              x: Number(img.config.x) || 0,
              y: Number(img.config.y) || 0,
              width: Number(img.config.width) || 200,
              height: Number(img.config.height) || 200,
              rotation: Number(img.config.rotation) || 0,
              scaleX: Number(img.config.scaleX) || 1,
              scaleY: Number(img.config.scaleY) || 1,
              draggable: true
            }
          })),
          zIndexMap: this.zIndexMap
        };

        await localforage.setItem('canvas_state', JSON.stringify(canvasState));
      } catch (error) {
        console.error('Failed to persist canvas state:', error);
        throw error;
      }
    },

    async initializeImages() {
      try {
        this.imagesLoaded = false;
        
        const metadataStr = await localforage.getItem('images_metadata');
        if (metadataStr) {
          this.imageList = typeof metadataStr === 'string' 
            ? JSON.parse(metadataStr) 
            : metadataStr;
        }
        
        const canvasStateStr = await localforage.getItem('canvas_state');
        if (canvasStateStr) {
          const canvasState = typeof canvasStateStr === 'string'
            ? JSON.parse(canvasStateStr)
            : canvasStateStr;
          
          const loadedImages = await Promise.all(
            canvasState.canvasImages.map(async (imgData) => {
              const metadata = this.imageList.find(img => img.id === imgData.id);
              if (!metadata) return null;
              
              try {
                const img = await this.loadImage(metadata.src);
                return {
                  id: imgData.id,
                  config: {
                    ...imgData.config,
                    image: img,
                  }
                };
              } catch (error) {
                console.error(`Failed to load image ${imgData.id}:`, error);
                return null;
              }
            })
          );
          
          this.canvasImages = loadedImages.filter(Boolean);
          this.zIndexMap = canvasState.zIndexMap;
        }
        
        this.imagesLoaded = true;
      } catch (error) {
        console.error('Failed to initialize images:', error);
        this.imagesLoaded = true;
        throw error;
      }
    },

    moveToTop(index) {
      const maxZIndex = Math.max(...Object.values(this.zIndexMap), 0);
      this.zIndexMap[index] = maxZIndex + 1;
      this.persistCanvasState();
    },

    reorderZIndices() {
      const sortedIndices = Object.keys(this.zIndexMap)
        .sort((a, b) => this.zIndexMap[a] - this.zIndexMap[b]);
      
      sortedIndices.forEach((index, newIndex) => {
        this.zIndexMap[index] = newIndex;
      });
    },

    updateImageConfig(index, newConfig) {
      if (this.canvasImages[index]) {
        const currentConfig = this.canvasImages[index].config;
        this.canvasImages[index].config = {
          ...currentConfig,
          ...newConfig,
          image: currentConfig.image
        };
        this.persistCanvasState();
      }
    },

    cleanConfig(config) {
      return {
        x: Number(config.x) || 0,
        y: Number(config.y) || 0,
        width: Number(config.width) || 200,
        height: Number(config.height) || 200,
        rotation: Number(config.rotation) || 0,
        scaleX: Number(config.scaleX) || 1,
        scaleY: Number(config.scaleY) || 1,
        draggable: true
      };
    },
  },

  getters: {
    images() {
      return this.imageList;
    },
    loadedCanvasImages: (state) => {
      return state.canvasImages
        .filter(img => img.config?.image instanceof HTMLImageElement)
        .map((img, index) => ({
          ...img,
          originalIndex: index,
          zIndex: state.zIndexMap[index] || 0,
          src: img.config.image.src
        }))
        .sort((a, b) => a.zIndex - b.zIndex);
    }
  }
});