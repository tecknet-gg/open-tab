import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { SongsterrToAlphaTabConverter } from '../services/converter/songsterr-to-alphatab';
import { SongsterrService } from '../services/songsterr';
import type { TabMetadata, SongsterrStateMetaCurrent } from '../types';

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Documents', 'tabs');

function sanitizeDirName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { songId, revisionId: requestedRevisionId, format = 'gp7', video = false } = body as {
    songId: number;
    revisionId?: number;
    format?: 'gp7' | 'midi';
    video?: boolean;
  };

  if (!songId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required field: songId'
    });
  }

  const startedAt = performance.now();

  try {
    const songsterrService = new SongsterrService();
    const converter = new SongsterrToAlphaTabConverter();

    // Get latest revision if not specified
    const revision = requestedRevisionId
      ? { revisionId: requestedRevisionId }
      : await songsterrService.getLatestRevision(songId);
    const revisionId = revision.revisionId;

    // Fetch full metadata (includes tracks, image, videos)
    const metaUrl = `https://www.songsterr.com/api/meta/${songId}/${revisionId}`;
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      throw new Error(`Failed to fetch metadata: ${metaRes.status}`);
    }
    const meta = await metaRes.json() as any;

    // Get sync points
    const syncVideo = await songsterrService.getMainVideoSync(songId, revisionId);

    // Build stateMeta for the converter (it needs this shape)
    const tracks = meta.tracks || [];
    const stateMeta: SongsterrStateMetaCurrent = {
      songId: meta.songId,
      revisionId: meta.revisionId,
      image: meta.image,
      title: meta.title || 'Song',
      artist: meta.artist || 'Unknown Artist',
      tracks: tracks.map((t: any, index: number) => ({
        partId: index,
        instrumentId: t.instrumentId,
        title: t.name,
        name: t.name,
        tuning: t.tuning,
        isDrums: t.instrumentId === 1024,
      })),
    };

    // Fetch revision JSONs for each track from CDN
    const fetchResults = await Promise.all(
      tracks.map(async (track: any, index: number) => {
        const partId = index;
        const cdnUrl = `https://dqsljvtekg760.cloudfront.net/${songId}/${revisionId}/${meta.image}/${partId}.json`;
        try {
          const res = await fetch(cdnUrl);
          if (!res.ok) {
            // Try fallback CDN
            const fallbackUrl = `https://d3d3l6a6rcgkaf.cloudfront.net/${songId}/${revisionId}/${meta.image}/${partId}.json`;
            const fallbackRes = await fetch(fallbackUrl);
            if (!fallbackRes.ok) return null;
            return { trackMeta: { ...track, partId }, revision: await fallbackRes.json() };
          }
          return { trackMeta: { ...track, partId }, revision: await res.json() };
        } catch {
          return null;
        }
      })
    );

    const revisions = fetchResults.filter(Boolean) as { trackMeta: any; revision: any }[];

    if (revisions.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Unable to fetch any revision payloads for songId ${songId}`
      });
    }

    // Convert to GP7/MIDI
    let data: Uint8Array;
    let extension: string;

    if (format === 'midi') {
      const result = converter.toMidi({ meta: stateMeta, revisions });
      data = result.data;
      extension = '.mid';
    } else {
      const result = converter.toGp7({ meta: stateMeta, revisions });
      data = result.data;
      extension = '.gp';
    }

    // Build artist/song directory
    const artistDir = sanitizeDirName(stateMeta.artist);
    const songDir = sanitizeDirName(stateMeta.title);
    const outputDir = join(DEFAULT_DOWNLOAD_DIR, artistDir, songDir);

    await mkdir(outputDir, { recursive: true });

    // Write GP7/MIDI file
    const fileName = `${songDir}${extension}`;
    const filePath = join(outputDir, fileName);
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    );
    await writeFile(filePath, new Uint8Array(buffer));

    // Build and write metadata.json
    const metadata: TabMetadata = {
      songId,
      revisionId,
      title: stateMeta.title,
      artist: stateMeta.artist,
      artistId: meta.artistId,
      source: 'songsterr',
      format,
      tracks: tracks.map((t: any) => ({
        instrumentId: t.instrumentId,
        instrument: t.instrument || '',
        tuning: t.tuning,
        hash: t.hash || '',
      })),
      sync: syncVideo
        ? {
            videoId: syncVideo.videoId,
            points: syncVideo.points,
            feature: syncVideo.feature,
          }
        : null,
    };

    const metadataPath = join(outputDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Download YouTube video if requested
    let videoFile: string | null = null;
    if (video && syncVideo?.videoId) {
      const videoUrl = `https://www.youtube.com/watch?v=${syncVideo.videoId}`;
      const videoOutput = join(outputDir, `${songDir}.%(ext)s`);

      await new Promise<void>((resolve, reject) => {
        execFile('yt-dlp', [
          '-f', 'bestaudio/best',
          '-x',
          '--audio-format', 'mp3',
          '--no-playlist',
          '-o', videoOutput,
          videoUrl,
        ], { timeout: 120_000 }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`yt-dlp failed: ${stderr || error.message}`));
          } else {
            resolve();
          }
        });
      });

      // Find the downloaded file
      const candidate = join(outputDir, `${songDir}.mp3`);
      try {
        await access(candidate);
        videoFile = `${songDir}.mp3`;
      } catch {}
    }

    const durationMs = Math.round(performance.now() - startedAt);

    const files = [fileName, 'metadata.json'];
    if (videoFile) files.push(videoFile);

    return {
      success: true,
      dir: outputDir,
      files,
      artist: stateMeta.artist,
      title: stateMeta.title,
      trackCount: revisions.length,
      hasSync: !!syncVideo,
      videoFile,
      format,
      sizeBytes: data.byteLength,
      durationMs,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to download tab'
    });
  }
});
