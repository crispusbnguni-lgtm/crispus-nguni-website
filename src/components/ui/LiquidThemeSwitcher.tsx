
"use client";

import { useState } from "react";

type Theme = "light" | "dark" | "sepia";

type LiquidThemeSwitcherProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
};

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Pearl", icon: "☀" },
  { value: "dark", label: "Midnight", icon: "☾" },
  { value: "sepia", label: "Sepia", icon: "☼" },
];

export function LiquidThemeSwitcher({
  value,
  onChange,
}: LiquidThemeSwitcherProps) {
  const [previous, setPrevious] = useState<Theme>(value);

  return (
    <fieldset
      className="switcher"
      data-previous={themes.findIndex((theme) => theme.value === previous) + 1}
    >
      <legend className="switcher__legend">Choose appearance</legend>

      {themes.map((theme, index) => (
        <label className="switcher__option" key={theme.value}>
          <input
            className="switcher__input"
            type="radio"
            name="site-theme"
            value={theme.value}
            checked={value === theme.value}
            onChange={() => {
              setPrevious(value);
              onChange(theme.value);
            }}
            data-option={index + 1}
          />

          <span className="switcher__icon" aria-hidden="true">
            {theme.icon}
          </span>

          <span className="switcher__label">{theme.label}</span>
        </label>
      ))}
    </fieldset>
  );
}