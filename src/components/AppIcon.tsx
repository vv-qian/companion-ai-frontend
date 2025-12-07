import React from "react";

interface AppIconProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

/**
 * AppIcon component - displays the app icon
 * Place your icon file at: public/app-icon.svg (SVG format recommended)
 * 
 * @param className - Additional CSS classes
 * @param size - Size of the icon in pixels (default: 32)
 * @param animate - Whether to animate the icon with rotation (default: false)
 */
export const AppIcon: React.FC<AppIconProps> = ({
  className = "",
  size = 32,
  animate = false,
}) => {
  return (
    <img
      src="/app-icon.svg"
      alt="CompanionAI"
      width={size}
      height={size}
      className={`${animate ? "animate-spin" : ""} ${className}`}
      style={{ 
        display: "block",
        margin: 0,
        padding: 0,
        lineHeight: 0
      }}
    />
  );
};

export default AppIcon;

