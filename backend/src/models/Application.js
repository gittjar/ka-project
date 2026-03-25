import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 64 },
  email:      { type: String, required: true, trim: true, maxlength: 128 },
  location:   { type: String, required: true, trim: true, maxlength: 64 },
  favDrink:   { type: String, required: true, trim: true, maxlength: 64 },
  motivation: { type: String, required: true, trim: true, maxlength: 2000 },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  handledBy:  { type: String, default: null },   // admin username
  handledAt:  { type: Date,   default: null },
  createdAt:  { type: Date,   default: Date.now },
});

export default mongoose.model('Application', applicationSchema);
