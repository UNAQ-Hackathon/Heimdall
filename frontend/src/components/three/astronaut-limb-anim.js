/**
 * Connected-island limb classifier and rigid-body limb animator for `astronautaNormal.glb`.
 * Ensures every box/island in the low-poly astronaut mesh (arms, gloves, arm stripes,
 * legs, boots, leg stripes) moves as a 100% rigid piece around its joint pivot,
 * with zero stretched or torn triangles.
 */

export const LIMB_ROLE = {
  BODY: 0,
  LEFT_ARM: 1,
  RIGHT_ARM: 2,
  LEFT_LEG: 3,
  RIGHT_LEG: 4,
};

/**
 * Classifies each vertex of a BufferGeometry into a rigid limb role by finding
 * connected triangle islands (via shared vertex indices or shared 3D coordinates).
 */
export function buildLimbVertexRoles(geometry) {
  const posAttr = geometry?.attributes?.position;
  if (!posAttr) return new Uint8Array(0);

  const count = posAttr.count;
  const roles = new Uint8Array(count);
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    parent[i] = i;
  }

  const find = (x) => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    let curr = x;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  };

  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // 1. Union vertices that share identical 3D positions (within 0.1mm)
  const posMap = new Map();
  for (let i = 0; i < count; i += 1) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;
    const prev = posMap.get(key);
    if (prev !== undefined) {
      union(i, prev);
    } else {
      posMap.set(key, i);
    }
  }

  // 2. Union vertices connected by triangles
  const indexAttr = geometry.index;
  if (indexAttr) {
    const idxCount = indexAttr.count;
    for (let i = 0; i < idxCount; i += 3) {
      const i0 = indexAttr.getX(i);
      const i1 = indexAttr.getX(i + 1);
      const i2 = indexAttr.getX(i + 2);
      union(i0, i1);
      union(i1, i2);
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      if (i + 2 < count) {
        union(i, i + 1);
        union(i + 1, i + 2);
      }
    }
  }

  // 3. Compute bounding box of each connected island
  const islands = new Map();
  for (let i = 0; i < count; i += 1) {
    const r = find(i);
    let info = islands.get(r);
    if (!info) {
      info = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
        verts: [],
      };
      islands.set(r, info);
    }
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    info.verts.push(i);
    if (x < info.minX) info.minX = x;
    if (x > info.maxX) info.maxX = x;
    if (y < info.minY) info.minY = y;
    if (y > info.maxY) info.maxY = y;
    if (z < info.minZ) info.minZ = z;
    if (z > info.maxZ) info.maxZ = z;
  }

  // 4. Tag each island as a whole so no triangle is ever split
  for (const info of islands.values()) {
    const cx = (info.minX + info.maxX) * 0.5;
    const cy = (info.minY + info.maxY) * 0.5;
    const cz = (info.minZ + info.maxZ) * 0.5;
    const xSpan = info.maxX - info.minX;

    let role = LIMB_ROLE.BODY;
    if (cx > 0.14 && xSpan < 0.15 && cy >= 0.30 && cy <= 0.66) {
      role = LIMB_ROLE.LEFT_ARM;
    } else if (cx < -0.14 && xSpan < 0.15 && cy >= 0.30 && cy <= 0.66) {
      role = LIMB_ROLE.RIGHT_ARM;
    } else if (cx > 0.01 && xSpan < 0.15 && cy < 0.32 && cz > -0.10) {
      role = LIMB_ROLE.LEFT_LEG;
    } else if (cx < -0.01 && xSpan < 0.15 && cy < 0.32 && cz > -0.10) {
      role = LIMB_ROLE.RIGHT_LEG;
    }

    for (let k = 0; k < info.verts.length; k += 1) {
      roles[info.verts[k]] = role;
    }
  }

  return roles;
}

/**
 * Clones an astronaut Three.js scene and prepares per-mesh base positions, base normals,
 * and connected-island limb roles for glitch-free rigid limb animation.
 */
export function prepareAnimatableAstronaut(scene) {
  const root = scene.clone(true);
  const parts = [];

  root.traverse((node) => {
    if (node.isMesh && node.geometry?.attributes?.position) {
      node.geometry = node.geometry.clone();
      const basePos = Float32Array.from(node.geometry.attributes.position.array);
      const baseNorm = node.geometry.attributes.normal
        ? Float32Array.from(node.geometry.attributes.normal.array)
        : null;
      const roles = buildLimbVertexRoles(node.geometry);
      parts.push({ mesh: node, basePos, baseNorm, roles });
    }
  });

  return { root, parts };
}

