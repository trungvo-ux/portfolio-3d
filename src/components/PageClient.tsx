"use client";

import dynamic from "next/dynamic";

const SceneExperience = dynamic(() => import("./SceneExperience"), {
  ssr: false,
  loading: () => <main className="h-screen w-screen bg-white" />,
});

export default function PageClient() {
  return <SceneExperience />;
}
