import React from "react";
import styles from "./ShinyText.module.css";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number; // seconds
  className?: string;
}

const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 5,
  className = "",
}) => {
  const animationDuration = `${speed}s`;
  return (
    <div
      className={[
        styles.shinyText,
        disabled ? styles.disabled : "",
        className,
      ].join(" ")}
      style={{ animationDuration }}
    >
      {text}
    </div>
  );
};

export default ShinyText;
