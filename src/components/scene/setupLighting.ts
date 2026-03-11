import * as THREE from "three";

type SetupLightingResult = {
  keyTarget: THREE.Object3D;
  monitorTarget: THREE.Object3D;
  ground: THREE.Mesh;
  shadowCasters: Array<THREE.Light & { castShadow: boolean }>;
};

export const setupLighting = (scene: THREE.Scene): SetupLightingResult => {
  scene.add(new THREE.HemisphereLight(0xd4deea, 0x1c232d, 0.34));
  scene.add(new THREE.AmbientLight(0xffffff, 0.34));

  const keyTarget = new THREE.Object3D();
  scene.add(keyTarget);
  const heroLight = new THREE.SpotLight(0xfff3d8, 10.2, 170, Math.PI * 0.15, 0.38, 1.1);
  heroLight.position.set(0.3, 6.9, 6.6);
  heroLight.castShadow = true;
  heroLight.shadow.mapSize.set(1024, 1024);
  heroLight.shadow.bias = -0.00025;
  heroLight.shadow.normalBias = 0.015;
  heroLight.shadow.radius = 6;
  heroLight.shadow.camera.near = 0.1;
  heroLight.shadow.camera.far = 80;
  heroLight.target = keyTarget;
  scene.add(heroLight);

  const monitorTarget = new THREE.Object3D();
  scene.add(monitorTarget);
  const monitorDirectLight = new THREE.SpotLight(0xf7fbff, 12.6, 95, Math.PI * 0.12, 0.28, 1.28);
  monitorDirectLight.position.set(0.0, 5.2, 5.6);
  monitorDirectLight.castShadow = false;
  monitorDirectLight.shadow.mapSize.set(512, 512);
  monitorDirectLight.shadow.bias = -0.0002;
  monitorDirectLight.shadow.normalBias = 0.012;
  monitorDirectLight.shadow.radius = 2;
  monitorDirectLight.shadow.camera.near = 0.1;
  monitorDirectLight.shadow.camera.far = 60;
  monitorDirectLight.target = monitorTarget;
  scene.add(monitorDirectLight);

  const monitorBoost = new THREE.PointLight(0xfff0ce, 2.2, 26, 1.9);
  monitorBoost.position.set(0.08, 2.15, 4.15);
  scene.add(monitorBoost);

  const coolFill = new THREE.PointLight(0x86b9ff, 0.35, 32, 1.8);
  coolFill.position.set(-5.2, 3.1, -1.2);
  scene.add(coolFill);

  const officeStripLeft = new THREE.SpotLight(0xeef6ff, 4.8, 200, Math.PI * 0.18, 0.55, 1.35);
  officeStripLeft.position.set(-4.8, 9.5, 5.3);
  officeStripLeft.castShadow = false;
  officeStripLeft.shadow.mapSize.set(512, 512);
  officeStripLeft.shadow.bias = -0.00022;
  officeStripLeft.shadow.normalBias = 0.02;
  officeStripLeft.shadow.radius = 2;
  officeStripLeft.target = keyTarget;
  scene.add(officeStripLeft);

  const officeStripRight = new THREE.SpotLight(0xeef6ff, 4.4, 200, Math.PI * 0.18, 0.55, 1.35);
  officeStripRight.position.set(4.8, 9.3, 4.8);
  officeStripRight.castShadow = false;
  officeStripRight.shadow.mapSize.set(512, 512);
  officeStripRight.shadow.bias = -0.00022;
  officeStripRight.shadow.normalBias = 0.02;
  officeStripRight.shadow.radius = 2;
  officeStripRight.target = keyTarget;
  scene.add(officeStripRight);

  const rimLight = new THREE.DirectionalLight(0xa8c8ff, 0.2);
  rimLight.position.set(6.5, 4.2, -7);
  scene.add(rimLight);

  const topFill = new THREE.DirectionalLight(0xffffff, 0.22);
  topFill.position.set(0, 8.5, 1.2);
  scene.add(topFill);

  const deskBounce = new THREE.PointLight(0xfff2dc, 0.45, 24, 2);
  deskBounce.position.set(0, 0.7, 4.1);
  scene.add(deskBounce);

  const screenGlow = new THREE.PointLight(0x39ff6d, 0.18, 12, 2.2);
  screenGlow.position.set(0, 2.9, 4.6);
  scene.add(screenGlow);

  const globalFrontFill = new THREE.DirectionalLight(0xffffff, 0.5);
  globalFrontFill.position.set(0, 4.1, 8.2);
  scene.add(globalFrontFill);

  const globalSideFill = new THREE.DirectionalLight(0xd7e7ff, 0.38);
  globalSideFill.position.set(-8, 4.2, 2);
  scene.add(globalSideFill);

  const globalBackFill = new THREE.DirectionalLight(0xb7cdfa, 0.22);
  globalBackFill.position.set(7, 5.2, -7.5);
  scene.add(globalBackFill);

  const globalUnderBounce = new THREE.PointLight(0xfff3df, 0.52, 45, 2);
  globalUnderBounce.position.set(0, 0.35, 1.5);
  scene.add(globalUnderBounce);

  const globalWideFill = new THREE.PointLight(0xffffff, 0.38, 60, 1.8);
  globalWideFill.position.set(0, 4.4, 2.4);
  scene.add(globalWideFill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.ShadowMaterial({ opacity: 0.38 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5;
  ground.receiveShadow = true;
  scene.add(ground);

  return { keyTarget, monitorTarget, ground, shadowCasters: [heroLight] };
};
