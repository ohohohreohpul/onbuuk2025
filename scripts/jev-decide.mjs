#!/usr/bin/env node
// Jev decision runner — lets TypeSafe's Jev make product/implementation calls
// instead of pausing for human input. Each decision is a Choice question over a
// shared project state; results (choice + full distribution) are appended to
// docs/DECISIONS.md so every call is auditable and reversible.
//
// Usage:
//   TYPESAFE_API_KEY=... node scripts/jev-decide.mjs scripts/decisions/<spec>.json
//
// Spec shape: { "title": string, "state": object, "decisions": { id: { instructions, criteria, fallback } } }
// Policy: if Jev's confidence < LOW_CONFIDENCE, the spec's `fallback` is used and
// flagged — work continues either way; nothing blocks on a human.

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const LOW_CONFIDENCE = 0.35;
const LOG_PATH = "docs/DECISIONS.md";

function fail(message) {
  console.error(`jev-decide: ${message}`);
  process.exit(1);
}

async function loadSpec(path) {
  if (!path) fail("pass a decision spec JSON path");
  const spec = JSON.parse(await readFile(path, "utf8"));
  if (!spec.state || !spec.decisions) fail("spec needs `state` and `decisions`");
  for (const [id, d] of Object.entries(spec.decisions)) {
    if (!d.instructions || !d.criteria) fail(`decision "${id}" needs instructions + criteria`);
    if (d.fallback && !(d.fallback in d.criteria)) fail(`decision "${id}" fallback not in criteria`);
  }
  return spec;
}

async function askJev(apiKey, spec) {
  const questions = Object.fromEntries(
    Object.entries(spec.decisions).map(([id, d]) => [
      id,
      { type: "choice", instructions: d.instructions, criteria: d.criteria },
    ]),
  );
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state: spec.state, model: MODEL, questions }),
  });
  if (!res.ok) fail(`TypeSafe ${res.status}: ${await res.text()}`);
  return res.json();
}

function resolve(spec, response) {
  return Object.entries(spec.decisions).map(([id, d]) => {
    const answer = response.answers?.[id] ?? {};
    const confidence = answer.confidence ?? 0;
    const isLow = confidence < LOW_CONFIDENCE && Boolean(d.fallback);
    return {
      id,
      decided: isLow ? d.fallback : answer.choice,
      jevChoice: answer.choice,
      confidence,
      isLow,
      probabilities: answer.probabilities ?? {},
    };
  });
}

function toMarkdown(spec, model, results) {
  const date = new Date().toISOString().slice(0, 10);
  const rows = results.map((r) => {
    const dist = Object.entries(r.probabilities)
      .sort((a, b) => b[1] - a[1])
      .map(([k, p]) => `${k} ${(p * 100).toFixed(0)}%`)
      .join(", ");
    const flag = r.isLow ? ` (low confidence → fallback; Jev said ${r.jevChoice})` : "";
    return `| ${r.id} | **${r.decided}**${flag} | ${r.confidence.toFixed(2)} | ${dist} |`;
  });
  return [
    `\n## ${date} — ${spec.title} (${model})\n`,
    "| Decision | Outcome | Confidence | Distribution |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

async function main() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) fail("TYPESAFE_API_KEY is not set");
  const spec = await loadSpec(process.argv[2]);
  const response = await askJev(apiKey, spec);
  const results = resolve(spec, response);
  await mkdir(dirname(LOG_PATH), { recursive: true });
  await appendFile(LOG_PATH, toMarkdown(spec, response.model, results));
  console.log(JSON.stringify({ model: response.model, usage: response.usage, results }, null, 2));
}

main().catch((err) => fail(err.message));
