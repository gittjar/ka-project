import mongoose from 'mongoose';

const drinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  instructions: { type: String, required: true },
  author: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  mediaUrl:  { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', ''], default: '' },
  blobName:  { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Drink', drinkSchema);
