import { useLayoutEffect, useRef } from 'react';
import { Color, Object3D } from 'three';

const STAR_COUNT = 420;
const PALETTE = ['#8f9db7', '#c2baa6', '#6b80a2'];
const variation = (index) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export default function LowPolySpace() {
  const stars = useRef(null);

  useLayoutEffect(() => {
    const transform = new Object3D();
    const color = new Color();
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const y = 1 - 2 * (index + 0.5) / STAR_COUNT;
      const radius = 35 + variation(index) * 10;
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const horizontal = Math.sqrt(1 - y * y);
      const size = 0.06 + variation(index + STAR_COUNT) * 0.07;
      transform.position.set(Math.cos(angle) * horizontal * radius, y * radius, Math.sin(angle) * horizontal * radius);
      transform.rotation.set(0, angle, variation(index + 2 * STAR_COUNT) * Math.PI);
      transform.scale.set(size, size * 1.4, size * 0.7);
      transform.updateMatrix();
      stars.current.setMatrixAt(index, transform.matrix);
      stars.current.setColorAt(index, color.set(PALETTE[index % PALETTE.length]));
    }
    stars.current.instanceMatrix.needsUpdate = true;
    stars.current.instanceColor.needsUpdate = true;
    stars.current.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh ref={stars} args={[undefined, undefined, STAR_COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
