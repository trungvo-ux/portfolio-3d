"use client";

import { useEffect, useRef, useState } from "react";
import localFont from "next/font/local";
import { BootOverlay } from "./scene/BootOverlay";
import { MobileBeginSheet } from "./scene/MobileBeginSheet";
import { asciiLogo, bootLines } from "./scene/bootContent";
import { mountSceneRuntime } from "./scene/mountSceneRuntime";
import "./scene/sceneStyles.css";

const ibmPlexMono = localFont({
  src: "../app/fonts/IBMPlexMono-Medium.ttf",
  weight: "500",
  variable: "--font-ibm-plex-mono",
});

export default function SceneExperience() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasBegunRef = useRef(false);
  const iframeElementRef = useRef<HTMLIFrameElement | null>(null);
  const screenRecordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const oldComputerAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const screenGainNodeRef = useRef<GainNode | null>(null);
  const oldGainNodeRef = useRef<GainNode | null>(null);
  const oldBassFilterRef = useRef<BiquadFilterNode | null>(null);
  const beginTimestampRef = useRef(0);

  const [hasBegun, setHasBegun] = useState(false);
  const [uiPhase, setUiPhase] = useState<"boot" | "ready">("boot");
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [isInteractionEnabled, setIsInteractionEnabled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileBeginSheetOpen, setIsMobileBeginSheetOpen] = useState(false);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsInteractionEnabled(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    hasBegunRef.current = hasBegun;
  }, [hasBegun]);

  useEffect(() => {
    if (hasBegun) return;

    let lineIndex = 0;
    let revealCompleteTimeout: number | undefined;

    const lineTimer = window.setInterval(() => {
      lineIndex += 1;
      setVisibleLineCount(Math.min(lineIndex, bootLines.length));
      if (lineIndex >= bootLines.length) {
        window.clearInterval(lineTimer);
        revealCompleteTimeout = window.setTimeout(() => {
          setUiPhase("ready");
        }, 2000);
      }
    }, 380);

    return () => {
      window.clearInterval(lineTimer);
      if (revealCompleteTimeout) {
        window.clearTimeout(revealCompleteTimeout);
      }
    };
  }, [hasBegun]);

  const handleOldComputerLoop = () => {
    const audio = oldComputerAudioRef.current;
    if (!audio) return;
    const loopStart = 0;
    const loopEnd = 150;
    if (audio.currentTime >= loopEnd) {
      audio.currentTime = loopStart;
      if (audio.paused) {
        void audio.play().catch(() => {});
      }
    }
  };

  const handleBegin = () => {
    if (!isInteractionEnabled) return;

    setHasBegun(true);
    beginTimestampRef.current = performance.now();
    const isMobileViewport = window.innerWidth < 768;
    if (isMobileViewport) {
      setIsMobileBeginSheetOpen(true);
    }

    const iframe = iframeElementRef.current;
    if (iframe && !isMobileViewport) {
      const currentSrc = iframe.src;
      iframe.src = "about:blank";
      window.setTimeout(() => {
        iframe.src = currentSrc;
      }, 20);
    }

    const screenRecording = screenRecordingAudioRef.current;
    if (screenRecording) {
      if (!audioContextRef.current) {
        const context = new window.AudioContext();
        audioContextRef.current = context;

        const screenSource = context.createMediaElementSource(screenRecording);
        const screenGain = context.createGain();
        screenGain.gain.value = 0.1;
        screenSource.connect(screenGain).connect(context.destination);
        screenGainNodeRef.current = screenGain;

        const oldComputer = oldComputerAudioRef.current;
        if (oldComputer) {
          const oldSource = context.createMediaElementSource(oldComputer);
          const oldBass = context.createBiquadFilter();
          oldBass.type = "lowshelf";
          oldBass.frequency.value = 220;
          oldBass.gain.value = 0;
          const oldGain = context.createGain();
          oldGain.gain.value = 0.25;
          oldSource.connect(oldBass).connect(oldGain).connect(context.destination);
          oldBassFilterRef.current = oldBass;
          oldGainNodeRef.current = oldGain;
        }
      }
      void audioContextRef.current?.resume().catch(() => {});
      screenRecording.currentTime = 0;
      screenRecording.volume = 1;
      void screenRecording.play().catch(() => {});
    }

    const oldComputer = oldComputerAudioRef.current;
    if (oldComputer) {
      oldComputer.currentTime = 0;
      oldComputer.volume = 1;
      oldComputer.loop = false;
      void oldComputer.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    return mountSceneRuntime({
      container: containerRef.current,
      hasBegunRef,
      beginTimestampRef,
      iframeElementRef,
      screenGainNodeRef,
      oldGainNodeRef,
      oldBassFilterRef,
    });
  }, [isMounted]);

  return (
    <main suppressHydrationWarning className="relative h-[100dvh] w-screen overflow-hidden bg-white">
      <div suppressHydrationWarning ref={containerRef} className="h-full w-full" />

      {isMounted && !hasBegun && (
        <BootOverlay
          asciiLogo={asciiLogo}
          bootLines={bootLines}
          visibleLineCount={visibleLineCount}
          uiPhase={uiPhase}
          isInteractionEnabled={isInteractionEnabled}
          onBegin={handleBegin}
          fontClassName={ibmPlexMono.className}
          fontVariable={ibmPlexMono.variable}
        />
      )}

      {isMounted && (
        <>
          <audio
            ref={screenRecordingAudioRef}
            src="/media/office-ambience.mp3"
            loop
            preload="auto"
            style={{ display: "none" }}
          />
          <audio
            ref={oldComputerAudioRef}
            src="/media/old-computer.mp3"
            preload="auto"
            onTimeUpdate={handleOldComputerLoop}
            style={{ display: "none" }}
          />
        </>
      )}

      {isMounted && isMobileBeginSheetOpen && (
        <MobileBeginSheet
          onClose={() => setIsMobileBeginSheetOpen(false)}
          fontClassName={ibmPlexMono.className}
          fontVariable={ibmPlexMono.variable}
        />
      )}
    </main>
  );
}
