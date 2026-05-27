import { NextResponse } from "next/server";
import { validateOp, type JournalResponse } from "@/lib/journal-ops";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

const SYSTEM = `You are a financial operations parser for a personal wealth tracker.

The user describes changes to their portfolio in natural language (Spanish or English). Output ONLY valid JSON matching this schema — no markdown, no commentary, no code fences:

{
  "operations": [ <Op>, ... ]
}

An <Op> is one of:

1. {"type":"adjust_position","ticker":"TICKER","delta_shares":-1,"price_usd":100}
   Buy (positive delta_shares) or sell (negative) shares of an existing ticker. price_usd optional.

2. {"type":"set_position","ticker":"TICKER","shares":10,"avg_price_usd":50,"target_price_usd":200}
   Overwrite specific fields of a position. All fields except ticker are optional; include only the ones the user specified.

3. {"type":"adjust_asset","name":"ACCOUNT_NAME","delta_eur":100}
   Add (+) or subtract (-) EUR from a manual-cash account balance.

4. {"type":"set_asset","name":"ACCOUNT_NAME","value_eur":1000}
   Overwrite a manual-cash account balance to an exact EUR value (use when the user says "ahora tengo X" or "el saldo es X").

5. {"type":"contribute","amount_eur":100,"contribution_type":"nomina","note":"nómina mes","date":"2026-01-15"}
   Record a contribution row in the journal. contribution_type is one of "nomina", "liquidez", "inversion", "otro". date is ISO YYYY-MM-DD and optional (defaults to today).

Rules:
- Emit BOTH an adjust_asset AND a contribute op when the user describes money moving into a cash account from outside (e.g. "aporté 200 a Revolut" → adjust_asset delta +200 AND contribute type=nomina/liquidez amount=200).
- Do NOT emit contribute for internal rebalances (moving between accounts or buying/selling shares with existing cash).
- Match ticker / account names case-insensitively against the context provided below. If no close match, emit the op anyway with the user's spelling — the backend will validate.
- If the user says "vendí X de Y a Z", delta_shares is -X, price_usd is Z.
- Infer conservatively. Skip parts you are unsure about.

Examples (use the ticker and account names from the actual context below, not these placeholders):

User: "vendí 2 FOO a 100"
{"operations":[{"type":"adjust_position","ticker":"FOO","delta_shares":-2,"price_usd":100}]}

User: "aporté 500 a Savings de nómina"
{"operations":[{"type":"adjust_asset","name":"Savings","delta_eur":500},{"type":"contribute","amount_eur":500,"contribution_type":"nomina","note":"aportación"}]}

User: "el saldo de Checking es 1500"
{"operations":[{"type":"set_asset","name":"Checking","value_eur":1500}]}

User: "compré 3 BAR a 200 y vendí 4 FOO a 100"
{"operations":[{"type":"adjust_position","ticker":"BAR","delta_shares":3,"price_usd":200},{"type":"adjust_position","ticker":"FOO","delta_shares":-4,"price_usd":100}]}`;

interface RequestBody {
  text?: string;
  tickers?: string[];
  assetNames?: string[];
  today?: string;
}

export async function POST(request: Request) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Server is missing NVIDIA_API_KEY in .env.local" } satisfies JournalResponse,
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" } satisfies JournalResponse,
      { status: 400 },
    );
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "empty text" } satisfies JournalResponse,
      { status: 400 },
    );
  }

  const today = body.today ?? new Date().toISOString().slice(0, 10);
  const contextLines = [
    `Today is ${today}.`,
    `Available position tickers: ${(body.tickers ?? []).join(", ") || "(none yet)"}.`,
    `Available manual-cash account names: ${(body.assetNames ?? []).join(", ") || "(none yet)"}.`,
  ];

  const model = process.env.NVIDIA_MODEL || DEFAULT_MODEL;

  const res = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM + "\n\n" + contextLines.join("\n") },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 800,
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error: `NVIDIA ${res.status}: ${errText.slice(0, 300)}`,
      } satisfies JournalResponse,
      { status: 502 },
    );
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";

  const jsonText = extractJson(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      {
        operations: [],
        raw: content,
        error: "El modelo no devolvió JSON válido. Reintenta reformulando la frase.",
      } satisfies JournalResponse,
      { status: 200 },
    );
  }

  const rawOps = (parsed as { operations?: unknown[] })?.operations ?? [];
  const operations = rawOps
    .map((op) => validateOp(op))
    .filter((op): op is NonNullable<ReturnType<typeof validateOp>> => op !== null);

  return NextResponse.json({ operations, raw: content } satisfies JournalResponse);
}

/** Try to pull the first JSON object out of an LLM response. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}
