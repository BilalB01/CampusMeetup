import { useNavigate, useParams } from "react-router-dom";
import { createActivity } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORIES, getCategoryBySlug } from "../constants/categories";
import { EHB_CAMPUS_CENTER } from "../constants/maps";
import ActiviteitForm from "../components/ActiviteitForm";

export default function ActiviteitAanmaken() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const defaultCategory = getCategoryBySlug(slug)?.value ?? CATEGORIES[0].value;

  async function handleSave(payload) {
    const activity = await createActivity(payload, token);
    navigate(`/activiteiten/${activity.id}`);
  }

  return (
    <ActiviteitForm
      heading="Activiteit aanmaken"
      submitLabel="Aanmaken"
      cancelLink={`/activiteiten/categorie/${slug}`}
      initialValues={{ category: defaultCategory, position: EHB_CAMPUS_CENTER }}
      onSave={handleSave}
    />
  );
}
