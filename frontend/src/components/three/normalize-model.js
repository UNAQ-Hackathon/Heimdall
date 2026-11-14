import { Box3, Group, Vector3 } from 'three';

export function normalizeModel(scene) {
  const centered = new Group();
  centered.add(scene.clone(true));
  const box = new Box3().setFromObject(centered);
  const size = box.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0) {
    throw new Error('The model has no visible geometry');
  }
  centered.position.sub(box.getCenter(new Vector3()));
  const root = new Group();
  root.add(centered);
  root.scale.setScalar(2 / extent);
  return root;
}
