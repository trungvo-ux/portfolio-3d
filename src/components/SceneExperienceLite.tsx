"use client";

export default function SceneExperienceLite() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center bg-black text-white">
      <div className="max-w-xl px-6 text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-400">Portfolio Preview</p>
        <h1 className="mb-4 text-3xl font-semibold">Lite Mode Is Active</h1>
        <p className="text-zinc-300">
          This Vercel preview uses a lightweight shell to avoid build memory limits. The full 3D
          monitor scene is available in local development.
        </p>
      </div>
    </main>
  );
}
