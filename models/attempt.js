const mongoose = require('mongoose')

const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    response: { type: String, default: '' },
    isCorrect: { type: Boolean, default: null },
    awardedMarks: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 0 },
    gradedByInstructor: { type: Boolean, default: false },
  },
  { _id: false }
)

const attemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    set: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionSet', required: true },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    
    needsGrading: { type: Boolean, default: false },
    gradingStatus: {
      type: String,
      enum: ['pending', 'graded'],
      default: 'graded',
    },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

attemptSchema.index({ student: 1, completedAt: -1 })
attemptSchema.index({ set: 1 })
attemptSchema.index({ gradingStatus: 1 })

module.exports = mongoose.model('Attempt', attemptSchema)