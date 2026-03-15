import mongoose from 'mongoose';

const galleryImageSchema = new mongoose.Schema({
  blobName:   { type: String, required: true, unique: true },
  url:        { type: String, required: true },
  uploadedBy: { type: String },
  folderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  mediaType:  { type: String, enum: ['image', 'video'], default: 'image' },
  fileSize:   { type: Number, default: 0 }, // tavua

  // EXIF-metatiedot (kuvat)
  exif: {
    dateTaken:    { type: Date },
    make:         { type: String },
    model:        { type: String },
    lens:         { type: String },
    software:     { type: String },
    fNumber:      { type: Number },
    exposureTime: { type: String },
    iso:          { type: Number },
    focalLength:  { type: Number },
    focalLength35:{ type: Number },
    flash:        { type: String },
    whiteBalance: { type: String },
    width:        { type: Number },
    height:       { type: Number },
    orientation:  { type: String },
    latitude:     { type: Number },
    longitude:    { type: Number },
    altitude:     { type: Number },
    locationName: { type: String },
  },
}, { timestamps: true });

export default mongoose.model('GalleryImage', galleryImageSchema);
