export type SpotStatus = 'been' | 'want';
export interface Photo { id: string; url: string; width: number; height: number }
export interface Spot {
  id: string; name: string; address: string | null; lat: number; lng: number;
  status: SpotStatus; rating: number | null; notes: string;
  visitedOn: string | null;          // YYYY-MM-DD
  tags: string[]; photos: Photo[]; createdAt: string; updatedAt: string;
}
export type SpotSummary = Omit<Spot, 'photos'> & { coverPhoto: Photo | null };
export type SpotInput = Omit<Spot, 'id' | 'photos' | 'createdAt' | 'updatedAt'>;
export interface PlaceResult { name: string; address: string | null; lat: number; lng: number }
export interface SpotFilter { status?: SpotStatus; tag?: string }
