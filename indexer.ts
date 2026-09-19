import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) throw new Error("OpenAI API key not configured.");

    const systemPrompt = `You are an expert form architect for the DOXA enterprise platform. 
    Output ONLY raw JSON. No markdown formatting.
    Generate a highly professional form schema based on the user's prompt.
    Structure:
    {
      "title": "Form Title",
      "description": "Form Description",
      "fields": [
        {
          "id": "field_randomstring",
          "type": "short_text|long_text|email|phone|number|radio|checkbox|select|payment|rank|matrix|file|signature|date|time|section",
          "label": "Question Text",
          "description": "Help text (optional)",
          "required": true/false,
          "options": ["Opt 1", "Opt 2"] (only for radio/checkbox/select/rank),
          "columns": ["Col 1"] (only for matrix),
          "rows": ["Row 1"] (only for matrix),
          "amount": 50, "currency": "USD" (only for payment)
        }
      ]
    }
    Use "section" fields as page dividers to group related questions logically.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const schema = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(schema), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
  }
});