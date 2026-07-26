export const DEFAULT_PATTERN_TAGS = [
  "1D DP",
  "2D DP",
  "Arrays",
  "Backtracking",
  "BFS",
  "Binary Search",
  "Binary Search on Answer",
  "Bit Manipulation",
  "Design",
  "DFS",
  "Dynamic Programming",
  "Enumeration",
  "Graphs",
  "Greedy",
  "Hash Table",
  "Heap / Priority Queue",
  "Intervals",
  "Linked List",
  "Math",
  "Matrix",
  "Monotonic Stack",
  "Prefix Sum",
  "Sliding Window",
  "Sorting",
  "Stack",
  "Strings",
  "Topological Sort",
  "Trees",
  "Trie",
  "Two Pointers",
  "Union Find",
] as const;

const TAG_ALIASES: Record<string, string> = {
  Array: "Arrays",
  String: "Strings",
  Hashing: "Hash Table",
  "Depth-First Search": "DFS",
  "Breadth-First Search": "BFS",
  Tree: "Trees",
  "Binary Tree": "Trees",
  "Binary Search Tree": "Trees",
  Graph: "Graphs",
  "Graph Theory": "Graphs",
  "Heap (Priority Queue)": "Heap / Priority Queue",
  "Union-Find": "Union Find",
  "Doubly-Linked List": "Linked List",
  "Dynamic Programming": "Dynamic Programming",
};

export function normalizePatternTag(tag: string): string {
  return TAG_ALIASES[tag] ?? tag;
}

export function normalizePatternTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(normalizePatternTag))).sort((a, b) => a.localeCompare(b));
}

// Built-in source-group labels that map cleanly to a single canonical concept.
// Grounded in the actual sourceGroup strings in problemSetData.ts. Groups with
// no clean single concept (e.g. "Array / String", "Arrays & Hashing") are
// intentionally omitted and fall through to priority ranking.
const SOURCE_GROUP_CONCEPT: Record<string, string> = {
  "Binary Tree - DFS": "DFS",
  "Graphs - DFS": "DFS",
  "Binary Tree - BFS": "BFS",
  "Binary Tree BFS": "BFS",
  "Graph BFS": "BFS",
  "Graphs - BFS": "BFS",
  "DP - 1D": "1D DP",
  "1D DP": "1D DP",
  "1-D Dynamic Programming": "1D DP",
  "Kadane's Algorithm": "1D DP",
  "DP - Multidimensional": "2D DP",
  "Multidimensional DP": "2D DP",
  "2-D Dynamic Programming": "2D DP",
  Hashmap: "Hash Table",
  "Hash Map / Set": "Hash Table",
  Heap: "Heap / Priority Queue",
  "Heap / Priority Queue": "Heap / Priority Queue",
  Trees: "Trees",
  "Binary Tree General": "Trees",
  "Binary Search Tree": "Trees",
  Graphs: "Graphs",
  "Graph General": "Graphs",
  "Advanced Graphs": "Graphs",
  Trie: "Trie",
  Tries: "Trie",
  Backtracking: "Backtracking",
  "Binary Search": "Binary Search",
  "Two Pointers": "Two Pointers",
  "Sliding Window": "Sliding Window",
  Stack: "Stack",
  "Monotonic Stack": "Monotonic Stack",
  "Prefix Sum": "Prefix Sum",
  Intervals: "Intervals",
  "Linked List": "Linked List",
  "Bit Manipulation": "Bit Manipulation",
  Greedy: "Greedy",
  Matrix: "Matrix",
  Math: "Math",
  "Math & Geometry": "Math",
};

// Strongest learning concept first, generic containers last. Used to pick the
// single primary concept from a problem's own patterns.
const PATTERN_PRIORITY = [
  "Topological Sort",
  "Union Find",
  "Trie",
  "Backtracking",
  "BFS",
  "DFS",
  "Binary Search on Answer",
  "Binary Search",
  "Sliding Window",
  "Two Pointers",
  "Monotonic Stack",
  "Prefix Sum",
  "2D DP",
  "1D DP",
  "Dynamic Programming",
  "Greedy",
  "Intervals",
  "Bit Manipulation",
  "Heap / Priority Queue",
  "Stack",
  "Linked List",
  "Trees",
  "Graphs",
  "Matrix",
  "Sorting",
  "Design",
  "Enumeration",
  "Math",
  "Hash Table",
  "Strings",
  "Arrays",
];

/**
 * Pick the single strongest concept from a problem's own patterns. The result
 * is always a member of the normalized patterns, or undefined when empty.
 * A source group (from a built-in set) biases the choice when it maps to a
 * concept the problem actually has.
 */
export function inferPrimaryPattern(patterns: string[], sourceGroups?: string[]): string | undefined {
  const normalized = normalizePatternTags(patterns);
  if (normalized.length === 0) {
    return undefined;
  }

  if (sourceGroups) {
    for (const group of sourceGroups) {
      const concept = SOURCE_GROUP_CONCEPT[group];
      if (concept && normalized.includes(concept)) {
        return concept;
      }
    }
  }

  for (const candidate of PATTERN_PRIORITY) {
    if (normalized.includes(candidate)) {
      return candidate;
    }
  }

  return normalized[0];
}

/**
 * Validate a stored/imported/user primary value against a pattern set. Returns
 * the value when it is a member of the normalized patterns, otherwise falls
 * back to inference. Keeps the invariant that primaryPattern is a member of
 * patterns (or undefined).
 */
export function normalizePrimaryPattern(
  value: string | undefined,
  patterns: string[],
): string | undefined {
  const normalized = normalizePatternTags(patterns);
  if (value) {
    const normalizedValue = normalizePatternTag(value);
    if (normalized.includes(normalizedValue)) {
      return normalizedValue;
    }
  }

  return inferPrimaryPattern(normalized);
}
