import Fetcher from './fetcher';

class Scraper {
  async getDocumentFromUrl(url: string) {
    const fetcher = new Fetcher({ withRotatingUserAgent: false });
    const response = await fetcher.fetch(url, {
      headers: fetcher.browserLikeDocumentHeaders
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (${response.status})`);
    }

    return response.text();
  }

  extractStateFromHtml(html: string): Record<string, any> | null {
    const match = html.match(/<script\s+id="state"[^>]*>([\s\S]*?)<\/script>/i);
    if (!match?.[1]) return null;

    const raw = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export const scraper = new Scraper();
