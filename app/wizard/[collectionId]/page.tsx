'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

  // Form state
  const [campaignName, setCampaignName] = useState('')
  const [campaignPurpose, setCampaignPurpose] = useState('')
  const [channel, setChannel] = useState('email')
  const [strategy, setStrategy] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')

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

  const getSelectedTitles = () => {
    const titles = executives
      .filter((e) => selectedExecutives.includes(e.id))
      .map((e) => e.title)
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

  const handleExecuteCampaign = async () => {
    setIsSubmitting(true)
    setError('')

    try {
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

      const response = await api.createCampaign(campaignData)

      if (response.success) {
        alert('Campaign created successfully! 🎉')
        router.push('/')
      } else {
        setError(response.error?.message || 'Failed to create campaign')
      }
    } catch (error) {
      console.error('Failed to create campaign:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to create campaign: ${errorMsg}`)
    } finally {
      setIsSubmitting(false)
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
                      placeholder="Create your message, or click 'Generate with AI' above."
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      rows={10}
                    />
                    <p className="text-gray-600 text-sm mt-2">💡 Tip: Use name, company, and title placeholders for personalization</p>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 5: Review & Execute</h2>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4 mb-6">
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
                    {strategy && (
                      <div>
                        <p className="text-gray-700 font-bold">Strategy:</p>
                        <p className="text-gray-900 whitespace-pre-wrap text-sm">{strategy}</p>
                      </div>
                    )}
                    {messageTemplate && (
                      <div>
                        <p className="text-gray-700 font-bold">Message Preview:</p>
                        <p className="text-gray-900 whitespace-pre-wrap text-sm bg-white p-3 rounded border">{messageTemplate}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-700 font-bold">Status:</p>
                      <p className="text-green-600 font-bold">Ready to Launch</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-900 font-bold mb-2">Schedule Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <p className="text-gray-600 text-sm mt-2">Leave blank to send immediately</p>
                  </div>
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
                    {isSubmitting ? '⏳ Launching...' : '🚀 Launch Campaign'}
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
