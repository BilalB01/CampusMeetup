import { useCountUp } from "../hooks/useCountUp";

// Grotere statistiekkaart met icoon, enkel voor de Start-hero — StatTegel.jsx
// blijft de kleinere, icoonloze variant voor Profiel.jsx
export default function StartStatKaart({ n, l, icoon, bg, accent }) {
  const animated = useCountUp(n);
  return (
    <div className="start-stat-kaart">
      <div className="start-stat-tekst">
        <div className="start-stat-getal" style={{ color: accent }}>
          {animated}
        </div>
        <div className="start-stat-label">{l}</div>
      </div>
      <div className="start-stat-icoon" style={{ background: bg, color: accent }}>
        {icoon}
      </div>
    </div>
  );
}
