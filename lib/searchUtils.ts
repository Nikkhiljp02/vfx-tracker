/**
 * Utility functions for smart search matching
 */

/**
 * Checks if a shot name matches the search query, even when the query contains extra words.
 * 
 * Example: 
 * - shotName: "tsu000_0340"
 * - query: "napex_tsu_000_0340" or "tsu000" or "0340"
 * - Returns: true (because "tsu000_0340" can be found within the query)
 * 
 * @param shotName The actual shot name to match
 * @param query The search query (may contain extra words)
 * @returns true if the shot name is found in the query or query is found in shot name
 */
export function matchesShotName(shotName: string, query: string): boolean {
  const normalizedShot = shotName.toLowerCase().replace(/[_\s-]/g, '');
  const normalizedQuery = query.toLowerCase().replace(/[_\s-]/g, '');
  
  // Direct substring match (bidirectional)
  if (normalizedShot.includes(normalizedQuery) || normalizedQuery.includes(normalizedShot)) {
    return true;
  }
  
  // Extract potential shot-like patterns from query
  // Look for sequences of alphanumeric characters separated by underscores or hyphens
  const shotPatterns = query.toLowerCase().split(/[\s,;|]+/);
  
  for (const pattern of shotPatterns) {
    const normalizedPattern = pattern.replace(/[_\s-]/g, '');
    
    // Check if this pattern matches the shot name
    if (normalizedPattern && normalizedShot.includes(normalizedPattern)) {
      return true;
    }
    
    // Also check if shot name matches the pattern
    if (normalizedPattern && normalizedPattern.includes(normalizedShot)) {
      return true;
    }
  }
  
  // Try to extract shot-like segments (e.g., "tsu000", "0340" from "tsu000_0340")
  const shotSegments = shotName.toLowerCase().split(/[_\-]/);
  
  for (const segment of shotSegments) {
    if (segment.length >= 3) { // Only consider meaningful segments
      const normalizedSegment = segment.replace(/[_\s-]/g, '');
      if (normalizedQuery.includes(normalizedSegment)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Enhanced search filter that checks multiple fields including smart shot name matching
 * 
 * @param item Object with searchable fields
 * @param query Search query string
 * @param fields Array of field names to search (shot name will use smart matching)
 * @returns true if any field matches the query
 */
export function smartSearch<T extends Record<string, any>>(
  item: T,
  query: string,
  fields: (keyof T)[]
): boolean {
  const lowerQuery = query.toLowerCase().trim();
  
  for (const field of fields) {
    const value = item[field];
    if (!value) continue;
    
    const strValue = String(value).toLowerCase();
    
    // Use smart matching for shot-related fields
    if (field === 'shotName' || field === 'shot') {
      if (matchesShotName(String(value), lowerQuery)) {
        return true;
      }
    } else {
      // Regular substring match for other fields
      if (strValue.includes(lowerQuery)) {
        return true;
      }
    }
  }
  
  return false;
}
