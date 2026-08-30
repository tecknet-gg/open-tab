import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { SongsterrToAlphaTabConverter } from '../services/converter/songsterr-to-alphatab';
import { SongsterrService } from '../services/songsterr';
import type { TabMetadata, SyncEntry, SongsterrStateMetaCurrent, SongsterrVideoRecord } from '../types';

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Documents', 'tabs');

function sanitizeDirName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAudioFileName(songDir: string, feature: string | null, index: number, total: number): string {
  if (feature === null) return `${songDir}.mp3`;
  const sameFeatureCount = total;
  if (sameFeatureCount === 1) return `${songDir}-${feature}.mp3`;
  return `${songDir}-${feature}-${index + 1}.mp3`;
}

async function downloadAudio(url: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile('yt-dlp', [
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--no-playlist',
      '-o', outputPath,
      url,
    ], { timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`yt-dlp failed: ${stderr || error.message}`));
      } else {
        resolve();
      }
    });
  });
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { songId, revisionId: requestedRevisionId, format = 'gp7', video = false, main = false, all = false } = body as {
    songId: number;
    revisionId?: number;
    format?: 'gp7' | 'midi';
    video?: boolean;
    main?: boolean;
    all?: boolean;
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
    const allVideos = main
      ? await songsterrService.getAllDoneVideos(songId, revisionId)
      : [];
    const syncVideo = main
      ? allVideos.find(v => v.feature === null) ?? null
      : await songsterrService.getMainVideoSync(songId, revisionId);

    // Select which videos to download
    const videosToDownload: SongsterrVideoRecord[] = [];
    if (main && allVideos.length > 0) {
      if (all) {
        // Download all variants
        videosToDownload.push(...allVideos);
      } else {
        // Pick one of each type
        const seen = new Set<string>();
        for (const v of allVideos) {
          const key = v.feature ?? 'main';
          if (!seen.has(key)) {
            seen.add(key);
            videosToDownload.push(v);
          }
        }
      }
    }

    // Build stateMeta for the converter
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

    // Build sync entries
    const toSyncEntry = (v: SongsterrVideoRecord): SyncEntry => ({
      videoId: v.videoId,
      points: v.points,
      feature: v.feature,
      trackHashes: v.trackHashes ?? [],
    });

    const allSync: SyncEntry[] = main ? allVideos.map(toSyncEntry) : [];
    const primarySync: SyncEntry | null = syncVideo ? toSyncEntry(syncVideo) : null;

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
        difficulty: t.difficulty,
      })),
      sync: primarySync,
      allSync: allSync.length > 0 ? allSync : undefined,
    };

    const metadataPath = join(outputDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Download audio files
    const audioFiles: string[] = [];

    if (videosToDownload.length > 0) {
      // Count per feature type for naming
      const featureCounts = new Map<string, number>();
      for (const v of videosToDownload) {
        const key = v.feature ?? 'main';
        featureCounts.set(key, (featureCounts.get(key) ?? 0) + 1);
      }

      const featureIndices = new Map<string, number>();
      for (const v of videosToDownload) {
        const key = v.feature ?? 'main';
        const idx = featureIndices.get(key) ?? 0;
        featureIndices.set(key, idx + 1);

        const audioName = buildAudioFileName(songDir, v.feature, idx, featureCounts.get(key)!);
        const audioPath = join(outputDir, audioName);
        const videoUrl = `https://www.youtube.com/watch?v=${v.videoId}`;

        try {
          await downloadAudio(videoUrl, join(outputDir, `${songDir}-tmp-${v.videoId}`));
          const exts = ['mp3', 'm4a', 'opus', 'webm'];
          let found = false;
          for (const ext of exts) {
            const candidate = join(outputDir, `${songDir}-tmp-${v.videoId}.${ext}`);
            try {
              await access(candidate);
              const { rename } = await import('node:fs/promises');
              await rename(candidate, audioPath);
              audioFiles.push(audioName);
              found = true;
              break;
            } catch {}
          }
          if (!found) {
            const candidate = join(outputDir, `${songDir}-tmp-${v.videoId}.mp3`);
            try {
              await access(candidate);
              const { rename } = await import('node:fs/promises');
              await rename(candidate, audioPath);
              audioFiles.push(audioName);
            } catch {}
          }
        } catch {
          // Skip failed downloads
        }
      }
    } else if (video && syncVideo?.videoId) {
      // Single video download (original behavior)
      const videoUrl = `https://www.youtube.com/watch?v=${syncVideo.videoId}`;
      const videoOutput = join(outputDir, `${songDir}.%(ext)s`);

      await downloadAudio(videoUrl, videoOutput);

      const candidate = join(outputDir, `${songDir}.mp3`);
      try {
        await access(candidate);
        audioFiles.push(`${songDir}.mp3`);
      } catch {}
    }

    const durationMs = Math.round(performance.now() - startedAt);

    const files = [fileName, 'metadata.json', ...audioFiles];

    return {
      success: true,
      dir: outputDir,
      files,
      artist: stateMeta.artist,
      title: stateMeta.title,
      trackCount: revisions.length,
      hasSync: !!syncVideo,
      audioFiles,
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
