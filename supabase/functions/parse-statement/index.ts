import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a bank statement parser. Extract all transactions from the following bank statement text.

For each transaction, extract:
- date: in YYYY-MM-DD format
- description: the transaction description/title
- amount: the absolute numeric value (positive number, no currency symbols)

Rules:
- Only include actual purchases/charges (positive values on credit card statements)
- Skip payments, refunds, or negative amounts
- If a date uses DD/MM/YYYY format, convert to YYYY-MM-DD
- If a date uses DD MMM YYYY or similar, convert to YYYY-MM-DD
- Return ONLY a valid JSON array, no markdown, no explanation

Example output:
[{"date":"2025-01-15","description":"UBER TRIP","amount":25.50},{"date":"2025-01-16","description":"NETFLIX","amount":55.90}]

Bank statement text:
${text.substring(0, 15000)}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process statement" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let transactions;
    try {
      transactions = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse transactions from statement", raw: content }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate and clean
    const cleaned = transactions
      .filter(
        (t: { date?: string; description?: string; amount?: number }) =>
          t.date && t.description && typeof t.amount === "number" && t.amount > 0
      )
      .map((t: { date: string; description: string; amount: number }) => ({
        date: t.date,
        description: t.description,
        amount: Math.round(t.amount * 100) / 100,
      }));

    return new Response(JSON.stringify({ transactions: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
