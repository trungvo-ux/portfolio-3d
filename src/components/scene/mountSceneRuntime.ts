import type { MutableRefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { createMonitorScreen } from "../monitorscreen";
import { getScreenPlaneSize } from "./screenPlaneSize";
import { setupLighting } from "./setupLighting";

type MountSceneRuntimeArgs = {
  container: HTMLDivElement;
  hasBegunRef: MutableRefObject<boolean>;
  beginTimestampRef: MutableRefObject<number>;
  iframeElementRef: MutableRefObject<HTMLIFrameElement | null>;
  screenGainNodeRef: MutableRefObject<GainNode | null>;
  oldGainNodeRef: MutableRefObject<GainNode | null>;
  oldBassFilterRef: MutableRefObject<BiquadFilterNode | null>;
};

export const mountSceneRuntime = ({
  container,
  hasBegunRef,
  beginTimestampRef,
  iframeElementRef,
  screenGainNodeRef,
  oldGainNodeRef,
  oldBassFilterRef,
}: MountSceneRuntimeArgs) => {
  const MODEL_Y_ROTATION = 0;
  const MODEL_Y_OFFSET = -0.24;
  let isMobileViewport = container.clientWidth <= 900;

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  scene.background = null;
  const applyViewportBackground = () => {
    if (isMobileViewport) {
      container.style.backgroundImage = "url('/wallpaper.png')";
      container.style.backgroundPosition = "center";
      container.style.backgroundRepeat = "no-repeat";
      container.style.backgroundSize = "cover";
      container.style.backgroundColor = "#101014";
    } else {
      container.style.backgroundImage = "";
      container.style.backgroundPosition = "";
      container.style.backgroundRepeat = "";
      container.style.backgroundSize = "";
      container.style.backgroundColor = "";
    }
  };
  applyViewportBackground();

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.zoom = 1.2;
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.zIndex = "2";
  renderer.domElement.style.pointerEvents = "none";
  container.appendChild(renderer.domElement);

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(container.clientWidth, container.clientHeight);
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.top = "0";
  cssRenderer.domElement.style.left = "0";
  cssRenderer.domElement.style.zIndex = "1";
  cssRenderer.domElement.style.pointerEvents = "auto";
  container.appendChild(cssRenderer.domElement);

  const { keyTarget, monitorTarget, ground, shadowCasters } = setupLighting(scene);

  let frameId = 0;
  let disposed = false;
  const introZoom = 5;
  const activeZoom = 5;
  const hoverFrontZoom = 12;
  const settleStartZoom = 5.24;
  const settleDurationMs = 900;
  const pointerNdc = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const clock = new THREE.Clock();
  let isHoveringFrontScreen = false;
  let backScreenIframe: HTMLIFrameElement | null = null;
  let disposeMonitorScreen: (() => void) | null = null;
  let frontScreenMeshes: THREE.Mesh[] = [];
  const modelMeshes: THREE.Mesh[] = [];
  const introCameraPosition = new THREE.Vector3();
  const activeCameraPosition = new THREE.Vector3();
  const introLookTarget = new THREE.Vector3();
  const activeLookTarget = new THREE.Vector3();
  const cameraAnchorPosition = new THREE.Vector3();
  const cameraAnchorLookTarget = new THREE.Vector3();
  const currentLookOffset = new THREE.Vector3();
  const desiredLookOffset = new THREE.Vector3();
  const currentPositionOffset = new THREE.Vector3();
  const desiredPositionOffset = new THREE.Vector3();
  let monitorFocusMix = 0;

  const loader = new GLTFLoader();
  const modelPath = isMobileViewport ? "/models/cube.mobile.glb" : "/models/cube.glb";
  const enableCssScreenOverlay = true;
  const enableScreenEffects = !isMobileViewport;
  loader.load(
    modelPath,
    (gltf) => {
      if (disposed) return;

      const model = gltf.scene;
      model.rotateY(MODEL_Y_ROTATION);
      model.position.y += MODEL_Y_OFFSET;
      model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          modelMeshes.push(obj);
          obj.castShadow = !isMobileViewport;
          obj.receiveShadow = !isMobileViewport;
        }
      });
      scene.add(model);

      const fallbackCenter = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getCenter(fallbackCenter);

      const frontScreenNode =
        model.getObjectByName("Front Screen") ??
        model.getObjectByName("FrontScreen") ??
        model.getObjectByName("front_screen") ??
        model.getObjectByName("frontscreen") ??
        model.getObjectByName("Front_Screen") ??
        (() => {
          let found: THREE.Object3D | undefined;
          model.traverse((obj) => {
            if (found || !obj.name || !obj.name.toLowerCase().replace(/[\s_]/g, "").includes("frontscreen")) {
              return;
            }
            found = obj;
          });
          return found ?? null;
        })();

      const backScreenNode =
        model.getObjectByName("Back Screen") ??
        model.getObjectByName("BackScreen") ??
        model.getObjectByName("back_screen") ??
        model.getObjectByName("backscreen") ??
        model.getObjectByName("Back_Screen") ??
        (() => {
          let found: THREE.Object3D | undefined;
          model.traverse((obj) => {
            if (found || !obj.name || !obj.name.toLowerCase().replace(/[\s_]/g, "").includes("backscreen")) {
              return;
            }
            found = obj;
          });
          return found ?? null;
        })();

      if (frontScreenNode) {
        if (enableCssScreenOverlay) {
          frontScreenNode.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              frontScreenMeshes.push(obj);
            }
          });
          if (frontScreenNode instanceof THREE.Mesh) {
            frontScreenMeshes.push(frontScreenNode);
          }
          frontScreenMeshes = [...new Set(frontScreenMeshes)];

          frontScreenNode.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            obj.visible = false;
          });
        } else {
          frontScreenNode.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh)) return;
            obj.visible = true;
          });
        }
      }

      const targetCenter = new THREE.Vector3();
      if (frontScreenNode) {
        const targetBox = new THREE.Box3().setFromObject(frontScreenNode);
        if (targetBox.isEmpty()) {
          frontScreenNode.getWorldPosition(targetCenter);
        } else {
          targetBox.getCenter(targetCenter);
        }
      } else {
        targetCenter.copy(fallbackCenter);
      }

      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      const distance = Math.max(size.length() * (isMobileViewport ? 4.8 : 1), 1.5);

      const viewDirection = new THREE.Vector3(0, 0, 1);
      if (isMobileViewport && frontScreenNode && backScreenNode) {
        const frontCenter = new THREE.Box3()
          .setFromObject(frontScreenNode)
          .getCenter(new THREE.Vector3());
        const backCenter = new THREE.Box3()
          .setFromObject(backScreenNode)
          .getCenter(new THREE.Vector3());
        const towardBack = backCenter.sub(frontCenter);
        if (towardBack.lengthSq() > 1e-6) {
          viewDirection.copy(towardBack.normalize().multiplyScalar(-1));
        }
      } else if (frontScreenNode) {
        const frontQuat = frontScreenNode.getWorldQuaternion(new THREE.Quaternion());
        viewDirection.applyQuaternion(frontQuat).normalize();

        if (backScreenNode) {
          const backCenter = new THREE.Box3()
            .setFromObject(backScreenNode)
            .getCenter(new THREE.Vector3());
          const towardBack = backCenter.sub(targetCenter).normalize();
          if (viewDirection.dot(towardBack) > 0) {
            viewDirection.multiplyScalar(-1);
          }
        } else {
          const towardModelCenter = fallbackCenter.clone().sub(targetCenter).normalize();
          if (viewDirection.dot(towardModelCenter) > 0) {
            viewDirection.multiplyScalar(-1);
          }
        }
      }

      const lookTarget = targetCenter.clone();
      camera.position.copy(lookTarget.clone().add(viewDirection.multiplyScalar(distance)));
      if (isMobileViewport) {
        camera.position.y += Math.max(size.y * 0.06, 0.18);
      }
      camera.lookAt(lookTarget);
      camera.updateProjectionMatrix();
      keyTarget.position.copy(lookTarget);
      monitorTarget.position.copy(lookTarget);
      activeCameraPosition.copy(camera.position);
      activeLookTarget.copy(lookTarget);
      introCameraPosition.copy(activeCameraPosition);
      introLookTarget.copy(activeLookTarget);
      cameraAnchorPosition.copy(introCameraPosition);
      cameraAnchorLookTarget.copy(introLookTarget);
      ground.position.y = Math.max(lookTarget.y - size.y * 0.5 - 0.05, -5);

      const iframeScreenNode = frontScreenNode ?? backScreenNode;
      if (iframeScreenNode && enableCssScreenOverlay) {
        const monitorScreen = createMonitorScreen({
          scene,
          cssScene,
          camera,
          iframeScreenNode,
          targetNode: frontScreenNode,
          backScreenNode,
          getScreenPlaneSize,
          iframeSrc: "https://speak-cider-47752224.figma.site",
          enableEffects: enableScreenEffects,
        });
        iframeElementRef.current = monitorScreen.iframe;
        backScreenIframe = monitorScreen.iframe;
        disposeMonitorScreen = monitorScreen.dispose;
      } else {
        iframeElementRef.current = null;
        backScreenIframe = null;
        disposeMonitorScreen = null;
      }

      const render = () => {
        frameId = requestAnimationFrame(render);
        const delta = clock.getDelta();
        if (hasBegunRef.current && frontScreenMeshes.length > 0 && !isMobileViewport) {
          raycaster.setFromCamera(pointerNdc, camera);
          isHoveringFrontScreen = raycaster.intersectObjects(frontScreenMeshes, false).length > 0;
        } else {
          isHoveringFrontScreen = false;
        }
        const shouldFocusMonitor = hasBegunRef.current && (isMobileViewport || isHoveringFrontScreen);

        const mouseLookEnabled =
          hasBegunRef.current && !isMobileViewport && performance.now() - beginTimestampRef.current >= 3000;
        const focusPointerScale = shouldFocusMonitor ? 0.18 : 1;

        if (mouseLookEnabled) {
          desiredLookOffset.set(
            pointerNdc.x * -0.9 * focusPointerScale,
            pointerNdc.y * 0.45 * focusPointerScale,
            0
          );
          desiredPositionOffset.set(
            pointerNdc.x * -0.12 * focusPointerScale,
            pointerNdc.y * 0.06 * focusPointerScale,
            0
          );
        } else {
          desiredLookOffset.set(0, 0, 0);
          desiredPositionOffset.set(0, 0, 0);
        }

        const movementLerp = 1 - Math.exp(-6 * delta);
        currentLookOffset.lerp(desiredLookOffset, movementLerp);
        currentPositionOffset.lerp(desiredPositionOffset, movementLerp);

        cameraAnchorPosition.lerp(activeCameraPosition, movementLerp);
        cameraAnchorLookTarget.lerp(activeLookTarget, movementLerp);

        camera.position.copy(cameraAnchorPosition).add(currentPositionOffset);
        camera.lookAt(cameraAnchorLookTarget.clone().add(currentLookOffset));

        const responsiveActiveZoom = isMobileViewport ? 6.2 : activeZoom;
        const responsiveMonitorZoom = isMobileViewport ? 6.2 : hoverFrontZoom;
        const responsiveSettleStartZoom = isMobileViewport ? 4.18 : settleStartZoom;

        let baseZoom = hasBegunRef.current ? responsiveActiveZoom : introZoom;
        if (hasBegunRef.current && !isMobileViewport) {
          const settleElapsed = performance.now() - beginTimestampRef.current;
          const settleT = THREE.MathUtils.clamp(settleElapsed / settleDurationMs, 0, 1);
          const settleEase = 1 - Math.pow(1 - settleT, 3);
          baseZoom = THREE.MathUtils.lerp(responsiveSettleStartZoom, responsiveActiveZoom, settleEase);
        }

        const desiredZoom = shouldFocusMonitor ? responsiveMonitorZoom : baseZoom;
        const nextZoom = THREE.MathUtils.damp(camera.zoom, desiredZoom, 8, delta);
        if (Math.abs(nextZoom - camera.zoom) > 0.0001) {
          camera.zoom = nextZoom;
          camera.updateProjectionMatrix();
        }

        const targetFocusMix = hasBegunRef.current && isHoveringFrontScreen ? 1 : 0;
        const focusLerp = 1 - Math.exp(-7 * delta);
        monitorFocusMix += (targetFocusMix - monitorFocusMix) * focusLerp;

        if (screenGainNodeRef.current) {
          screenGainNodeRef.current.gain.value = THREE.MathUtils.lerp(0.1, 0.04, monitorFocusMix);
        }
        if (oldGainNodeRef.current) {
          oldGainNodeRef.current.gain.value = THREE.MathUtils.lerp(0.25, 0.07, monitorFocusMix);
        }
        if (oldBassFilterRef.current) {
          oldBassFilterRef.current.gain.value = THREE.MathUtils.lerp(0, -50, monitorFocusMix);
        }

        renderer.render(scene, camera);
        cssRenderer.render(cssScene, camera);
      };

      render();
    },
    undefined,
    (error) => {
      console.error(`Failed to load ${modelPath}:`, error);
    }
  );

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    isMobileViewport = container.clientWidth <= 900;
    scene.background = null;
    applyViewportBackground();
    renderer.shadowMap.enabled = !isMobileViewport;
    for (const light of shadowCasters) {
      light.castShadow = !isMobileViewport;
    }
    ground.receiveShadow = !isMobileViewport;
    ground.visible = !isMobileViewport;
    if (ground.material instanceof THREE.ShadowMaterial) {
      ground.material.opacity = 0.38;
      ground.material.needsUpdate = true;
    }
    for (const mesh of modelMeshes) {
      mesh.castShadow = !isMobileViewport;
      mesh.receiveShadow = !isMobileViewport;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  const onPointerLeave = () => {
    pointerNdc.set(0, 0);
  };

  const onPointerDown = () => {
    if (!hasBegunRef.current) return;
  };

  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("pointerdown", onPointerDown);

  onResize();

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("pointerdown", onPointerDown);

    if (backScreenIframe) {
      backScreenIframe.src = "about:blank";
    }
    disposeMonitorScreen?.();
    iframeElementRef.current = null;

    renderer.dispose();
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
};
