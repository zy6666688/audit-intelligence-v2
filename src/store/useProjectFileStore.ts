import { defineStore } from 'pinia'
import apiClient from '@/api/axios-config'

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  size: number
  mimeType: string
  storagePath: string
  uploadedAt: string
  uploader?: string
  tags?: string[]
  note?: string
}

interface State {
  currentProjectId: string
  files: ProjectFile[]
  loading: boolean
}

export const useProjectFileStore = defineStore('projectFiles', {
  state: (): State => ({
    currentProjectId: '',
    files: [],
    loading: false
  }),

  actions: {
    setProject(projectId: string) {
      if (this.currentProjectId === projectId) return
      this.currentProjectId = projectId
      this.fetchFiles()
    },

    async fetchFiles() {
      if (!this.currentProjectId) return
      this.loading = true
      try {
        const res = await apiClient.get<ProjectFile[]>(
          `/api/projects/${this.currentProjectId}/files`
        )
        this.files = res.data || []
      } catch (e) {
        console.warn('[ProjectFileStore] fetchFiles failed', e)
      } finally {
        this.loading = false
      }
    },

    async uploadFile(file: File, note?: string, tags?: string[]) {
      if (!this.currentProjectId) throw new Error('No project selected')
      const form = new FormData()
      form.append('file', file)
      if (note) form.append('note', note)
      if (tags && tags.length) {
        form.append('tags', JSON.stringify(tags))
      }
      const res = await apiClient.post<ProjectFile>(
        `/api/projects/${this.currentProjectId}/files`,
        form
      )
      this.files.push(res.data)
      return res.data
    },

    async deleteFile(fileId: string) {
      if (!this.currentProjectId) return
      await apiClient.delete(
        `/api/projects/${this.currentProjectId}/files/${fileId}`
      )
      this.files = this.files.filter(f => f.id !== fileId)
    }
  }
})


