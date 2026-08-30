import {SongsterrService} from "#server/services/songsterr.ts";
export default defineEventHandler(async () => {
    const songsterr = new SongsterrService();
    return await songsterr.search({
        query: 'scott street',
    });

})