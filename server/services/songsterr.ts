import type { SongsterrPartialMetadata } from '../types';
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
}
