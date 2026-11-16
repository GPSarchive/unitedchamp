// Where the directory is mounted. Promoting the preview = moving this folder
// to src/app/paiktes and changing this one constant to "/paiktes".
export const PAIKTES_BASE_PATH = "/preview/paiktes-v2";

/**
 * sessionStorage key for the list position saved when a player is opened
 * (filters, rendered rows, scroll), so coming back lands on the same row.
 */
export const PAIKTES_VIEW_KEY = "paiktes-v2:view";

export type SavedListView = { search: string; count: number; y: number; at: number };
