import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STUDY_PLANS = ["leetcode-75", "top-interview-150"];
const NEETCODE_150 = {
  name: "NeetCode 150",
  pageUrl: "https://neetcode.io/practice/practice/neetcode150",
  slug: "neetcode-150",
};
const OUTPUT_PATH = resolve("src/lib/problemSetData.ts");

const query = `
  query studyPlanV2Detail($slug: String!) {
    studyPlanV2Detail(planSlug: $slug) {
      name
      slug
      planSubGroups {
        name
        questions {
          titleSlug
          title
          questionFrontendId
          difficulty
          topicTags {
            name
          }
        }
      }
    }
  }
`;

async function fetchPlan(slug) {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { slug },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode request failed for ${slug}: ${response.status}`);
  }

  const payload = await response.json();
  const plan = payload.data?.studyPlanV2Detail;

  if (!plan) {
    throw new Error(`LeetCode returned no study plan for ${slug}.`);
  }

  return plan;
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.text();
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getDifficulty(value) {
  const difficulty = value.toUpperCase();

  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
    throw new Error(`Unexpected NeetCode difficulty: ${value}`);
  }

  return difficulty;
}

function getQuestionFrontendId(code) {
  const match = code.match(/^0*(\d+)-.+$/);

  if (!match) {
    throw new Error(`Unexpected NeetCode code field: ${code}`);
  }

  return match[1];
}

async function fetchNeetCode150Plan() {
  const html = await fetchText(NEETCODE_150.pageUrl);
  const scriptMatch = html.match(/<script[^>]+src="([^"]*main\.[^"]+\.js)"[^>]*><\/script>/);

  if (!scriptMatch) {
    throw new Error("Could not find NeetCode main JavaScript bundle.");
  }

  const bundleUrl = new URL(scriptMatch[1], new URL("/", NEETCODE_150.pageUrl)).toString();
  const bundle = await fetchText(bundleUrl);
  const entryPattern =
    /\{problem:"(?<title>[^"]+)",pattern:"(?<pattern>[^"]+)",link:"(?<link>[^"]*)",video:"[^"]*",difficulty:"(?<difficulty>[^"]+)",code:"(?<code>[^"]*)"(?<rest>[^}]*?neetcode150:!0[^}]*)\}/g;
  const entries = Array.from(bundle.matchAll(entryPattern)).map((match) => {
    const groups = match.groups;
    const ncLinkMatch = groups.rest.match(/ncLink:"(?<ncLink>[^"]+)"/);

    if (!groups.link || !groups.code || !ncLinkMatch?.groups?.ncLink) {
      throw new Error(`Incomplete NeetCode mapping for ${groups.title}`);
    }

    return [
      NEETCODE_150.slug,
      groups.pattern,
      getQuestionFrontendId(groups.code),
      stripTrailingSlash(groups.link),
      groups.title,
      getDifficulty(groups.difficulty),
      groups.pattern,
      stripTrailingSlash(ncLinkMatch.groups.ncLink),
    ];
  });

  if (entries.length !== 150) {
    throw new Error(`Expected 150 NeetCode entries, found ${entries.length}.`);
  }

  return {
    name: NEETCODE_150.name,
    slug: NEETCODE_150.slug,
    entries,
  };
}

function toEntry(plan, group, question) {
  return [
    plan.slug,
    group.name,
    question.questionFrontendId,
    question.titleSlug,
    question.title,
    question.difficulty,
    question.topicTags.map((tag) => tag.name).join("|"),
  ];
}

function renderEntry(entry) {
  return `  ${JSON.stringify(entry)},`;
}

function renderFile(plans) {
  const lines = [
    "import type { RawProblemSetEntry } from \"./problemSets\";",
    "",
    "// Generated from official LeetCode study-plan data and NeetCode's public practice bundle.",
    "// Refresh with: node scripts/update-problem-set-data.mjs",
    "export const RAW_PROBLEM_SET_ENTRIES = [",
  ];

  for (const plan of plans) {
    lines.push(`  // ${plan.name}`);

    if ("entries" in plan) {
      for (const entry of plan.entries) {
        lines.push(renderEntry(entry));
      }
    } else {
      for (const group of plan.planSubGroups) {
        for (const question of group.questions) {
          lines.push(renderEntry(toEntry(plan, group, question)));
        }
      }
    }
  }

  lines.push("] as const satisfies readonly RawProblemSetEntry[];", "");
  return lines.join("\n");
}

const plans = await Promise.all([...STUDY_PLANS.map(fetchPlan), fetchNeetCode150Plan()]);
const contents = renderFile(plans);

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, contents, "utf8");

for (const plan of plans) {
  const count =
    "entries" in plan
      ? plan.entries.length
      : plan.planSubGroups.reduce((total, group) => total + group.questions.length, 0);
  console.log(`${plan.slug}: ${count}`);
}

console.log(`wrote ${OUTPUT_PATH}`);
