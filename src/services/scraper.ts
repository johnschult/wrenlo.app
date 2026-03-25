import * as cheerio from 'cheerio';

export interface ScrapeResult {
  url: string;
  title: string;
  metaDescription: string;
  content: string;
}

const MAX_CONTENT_LENGTH = 15_000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'wrenlo-intake/1.0 (https://wrenlo.app)';
const STRIP_TAGS = ['script', 'style', 'nav', 'footer', 'aside', 'iframe', 'noscript', 'svg'];

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim() || '';
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  for (const tag of STRIP_TAGS) $(tag).remove();

  const sections: string[] = [];
  $('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, dd, dt').each((_, el) => {
    const tagName = (el as { tagName?: string }).tagName?.toLowerCase() || '';
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (tagName.startsWith('h')) sections.push(`\n## ${text}`);
    else if (tagName === 'li') sections.push(`- ${text}`);
    else sections.push(text);
  });

  let content = sections.join('\n').trim();
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) + '\n[content truncated]';
  }

  return { url, title, metaDescription, content };
}

export async function scrapeUrls(urls: string[]): Promise<string> {
  const results = await Promise.allSettled(urls.map(scrapeUrl));
  const successful: ScrapeResult[] = [];
  const failed: string[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') successful.push(r.value);
    else failed.push(`${urls[i]}: ${(r.reason as Error)?.message || 'Unknown error'}`);
  });

  if (successful.length === 0) {
    throw new Error(`All URLs failed to scrape:\n${failed.join('\n')}`);
  }

  return successful
    .map((r) => {
      const parts = [`URL: ${r.url}`];
      if (r.title) parts.push(`Title: ${r.title}`);
      if (r.metaDescription) parts.push(`Description: ${r.metaDescription}`);
      parts.push(`\nContent:\n${r.content}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}
