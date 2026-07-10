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
