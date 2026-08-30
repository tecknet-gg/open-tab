import type { SongsterrPartialMetadata } from '../types';
import type { SongsterrSearchParams, SearchResults } from '../types';
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

  private async fetchSearch(params: SongsterrSearchParams): Promise<unknown> {
    const {
        query,
        inst,
        tuning,
        difficulty,
        size = 50,
        more = true,
    } = params;
    const searchParams = new URLSearchParams();

    searchParams.set("pattern", query);
    searchParams.set("size", String(size));
    searchParams.set("more", String(more));
    searchParams.set("from", "0")

    const url = `https://songsterr.com/api/search?${searchParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`);
    }
    return await response.json();
  }



  private normaliseSearchResults(response: unknown): SearchResults[] {
    console.log(response);
    return [];

  }

  async search(params: SongsterrSearchParams): Promise<SearchResults[]> {
    const response = await this.fetchSearch(params);
    return this.normaliseSearchResults(response);
  }
}
