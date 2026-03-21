import mongoose from 'mongoose';

const rsvpSchema = new mongoose.Schema({
  userId:   { type: String, required: true },
  username: { type: String, required: true },
  status:   { type: String, enum: ['attending', 'not_attending', 'maybe'], required: true },
}, { _id: false });

const eventSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  startDate:    { type: Date, required: true },
  endDate:      { type: Date },
  location:     { type: String, default: '' },
  contactName:  { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  imageUrl:     { type: String, default: '' },
  blobName:     { type: String, default: '' },
  createdBy:    { type: String, required: true },
  createdById:  { type: String, required: true },
  rsvps:        { type: [rsvpSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
