import * as THREE from "three";

export const getScreenPlaneSize = (node: THREE.Object3D, quat: THREE.Quaternion) => {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize();
  const worldVertex = new THREE.Vector3();

  let minRight = Infinity;
  let maxRight = -Infinity;
  let minUp = Infinity;
  let maxUp = -Infinity;

  node.updateWorldMatrix(true, true);
  node.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const positionAttr = obj.geometry.getAttribute("position");
    if (!positionAttr || positionAttr.itemSize < 3) return;

    const stride = Math.max(1, Math.floor(positionAttr.count / 3000));
    for (let i = 0; i < positionAttr.count; i += stride) {
      worldVertex.fromBufferAttribute(positionAttr, i).applyMatrix4(obj.matrixWorld);
      const r = worldVertex.dot(right);
      const u = worldVertex.dot(up);
      if (r < minRight) minRight = r;
      if (r > maxRight) maxRight = r;
      if (u < minUp) minUp = u;
      if (u > maxUp) maxUp = u;
    }
  });

  if (Number.isFinite(minRight) && Number.isFinite(minUp)) {
    return {
      width: Math.max(maxRight - minRight, 0.2),
      height: Math.max(maxUp - minUp, 0.2),
    };
  }

  const fallbackSize = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
  const dims = [fallbackSize.x, fallbackSize.y, fallbackSize.z].sort((a, b) => b - a);
  return {
    width: Math.max(dims[0], 0.2),
    height: Math.max(dims[1], 0.2),
  };
};
