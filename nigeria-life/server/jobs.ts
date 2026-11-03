/** Shift lengths mirror DEFAULT_JOBS in src/backend/types.ts. */
export interface ServerJob {
  id: string;
  title: string;
  /** Seconds on the clock before the shift can be completed. */
  shiftDuration: number;
}

export const SERVER_JOBS: readonly ServerJob[] = [
  { id: 'job_shop_assistant', title: 'Trade Shop Assistant', shiftDuration: 10 },
  { id: 'job_mechanic', title: 'Auto Mechanic Apprentice', shiftDuration: 12 },
  { id: 'job_danfo_driver', title: 'Danfo Commercial Driver', shiftDuration: 15 },
  { id: 'job_food_seller', title: 'Buka Kitchen Cook Assistant', shiftDuration: 10 },
  { id: 'job_office_worker', title: 'Corporate Office Clerk', shiftDuration: 18 },
  { id: 'job_software_dev', title: 'Junior Software Engineer', shiftDuration: 20 },
  { id: 'job_construction', title: 'Site Framing Artisan', shiftDuration: 14 },
  { id: 'job_security', title: 'Estate Security Officer', shiftDuration: 12 },
];

const BY_ID = new Map(SERVER_JOBS.map((job) => [job.id, job]));

export function getServerJob(id: string): ServerJob | undefined {
  return BY_ID.get(id);
}
