type MediaLike = { position?: number | null; url?: string | null };
type SportObjectLike = {
  description?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phones?: string[] | null;
  images?: MediaLike[] | null;
  areas?: unknown[] | null;
};

export type NormalizeSportObjectOptions = {
  /** Для admin: полный список Media. Для catalog/search — только imageUrls. */
  includeImages?: boolean;
};

export type NormalizedSportObject<T extends SportObjectLike> = Omit<T, 'images'> & {
  imageUrls: string[];
  images?: MediaLike[];
};

function sortImages(images: MediaLike[]): MediaLike[] {
  return images.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function normalizeSportObject<T extends SportObjectLike>(
  obj: T,
  options: NormalizeSportObjectOptions = {},
): NormalizedSportObject<T> {
  const sorted = sortImages(obj.images ?? []);
  const imageUrls = sorted
    .map((img) => img.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);

  const { images: _images, ...rest } = obj;

  const normalized = {
    ...rest,
    description: obj.description ?? null,
    website: obj.website ?? null,
    latitude: obj.latitude ?? null,
    longitude: obj.longitude ?? null,
    phones: obj.phones ?? [],
    imageUrls,
    areas: obj.areas ?? [],
  } as NormalizedSportObject<T>;

  if (options.includeImages) {
    normalized.images = sorted;
  }

  return normalized;
}

export function normalizeSportObjects<T extends SportObjectLike>(
  items: T[],
  options?: NormalizeSportObjectOptions,
): NormalizedSportObject<T>[] {
  return items.map((item) => normalizeSportObject(item, options));
}
