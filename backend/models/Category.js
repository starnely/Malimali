const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  name: {
    type:     String,
    required: true,
    trim:     true,
    lowercase: true,
  },
  // null / undefined = global (visible to all stores)
  // set to store name = only visible to that store
  store: {
    type:    String,
    default: null,
    trim:    true,
  },
  description: {
    type:    String,
    default: '',
    trim:    true,
  },
}, { timestamps: true })

// Unique per name+store combination
// (same name can exist in different stores, but not twice in same store)
// Phase 2a-2 — tenantId leads the existing compound unique index
categorySchema.index({ tenantId: 1, name: 1, store: 1 }, { unique: true })

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema)
