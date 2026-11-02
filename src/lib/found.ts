/**
 * The query worked and found nothing. A failed query (no internet) is not "nothing": without this,
 * a senior offline looked unpaired and was sent to Welcome.
 */
export const missing = (r: { data: unknown; error: unknown }) => !r.error && !r.data;
