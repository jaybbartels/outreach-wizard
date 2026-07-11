import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { campaignName, purpose, strategy, channel, executiveTitles } = await request.json()

    const prompt = `You are a B2B outreach copywriter. Write a personalized outreach message template for the following campaign:

Campaign Name: ${campaignName}
Purpose: ${purpose}
Channel: ${channel}
Strategy: ${strategy}
Target Titles: ${executiveTitles}

Write a message template using {{name}}, {{company}}, and {{title}} as placeholders for personalization.
Keep it concise (under 150 words), professional, and compelling.
${channel === 'email' ? 'Include a subject line at the top prefixed with "Subject:".' : ''}

Return ONLY the message template, no additional commentary.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const messageTemplate = textBlock && 'text' in textBlock ? textBlock.text : ''

    return NextResponse.json({ success: true, message: messageTemplate })
  } catch (error) {
    console.error('Message generation error:', error)
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Failed to generate message' } },
      { status: 500 }
    )
  }
}
