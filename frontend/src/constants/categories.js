// Koppelt een URL-veilige slug aan de exacte categoriewaarde die de backend
// verwacht — "Cultuur & creatief" bevat een & en een spatie, niet geschikt
// als route-segment
// bg = pastelkleur van de tegel, accent = bijhorende felle kleur (voor
// eventuele details), zodat elke categorie er op het scherm anders en
// speels uitziet in plaats van 6 identieke grijze vakken
export const CATEGORIES = [
  { slug: "sporten", value: "Sporten", label: "Sporten", icon: "⚽", bg: "#FFE7D9", accent: "#E1571E" },
  { slug: "studeren", value: "Studeren", label: "Studeren", icon: "📚", bg: "#DCE9FF", accent: "#2F6FE4" },
  { slug: "gamen", value: "Gamen", label: "Gamen", icon: "🎮", bg: "#E9E1FF", accent: "#6C4FF5" },
  { slug: "sociaal", value: "Sociaal", label: "Sociaal", icon: "👥", bg: "#FFE0EC", accent: "#D62F73" },
  { slug: "cultuur-creatief", value: "Cultuur & creatief", label: "Cultuur & creatief", icon: "🎨", bg: "#FFF1C9", accent: "#A87400" },
  { slug: "overige", value: "Overige", label: "Overige", icon: "📌", bg: "#D8F5E9", accent: "#0E8A64" },
];

export function getCategoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryByValue(value) {
  return CATEGORIES.find((c) => c.value === value);
}
