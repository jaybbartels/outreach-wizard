'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Collection {
  id: string
  name: string
  icon?: string
  description?: string
}

export default function WizardHome() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const response = await api.getCollections()
      setCollections(response.data?.collections || [])
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCollectionName.trim()) return

    setCreating(true)
    setError('')
    try {
      const response = await api.createCollection({
        name: newCollectionName,
        description: newCollectionDesc,
        icon: '📂'
      })

      if (response.success) {
        setCollections([...collections, response.data])
        setNewCollectionName('')
        setNewCollectionDesc('')
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error('Failed to create collection:', error)
      setError('Failed to create collection. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">🚀 Outreach Wizard</h1>
              <p className="text-gray-700 mt-2">Your complete guide to B2B outreach campaigns</p>
            </div>
            <a href="https://outreach-analytics-puce.vercel.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-bold text-lg">
              Analytics →
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Stage 1: Collections */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Stage 1️⃣ : Add Data to Database
          </h2>
          <p className="text-gray-700 mb-8">Create collections to organize your executive targets</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {loading ? (
              <div className="text-center py-12 text-gray-700">Loading collections...</div>
            ) : collections.length > 0 ? (
              collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/wizard/${collection.id}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition p-6 border border-gray-200"
                >
                  <div className="text-5xl mb-3">{collection.icon || '📂'}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{collection.name}</h3>
                  <p className="text-gray-700 text-sm mb-4">{collection.description || 'No description'}</p>
                  <button className="text-blue-600 hover:text-blue-800 font-bold text-sm">
                    Start Campaign →
                  </button>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-700 mb-4 text-lg">No collections yet. Create one to get started!</p>
              </div>
            )}
          </div>

          {/* Create Collection Form */}
          {showCreateForm ? (
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create New Collection</h3>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div>
                  <label className="block text-gray-900 font-bold mb-2">Collection Name *</label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g., Healthcare Providers, Tech Startups"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-900 font-bold mb-2">Description</label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Describe this collection..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    {creating ? 'Creating...' : 'Create Collection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setError('')
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-900 px-6 py-3 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-bold text-lg"
            >
              + Create New Collection
            </button>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">How to Use the Outreach Wizard</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold text-lg text-gray-900 mb-3">Stage 1: Organize Data 📂</h4>
              <p className="text-gray-700 leading-relaxed">Create collections to organize your executive targets. Each collection groups related companies and executives for targeted outreach campaigns.</p>
            </div>
            <div className="p-6 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-bold text-lg text-gray-900 mb-3">Stage 2: Execute Campaign 🚀</h4>
              <p className="text-gray-700 leading-relaxed">Select a collection, name your campaign, choose targets, create a strategy, build personalized messaging, schedule and execute your outreach.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
