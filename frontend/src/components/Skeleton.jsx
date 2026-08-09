// Generieke shimmer-placeholder — className krijgt vaak een bestaande
// kaart-class mee (bv. .activiteit-rij) zodat afmetingen/grid-plaatsing
// automatisch kloppen met de echte inhoud die hij vervangt
export default function Skeleton({ className = "", style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}
