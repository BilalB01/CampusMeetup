import { useCountUp } from "../hooks/useCountUp";

// Eigen componentje i.p.v. useCountUp rechtstreeks in een .map() aan te
// roepen — Hooks mogen niet binnen een loop aangeroepen worden
export default function StatTegel({ n, l }) {
  const animated = useCountUp(n);
  return (
    <div className="profiel-stat-tegel">
      <div className="profiel-stat-getal">{animated}</div>
      <div className="profiel-stat-label">{l}</div>
    </div>
  );
}
