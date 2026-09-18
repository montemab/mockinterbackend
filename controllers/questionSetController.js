const QuestionSet = require('../models/questionSet')
const Question = require('../models/question')
const Attempt = require('../models/attempt')
const {
  isStr,
  isEnum,
  isPositiveInt,
  isOptionalStr,
  escapeRegex,
} = require('../utils/validators')

const CATEGORIES = ['React', 'JavaScript', 'Node.js', 'MongoDB', 'DSA', 'CSS', 'HR', 'Other']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

const normalizeMcqOptions = (rawOptions, rawCorrect) => {
  if (!Array.isArray(rawOptions) || rawOptions.length < 2)
    return { ok: false, message: 'needs at least 2 options' }

  const cleaned = rawOptions.map((o) => (typeof o === 'string' ? o.trim() : ''))

  if (cleaned.some((o) => o.length === 0))
    return { ok: false, message: 'you cannot leave any selection completely blank' }

  if (cleaned.some((o) => o.length > 300))
    return { ok: false, message: 'Each option must be ≤ 300 characters' }

  if (new Set(cleaned).size !== cleaned.length)
    return { ok: false, message: 'Options must be unique' }

  const cleanCorrect = typeof rawCorrect === 'string' ? rawCorrect.trim() : ''

  if (!cleanCorrect || !cleaned.includes(cleanCorrect))
    return { ok: false, message: 'Correct answer must match one option' }

  return { ok: true, options: cleaned, correctAnswer: cleanCorrect }
}

exports.listSets = async (req, res, next) => {
  try {
    const { category, difficulty, search } = req.query
    const filter = {}

    if (req.user.role === 'student') filter.status = 'approved'
    else if (req.user.role === 'instructor') {
      filter.createdBy = req.user._id
      filter.status = { $ne: 'archived' }
    }

    if (category) filter.category = category
    if (difficulty) filter.difficulty = difficulty
    if (search && search.trim())
      filter.title = { $regex: escapeRegex(search.trim()), $options: 'i' }

    const sets = await QuestionSet.find(filter)
      .populate('createdBy', 'name')
      .sort('-createdAt')

    const counts = await Question.aggregate([
      { $group: { _id: '$set', count: { $sum: 1 } } },
    ])
    const map = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]))
    const data = sets.map((s) => ({
      ...s.toObject(),
      questionCount: map[s._id.toString()] || 0,
    }))

    res.json({ sets: data })
  } catch (err) {
    next(err)
  }
}

exports.getSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id).populate('createdBy', 'name')
    if (!set) return res.status(404).json({ message: 'Question set not found' })

    if (req.user.role === 'student' && set.status !== 'approved')
      return res.status(403).json({ message: 'Set not available' })

    if (
      req.user.role === 'instructor' &&
      set.createdBy._id.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Not your set' })

    const questions = await Question.find({ set: set._id }).sort('createdAt')

    const safeQuestions =
      req.user.role === 'student'
        ? questions.map((q) => {
            const o = q.toObject()
            delete o.correctAnswer
            delete o.modelAnswer
            return o
          })
        : questions

    res.json({ set, questions: safeQuestions })
  } catch (err) {
    next(err)
  }
}

exports.createSet = async (req, res, next) => {
  try {
    const { title, description, category, difficulty } = req.body

    if (!isStr(title, 3, 120))
      return res.status(422).json({ message: 'Title must be 3-120 chars' })
    if (!isOptionalStr(description, 500))
      return res.status(422).json({ message: 'Description must be ≤ 500 chars' })
    if (category !== undefined && !isEnum(category, CATEGORIES))
      return res.status(422).json({ message: 'Invalid category' })
    if (difficulty !== undefined && !isEnum(difficulty, DIFFICULTIES))
      return res.status(422).json({ message: 'Invalid difficulty' })

    const set = await QuestionSet.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      category,
      difficulty,
      createdBy: req.user._id,
      status: req.user.role === 'admin' ? 'approved' : 'pending',
    })
    res.status(201).json({ set })
  } catch (err) {
    next(err)
  }
}

exports.updateSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    if (set.status === 'archived') {
  return res.status(409).json({
    message: 'Archived sets are read-only. Create a new set or manage an active version instead.',
  })
}

    const { title, description, category, difficulty } = req.body

    if (title !== undefined && !isStr(title, 3, 120))
      return res.status(422).json({ message: 'Title must be 3-120 chars' })
    if (!isOptionalStr(description, 500))
      return res.status(422).json({ message: 'Description must be ≤ 500 chars' })
    if (category !== undefined && !isEnum(category, CATEGORIES))
      return res.status(422).json({ message: 'Invalid category' })
    if (difficulty !== undefined && !isEnum(difficulty, DIFFICULTIES))
      return res.status(422).json({ message: 'Invalid difficulty' })

    if (title !== undefined) set.title = title.trim()
    if (description !== undefined) set.description = description.trim()
    if (category !== undefined) set.category = category
    if (difficulty !== undefined) set.difficulty = difficulty

    if (
  req.user.role !== 'admin' &&
  (set.status === 'approved' || set.status === 'rejected')
) {
  set.status = 'pending'
}

    await set.save()
    res.json({ set })
  } catch (err) {
    next(err)
  }
}

exports.deleteSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    const attemptCount = await Attempt.countDocuments({ set: set._id })
    if (attemptCount > 0) {
      return res.status(409).json({
        message: `Cannot delete: ${attemptCount} student attempt(s) exist. Archive it instead.`,
        canArchive: true,
        attemptCount,
      })
    }

    await Question.deleteMany({ set: set._id })
    await set.deleteOne()

    res.json({ message: 'Set deleted' })
  } catch (err) {
    next(err)
  }
}

