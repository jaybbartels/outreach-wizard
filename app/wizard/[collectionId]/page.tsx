'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'

interface Executive {
  id: string
  name: string
  title: string
  email: string
  company_name?: string
  linkedin_url?: string
}

interface CampaignStep {
  step: number
  title: string
  description: string
}

const STEPS: CampaignStep[] = [
  { step: 1, title: 'Campaign Details', description: 'Name your campaign' },
  { step: 2, title: 'Select Targets', description: 'Choose executives' },
  { step: 3, title: 'Strategy', description: 'Define approach' },
  { step: 4, title: 'Messaging', description: 'Craft your message' },
  { step: 5, title: 'Execute', description: 'Schedule & send' }
]

function mergeTemplate(template: string, exec: Executive) {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, exec.name || '')
    .replace(/\{\{\s*company\s*\}\}/gi, exec.company_name || 'your company')
    .replace(/\{\{\s*title\s*\}\}/gi, exec.title || '')
}

function splitSubjectBody(merged: string) {
  const lines = merged.split('\n')
  if (lines[0]?.toLowerCase().startsWith('subject:')) {
    const subject = lines[0].replace(/subject:\s*/i, '').trim()
    const body = lines.slice(1).join('\n').trim()
    return { subject, body }
  }
  return { subject: '', body: merged.trim() }
}

