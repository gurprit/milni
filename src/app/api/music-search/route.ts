import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
};

type DeezerTrack = {
  id: number;
  title: string;
  link?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string; cover_big?: string };
};

type SearchResult = {
  id: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  trackUrl: string;
  genre: string;
};

async function searchStorefront(term: string, country: 'GB' | 'IN'): Promise<ITunesTrack[]> {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('media', 'music');
  url.searchParams.set('limit', '12');
  url.searchParams.set('country', country);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Accept-Language': country === 'IN' ? 'en-IN,en;q=0.9' : 'en-GB,en;q=0.9',
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { results?: ITunesTrack[] };
    return data.results ?? [];
  } catch {
    // One storefront failing should not wipe out results from the other.
    return [];
  }
}

async function searchDeezer(term: string): Promise<SearchResult[]> {
  const url = new URL('https://api.deezer.com/search');
  url.searchParams.set('q', term);
  url.searchParams.set('limit', '10');

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { data?: DeezerTrack[] };

    return (data.data ?? [])
      .filter((track) => track.id && track.title && track.artist?.name)
      .slice(0, 10)
      .map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist?.name ?? '',
        album: track.album?.title ?? '',
        artworkUrl: track.album?.cover_big ?? track.album?.cover_medium ?? '',
        trackUrl: track.link ?? '',
        genre: '',
      }));
  } catch {
    return [];
  }
}

function respond(results: SearchResult[]) {
  return NextResponse.json(
    { results },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const term = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (term.length < 2) return respond([]);

  // Search the UK and India storefronts independently. Previously a network
  // failure from either request could cause the whole lookup to return [].
  const [uk, india] = await Promise.all([
    searchStorefront(term, 'GB'),
    searchStorefront(term, 'IN'),
  ]);

  const seen = new Set<number>();
  const combined = [...india, ...uk]
    .filter((track) => {
      if (!track.trackId || seen.has(track.trackId)) return false;
      seen.add(track.trackId);
      return true;
    })
    .slice(0, 10)
    .map<SearchResult>((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName ?? '',
      artworkUrl: (track.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'),
      trackUrl: track.trackViewUrl ?? '',
      genre: track.primaryGenreName ?? '',
    }));

  if (combined.length) return respond(combined);

  // Apple can occasionally reject/timeout edge-worker requests. Deezer gives
  // us a no-key metadata fallback so search still works instead of presenting
  // every query as "No exact match".
  return respond(await searchDeezer(term));
}