/**
 * Applies walking leg/arm swing OR a friendly raised-arm greeting wave to the astronaut's
 * limb islands without stretching a single triangle.
 *
 * @param {Array} parts - Prepared mesh parts from `prepareAnimatableAstronaut`
 * @param {Object} params
 * @param {number} params.walkSwing - Fore/aft pitch angle (rad) for walking arms & legs
 * @param {number} params.waveRaise - [0..1] blend for raising the greeting arm
 * @param {number} params.waveOsc - Lateral wave oscillation angle (rad) at the raised shoulder
 */
export function applyAstronautPose(parts, { walkSwing = 0, waveRaise = 0, waveOsc = 0 }) {
  // Shoulder pivot for LEFT_ARM (viewer's right): center of upper sleeve top is (0.195, 0.64, 0)
  const shoulderX = 0.195;
  const shoulderY = 0.64;
  const shoulderZ = 0.0;

  // Pitch arm forward/up around X axis + roll outward/wave in XY plane around Z axis
  // Raising arm by ~2.35 rad (135 deg) around Z (with outward sign) puts the glove high above the shoulder!
  const rollZ = waveRaise * (2.35 + waveOsc);
  const pitchX = (1 - waveRaise) * walkSwing + waveRaise * 0.22;
  const cz = Math.cos(rollZ);
  const sz = Math.sin(rollZ);
  const cx = Math.cos(pitchX);
  const sx = Math.sin(pitchX);

  // Other arm & legs swing around X axis (fore/aft stride)
  const oppArmPitch = -walkSwing * 0.85;
  const cOpp = Math.cos(oppArmPitch);
  const sOpp = Math.sin(oppArmPitch);

  const leftLegPitch = -walkSwing;
  const cLL = Math.cos(leftLegPitch);
  const sLL = Math.sin(leftLegPitch);

  const rightLegPitch = walkSwing;
  const cRL = Math.cos(rightLegPitch);
  const sRL = Math.sin(rightLegPitch);

  const hipY = 0.36;

  for (let p = 0; p < parts.length; p += 1) {
    const { mesh, basePos, baseNorm, roles } = parts[p];
    const posAttr = mesh.geometry.attributes.position;
    const normAttr = mesh.geometry.attributes.normal;
    const arr = posAttr.array;
    const nArr = normAttr ? normAttr.array : null;

    for (let v = 0; v < roles.length; v += 1) {
      const role = roles[v];
      const idx = v * 3;
      const bx = basePos[idx];
      const by = basePos[idx + 1];
      const bz = basePos[idx + 2];

      if (role === LIMB_ROLE.LEFT_ARM) {
        const dx = bx - shoulderX;
        const dy = by - shoulderY;
        const dz = bz - shoulderZ;
        // 1. Rotate in XY plane around shoulder (raises arm outward & up, and waves left-right)
        const rx = dx * cz - dy * sz;
        const ry = dx * sz + dy * cz;
        const rz = dz;
        // 2. Slight forward pitch around X
        arr[idx] = shoulderX + rx;
        arr[idx + 1] = shoulderY + ry * cx - rz * sx;
        arr[idx + 2] = shoulderZ + ry * sx + rz * cx;

        if (nArr && baseNorm) {
          const nx = baseNorm[idx];
          const ny = baseNorm[idx + 1];
          const nz = baseNorm[idx + 2];
          const rnx = nx * cz - ny * sz;
          const rny = nx * sz + ny * cz;
          nArr[idx] = rnx;
          nArr[idx + 1] = rny * cx - nz * sx;
          nArr[idx + 2] = rny * sx + nz * cx;
        }
      } else if (role === LIMB_ROLE.RIGHT_ARM) {
        const dy = by - shoulderY;
        const dz = bz - shoulderZ;
        arr[idx] = bx;
        arr[idx + 1] = shoulderY + dy * cOpp - dz * sOpp;
        arr[idx + 2] = shoulderZ + dy * sOpp + dz * cOpp;
      } else if (role === LIMB_ROLE.LEFT_LEG) {
        const dy = by - hipY;
        const dz = bz;
        arr[idx] = bx;
        arr[idx + 1] = hipY + dy * cLL - dz * sLL;
        arr[idx + 2] = dy * sLL + dz * cLL;
      } else if (role === LIMB_ROLE.RIGHT_LEG) {
        const dy = by - hipY;
        const dz = bz;
        arr[idx] = bx;
        arr[idx + 1] = hipY + dy * cRL - dz * sRL;
        arr[idx + 2] = dy * sRL + dz * cRL;
      } else {
        arr[idx] = bx;
        arr[idx + 1] = by;
        arr[idx + 2] = bz;
      }
    }

    posAttr.needsUpdate = true;
    if (normAttr) normAttr.needsUpdate = true;
  }
}
