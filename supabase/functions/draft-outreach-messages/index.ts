import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { jobTitle, companyName, jobDescription, cvSummary, messageType } = body

    if (!jobTitle || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isShort = messageType === 'connection_request'
    const maxChars = isShort ? 300 : 800

    const prompt = `You are an expert at writing professional LinkedIn outreach messages for job seekers.

Write a ${isShort ? 'short LinkedIn connection request (max 300 characters)' : 'LinkedIn outreach message (max 800 characters)'}.

Applicant CV summary: ${cvSummary || 'Not provided'}
Job title: ${jobTitle}
Company: ${companyName}
Job description excerpt: ${jobDescription ? jobDescription.slice(0, 800) : 'Not provided'}

Rules:
- Do NOT invent anything about the recipient
- Reference something specific from the job or company
- Highlight 1-2 CV points relevant to the role
- Sound natural, not templated
- Do not open with "I came across your profile"
- No greeting line — start directly with content
- Output ONLY the message text, under ${maxChars} characters`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${err}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content?.trim() || ''

    return new Response(
      JSON.stringify({ message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