exports.archiveSet = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    set.status = 'archived'
    await set.save()
    res.json({ set, message: 'Set archived' })
  } catch (err) {
    next(err)
  }
}

exports.addQuestion = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    if (set.status === 'archived') {
      return res.status(409).json({
    message:
      'Archived sets are read-only. Restore or create an active set before adding questions.',
  })
}

    let { type, text, options, correctAnswer, modelAnswer, marks } = req.body

    if (!isEnum(type, ['mcq', 'descriptive']))
      return res.status(422).json({ message: 'Invalid question type' })
    if (!isStr(text, 3, 200))
      return res.status(422).json({ message: 'Question text must be 3-200 chars' })
    if (!isPositiveInt(marks))
      return res.status(422).json({ message: 'Marks must be a positive integer' })
    if (!isOptionalStr(modelAnswer, 500))
      return res.status(422).json({ message: 'Model answer too long' })

    if (type === 'mcq') {
      const result = normalizeMcqOptions(options, correctAnswer)
      if (!result.ok)
        return res.status(422).json({ message: result.message })
      options = result.options
      correctAnswer = result.correctAnswer
    }

    const question = await Question.create({
      set: set._id,
      type,
      text: text.trim(),
      options: type === 'mcq' ? options : [],
      correctAnswer: type === 'mcq' ? correctAnswer : '',
      modelAnswer:
        type === 'descriptive' && modelAnswer ? modelAnswer.trim() : '',
      marks: Number(marks),
    })

    if (
  req.user.role !== 'admin' &&
  (set.status === 'approved' || set.status === 'rejected')
) {
  set.status = 'pending'
  await set.save()
}

    res.status(201).json({ question })
  } catch (err) {
    next(err)
  }
}

exports.updateQuestion = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    if (set.status === 'archived') {
      return res.status(409).json({
    message:
      'Archived sets are read-only. Restore or create an active set before editing questions.',
  })
}

    const question = await Question.findOne({ _id: req.params.qid, set: set._id })
    if (!question) return res.status(404).json({ message: 'Question not found' })

    const { text, options, correctAnswer, modelAnswer, marks } = req.body

    if (text !== undefined && !isStr(text, 3, 1000))
      return res.status(422).json({ message: 'Question text must be 3-1000 chars' })
    if (marks !== undefined && !isPositiveInt(marks))
      return res.status(422).json({ message: 'Marks must be a positive integer' })
    if (!isOptionalStr(modelAnswer, 2000))
      return res.status(422).json({ message: 'Model answer too long' })

    let nextOptions = options !== undefined ? options : question.options
    let nextCorrect =
      correctAnswer !== undefined ? correctAnswer : question.correctAnswer

    if (question.type === 'mcq') {
      const result = normalizeMcqOptions(nextOptions, nextCorrect)
      if (!result.ok)
        return res.status(422).json({ message: result.message })
      nextOptions = result.options
      nextCorrect = result.correctAnswer
    }

    if (text !== undefined) question.text = text.trim()
    if (question.type === 'mcq') {
      question.options = nextOptions
      question.correctAnswer = nextCorrect
    }
    if (modelAnswer !== undefined)
      question.modelAnswer = modelAnswer ? modelAnswer.trim() : ''
    if (marks !== undefined) question.marks = Number(marks)

    await question.save()

    if (
  req.user.role !== 'admin' &&
  (set.status === 'approved' || set.status === 'rejected')
) {
  set.status = 'pending'
  await set.save()
}

    res.json({ question })
  } catch (err) {
    next(err)
  }
}

exports.deleteQuestion = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    if (set.status === 'archived') {
      return res.status(409).json({
    message: 'Archived sets are read-only. Archived questions cannot be deleted.',
  })
}

    const result = await Question.deleteOne({ _id: req.params.qid, set: set._id })
    if (!result.deletedCount)
      return res.status(404).json({ message: 'Question not found' })

    if (
      req.user.role !== 'admin' &&
    (set.status === 'approved' || set.status === 'rejected')
) {
      set.status = 'pending'
      await set.save()
    }

    res.json({ message: 'Question deleted' })
  } catch (err) {
    next(err)
  }
}

exports.getSetPerformance = async (req, res, next) => {
  try {
    const set = await QuestionSet.findById(req.params.id)
    if (!set) return res.status(404).json({ message: 'Set not found' })

    if (
      req.user.role !== 'admin' &&
      set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Forbidden' })

    const attempts = await Attempt.find({ set: set._id })
      .populate('student', 'name email')
      .sort('-completedAt')

    const attemptsDto = attempts.map((a) => ({
      _id: a._id,
      student: {
        _id: a.student?._id,
        name: a.student?.name,
        email: a.student?.email,
      },
      score: a.score,
      totalMarks: a.totalMarks,
      percentage: a.percentage,
      gradingStatus: a.gradingStatus,
      needsGrading: a.needsGrading,
      completedAt: a.completedAt,
    }))

    const avg = attemptsDto.length
      ? Math.round(
          attemptsDto.reduce((s, a) => s + a.percentage, 0) / attemptsDto.length
        )
      : 0

    const pendingGrading = attemptsDto.filter(
      (a) => a.gradingStatus === 'pending'
    ).length

    res.json({
      attempts: attemptsDto,
      averagePercentage: avg,
      totalAttempts: attemptsDto.length,
      pendingGrading,
    })
  } catch (err) {
    next(err)
  }
}