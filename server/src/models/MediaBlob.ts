import mongoose, { Schema, type Model } from 'mongoose'

export interface MediaBlobDoc {
  _id: mongoose.Types.ObjectId
  mimeType: string
  data: Buffer
  size: number
  sourceSlug?: string
  createdAt: Date
  updatedAt: Date
}

const mediaBlobSchema = new Schema<MediaBlobDoc>(
  {
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    sourceSlug: { type: String },
  },
  {
    collection: 'media_blobs',
    timestamps: true,
    versionKey: false,
  },
)

export const MediaBlobModel: Model<MediaBlobDoc> =
  (mongoose.models.MediaBlob as Model<MediaBlobDoc> | undefined) ??
  mongoose.model<MediaBlobDoc>('MediaBlob', mediaBlobSchema)
