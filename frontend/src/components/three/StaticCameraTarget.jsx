import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Locks a non-interactive preview camera to its framing target (used on mobile
 * viewports where OrbitControls are disabled so panel scrolling works smoothly).
 */
export default function StaticCameraTarget({ position, target }) {
  const { camera, invalidate } = useThree();

  useLayoutEffect(() => {
    if (position) {
      camera.position.set(position[0], position[1], position[2]);
    }
    camera.lookAt(target[0], target[1], target[2]);
    invalidate();
  }, [camera, invalidate, position, target]);

  return null;
}
