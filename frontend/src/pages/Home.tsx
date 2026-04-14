import { Navigate } from 'react-router-dom';

// Home redirects to feed for authenticated users
export default function HomePage() {
  return <Navigate to="/" replace />;
}
