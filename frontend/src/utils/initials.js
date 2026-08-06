// Haalt maximaal 2 initialen uit een naam, bv. "Jonas Peeters" -> "JP",
// gebruikt door AvatarStack
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}
