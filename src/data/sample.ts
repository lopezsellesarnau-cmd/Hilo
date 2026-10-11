/**
 * Example data until Supabase is connected. Mirrors the Figma "APP pills" frames.
 */

export type Pill = {
  id: string;
  name: string;
  /** Local time "HH:mm" */
  time: string;
  /** Local time it was confirmed, or null */
  takenAt: string | null;
};

export const samplePills: Pill[] = [
  { id: 'tension', name: 'Pastilla de la tensión', time: '09:00', takenAt: '09:15' },
  { id: 'vitamina-d', name: 'Vitamina D', time: '12:00', takenAt: null },
  { id: 'colesterol', name: 'Pastilla del colesterol', time: '21:20', takenAt: null },
];
