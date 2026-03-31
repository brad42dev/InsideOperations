import { useParams, Navigate } from "react-router-dom";

// The InvestigationWorkspace at /forensics/:id handles full investigation editing.
export default function InvestigationEditor() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/forensics/${id}`} replace />;
}
