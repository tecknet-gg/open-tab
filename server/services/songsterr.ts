import type {
  SearchResult,
  SongsterrPartialMetadata,
  SongsterrSearchParams,
  SongsterrSearchResponse,
} from '../types';
import { scraper } from '../utils/scraper';

export class SongsterrService {
  async getMetadataFromTabUrl(
    tabUrl: string
  ): Promise<SongsterrPartialMetadata> {
    const html = await scraper.getDocumentFromUrl(tabUrl);
    if (!html) throw new Error('Unable to get page data from songsterr');

    const state = scraper.extractStateFromHtml(html);
    if (!state?.meta?.current) throw new Error('Error reading tab data');

    return state.meta.current;
  }

  async search(
    params: SongsterrSearchParams
  ): Promise<SearchResult[]> {
    const response = await this.fetchSearch(params);

    return this.normaliseSearchResults(response);
  }

  buildFileNameFromSongName(songName: string, downloadUrl: string): string {
    try {
      const normalizedSongName = this.normalizeSongName(songName);
      const fileType = this.getFileTypeFromDownloadUrl(downloadUrl);
      return normalizedSongName + fileType;
    } catch {
      return `downloaded-tab_${Date.now()}.gp`;
    }
  }

  private normalizeSongName(input: string) {
    if (/[^a-zA-Z0-9\s]/.test(input)) {
      return input;
    }

    let normalized = input.toLowerCase();
    normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.trim();
    normalized = normalized.replace(/\s+/g, '-');

    return normalized;
  }

  private getFileTypeFromDownloadUrl(url: string) {
    if (url.endsWith('.gp5')) return '.gp5';
    if (url.endsWith('.mid')) return '.mid';
    return '.gp';
  }

  private async fetchSearch(params: SongsterrSearchParams): Promise<SongsterrSearchResponse> {
    const {
      query,
      size = 50,
      more = true,
    } = params;

    const searchParams = new URLSearchParams();

    searchParams.set('pattern', query);
    searchParams.set('size', String(size));
    searchParams.set('from', '0');
    searchParams.set('more', String(more));

    const url = `https://www.songsterr.com/api/search?${searchParams.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Songsterr search results: ${response.status} ${response.statusText}`
      );
    }

    return await response.json() as SongsterrSearchResponse;
  }

  private normaliseSearchResults(response: SongsterrSearchResponse): SearchResult[] {
    return response.records.map((record) => ({
      songId: record.songId,
      title: record.title,
      artist: record.artist,
      source: 'songsterr',
      tracks: record.tracks.map((track) => ({
        instrumentId: track.instrumentId,
        instrument: track.instrument,
        tuning: track.tuning,
        difficulty: track.difficulty,
        hash: track.hash,
      })),
    }));
  }
}