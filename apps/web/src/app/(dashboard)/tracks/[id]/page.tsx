import TrackDetailPage from './track-detail-client';

export async function generateStaticParams() {
  return [];
}

export default function Page() {
  return <TrackDetailPage />;
}
