const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: { 
    type: String, 
    trim: true 
  },
  // ✅ ADD THIS: Allows storing a unique phone number per branch
  phone: {
    type: String,
    trim: true
  }
}, { 
  timestamps: true 
});

// Phase 2a-2 — tenant-scoped uniqueness (was global unique:true)
storeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Store', storeSchema);