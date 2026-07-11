import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { campaignName, purpose, channel, executiveCount, executiveTitles } = await request.json()

    const prompt = `You are a B2B outreach strategist. Create a concise, actionable outreach strategy for the following campaign:

Campaign Name: ${campaignName}
Purpose: ${purpose}
Channel: ${channel}
Number of Targets: ${executiveCount}
Target Titles: ${executiveTitles}

Provide a strategy covering:
1. Best timing/cadence for outreach
2. Tone and approach recommendations
3. Key value propositions to emphasize
4. Follow-up cadence suggestion

Keep it concise and actionable - 4-6 bullet points maximum.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const strategy = textBlock && 'text' in textBlock ? textBlock.text : ''

    return NextResponse.json({ success: true, strategy })
  } catch (error) {
    console.error('Strategy generation error:', error)
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Failed to generate strategy' } },
      { status: 500 }
    )
  }
}
