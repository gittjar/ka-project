import mongoose from 'mongoose';

const shareTokenSchema = new mongoose.Schema({
  token:         { type: String, required: true, unique: true, index: true },
  blobName:      { type: String, required: true, index: true },
  folderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  createdBy:     { type: String },
  createdAt:     { type: Date, default: Date.now },
  downloadCount: { type: Number, default: 0 },
  lastDownloadAt:{ type: Date, default: null },
});

export default mongoose.model('ShareToken', shareTokenSchema);
