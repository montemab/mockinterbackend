const User = require('../models/user')
const QuestionSet = require('../models/questionSet')
const Attempt = require('../models/attempt')
const { isEmail, isStr, isEnum, escapeRegex } = require('../utils/validators')

exports.listUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query
    const filter = {}
    if (role) filter.role = role
    if (status) filter.status = status
    if (search && search.trim()) {
      const rx = { $regex: escapeRegex(search.trim()), $options: 'i' }
      filter.$or = [{ name: rx }, { email: rx }]
    }

    const users = await User.find(filter).sort('-createdAt')
    res.json({ users })
  } catch (err) {
    next(err)
  }
}

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, status } = req.body

    if (!isStr(name, 2, 80))
      return res.status(422).json({ message: 'Name must be 2-80 chars' })
    if (!isEmail(email))
      return res.status(422).json({ message: 'Valid email required' })
    if (!isStr(password, 6, 100))
      return res.status(422).json({ message: 'Password min 6 chars' })
    if (!isEnum(role, ['student', 'instructor', 'admin']))
      return res.status(422).json({ message: 'Invalid role' })
    if (status && !isEnum(status, ['approved', 'pending', 'blocked']))
      return res.status(422).json({ message: 'Invalid status' })

    const exists = await User.findOne({ email: email.trim().toLowerCase() })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      status: status || 'approved',
    })

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
}

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['approved', 'blocked', 'pending'].includes(status))
      return res.status(422).json({ message: 'Invalid status' })

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.role === 'admin')
      return res.status(403).json({ message: 'Cannot modify admin accounts' })

    if (user.role === 'student' && status === 'pending')
      return res.status(422).json({
        message: 'Students cannot be set to pending they are auto-approved.',
      })

    user.status = status
    await user.save()
    res.json({ user })
  } catch (err) {
    next(err)
  }
}

exports.listAllSets = async (req, res, next) => {
  try {
    const { status } = req.query
    const filter = {}
    if (status) filter.status = status

    const sets = await QuestionSet.find(filter)
      .populate('createdBy', 'name email')
      .sort('-createdAt')

    res.json({ sets })
  } catch (err) {
    next(err)
  }
}

exports.updateSetStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['approved', 'rejected', 'pending', 'archived'].includes(status))
      return res.status(422).json({ message: 'Invalid status' })

    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    set.status = status
    await set.save()
    res.json({ set })
  } catch (err) {
    next(err)
  }
}

exports.stats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalInstructors,
      totalAdmins,
      totalSets,
      pendingSets,
      approvedSets,
      archivedSets,
      totalAttempts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'instructor' }),
      User.countDocuments({ role: 'admin' }),
      QuestionSet.countDocuments({ status: { $ne: 'archived' } }),
      QuestionSet.countDocuments({ status: 'pending' }),
      QuestionSet.countDocuments({ status: 'approved' }),
      QuestionSet.countDocuments({ status: 'archived' }),
      Attempt.countDocuments(),
    ])

    const attempts = await Attempt.find({}, 'percentage')
    const averageScore = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
      : 0

    const categoryAgg = await Attempt.aggregate([
      {
        $lookup: {
          from: 'questionsets',
          localField: 'set',
          foreignField: '_id',
          as: 'setDoc',
        },
      },
      { $unwind: '$setDoc' },
      {
        $group: {
          _id: '$setDoc.category',
          attempts: { $sum: 1 },
          avgScore: { $avg: '$percentage' },
        },
      },
      { $sort: { attempts: -1 } },
    ])

    const mostPracticedCategory = categoryAgg[0]?._id || '—'

    const sortedByDifficulty = [...categoryAgg].sort(
      (a, b) => a.avgScore - b.avgScore
    )
    const mostDifficultCategory = sortedByDifficulty[0]?._id || '—'

    const recentUsers = await User.find().sort('-createdAt').limit(5)

    res.json({
      stats: {
        totalUsers,
        totalStudents,
        totalInstructors,
        totalAdmins,
        totalSets,
        approvedSets,
        pendingSets,
        archivedSets,
        totalAttempts,
        averageScore,
        mostPracticedCategory,
        mostDifficultCategory,
      },
      categoryBreakdown: categoryAgg,
      recentUsers,
    })
  } catch (err) {
    next(err)
  }
}