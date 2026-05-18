export const DEFAULT_PATTERN_TAGS = [
  "Arrays",
  "Strings",
  "Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Monotonic Stack",
  "Binary Search",
  "Binary Search on Answer",
  "Linked List",
  "Intervals",
  "Trees",
  "DFS",
  "BFS",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Topological Sort",
  "Union Find",
  "Dynamic Programming",
  "1D DP",
  "2D DP",
  "Greedy",
  "Trie",
  "Bit Manipulation",
  "Math",
  "Design",
  "Prefix Sum",
  "Matrix",
] as const;

const TAG_ALIASES: Record<string, string> = {
  Array: "Arrays",
  String: "Strings",
  "Hash Table": "Hashing",
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
