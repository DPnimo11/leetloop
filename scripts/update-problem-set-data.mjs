import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STUDY_PLANS = ["leetcode-75", "top-interview-150"];
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
    "// Generated from official LeetCode study-plan data.",
    "// Refresh with: node scripts/update-problem-set-data.mjs",
    "export const RAW_PROBLEM_SET_ENTRIES = [",
  ];

  for (const plan of plans) {
    lines.push(`  // ${plan.name}`);

    for (const group of plan.planSubGroups) {
      for (const question of group.questions) {
        lines.push(renderEntry(toEntry(plan, group, question)));
      }
    }
  }

  lines.push("] as const satisfies readonly RawProblemSetEntry[];", "");
  return lines.join("\n");
}

const plans = await Promise.all(STUDY_PLANS.map(fetchPlan));
const contents = renderFile(plans);

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, contents, "utf8");

for (const plan of plans) {
  const count = plan.planSubGroups.reduce((total, group) => total + group.questions.length, 0);
  console.log(`${plan.slug}: ${count}`);
}

console.log(`wrote ${OUTPUT_PATH}`);
