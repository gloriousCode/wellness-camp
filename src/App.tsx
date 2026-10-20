import { useEffect, useState } from 'react';
import { MapExplorer } from './components/MapExplorer';
import type { Manifest } from './types';

export function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}maps.json`, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Map catalogue could not be loaded.');
      return response.json();
    }).then((data: Manifest) => { if (!data.maps.length) throw new Error('The map catalogue is empty.'); setManifest(data); }).catch(reason => { if (reason.name !== 'AbortError') setError(String(reason.message)); });
    return () => controller.abort();
  }, []);
  if (error) return <main className="error-page"><h1>Atlas unavailable</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!manifest) return <main className="error-page"><span className="status-orb" /><p>Opening the atlas…</p></main>;
  return <MapExplorer manifest={manifest} />;
}
