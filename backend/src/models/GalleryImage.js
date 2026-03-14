import mongoose from 'mongoose';

const galleryImageSchema = new mongoose.Schema({
  blobName: { type: String, required: true, unique: true },
  url:      { type: String, required: true },
  uploadedBy: { type: String },

  // EXIF-metatiedot
  exif: {
    // Aika
    dateTaken:    { type: Date },
    // Kamera
    make:         { type: String },   // esim. "Apple"
    model:        { type: String },   // esim. "iPhone 15 Pro"
    lens:         { type: String },
    software:     { type: String },
    // Kuva-asetukset
    fNumber:      { type: Number },   // esim. 1.8
    exposureTime: { type: String },   // esim. "1/120"
    iso:          { type: Number },
    focalLength:  { type: Number },   // mm
    focalLength35:{ type: Number },   // 35mm-ekvivalentti
    flash:        { type: String },
    whiteBalance: { type: String },
    // Kuvan tiedot
    width:        { type: Number },
    height:       { type: Number },
    orientation:  { type: String },
    // Sijainti
    latitude:     { type: Number },
    longitude:    { type: Number },
    altitude:     { type: Number },
    locationName: { type: String },   // valinnainen käsin asetettu
  },
}, { timestamps: true });

export default mongoose.model('GalleryImage', galleryImageSchema);
