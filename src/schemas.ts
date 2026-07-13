import { z } from 'zod';

const requiredText = (description: string) =>
  z.string().trim().min(1).describe(description);
const optionalText = (description: string) =>
  z.string().trim().min(1).optional().describe(description);
const regionCode = (description: string) =>
  z.string().regex(/^[a-z]{2}$/, 'Must be a two-letter lowercase code.').optional().describe(description);
const positiveInteger = (description: string) =>
  z.number().int().positive().optional().describe(description);
const httpUrl = z
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'URL must use http or https.');

const sharedSearchFields = {
  q: requiredText('Search query.'),
  location: optionalText('Geographic location for localized results.'),
  gl: regionCode('Two-letter country code.'),
  hl: regionCode('Two-letter interface language code.'),
  tbs: optionalText('Google time-based search filter.'),
  num: positiveInteger('Maximum number of results.'),
  page: positiveInteger('One-based results page.'),
};

export const searchInputSchema = z.object(sharedSearchFields).strict();
export const imageInputSchema = z.object(sharedSearchFields).strict();
export const videoInputSchema = z.object(sharedSearchFields).strict();
export const placesInputSchema = z.object(sharedSearchFields).strict();

export const mapsInputSchema = z
  .object({
    q: optionalText('Place or map search query.'),
    hl: regionCode('Two-letter interface language code.'),
    ll: optionalText('Latitude/longitude and zoom search center.'),
    placeId: optionalText('Google Place ID.'),
    cid: optionalText('Google Maps customer ID.'),
    page: positiveInteger('One-based results page.'),
  })
  .strict()
  .refine((value) => Boolean(value.q || value.placeId || value.cid), {
    message: 'Provide at least one of q, placeId, or cid.',
  });

export const reviewsInputSchema = z
  .object({
    cid: optionalText('Google Maps customer ID.'),
    fid: optionalText('Google feature ID.'),
    placeId: optionalText('Google Place ID.'),
    gl: regionCode('Two-letter country code.'),
    hl: regionCode('Two-letter interface language code.'),
    sortBy: z
      .enum(['mostRelevant', 'newest', 'highestRating', 'lowestRating'])
      .optional()
      .describe('Review ordering.'),
    topicId: optionalText('Review topic identifier.'),
    nextPageToken: optionalText('Pagination token returned by Serper.'),
  })
  .strict()
  .refine((value) => Boolean(value.cid || value.fid || value.placeId), {
    message: 'Provide at least one of cid, fid, or placeId.',
  });

export const newsInputSchema = z.object(sharedSearchFields).strict();
export const shoppingInputSchema = z.object(sharedSearchFields).strict();

export const lensInputSchema = z
  .object({
    url: httpUrl.describe('Public image URL to analyze.'),
    location: optionalText('Geographic location for localized results.'),
    gl: regionCode('Two-letter country code.'),
    hl: regionCode('Two-letter interface language code.'),
    tbs: optionalText('Google time-based search filter.'),
  })
  .strict();

export const patentsInputSchema = z.object(sharedSearchFields).strict();

export const autocompleteInputSchema = z
  .object({
    q: requiredText('Partial search query.'),
    location: optionalText('Geographic location for localized suggestions.'),
    gl: regionCode('Two-letter country code.'),
    hl: regionCode('Two-letter interface language code.'),
  })
  .strict();

export const scrapeInputSchema = z
  .object({
    url: httpUrl.describe('Public web page URL to scrape.'),
    includeMarkdown: z.boolean().optional().describe('Include Markdown in the response.'),
  })
  .strict();

export const toolInputSchemas = {
  search: searchInputSchema,
  images: imageInputSchema,
  videos: videoInputSchema,
  places: placesInputSchema,
  maps: mapsInputSchema,
  reviews: reviewsInputSchema,
  news: newsInputSchema,
  shopping: shoppingInputSchema,
  lens: lensInputSchema,
  patents: patentsInputSchema,
  autocomplete: autocompleteInputSchema,
  scrape: scrapeInputSchema,
} as const;

const extensibleObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).catchall(z.unknown());

const searchParametersSchema = extensibleObject({
  q: z.string().optional(),
  type: z.string().optional(),
  engine: z.string().optional(),
  location: z.string().optional(),
  gl: z.string().optional(),
  hl: z.string().optional(),
  num: z.number().optional(),
  page: z.number().optional(),
});

const sitelinkSchema = extensibleObject({
  title: z.string().optional(),
  link: z.string().optional(),
  snippet: z.string().optional(),
});

const commonResultSchema = extensibleObject({
  title: z.string().optional(),
  link: z.string().optional(),
  snippet: z.string().optional(),
  position: z.number().optional(),
  source: z.string().optional(),
  date: z.string().optional(),
  imageUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  domain: z.string().optional(),
  rating: z.number().optional(),
  ratingCount: z.number().optional(),
  sitelinks: z.array(sitelinkSchema).optional(),
});

const responseBaseShape = {
  searchParameters: searchParametersSchema.optional(),
  credits: z.number().optional(),
};

export const searchResponseSchema = extensibleObject({
  ...responseBaseShape,
  organic: z.array(commonResultSchema).optional(),
});

export const imagesResponseSchema = extensibleObject({
  ...responseBaseShape,
  images: z.array(commonResultSchema).optional(),
});

export const videosResponseSchema = extensibleObject({
  ...responseBaseShape,
  videos: z.array(commonResultSchema).optional(),
});

export const placesResponseSchema = extensibleObject({
  ...responseBaseShape,
  places: z.array(commonResultSchema).optional(),
});

export const mapsResponseSchema = extensibleObject({
  ...responseBaseShape,
  places: z.array(commonResultSchema).optional(),
});

export const reviewsResponseSchema = extensibleObject({
  ...responseBaseShape,
  reviews: z.array(commonResultSchema).optional(),
});

export const newsResponseSchema = extensibleObject({
  ...responseBaseShape,
  news: z.array(commonResultSchema).optional(),
});

export const shoppingResponseSchema = extensibleObject({
  ...responseBaseShape,
  shopping: z.array(commonResultSchema).optional(),
});

export const lensResponseSchema = extensibleObject({
  ...responseBaseShape,
  images: z.array(commonResultSchema).optional(),
  organic: z.array(commonResultSchema).optional(),
});

export const patentsResponseSchema = extensibleObject({
  ...responseBaseShape,
  organic: z.array(commonResultSchema).optional(),
});

export const autocompleteResponseSchema = extensibleObject({
  ...responseBaseShape,
  suggestions: z.array(commonResultSchema).optional(),
});

export const scrapeResponseSchema = extensibleObject({
  text: z.string().optional(),
  markdown: z.string().optional(),
  metadata: extensibleObject({
    title: z.string().optional(),
    description: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
  credits: z.number().optional(),
});

export const toolResponseSchemas = {
  search: searchResponseSchema,
  images: imagesResponseSchema,
  videos: videosResponseSchema,
  places: placesResponseSchema,
  maps: mapsResponseSchema,
  reviews: reviewsResponseSchema,
  news: newsResponseSchema,
  shopping: shoppingResponseSchema,
  lens: lensResponseSchema,
  patents: patentsResponseSchema,
  autocomplete: autocompleteResponseSchema,
  scrape: scrapeResponseSchema,
} as const;
