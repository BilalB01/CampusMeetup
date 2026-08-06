import { getInitials } from "../utils/initials";

// Overlappende initiaal-cirkels voor een groepje deelnemers. Elke cirkel
// krijgt een title met de volledige naam — bij hover blijft die dus
// zichtbaar, geen informatie verloren t.o.v. een platte naamlijst
export default function AvatarStack({ participants, max = 3 }) {
  if (!participants || participants.length === 0) return null;

  const visible = participants.slice(0, max);
  const overflow = participants.length - visible.length;

  return (
    <div className="avatar-stapel">
      {visible.map((p) => (
        <span key={p.id} className="avatar-stapel-item" title={p.name}>
          {getInitials(p.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="avatar-stapel-item avatar-stapel-item--meer">+{overflow}</span>
      )}
    </div>
  );
}
