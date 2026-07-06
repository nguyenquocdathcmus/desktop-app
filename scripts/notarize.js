const { notarize } = require('@electron/notarize')
const path = require('path')

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context

  if (electronPlatformName !== 'darwin') return
  if (!process.env.APPLE_API_KEY_ID) {
    console.log('Skipping notarization — APPLE_API_KEY_ID not set')
    return
  }

  const appName = packager.appInfo.productName
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log(`Notarizing ${appPath}…`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleApiKey: process.env.APPLE_API_KEY_PATH,      // path to .p8 file
    appleApiKeyId: process.env.APPLE_API_KEY_ID,      // Key ID
    appleApiIssuer: process.env.APPLE_API_ISSUER,     // Issuer ID
  })

  console.log('Notarization done!')
}
