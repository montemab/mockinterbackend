const mongoose = require('mongoose')
const Attempt = require('../models/attempt')
const Question = require('../models/question')
const QuestionSet = require('../models/questionSet')
const { isNonNegInt } = require('../utils/validators')

const sanitizeQuestionForStudent = (q) => {
  if (!q || typeof q !== 'object') return q
  const o = { ...q }
  delete o.correctAnswer
  delete o.modelAnswer
  return o
}

exports.submitAttempt = async (req, res, next) => {
  try {
    const { setId, answers } = req.body

    if (!setId || !Array.isArray(answers))
      return res.status(422).json({ message: 'setId and answers required' })
    if (!mongoose.Types.ObjectId.isValid(setId))
      return res.status(422).json({ message: 'Invalid setId' })

    const set = await QuestionSet.findById(setId)
    if (!set) return res.status(404).json({ message: 'Set not found' })
    if (set.status !== 'approved')
      return res.status(403).json({ message: 'Set not approved' })

    const questions = await Question.find({ set: set._id })
    const expectedIds = new Set(questions.map((q) => q._id.toString()))

    const seen = new Set()
    const cleanedAnswers = []

    for (const a of answers) {
      if (!a || !a.question || !mongoose.Types.ObjectId.isValid(a.question))
        return res.status(422).json({ message: 'Invalid answer entry' })

      const id = a.question.toString()
      if (!expectedIds.has(id))
        return res
          .status(422)
          .json({ message: `Question ${id} is not part of this set` })
      if (seen.has(id))
        return res.status(422).json({ message: `Duplicate answer for question ${id}` })
      seen.add(id)

      if (typeof a.response !== 'string')
        return res.status(422).json({ message: 'Response must be a string' })

      const trimmed = a.response.trim()

      if (trimmed.length === 0)
        return res.status(422).json({
          message: `Question ${id} Submit an answer for every question.`,
        })

      cleanedAnswers.push({ question: id, response: trimmed })
    }

    if (seen.size !== expectedIds.size) {
      return res.status(422).json({
        message: `All ${expectedIds.size} questions must be answered. You sent ${seen.size}.`,
      })
    }

    const map = new Map(questions.map((q) => [q._id.toString(), q]))
    let autoScore = 0
    let totalMarks = 0
    let hasDescriptive = false
    const graded = []

    for (const q of questions) {
      totalMarks += q.marks
      if (q.type === 'descriptive') hasDescriptive = true
    }

    for (const a of cleanedAnswers) {
      const q = map.get(a.question)

      if (q.type === 'mcq') {
        const storedCorrect =
          typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : ''
        const isCorrect = a.response === storedCorrect
        const awarded = isCorrect ? q.marks : 0
        autoScore += awarded
        graded.push({
          question: q._id,
          response: a.response,
          isCorrect,
          awardedMarks: awarded,
          maxMarks: q.marks,
          gradedByInstructor: false,
        })
      } else {
        graded.push({
          question: q._id,
          response: a.response,
          isCorrect: null,
          awardedMarks: 0,
          maxMarks: q.marks,
          gradedByInstructor: false,
        })
      }
    }

    const percentage =
      totalMarks > 0 ? Math.round((autoScore / totalMarks) * 100) : 0

    const attempt = await Attempt.create({
      student: req.user._id,
      set: set._id,
      answers: graded,
      score: autoScore,
      totalMarks,
      percentage,
      needsGrading: hasDescriptive,
      gradingStatus: hasDescriptive ? 'pending' : 'graded',
    })

    res.status(201).json({ attempt })
  } catch (err) {
    next(err)
  }
}

exports.myAttempts = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id })
      .populate('set', 'title category difficulty')
      .sort('-completedAt')

    const total = attempts.length
    const avg = total
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / total)
      : 0
    const best = total ? Math.max(...attempts.map((a) => a.percentage)) : 0

    res.json({ attempts, stats: { total, average: avg, best } })
  } catch (err) {
    next(err)
  }
}

exports.getAttempt = async (req, res, next) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate('set', 'title category difficulty')
      .populate('student', 'name email')
      .populate('answers.question')

    if (!attempt) return res.status(404).json({ message: 'Attempt not found' })

    const ownsIt = attempt.student._id.toString() === req.user._id.toString()
    const isStudent = req.user.role === 'student'

    if (!ownsIt && isStudent)
      return res.status(403).json({ message: 'Forbidden' })

    const payload = attempt.toObject()
    if (isStudent) {
      payload.answers = payload.answers.map((a) => ({
        ...a,
        question: sanitizeQuestionForStudent(a.question),
      }))
    }

    res.json({ attempt: payload })
  } catch (err) {
    next(err)
  }
}

exports.gradeAttempt = async (req, res, next) => {
  try {
    const { grades } = req.body

    if (!Array.isArray(grades) || grades.length === 0)
      return res.status(422).json({ message: 'grades array required' })

    const attempt = await Attempt.findById(req.params.id).populate('set')
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' })

    if (
      req.user.role !== 'admin' &&
      attempt.set.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: 'Not your set' })

    if (attempt.gradingStatus === 'graded' && !attempt.needsGrading)
      return res.status(409).json({ message: 'Attempt does not need grading' })

    const answerById = new Map(
      attempt.answers.map((a) => [a.question.toString(), a])
    )
    const gradeMap = new Map()

    for (const g of grades) {
      if (!g || !g.questionId)
        return res
          .status(422)
          .json({ message: 'Each grade needs questionId and awardedMarks' })

      const qid = String(g.questionId)
      const ans = answerById.get(qid)

      if (!ans)
        return res
          .status(422)
          .json({ message: `Question ${qid} is not part of this attempt` })

      if (ans.isCorrect !== null)
        return res.status(422).json({
          message: `Question ${qid} is auto-graded (MCQ) and cannot be manually graded`,
        })

      if (gradeMap.has(qid))
        return res
          .status(422)
          .json({ message: `Duplicate grade for question ${qid}` })

      if (!isNonNegInt(g.awardedMarks))
        return res
          .status(422)
          .json({ message: `Invalid marks for question ${qid}` })

      const awarded = Number(g.awardedMarks)
      if (awarded > ans.maxMarks)
        return res.status(422).json({
          message: `Marks exceed max (${ans.maxMarks}) for question ${qid}`,
        })

      gradeMap.set(qid, awarded)
    }

    for (const [qid, awarded] of gradeMap) {
      const ans = answerById.get(qid)
      ans.awardedMarks = awarded
      ans.gradedByInstructor = true
    }

    const score = attempt.answers.reduce((s, a) => s + a.awardedMarks, 0)
    attempt.score = score
    attempt.percentage =
      attempt.totalMarks > 0 ? Math.round((score / attempt.totalMarks) * 100) : 0

    const allGraded = attempt.answers.every(
      (a) => a.isCorrect !== null || a.gradedByInstructor
    )

    if (allGraded) {
      attempt.gradingStatus = 'graded'
      attempt.needsGrading = false
      attempt.gradedBy = req.user._id
      attempt.gradedAt = new Date()
    } else {
      attempt.gradingStatus = 'pending'
      attempt.needsGrading = true
    }

    await attempt.save()
    res.json({ attempt })
  } catch (err) {
    next(err)
  }
}