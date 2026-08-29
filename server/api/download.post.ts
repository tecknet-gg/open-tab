import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SongsterrRevisionJsonService } from '../services/songsterr-revision-json';
import { SongsterrToAlphaTabConverter } from '../services/converter/songsterr-to-alphatab';
import { SongsterrService } from '../services/songsterr';

const DEFAULT_DOWNLOAD_DIR = join(homedir(), 'Documents', 'tabs');

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { url, format = 'gp7' } = body as {
    url: string;
    format?: 'gp7' | 'midi';
  };

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required field: url'
    });
  }

  if (!url.includes('songsterr.com')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Songsterr URL'
    });
  }

  const startedAt = performance.now();

  try {
    const revisionService = new SongsterrRevisionJsonService();
    const converter = new SongsterrToAlphaTabConverter();
    const songsterrService = new SongsterrService();

    const stateMeta = await revisionService.getStateMetaFromTabUrl(url);

    const { revisions, warnings: fetchWarnings } =
      await revisionService.fetchAllPartRevisionsWithFallback(stateMeta);

    if (revisions.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Unable to fetch any revision payloads for songId ${stateMeta.songId}`
      });
    }

    let data: Uint8Array;
    let extension: string;
    let contentType: string;

    if (format === 'midi') {
      const result = converter.toMidi({ meta: stateMeta, revisions });
      data = result.data;
      extension = '.mid';
      contentType = 'audio/midi';
    } else {
      const result = converter.toGp7({ meta: stateMeta, revisions });
      data = result.data;
      extension = '.gp';
      contentType = 'application/gp';
    }

    const fileName = songsterrService.buildFileNameFromSongName(
      stateMeta.title,
      `${stateMeta.songId}${extension}`
    );

    await mkdir(DEFAULT_DOWNLOAD_DIR, { recursive: true });

    const filePath = join(DEFAULT_DOWNLOAD_DIR, fileName);
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    );
    await writeFile(filePath, new Uint8Array(buffer));

    const durationMs = Math.round(performance.now() - startedAt);

    return {
      success: true,
      filePath,
      fileName,
      artist: stateMeta.artist,
      title: stateMeta.title,
      trackCount: revisions.length,
      format,
      sizeBytes: data.byteLength,
      durationMs
    };
  } catch (error: any) {
    if (error.statusCode) throw error;

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to download tab'
    });
  }
});
