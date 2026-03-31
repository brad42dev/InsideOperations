import { useParams, Navigate } from "react-router-dom";

// The LogEditor at /log/:id already handles editing when the entry is not completed.
// This route redirects there for backwards-compat / direct deep-links.
export default function LogEntryEdit() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/log/${id}`} replace />;
}
