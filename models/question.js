const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema(
  {
    set: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet', required: true },
    type: { type: String, enum: ['mcq', 'descriptive'], required: true },
    text: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },

    options: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(opt => opt.trim().length > 0 && opt.trim().length <= 100);
      },
      message: 'Each option must be 1-100 characters'
    }
  },
    correctAnswer: { type: String, default: '' },

    modelAnswer: { type: String, default: '', maxlength: 1000 },
    marks: { type: Number, default: 1, min: 1, max: 20 },

  },
  { timestamps: true }
)

questionSchema.index({ set: 1, createdAt: 1 })

module.exports = mongoose.model('Question', questionSchema)