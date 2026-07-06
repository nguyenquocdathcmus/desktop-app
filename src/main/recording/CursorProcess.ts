import { spawn, ChildProcess } from 'child_process'
import { dirname } from 'path'
import { createWriteStream, WriteStream, mkdirSync } from 'fs'
import { binPath } from '../binPath'

export interface CursorEvent {
  t: number
  x?: number
  y?: number
  type: 'move' | 'click' | 'keydown' | 'scroll' | 'ready'
  button?: 'left' | 'right' | 'middle'
  keyCode?: number
  modifiers?: string[]
  display?: string
  dx?: number
  dy?: number
}

export class CursorProcess {
  private proc: ChildProcess | null = null
  private fileStream: WriteStream | null = null
  private eventCount = 0

  private get binaryPath(): string {
    return binPath('cursor-tracker')
  }

  start(outputPath: string): void {
    if (this.proc) throw new Error('CursorProcess already running')

    // Set up file stream for event log
    mkdirSync(dirname(outputPath), { recursive: true })
    this.fileStream = createWriteStream(outputPath, { encoding: 'utf-8' })
    this.fileStream.write('[\n')
    this.eventCount = 0

    this.proc = spawn(this.binaryPath, [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
    })

    let buffer = ''
    this.proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as CursorEvent
          if (event.type === 'ready') continue  // skip ready signal

          // Write to JSON array file
          const prefix = this.eventCount > 0 ? ',\n' : ''
          this.fileStream?.write(prefix + JSON.stringify(event))
          this.eventCount++
        } catch {
          // Not JSON
        }
      }
    })

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[cursor-tracker]', chunk.toString())
    })

    this.proc.on('exit', () => {
      this.proc = null
    })
  }

  stop(): string | null {
    if (!this.proc) return null
    this.proc.kill('SIGTERM')
    this.proc = null

    // Close JSON array
    this.fileStream?.write('\n]\n')
    this.fileStream?.end()
    this.fileStream = null

    return `${this.eventCount} cursor events recorded`
  }

  get isRunning(): boolean {
    return this.proc !== null
  }
}
