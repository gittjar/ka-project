import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  aliases: [String],
  quote: { type: String, default: '' },
  born: { type: String, default: '' },
  highestPromille: { type: String, default: '' },
  favDrink: { type: String, default: '' },
  location: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  points: { type: Number, default: 0 },
  photos: [{
    url:       { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    blobName:  { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  }],
  deceased: {
    year:  { type: Number, default: null },
    note:  { type: String, default: '' },
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Member', memberSchema);
