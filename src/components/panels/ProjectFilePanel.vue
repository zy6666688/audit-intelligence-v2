<template>
  <div class="project-file-panel" v-if="projectId">
    <div class="header">
      <div class="title">项目文件区</div>
      <div class="actions">
        <label class="upload-btn">
          上传文件
          <input type="file" multiple @change="onFileChange" />
        </label>
        <button class="refresh-btn" @click="refresh" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>
    </div>

    <div class="body" v-if="files.length">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
      >
        <div class="file-main">
          <div class="file-name" :title="file.name">{{ file.name }}</div>
          <div class="file-meta">
            <span>{{ formatSize(file.size) }}</span>
            <span>·</span>
            <span>{{ formatTime(file.uploadedAt) }}</span>
          </div>
          <div class="file-tags" v-if="file.tags?.length">
            <span
              v-for="tag in file.tags"
              :key="tag"
              class="tag"
            >
              {{ tag }}
            </span>
          </div>
          <div class="file-note" v-if="file.note">
            {{ file.note }}
          </div>
        </div>

        <div class="file-actions">
          <button @click="attachToCurrentNode(file)" :disabled="!selectedNode">
            插入到节点
          </button>
          <button @click="downloadFile(file)">下载</button>
          <button class="danger" @click="removeFile(file)">删除</button>
        </div>
      </div>
    </div>

    <div class="empty" v-else>
      <p>当前项目暂无文件</p>
      <p>可以点击上方“上传文件”，或拖拽文件到此区域</p>
    </div>
  </div>
  <div v-else class="project-file-panel empty-project">
    <p>未选择项目，暂不可用项目文件区。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useProjectFileStore } from '@/store/useProjectFileStore'
import { useGraphStore } from '@/store/useGraphStore'
import apiClient from '@/api/axios-config'

interface Props {
  projectId: string
}

const props = defineProps<Props>()

const fileStore = useProjectFileStore()
const graphStore = useGraphStore()

const loading = computed(() => fileStore.loading)
const files = computed(() => fileStore.files)
const selectedNode = computed(() => graphStore.selectedNode)

onMounted(() => {
  if (props.projectId) {
    fileStore.setProject(props.projectId)
  }
})

function refresh() {
  if (!props.projectId) return
  fileStore.setProject(props.projectId)
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || !input.files.length) return

  for (const file of Array.from(input.files)) {
    await fileStore.uploadFile(file)
  }
  input.value = ''
}

function formatSize(size: number) {
  if (!size && size !== 0) return ''
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function downloadFile(file: any) {
  try {
    const res = await apiClient.get(
      `/api/projects/${fileStore.currentProjectId}/files/${file.id}/download`,
      { responseType: 'blob' }
    )
    const url = URL.createObjectURL(res.data as any)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('下载失败')
  }
}

async function removeFile(file: any) {
  const ok = confirm(`确定删除文件：${file.name}？`)
  if (!ok) return
  try {
    await fileStore.deleteFile(file.id)
  } catch (e) {
    console.error(e)
    alert('删除失败')
  }
}

function attachToCurrentNode(file: any) {
  const node = selectedNode.value as any
  if (!node) {
    alert('请先在画布中选择一个节点')
    return
  }

  const data = (node.data ||= {})

  if ('storage_path' in data) {
    data.storage_path = file.storagePath
  } else if ('file_path' in data) {
    data.file_path = file.storagePath
  } else {
    data.file_id = file.id
  }

  // 合同合规等节点可以额外记录来源文件
  if (node.type === 'ComplianceCheck' && !data.source_file_ids) {
    data.source_file_ids = [file.id]
  }

  ;(window as any).engine?.forceRender?.()
  alert(`已将文件引用插入节点：${node.type}`)
}
</script>

<style scoped lang="scss">
.project-file-panel {
  width: 260px;
  height: 100%;
  background: #252525;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
  color: #eee;
  font-size: 12px;

  &.empty-project {
    align-items: center;
    justify-content: center;
  }

  .header {
    padding: 10px 12px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #2a2a2a;

    .title {
      font-weight: 600;
      font-size: 13px;
    }

    .actions {
      display: flex;
      gap: 6px;
      align-items: center;

      .upload-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        background: #3498db;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        input[type='file'] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
      }

      .refresh-btn {
        padding: 4px 8px;
        background: #444;
        border: none;
        border-radius: 3px;
        color: #eee;
        cursor: pointer;
        font-size: 12px;
        &:disabled {
          opacity: 0.5;
          cursor: default;
        }
      }
    }
  }

  .body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .file-item {
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    background: #2a2a2a;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .file-main {
      .file-name {
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .file-meta {
        margin-top: 2px;
        color: #aaa;
        display: flex;
        gap: 4px;
      }
      .file-tags {
        margin-top: 4px;
        .tag {
          display: inline-block;
          padding: 1px 6px;
          margin-right: 4px;
          border-radius: 10px;
          background: #3b3b3b;
          font-size: 11px;
        }
      }
      .file-note {
        margin-top: 4px;
        color: #ccc;
      }
    }

    .file-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;

      button {
        padding: 3px 6px;
        border-radius: 3px;
        border: none;
        cursor: pointer;
        font-size: 11px;
        background: #444;
        color: #eee;

        &.danger {
          background: #c0392b;
        }

        &:hover {
          background: #555;
        }
      }
    }
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #777;
    padding: 16px;
    text-align: center;
    line-height: 1.6;
  }
}
</style>


