import {SongsterrService} from "#server/services/songsterr.ts";
export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const searchQuery = query.q as string;

    if (!searchQuery) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required query parameter: q'
        });
    }

    const songsterr = new SongsterrService();
    return await songsterr.search({
        query: searchQuery,
    });
})