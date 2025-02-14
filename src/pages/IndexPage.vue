<template>
  <q-page class="tw-flex tw-w-full tw-items-center tw-p-4">
    <div class="w-full max-w-md">
      <ImageUploader />
    </div>

    <div class="w-full max-w-md">
      <ImagesList />
    </div>

    <div class="w-full max-w-4xl">
      <StickerEditor />
    </div>
  </q-page>
</template>

<script setup>
import ImageUploader from '../components/ImageUploader.vue';
import ImagesList from '../components/ImagesList.vue';
import StickerEditor from '../components/StickerEditor.vue';
</script>
