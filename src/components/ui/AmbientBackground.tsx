"use client";

import { useEffect, useRef, useState } from "react";

export function AmbientBackground() {
  const [position, setPosition] = useState({
    x: 50,
    y: 50,
  });

  const nextPosition = useRef({
    x: 50,
    y: 50,
  });

  const frameId = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      nextPosition.current = {
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      };

      if (frameId.current !== null) {
        return;
      }

      frameId.current = window.requestAnimationFrame(() => {
        setPosition(nextPosition.current);
        frameId.current = null;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);

      if (frameId.current !== null) {
        window.cancelAnimationFrame(frameId.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute h-[420px] w-[420px] rounded-full bg-[#D9A441]/10 blur-3xl transition-transform duration-300"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.025),transparent_65%)]" />
    </div>
  );
}