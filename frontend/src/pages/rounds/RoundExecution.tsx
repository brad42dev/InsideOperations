import { useParams, Navigate } from 'react-router-dom'

// /rounds/:instance_id/execute → redirect to the RoundPlayer at /rounds/:id
export default function RoundExecution() {
  const { instance_id } = useParams<{ instance_id: string }>()
  return <Navigate to={`/rounds/${instance_id}`} replace />
}
