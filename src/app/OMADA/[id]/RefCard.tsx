interface RefCardProps {
  color: "yellow" | "red" | "blue";
  className?: string;
}

export default function RefCard({ color, className = "" }: RefCardProps) {
  const colorMap = {
    yellow: "bg-yellow-400 border-yellow-500",
    red: "bg-red-500 border-red-600",
    blue: "bg-blue-400 border-blue-500",
  };

  return (
    <div
      className={`inline-block w-2 h-3 rounded-[1px] border ${colorMap[color]} shadow-sm ${className}`}
      aria-label={`${color} card`}
    />
  );
}
