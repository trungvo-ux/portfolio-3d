import * as THREE from "three";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

type ScreenSize = { width: number; height: number };
type GetScreenPlaneSize = (node: THREE.Object3D, quat: THREE.Quaternion) => ScreenSize;

type CreateMonitorScreenArgs = {
  scene: THREE.Scene;
  cssScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  iframeScreenNode: THREE.Object3D;
  targetNode: THREE.Object3D | null;
  backScreenNode: THREE.Object3D | null;
  getScreenPlaneSize: GetScreenPlaneSize;
  iframeSrc: string;
  enableEffects?: boolean;
};

type CreateMonitorScreenResult = {
  iframe: HTMLIFrameElement;
  dispose: () => void;
};

const createOverlayLayer = (
  imageUrl: string,
  opacity: string,
  blendMode: string,
  zIndex: string,
  transform = "none"
) => {
  const layer = document.createElement("div");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.backgroundImage = `url('${imageUrl}')`;
  layer.style.backgroundRepeat = "no-repeat";
  layer.style.backgroundPosition = "center";
  layer.style.backgroundSize = "cover";
  layer.style.opacity = opacity;
  layer.style.mixBlendMode = blendMode;
  layer.style.transform = transform;
  layer.style.zIndex = zIndex;
  return layer;
};

