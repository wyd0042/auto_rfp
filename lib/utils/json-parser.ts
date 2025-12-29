/**
 * Helper function to extract JSON from AI responses that may be wrapped in markdown code blocks
 * 
 * This function handles:
 * - Raw JSON strings
 * - JSON wrapped in ```json ... ``` code blocks
 * - JSON wrapped in plain ``` ... ``` code blocks
 * - Extra whitespace around the JSON content
 * 
 * @param content - The string content to parse
 * @returns The parsed JSON object
 * @throws Error if content is empty or invalid JSON
 */
export function extractJsonFromResponse(content: string): any {
  if (!content) {
    throw new Error('No content to parse');
  }

  // Check if content is wrapped in markdown code blocks
  const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    // Extract JSON from code block
    const jsonContent = jsonBlockMatch[1].trim();
    return JSON.parse(jsonContent);
  }

  // If not in code blocks, try parsing directly
  return JSON.parse(content.trim());
}
