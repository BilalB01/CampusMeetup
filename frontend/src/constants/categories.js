// Koppelt een URL-veilige slug aan de exacte categoriewaarde die de backend
// verwacht — "Cultuur & creatief" bevat een & en een spatie, niet geschikt
// als route-segment
// bg = pastelkleur van de tegel, accent = bijhorende felle kleur (voor
// eventuele details), zodat elke categorie er op het scherm anders en
// speels uitziet in plaats van 6 identieke grijze vakken
export const CATEGORIES = [
  { slug: "sporten", value: "Sporten", label: "Sporten", icon: "⚽", bg: "#ffe9d6", accent: "#ff7a30" },
  { slug: "studeren", value: "Studeren", label: "Studeren", icon: "📚", bg: "#dceaff", accent: "#3b82f6" },
  { slug: "gamen", value: "Gamen", label: "Gamen", icon: "🎮", bg: "#ede4ff", accent: "#8b5cf6" },
  { slug: "sociaal", value: "Sociaal", label: "Sociaal", icon: "👥", bg: "#ffe1ec", accent: "#ec4899" },
  { slug: "cultuur-creatief", value: "Cultuur & creatief", label: "Cultuur & creatief", icon: "🎨", bg: "#fff3c4", accent: "#e8a400" },
  { slug: "overige", value: "Overige", label: "Overige", icon: "📌", bg: "#dbf7ec", accent: "#10b981" },
];

export function getCategoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}