function formatDateForFile(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export default function CampaignWizard() {
  const params = useParams()
  const router = useRouter()
  const collectionId = params.collectionId as string

  const [currentStep, setCurrentStep] = useState(1)
  const [collection, setCollection] = useState<any>(null)
  const [executives, setExecutives] = useState<Executive[]>([])
  const [selectedExecutives, setSelectedExecutives] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [generatingMessage, setGeneratingMessage] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [launchSuccess, setLaunchSuccess] = useState(false)

  // Form state
  const [campaignName, setCampaignName] = useState('')
  const [campaignPurpose, setCampaignPurpose] = useState('')
  const [channel, setChannel] = useState('email')
  const [strategy, setStrategy] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [staggerMinutes, setStaggerMinutes] = useState(15)

  useEffect(() => {
    loadData()
  }, [collectionId])

  const loadData = async () => {
    try {
      const collections = await api.getCollections()
      const coll = collections.data?.collections?.find((c: any) => c.id === collectionId)
      setCollection(coll)

      const execs = await api.getExecutives(collectionId, 500, 0)
      setExecutives(execs.data?.executives || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExecutive = (executiveId: string) => {
    setSelectedExecutives((prev) =>
      prev.includes(executiveId)
        ? prev.filter((id) => id !== executiveId)
        : [...prev, executiveId]
    )
  }

  const getSelectedExecs = () => executives.filter((e) => selectedExecutives.includes(e.id))

  const getSelectedTitles = () => {
    const titles = getSelectedExecs().map((e) => e.title)
    return Array.from(new Set(titles)).join(', ') || 'Executives'
  }

  const handleGenerateStrategy = async () => {
    setGeneratingStrategy(true)
    setError('')
    try {
      const res = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          purpose: campaignPurpose,
          channel,
          executiveCount: selectedExecutives.length,
          executiveTitles: getSelectedTitles()
        })
      })
      const data = await res.json()
      if (data.success) {
        setStrategy(data.strategy)
      } else {
        setError(data.error?.message || 'Failed to generate strategy')
      }
    } catch (err) {
      setError('Failed to generate strategy. Please try again.')
    } finally {
      setGeneratingStrategy(false)
    }
  }

  const handleGenerateMessage = async () => {
    setGeneratingMessage(true)
    setError('')
    try {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName,
          purpose: campaignPurpose,
          strategy,
          channel,
          executiveTitles: getSelectedTitles()
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessageTemplate(data.message)
      } else {
        setError(data.error?.message || 'Failed to generate message')
      }
    } catch (err) {
      setError('Failed to generate message. Please try again.')
    } finally {
      setGeneratingMessage(false)
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    setCurrentStep(Math.max(1, currentStep - 1))
  }

  const validateStep = (step: number) => {
    if (step === 1 && !campaignName.trim()) {
      setError('Please enter a campaign name')
      return false
    }
    if (step === 2 && selectedExecutives.length === 0) {
      setError('Please select at least one executive')
      return false
    }
    setError('')
    return true
  }

  // Build one row per recipient: merged subject/body + computed send time
  const buildRecipientRows = () => {
    const baseTime = scheduledDate ? new Date(scheduledDate) : new Date()
    return getSelectedExecs().map((exec, idx) => {
      const merged = mergeTemplate(messageTemplate, exec)
      const { subject, body } = splitSubjectBody(merged)
      const sendAt = new Date(baseTime.getTime() + idx * staggerMinutes * 60000)
      return {
        executive_id: exec.id,
        executive_name: exec.name,
        executive_email: exec.email || '',
        company_name: exec.company_name || '',
        title: exec.title || '',
        subject,
        message_content: body,
        channel,
        scheduled_at: sendAt.toISOString()
      }
    })
  }

  const downloadExcel = (rows: ReturnType<typeof buildRecipientRows>) => {
    const sheetData = rows.map((r) => ({
      Name: r.executive_name,
      Company: r.company_name,
      Title: r.title,
      Email: r.executive_email,
      Channel: r.channel,
      Subject: r.subject,
      Message: r.message_content,
      'Send Date': new Date(r.scheduled_at).toLocaleDateString(),
      'Send Time': new Date(r.scheduled_at).toLocaleTimeString()
    }))

    const worksheet = XLSX.utils.json_to_sheet(sheetData)
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 28 },
      { wch: 10 }, { wch: 35 }, { wch: 60 }, { wch: 12 }, { wch: 12 }
    ]

    const workbook = XLSX.utils.book_new()
    const sheetName = (campaignName || 'Outreach').substring(0, 31)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const fileName = `${(campaignName || 'outreach').replace(/[^a-z0-9]/gi, '_')}_send_list.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const handleExecuteCampaign = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      // 1. Create the campaign record
      const campaignData = {
        user_id: 'demo-user-001',
        name: campaignName,
        channel,
        purpose: campaignPurpose,
        collection_id: collectionId,
        total_recipients: selectedExecutives.length,
        status: 'draft',
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        replied_count: 0
      }

      const campaignResponse = await api.createCampaign(campaignData)
      if (!campaignResponse.success) {
        setError(campaignResponse.error?.message || 'Failed to create campaign')
        return
      }
      const campaignId = campaignResponse.data.id

      // 2. Build personalized rows (merged message + computed send time)
      const rows = buildRecipientRows()

      // 3. Save each prepared message to the database for the send tool to consume
      const saveResponse = await api.bulkCreateMessages(campaignId, rows)
      if (!saveResponse.success) {
        setError(saveResponse.error?.message || 'Campaign created, but failed to save prepared messages')
        return
      }

      // 4. Generate the downloadable Excel file
      downloadExcel(rows)

      setLaunchSuccess(true)
    } catch (error) {
      console.error('Failed to execute campaign:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to launch campaign: ${errorMsg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-5xl mb-4">⏳</div>
          <p className="text-lg text-gray-700">Loading campaign wizard...</p>
        </div>
      </div>
    )
  }

  if (launchSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-6">
        <div className="bg-white rounded-lg shadow-lg p-10 max-w-lg text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Campaign Launched!</h2>
          <p className="text-gray-700 mb-6">
            {selectedExecutives.length} personalized message(s) were saved to the database and an Excel
            send-list has been downloaded to your computer, ready for your send tool.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/" className="text-blue-600 hover:text-blue-800 font-bold">← Back</Link>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">Campaign Wizard</h1>
              <p className="text-gray-700">{collection?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Progress</h3>
              <div className="space-y-2">
                {STEPS.map((stepItem) => (
                  <button
                    key={stepItem.step}
                    onClick={() => setCurrentStep(stepItem.step)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      currentStep === stepItem.step
                        ? 'bg-blue-600 text-white font-bold'
                        : currentStep > stepItem.step
                        ? 'bg-green-100 text-green-900'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-bold">Step {stepItem.step}</div>
                    <div className="text-sm">{stepItem.title}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-8">
              {currentStep === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 1: Campaign Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-900 font-bold mb-2">Campaign Name *</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="e.g., Q3 Healthcare Director Outreach"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-900 font-bold mb-2">Campaign Purpose</label>
                      <textarea
                        value={campaignPurpose}
                        onChange={(e) => setCampaignPurpose(e.target.value)}
                        placeholder="What's the goal of this campaign?"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-900 font-bold mb-2">Channel</label>
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="email">Email</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="phone">Phone</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Select Targets</h2>
                  <p className="text-gray-700 mb-6">Selected: {selectedExecutives.length} executive(s)</p>

                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-300 rounded-lg p-4">
                    {executives.length > 0 ? (
                      executives.map((executive) => (
                        <label
                          key={executive.id}
                          className="flex items-start p-3 border-2 border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExecutives.includes(executive.id)}
                            onChange={() => toggleExecutive(executive.id)}
                            className="mt-1 mr-3 w-4 h-4"
                          />
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">{executive.name}</p>
                            <p className="text-gray-700 text-sm">{executive.title}</p>
                            <p className="text-gray-600 text-sm">{executive.company_name || 'N/A'}</p>
                            {executive.email && <p className="text-blue-600 text-sm">{executive.email}</p>}
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="text-gray-600">No executives found in this collection</p>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Step 3: Define Strategy</h2>
                    <button
                      onClick={handleGenerateStrategy}
                      disabled={generatingStrategy}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                    >
                      {generatingStrategy ? '✨ Generating...' : '✨ Generate with AI'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Outreach Strategy</label>
                    <textarea
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      placeholder="Describe your approach: timing, tone, value proposition, etc. Or click 'Generate with AI' above."
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      rows={8}
                    />
                    <p className="text-gray-500 text-xs mt-2">
                      Note: this is advisory guidance only. Actual per-recipient send timing is set in Step 5.
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Step 4: Craft Messaging</h2>
                    <button
                      onClick={handleGenerateMessage}
                      disabled={generatingMessage}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold text-sm"
                    >
                      {generatingMessage ? '✨ Generating...' : '✨ Generate with AI'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Message Template</label>
                    <textarea
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      placeholder="Create your message, or click 'Generate with AI' above. Use {{name}}, {{company}}, {{title}} placeholders."
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-mono text-sm"
                      rows={10}
                    />
                    <p className="text-gray-600 text-sm mt-2">💡 Use placeholders: name, company, title — merged per-recipient in Step 5</p>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Review & Execute</h2>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4 mb-8">
                    <div>
                      <p className="text-gray-700 font-bold">Campaign Name:</p>
                      <p className="text-gray-900">{campaignName}</p>
                    </div>
                    <div>
                      <p className="text-gray-700 font-bold">Targets:</p>
                      <p className="text-gray-900">{selectedExecutives.length} executives</p>
                    </div>
                    <div>
                      <p className="text-gray-700 font-bold">Channel:</p>
                      <p className="text-gray-900 capitalize">{channel}</p>
                    </div>
                    <div>
                      <p className="text-gray-700 font-bold">Status:</p>
                      <p className="text-green-600 font-bold">Ready to Launch</p>
                    </div>
                  </div>

                  {/* Send scheduling controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div>
                      <label className="block text-gray-900 font-bold mb-2">First Send Date/Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                      <p className="text-gray-600 text-xs mt-1">Leave blank to use right now as the start time</p>
                    </div>
                    <div>
                      <label className="block text-gray-900 font-bold mb-2">Minutes Between Sends</label>
                      <input
                        type="number"
                        min={0}
                        value={staggerMinutes}
                        onChange={(e) => setStaggerMinutes(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                      <p className="text-gray-600 text-xs mt-1">Each recipient is staggered by this many minutes</p>
                    </div>
                  </div>

                  {/* Personalized Email Previews - copy/paste-ready per recipient */}
                  {messageTemplate && (
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">📋 Personalized Previews</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Copy any of these to manually send a test message, or click Launch below to save all of
                        them to the database and download a ready-to-deploy Excel send-list.
                      </p>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {buildRecipientRows().map((row) => (
                          <div key={row.executive_id} className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-bold text-gray-900">{row.executive_name}</p>
                                <p className="text-gray-600 text-sm">{row.title} · {row.company_name || 'N/A'}</p>
                                <p className="text-gray-500 text-xs mt-1">
                                  Scheduled: {new Date(row.scheduled_at).toLocaleString()}
                                </p>
                              </div>
                              {row.executive_email && (
                                <a
                                  href={`mailto:${encodeURIComponent(row.executive_email)}?subject=${encodeURIComponent(row.subject)}&body=${encodeURIComponent(row.message_content)}`}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap"
                                >
                                  ✉️ Open in Email App
                                </a>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-gray-700 w-16">To:</label>
                                <input
                                  readOnly
                                  value={row.executive_email || 'No email on file'}
                                  className="flex-1 text-sm px-2 py-1 border rounded bg-gray-50 text-gray-900"
                                />
                                <button
                                  onClick={() => copyToClipboard(row.executive_email, `${row.executive_id}-email`)}
                                  className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded font-bold text-gray-900"
                                >
                                  {copiedId === `${row.executive_id}-email` ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>

                              {row.subject && (
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-bold text-gray-700 w-16">Subject:</label>
                                  <input
                                    readOnly
                                    value={row.subject}
                                    className="flex-1 text-sm px-2 py-1 border rounded bg-gray-50 text-gray-900"
                                  />
                                  <button
                                    onClick={() => copyToClipboard(row.subject, `${row.executive_id}-subject`)}
                                    className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded font-bold text-gray-900"
                                  >
                                    {copiedId === `${row.executive_id}-subject` ? '✓ Copied' : 'Copy'}
                                  </button>
                                </div>
                              )}

                              <div className="flex items-start gap-2">
                                <label className="text-xs font-bold text-gray-700 w-16 pt-1">Body:</label>
                                <textarea
                                  readOnly
                                  value={row.message_content}
                                  rows={4}
                                  className="flex-1 text-sm px-2 py-1 border rounded bg-gray-50 text-gray-900"
                                />
                                <button
                                  onClick={() => copyToClipboard(row.message_content, `${row.executive_id}-body`)}
                                  className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded font-bold text-gray-900 self-start"
                                >
                                  {copiedId === `${row.executive_id}-body` ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-4 mt-8 pt-6 border-t-2 border-gray-200">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 1}
                  className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-bold"
                >
                  ← Previous
                </button>

                {currentStep === 5 ? (
                  <button
                    onClick={handleExecuteCampaign}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-bold text-lg"
                  >
                    {isSubmitting ? '⏳ Saving & Exporting...' : '🚀 Launch Campaign & Download Send List'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
