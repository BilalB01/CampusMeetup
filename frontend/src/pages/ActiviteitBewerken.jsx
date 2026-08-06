import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getActivity, updateActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ActiviteitForm from "../components/ActiviteitForm";
import { toDatetimeLocalValue } from "../utils/formatDate";

export default function ActiviteitBewerken() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getActivity(id, { token })
      .then((data) => {
        if (!cancelled) setActivity(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  async function handleSave(payload) {
    const updated = await updateActivity(id, payload, token);
    navigate(`/activiteiten/${updated.id}`);
  }

  if (loading) {
    return (
      <div className="activiteiten-screen">
        <p>Bezig met laden...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activiteiten-screen">
        <div className="auth-error">{error}</div>
        <Link to="/">Terug naar categorieën</Link>
      </div>
    );
  }

  if (activity.organizer.id !== user.id) {
    return (
      <div className="activiteiten-screen">
        <div className="auth-error">Enkel de organisator kan deze activiteit bewerken.</div>
        <Link to={`/activiteiten/${id}`}>Terug naar de activiteit</Link>
      </div>
    );
  }

  return (
    <ActiviteitForm
      heading="Activiteit bewerken"
      submitLabel="Opslaan"
      cancelLink={`/activiteiten/${id}`}
      initialValues={{
        title: activity.title,
        description: activity.description ?? "",
        category: activity.category,
        locationName: activity.location_name,
        position: { lat: activity.latitude, lng: activity.longitude },
        startTime: toDatetimeLocalValue(activity.start_time),
        maxParticipants: activity.max_participants,
      }}
      onSave={handleSave}
    />
  );
}
