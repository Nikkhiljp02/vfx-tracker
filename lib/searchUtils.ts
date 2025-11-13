/**
 * Utility functions for smart search matching
 */

/**
 * Checks if a shot name matches the search query, even when the query contains extra words.
 * 
 * Example: 
 * - shotName: "tsu000_0340"
 * - query: "NPXS_tsu000_0340" -> Match (shot name found in query)
 * - query: "tsu000_0340" -> Match (exact match)
 * - query: "0340" -> No match (too short/ambiguous)
 * 
 * @param shotName The actual shot name to match
 * @param query The search query (may contain extra words)
 * @returns true if the shot name is found in the query or query exactly matches shot name
 */
export function matchesShotName(shotName: string, query: string): boolean {
  const lowerShotName = shotName.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  
  // Exact match
  if (lowerShotName === lowerQuery) {
    return true;
  }
  
  // Direct substring match (query is part of shot name)
  if (lowerShotName.includes(lowerQuery)) {
    return true;
  }
  
  // Normalize by removing separators for flexible matching
  const normalizedShot = lowerShotName.replace(/[_\s-]/g, '');
  const normalizedQuery = lowerQuery.replace(/[_\s-]/g, '');
  
  // Check if the entire normalized shot name appears in the normalized query
  // This handles cases like "NPXS_tsu000_0340" matching "tsu000_0340"
  if (normalizedQuery.includes(normalizedShot) && normalizedShot.length >= 5) {
    return true;
  }
  
  // Check if the entire normalized query matches the normalized shot name
  if (normalizedShot === normalizedQuery) {
    return true;
  }
  
  return false;
}
