const jwt = require('jsonwebtoken')
const User = require('../models/user')
const { isEmail, isStr } = require('../utils/validators')

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

const sanitize = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  bio: u.bio,
})

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body

    if (!isStr(name, 2, 20))
      return res.status(422).json({ message: 'Name must be 2-20 chars' })
    if (!isEmail(email))
      return res.status(422).json({ message: 'Valid email required' })
    if (!isStr(password, 6, 30))
      return res.status(422).json({ message: 'Password min 6 chars' })

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const safeRole = ['student', 'instructor'].includes(role) ? role : 'student'
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: safeRole,
      status: safeRole === 'instructor' ? 'pending' : 'approved',
    })

    if (safeRole === 'instructor') {
      return res.status(201).json({ user: sanitize(user) })
    }

    const token = signToken(user._id)
    res.status(201).json({ token, user: sanitize(user) })
  } catch (err) {
    next(err)
  }
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(422).json({ message: 'Email and password required' })

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const match = await user.comparePassword(password)
    if (!match) return res.status(401).json({ message: 'Invalid credentials' })

    if (user.status === 'blocked')
      return res.status(403).json({ message: 'Account blocked by admin' })
    if (user.status === 'pending')
      return res.status(403).json({ message: 'Account pending approval by admin' })

    const token = signToken(user._id)
    res.json({ token, user: sanitize(user) })
  } catch (err) {
    next(err)
  }
}

exports.me = async (req, res) => {
  res.json({ user: sanitize(req.user) })
}