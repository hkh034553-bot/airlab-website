import { connectDB, disconnectDB } from '../db.js'
import { contentModels } from '../models/content.js'
import { ApplicationModel } from '../models/Application.js'
import { extractDataUrisToMediaBlobs } from '../services/mediaStorage.js'

async function main() {
  await connectDB()

  let totalDocsScanned = 0
  let totalDocsUpdated = 0
  let totalBlobsCreated = 0
  let totalSavedBytes = 0

  for (const [slug, model] of contentModels.entries()) {
    let collectionDocs = 0
    let collectionUpdated = 0
    let collectionBlobs = 0

    const cursor = model.find().lean().cursor()
    for await (const doc of cursor) {
      totalDocsScanned += 1
      collectionDocs += 1

      const { value: prepared, extractedCount, savedBytes } = await extractDataUrisToMediaBlobs(
        doc as Record<string, unknown>,
        slug,
      )

      if (extractedCount > 0) {
        const { _id, ...rest } = prepared
        await model.updateOne({ _id }, { $set: rest })
        totalDocsUpdated += 1
        collectionUpdated += 1
        totalBlobsCreated += extractedCount
        collectionBlobs += extractedCount
        totalSavedBytes += savedBytes
      }
    }

    console.log(
      `[${slug}] scanned=${collectionDocs}, updated=${collectionUpdated}, blobsCreated=${collectionBlobs}`,
    )
  }

  // Also migrate any inline base64 CVs in the applications collection
  let appDocs = 0
  let appUpdated = 0
  let appBlobs = 0
  const appCursor = ApplicationModel.find().lean().cursor()
  for await (const doc of appCursor) {
    totalDocsScanned += 1
    appDocs += 1

    const { value: prepared, extractedCount, savedBytes } = await extractDataUrisToMediaBlobs(
      doc as Record<string, unknown>,
      'applications',
    )

    if (extractedCount > 0) {
      const { _id, ...rest } = prepared
      await ApplicationModel.updateOne({ _id }, { $set: rest })
      totalDocsUpdated += 1
      appUpdated += 1
      totalBlobsCreated += extractedCount
      appBlobs += extractedCount
      totalSavedBytes += savedBytes
    }
  }
  console.log(
    `[applications] scanned=${appDocs}, updated=${appUpdated}, blobsCreated=${appBlobs}`,
  )

  console.log('\nMigration complete:')
  console.log(`  Documents scanned : ${totalDocsScanned}`)
  console.log(`  Documents updated : ${totalDocsUpdated}`)
  console.log(`  Media blobs saved : ${totalBlobsCreated}`)
  console.log(`  Inline MB moved   : ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} MB`)
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })
