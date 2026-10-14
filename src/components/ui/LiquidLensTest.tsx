
"use client";

import { LiquidLensButton } from "@/components/ui/LiquidLensButton";

export default function LiquidLensTest() {
  return (
    <div className="crispus-home-lens-test">
      <LiquidLensButton
        aria-label="Test liquid glass effect"
        onClick={() => console.log("Liquid lens button clicked")}
      >
        Explore my work
      </LiquidLensButton>
    </div>
  );
}