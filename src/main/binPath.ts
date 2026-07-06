import { join } from 'path'
import { app } from 'electron'

/**
 * Resolve path to a bundled binary.
 *
 * Dev:        <appPath>/resources/bin/<name>
 * Packaged:   <resourcesPath>/app.asar.unpacked/resources/bin/<name>
 *
 * electron-builder's asarUnpack puts files from the source `resources/`
 * folder into `app.asar.unpacked/resources/` inside the final bundle.
 */
export function binPath(name: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', name)
  }
  return join(app.getAppPath(), 'resources', 'bin', name)
}
