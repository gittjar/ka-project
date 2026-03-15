import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  parent:    { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  createdBy: { type: String },
}, { timestamps: true });

export default mongoose.model('Folder', folderSchema);
