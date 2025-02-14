<template>
  <div :class="['uploaded-images', { expanded }]">
    <div class="toggle-button tw-z-50" @click="toggleExpand">
      <q-btn
        :icon="expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_up'"
        color="primary"
        round
      />
    </div>

    <div v-if="expanded" class="tw-w-full tw-h-full">
      <q-carousel
        v-model="slide"
        transition-prev="scale"
        transition-next="scale"
        swipeable
        animated
        control-color="blue"
        navigation
        padding
        height="30vh"
        class="tw-bg-gray-100 tw-mt-4"
      >
        <q-carousel-slide
          v-for="(slideImages, index) in groupedImages"
          :key="index"
          :name="index"
          class="column no-wrap"
        >
          <div class="row fit justify-center items-center q-gutter-xs q-col-gutter no-wrap tw-relative">
            <template v-for="image in slideImages" :key="image.id">
              <div class="tw-relative tw-w-32">
                <q-img
                  @click="addToMainCanvas(image)"
                  :src="image.src"
                  :alt="image.name"
                  class="tw-w-full tw-h-full tw-object-contain tw-rounded-lg tw-cursor-pointer hover:tw-opacity-80"
                />
              </div>
							<div class="tw-absolute -tw-top-2 tw-right-2">
								<q-btn
									icon="delete"
									color="negative"
									round
									dense
									flat
									@click.stop="removeImage(image)"
								/>
							</div>
            </template>
          </div>
        </q-carousel-slide>
      </q-carousel>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useImageStore } from '../stores/useImageStore';
import { useQuasar } from 'quasar';
import { storeToRefs } from 'pinia';

const slide = ref(0);
const imageStore = useImageStore();
const expanded = ref(false);
const $q = useQuasar();

const toggleExpand = () => {
  expanded.value = !expanded.value;
};

const { imageList } = storeToRefs(imageStore);

const imagesPerSlide = computed(() => {
  if ($q.screen.xs) return 1;
  if ($q.screen.sm) return 2;
  if ($q.screen.md) return 3;
  return 4;
});

const groupedImages = computed(() => {
  const groups = [];
  const imgArray = imageList.value || [];
  for (let i = 0; i < imgArray.length; i += imagesPerSlide.value) {
    groups.push(imgArray.slice(i, i + imagesPerSlide.value));
  }
  return groups;
});

const removeImage = async (image) => {
  try {
    await imageStore.removeFromImageList(image.id);
  } catch (error) {
    console.error('Failed to remove image:', error);
  }
};

const addToMainCanvas = async (image) => {
  try {
    const newImageObject = {
      src: image.src,
      config: {
        ...image.config,
        x: window.innerWidth * 0.9 / 2,
        y: window.innerHeight * 0.8 / 2,
      }
    };

    await imageStore.addCanvasImage(newImageObject);
  } catch (error) {
    console.error('Failed to add image to canvas:', error);
  }
};
</script>

<style scoped>
.uploaded-images {
  @apply tw-fixed tw-bottom-0 tw-left-0 tw-w-full tw-bg-gray-100 tw-transition-all tw-duration-300 tw-flex tw-flex-col tw-items-center tw-shadow-md tw-z-50;
}

.uploaded-images.expanded {
  @apply tw-h-[30vh];
}

.uploaded-images:not(.expanded) {
  @apply tw-h-8;
}

.toggle-button {
  @apply tw-absolute -tw-top-5 tw-bg-gray-100 tw-rounded-full tw-shadow-lg;
}
</style>