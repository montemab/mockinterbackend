const mongoose = require('mongoose')

const questionSetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    category: {
      type: String,
      enum: ['React', 'JavaScript', 'Node.js', 'MongoDB', 'DSA', 'CSS', 'HR'],
      default: 'React',
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'archived'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

questionSetSchema.index({ createdBy: 1 })
questionSetSchema.index({ status: 1 })
questionSetSchema.index({ category: 1, difficulty: 1 })

module.exports = mongoose.model('QuestionSet', questionSetSchema)