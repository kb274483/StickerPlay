import { defineBoot } from '#q-app/wrappers'
import VueKonva from 'vue-konva';

export default defineBoot(({ app }) => {
  app.use(VueKonva);
});
