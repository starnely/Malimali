const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  barcode:     { type: String, required: true, index: true },
  pluNumber:   { type: Number, required: true, index: true },
  weightGrams: { type: Number, required: true },
  weightKg:    { type: Number, required: true },
  totalPrice:  { type: Number },
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  store:       { type: String },
  cashierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cashierName: { type: String },
  decodedAt:   { type: Date, default: Date.now, index: true },
}, { collection: 'weighbarcodelogs' })

module.exports = mongoose.model('WeighBarcodeLog', schema)