export const createMonitorScreen = ({
  scene,
  cssScene,
  camera,
  iframeScreenNode,
  targetNode,
  backScreenNode,
  getScreenPlaneSize,
  iframeSrc,
  enableEffects = true,
}: CreateMonitorScreenArgs): CreateMonitorScreenResult => {
  const screenBox = new THREE.Box3().setFromObject(iframeScreenNode);
  const screenCenter = screenBox.getCenter(new THREE.Vector3());
  const screenQuaternion = iframeScreenNode.getWorldQuaternion(new THREE.Quaternion());
  const { width: screenWidth, height: screenHeight } = getScreenPlaneSize(
    iframeScreenNode,
    screenQuaternion
  );

  let iframeDepthOffset = -0.01;
  if (targetNode && backScreenNode) {
    const frontCenter = new THREE.Box3().setFromObject(targetNode).getCenter(new THREE.Vector3());
    const towardFront = frontCenter.clone().sub(screenCenter);
    const screenForward = new THREE.Vector3(0, 0, 1).applyQuaternion(screenQuaternion).normalize();
    const sign = Math.sign(screenForward.dot(towardFront)) || 1;
    iframeDepthOffset = towardFront.length() * 0.5 * sign;
  }

  // Ensure the CSS3D plane faces the current camera; some GLBs have screen normals flipped.
  const screenForward = new THREE.Vector3(0, 0, 1).applyQuaternion(screenQuaternion).normalize();
  const toCamera = camera.position.clone().sub(screenCenter).normalize();
  if (screenForward.dot(toCamera) < 0) {
    screenQuaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    );
    iframeDepthOffset *= -1;
  }
  const mobileForwardNudge = enableEffects ? 0 : 0.12;
  const finalDepthOffset = iframeDepthOffset + mobileForwardNudge;

  const iframeContentWidth = 1280;
  const iframeContentHeight = 1080;
  const iframePaddingX = 40;
  const iframePaddingTop = 40;
  const iframePaddingBottom = 60;
  const screenInset = 0.98;


  const translatedCenter = screenCenter
    .clone()
    .add(new THREE.Vector3(0, 0, finalDepthOffset).applyQuaternion(screenQuaternion));
  const perspectiveCompensation =
    camera.position.distanceTo(translatedCenter) / camera.position.distanceTo(screenCenter);
  const targetPixelWidth = screenWidth * 1000 * perspectiveCompensation * screenInset;
  const targetPixelHeight = screenHeight * 1000 * perspectiveCompensation * screenInset;

  const iframeShell = document.createElement("div");
  iframeShell.style.width = `${iframeContentWidth}px`;
  iframeShell.style.height = `${iframeContentHeight}px`;
  iframeShell.style.position = "relative";
  iframeShell.style.overflow = "hidden";
  iframeShell.style.boxSizing = "border-box";
  iframeShell.style.background = "#000000";
  iframeShell.style.borderRadius = "12px";
  iframeShell.style.pointerEvents = "auto";

  const iframeViewport = document.createElement("div");
  iframeViewport.style.position = "absolute";
  iframeViewport.style.left = `${iframePaddingX}px`;
  iframeViewport.style.right = `${iframePaddingX}px`;
  iframeViewport.style.top = `${iframePaddingTop}px`;
  iframeViewport.style.bottom = `${iframePaddingBottom}px`;
  iframeViewport.style.overflow = "hidden";
  iframeViewport.style.background = "#000000";
  iframeViewport.style.zIndex = "1";
  iframeViewport.style.pointerEvents = "auto";
  iframeShell.appendChild(iframeViewport);

  const iframe = document.createElement("iframe");
  iframe.src = iframeSrc;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "#000000";
  iframe.style.pointerEvents = "auto";
  if (enableEffects) {
    iframe.className = "crt-jitter";
  }
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("title", "Back Screen Content");
  iframeViewport.appendChild(iframe);

  const shadowLayer = createOverlayLayer(
    "/textures/monitor/layers/compressed/shadow-compressed.png",
    "0.88",
    "normal",
    "2"
  );
  const smudgeLayer = createOverlayLayer(
    "/textures/monitor/layers/compressed/smudges.jpg",
    "0.2",
    "screen",
    "3"
  );
  const dustLayer = createOverlayLayer(
    "/textures/monitor/layers/png/dust.png",
    "0.16",
    "soft-light",
    "4",
    "scale(1.015)"
  );

  const scanlineLayer = document.createElement("div");
  scanlineLayer.style.position = "absolute";
  scanlineLayer.style.inset = "0";
  scanlineLayer.style.pointerEvents = "none";
  scanlineLayer.style.zIndex = "5";
  scanlineLayer.style.opacity = "0.2";
  scanlineLayer.style.mixBlendMode = "screen";
  scanlineLayer.style.backgroundImage =
    "repeating-linear-gradient(to bottom, rgba(115,255,165,0.12) 0px, rgba(115,255,165,0.12) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)";
  scanlineLayer.className = "crt-scanline-layer";

  const staticLayer1 = document.createElement("video");
  staticLayer1.src = "/textures/monitor/video/base-static.mp4";
  staticLayer1.muted = true;
  staticLayer1.loop = true;
  staticLayer1.autoplay = true;
  staticLayer1.playsInline = true;
  staticLayer1.style.position = "absolute";
  staticLayer1.style.inset = "0";
  staticLayer1.style.width = "100%";
  staticLayer1.style.height = "100%";
  staticLayer1.style.objectFit = "cover";
  staticLayer1.style.pointerEvents = "none";
  staticLayer1.style.zIndex = "6";
  staticLayer1.style.opacity = "0.1";
  staticLayer1.style.mixBlendMode = "screen";
  void staticLayer1.play().catch(() => {});

  const staticLayer2 = document.createElement("video");
  staticLayer2.src = "/textures/monitor/video/static-texture-layer.mp4";
  staticLayer2.muted = true;
  staticLayer2.loop = true;
  staticLayer2.autoplay = true;
  staticLayer2.playsInline = true;
  staticLayer2.style.position = "absolute";
  staticLayer2.style.inset = "0";
  staticLayer2.style.width = "100%";
  staticLayer2.style.height = "100%";
  staticLayer2.style.objectFit = "cover";
  staticLayer2.style.pointerEvents = "none";
  staticLayer2.style.zIndex = "7";
  staticLayer2.style.opacity = "0.06";
  staticLayer2.style.mixBlendMode = "screen";
  void staticLayer2.play().catch(() => {});

  if (enableEffects) {
    iframeShell.appendChild(shadowLayer);
    iframeShell.appendChild(smudgeLayer);
    iframeShell.appendChild(dustLayer);
    iframeShell.appendChild(scanlineLayer);
    iframeShell.appendChild(staticLayer1);
    iframeShell.appendChild(staticLayer2);
  }

  const iframeFitScale = Math.max(
    targetPixelWidth / iframeContentWidth,
    targetPixelHeight / iframeContentHeight
  );

  const cssObject = new CSS3DObject(iframeShell);
  cssObject.position.copy(screenCenter);
  cssObject.quaternion.copy(screenQuaternion);
  cssObject.translateZ(finalDepthOffset);
  cssObject.scale.setScalar(0.001 * iframeFitScale);
  cssScene.add(cssObject);

  const occluderSource = targetNode ?? iframeScreenNode;
  const occluderBox = new THREE.Box3().setFromObject(occluderSource);
  const occluderCenter = occluderBox.getCenter(new THREE.Vector3());
  const occluderQuaternion = occluderSource.getWorldQuaternion(new THREE.Quaternion());
  const { width: occluderWidth, height: occluderHeight } = getScreenPlaneSize(
    occluderSource,
    occluderQuaternion
  );
  const occluderMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    blending: THREE.NoBlending,
  });
  const occluder = new THREE.Mesh(new THREE.PlaneGeometry(occluderWidth, occluderHeight), occluderMaterial);
  occluder.position.copy(occluderCenter);
  occluder.quaternion.copy(occluderQuaternion);
  scene.add(occluder);

  return {
    iframe,
    dispose: () => {
      iframe.src = "about:blank";
      if (enableEffects) {
        staticLayer1.pause();
        staticLayer2.pause();
        staticLayer1.removeAttribute("src");
        staticLayer2.removeAttribute("src");
        staticLayer1.load();
        staticLayer2.load();
      }

      cssScene.remove(cssObject);
      scene.remove(occluder);
      occluder.geometry.dispose();
      occluderMaterial.dispose();
    },
  };
};
