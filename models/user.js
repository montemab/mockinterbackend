const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'blocked', 'deactivated'],
      default: 'approved',
    },
    bio: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: true }
)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.index({ role: 1, status: 1 })

module.exports = mongoose.model('User', userSchema)