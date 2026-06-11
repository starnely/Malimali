const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
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

module.exports = mongoose.model('Store', storeSchema);